import type { CollectionConfig } from 'payload'

const PunchIn: CollectionConfig = {
  slug: 'punchin',
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['user', 'date', 'photo'],
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
    create: ({ req: { user } }) => !!user, // Any logged in user can create an entry
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
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'The exact date and time the user punched in',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Selfie captured during punch in',
      },
    },
  ],
}

export default PunchIn
