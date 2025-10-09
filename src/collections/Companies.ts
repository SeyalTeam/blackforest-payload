import type { CollectionConfig } from 'payload'

export const Companies: CollectionConfig = {
  slug: 'companies',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'hqAddress',
      type: 'text',
      required: false,
    },
    {
      name: 'gst',
      type: 'text',
      required: false,
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: async ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'superadmin' || req.user.role === 'admin') return true
      if (req.user.role === 'branch' && req.user.branch) {
        let branchCompany: string | undefined
        if (typeof req.user.branch === 'string') {
          const branch = await req.payload.findByID({
            collection: 'branches',
            id: req.user.branch,
            depth: 0, // No need for deep population
          })
          branchCompany = branch?.company as string | undefined
        } else {
          branchCompany = req.user.branch.company as string | undefined
        }
        if (branchCompany) {
          return { id: { equals: branchCompany } }
        }
        return false
      }
      return false // Delivery none
    },
    update: ({ req }) => req.user?.role === 'superadmin',
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
}
