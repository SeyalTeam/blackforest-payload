import type { CollectionConfig } from 'payload'

export const Branches: CollectionConfig = {
  slug: 'branches',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'address',
      type: 'text',
      required: true,
    },
    {
      name: 'gst',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: () => true,
    update: ({ req, id }): boolean | import('payload').Where => {
      // Sync, explicit type
      if (!req.user) return false
      if (req.user.role === 'superadmin') return true
      if (req.user.role === 'branch') {
        if (!req.user.branch) return false // Null guard
        const userBranchId =
          typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
        return { id: { equals: userBranchId } } // Own branch only
      }
      return false
    },
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
}
