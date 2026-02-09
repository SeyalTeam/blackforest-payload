import type { CollectionConfig } from 'payload'

const Attendance: CollectionConfig = {
  slug: 'attendance',
  admin: {
    useAsTitle: 'punchIn',
    defaultColumns: ['user', 'punchIn', 'punchOut', 'status', 'ipAddress'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (['superadmin', 'admin', 'company'].includes(user.role)) return true
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
      if (['superadmin', 'admin'].includes(user.role)) return true
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
        },
        {
          name: 'punchOut',
          type: 'date',
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
        },
        {
          name: 'ipAddress',
          type: 'text',
        },
        {
          name: 'device',
          type: 'text',
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
