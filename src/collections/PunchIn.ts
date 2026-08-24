import type { CollectionConfig } from 'payload'

const PunchIn: CollectionConfig = {
  slug: 'punchin',
  admin: {
    useAsTitle: 'dateString',
    defaultColumns: ['user', 'dateString'],
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
        } as any
      }
      return {
        user: {
          equals: user.id,
        },
      } as any
    },
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
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
      name: 'dateString',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Format: YYYY-MM-DD. Ensures one document per user per day.',
      },
    },
    {
      name: 'records',
      type: 'array',
      fields: [
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
          name: 'photo',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
  ],
}

export default PunchIn
