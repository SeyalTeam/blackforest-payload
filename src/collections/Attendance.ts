import type { CollectionConfig } from 'payload'

const Attendance: CollectionConfig = {
  slug: 'attendance',
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['user', 'employee', 'date', 'activities'],
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data) return data;
        
        // Requirement: Enforce selfie for sessions
        if (data.activities && Array.isArray(data.activities)) {
          for (const activity of data.activities) {
            if (activity.type === 'session' && !activity.capturedImage) {
              throw new Error('A selfie (captured image) is strictly required to start a session. Invalid request blocked.');
            }
          }
        }

        // Requirement 3: Enforce Unique Daily Logs
        if (operation === 'create' && data.user && data.dateString) {
          const existing = await req.payload.find({
            collection: 'attendance',
            where: {
              and: [
                {
                  user: { equals: data.user },
                },
                {
                  dateString: { equals: data.dateString },
                },
              ],
            },
            limit: 1,
          })
          if (existing.docs.length > 0) {
            throw new Error(`An attendance record for user on ${data.dateString} already exists.`)
          }
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        try {
          if (!doc.user || !doc.dateString || !doc.activities) return;
          
          const sessionActivities = doc.activities.filter((a: any) => a.type === 'session');
          if (sessionActivities.length === 0) return;

          const records = sessionActivities.map((a: any) => ({
            punchIn: a.punchIn,
            punchOut: a.punchOut,
            photo: a.capturedImage,
          }));

          const existingPunchIn = await req.payload.find({
            collection: 'punchin',
            where: {
              and: [
                { user: { equals: typeof doc.user === 'string' ? doc.user : doc.user.id } },
                { dateString: { equals: doc.dateString } }
              ]
            },
            limit: 1
          });

          if (existingPunchIn.docs.length > 0) {
            await req.payload.update({
              collection: 'punchin',
              id: existingPunchIn.docs[0].id,
              data: { records }
            });
          } else {
            await req.payload.create({
              collection: 'punchin',
              data: {
                user: typeof doc.user === 'string' ? doc.user : doc.user.id,
                dateString: doc.dateString,
                records
              }
            });
          }
        } catch (e) {
          console.error('Error syncing Attendance to PunchIn:', e);
        }
      }
    ],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data;
        
        // Requirement 2: Close Previous Sessions on New "Punch In"
        if (data.activities && Array.isArray(data.activities)) {
          let lastActiveIndex = -1;
          let hasActive = false;
          for (let i = data.activities.length - 1; i >= 0; i--) {
             if (data.activities[i].status === 'active') {
                 if (lastActiveIndex === -1) {
                     lastActiveIndex = i;
                     hasActive = true;
                 } else {
                     data.activities[i].status = 'closed';
                     if (!data.activities[i].punchOut) {
                         data.activities[i].punchOut = new Date().toISOString();
                     }
                     if (data.activities[i].punchIn && data.activities[i].punchOut) {
                         const duration = Math.floor((new Date(data.activities[i].punchOut).getTime() - new Date(data.activities[i].punchIn).getTime()) / 1000);
                         data.activities[i].durationSeconds = duration > 0 ? duration : 0;
                     }
                 }
             }
          }

          // Auto-calculate breakDurationSeconds for each session activity
          // Break = gap between previous session's punchOut and this session's punchIn
          const sessionActivities = data.activities.filter((a: any) => a.type === 'session');
          for (let i = 1; i < sessionActivities.length; i++) {
            const prev = sessionActivities[i - 1];
            const curr = sessionActivities[i];
            if (prev.punchOut && curr.punchIn && !curr.breakDurationSeconds) {
              const breakSecs = Math.floor(
                (new Date(curr.punchIn).getTime() - new Date(prev.punchOut).getTime()) / 1000
              );
              curr.breakDurationSeconds = breakSecs > 0 ? breakSecs : 0;
            }
          }
          
          if (hasActive && data.user) {
            try {
              const activeDocs = await req.payload.find({
                collection: 'attendance',
                where: {
                  user: { equals: data.user }
                },
                limit: 100
              })
              
              for (const doc of activeDocs.docs) {
                if (operation === 'update' && originalDoc && doc.id === originalDoc.id) continue;
                
                let needsUpdate = false;
                const updatedActivities = (doc.activities || []).map((act: any) => {
                  if (act.status === 'active') {
                    needsUpdate = true;
                    const punchOut = new Date().toISOString();
                    let durationSeconds = 0;
                    if (act.punchIn) {
                      durationSeconds = Math.floor((new Date(punchOut).getTime() - new Date(act.punchIn).getTime()) / 1000);
                    }
                    return {
                      ...act,
                      status: 'closed',
                      punchOut,
                      durationSeconds: durationSeconds > 0 ? durationSeconds : 0
                    }
                  }
                  return act;
                });
                
                if (needsUpdate) {
                  await req.payload.update({
                    collection: 'attendance',
                    id: doc.id,
                    data: { activities: updatedActivities }
                  });
                }
              }
            } catch (err) {
              console.error('Error auto-closing previous sessions:', err);
            }
          }
        }
        return data;
      },
    ],

  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (['superadmin', 'admin', 'company', 'account'].includes(user.role)) return true
      if (user.role === 'branch') {
        return {
          'user.branch': {
            equals: user.branch,
          },
        } as any // Cast to any/Where to satisfy Payload types
      }
      return {
        user: {
          equals: user.id,
        },
      } as any
    },
    create: ({ req: { user } }) => !!user, // Any logged in user can create an entry (punch)
    update: ({ req: { user } }) => {
      if (!user) return false
      if (['superadmin', 'admin', 'account'].includes(user.role)) return true
      return {
        user: {
          equals: user.id,
        },
      } as any
    },
    delete: ({ req: { user } }) =>
      user?.role ? ['superadmin', 'admin'].includes(user.role) : false,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      index: true,
      admin: {
        description: 'The employee matched via face recognition',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'The local date this log represents (normalized to midnight)',
      },
      defaultValue: () => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d
      },
    },
    {
      name: 'dateString',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'YYYY-MM-DD format (timezone independent)',
      },
    },
    {
      name: 'activities',
      type: 'array',
      fields: [
        {
          name: 'type',
          type: 'select',
          options: [
            { label: 'Session', value: 'session' },
            { label: 'Break', value: 'break' },
          ],
          required: true,
        },
        {
          name: 'punchIn',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
              displayFormat: 'yyyy-MM-dd HH:mm:ss',
            },
          },
        },
        {
          name: 'punchOut',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
              displayFormat: 'yyyy-MM-dd HH:mm:ss',
            },
          },
        },
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Closed', value: 'closed' },
          ],
          defaultValue: 'active',
        },
        {
          name: 'durationSeconds',
          type: 'number',
          admin: {
            description: 'Work duration of this session in seconds',
          },
        },
        {
          name: 'breakDurationSeconds',
          type: 'number',
          admin: {
            description: 'Break duration before this session started (gap from previous session punchOut to this punchIn), in seconds. Auto-calculated by the server.',
          },
        },

        {
          name: 'ipAddress',
          type: 'text',
        },
        {
          name: 'device',
          type: 'text',
        },
        {
          name: 'capturedImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Selfie captured during face recognition punch',
            condition: (data, siblingData) => siblingData?.type === 'session',
          },
          validate: (value: any, { siblingData }: any) => {
            if (siblingData?.type === 'session' && !value) {
              return 'A selfie (captured image) is required to start a session.';
            }
            return true;
          },
        },
        {
          name: 'latitude',
          type: 'number',
        },
        {
          name: 'longitude',
          type: 'number',
        },
      ],
    },
    // Keep old fields for backward compatibility during transition (set to hidden/optional)
    {
      name: 'punchIn',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'punchOut',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { hidden: true },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Login (Punch In)', value: 'in' },
        { label: 'Logout (Punch Out)', value: 'out' },
      ],
      admin: { hidden: true },
    },
    {
      name: 'timestamp',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'ipAddress',
      type: 'text',
    },
    {
      name: 'device',
      type: 'text',
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'latitude',
          type: 'number',
        },
        {
          name: 'longitude',
          type: 'number',
        },
      ],
    },
  ],
}

export default Attendance
