import type { CollectionConfig } from 'payload'

const Attendance: CollectionConfig = {
  slug: 'attendance',
  admin: {
    useAsTitle: 'timestamp',
    defaultColumns: ['user', 'type', 'timestamp', 'ipAddress'],
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
    update: ({ req: { user } }) =>
      user?.role ? ['superadmin', 'admin'].includes(user.role) : false, // Only admins edit history
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
      name: 'type',
      type: 'select',
      options: [
        { label: 'Login (Punch In)', value: 'in' },
        { label: 'Logout (Punch Out)', value: 'out' },
        { label: 'Break Start', value: 'break-start' }, // Reserved for explicit breaks
        { label: 'Break End', value: 'break-end' }, // Reserved for explicit breaks
      ],
      required: true,
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
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
