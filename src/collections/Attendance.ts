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
      name: 'punchIn',
      type: 'date',
      required: false,
      index: true,
      admin: {
        description: 'Time when the user punched in',
      },
    },
    {
      name: 'punchOut',
      type: 'date',
      required: false,
      admin: {
        description: 'Time when the user punched out',
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
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Login (Punch In)', value: 'in' },
        { label: 'Logout (Punch Out)', value: 'out' },
        { label: 'Break Start', value: 'break-start' },
        { label: 'Break End', value: 'break-end' },
      ],
      required: false, // Made optional for backward compat
      admin: {
        hidden: true,
      },
    },
    {
      name: 'timestamp',
      type: 'date',
      required: false, // Made optional for backward compat
      defaultValue: () => new Date(),
      admin: {
        hidden: true,
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
