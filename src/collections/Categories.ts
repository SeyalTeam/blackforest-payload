import { CollectionConfig, PayloadRequest, Where } from 'payload' // Added Where import for type safety in filterOptions

// Assuming Company is exported from Companies.ts; if not, define a simple interface
// interface Company {
//   id: string
//   // Add other fields if needed for typing
// }

const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    group: 'Inventory',
    defaultColumns: ['name', 'company', 'isBilling', 'isCake', 'isStock'],
  },
  access: {
    read: () => true,
    create: ({ req }: { req: PayloadRequest }) =>
      req.user?.role === 'superadmin' || req.user?.role === 'company',
    update: ({ req }: { req: PayloadRequest }) =>
      req.user?.role === 'superadmin' || req.user?.role === 'company',
    delete: ({ req }: { req: PayloadRequest }) => req.user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'isBilling', // Consistent with your JSON; rename if typo
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'isCake',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'isStock',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      hasMany: true,
      filterOptions: async ({ req }: { req: PayloadRequest }): Promise<Where | boolean> => {
        // Consistent typing
        const user = req.user
        if (user?.role === 'superadmin') return true // Allow all (true = no filter)
        if (user?.role === 'company') {
          // Type guard for company
          const company = user.company
          const companyId =
            typeof company === 'object' && company !== null
              ? company.id
              : (company as string | undefined)
          if (!companyId) return false
          return { id: { equals: companyId } } as Where // Explicit cast for TS safety
        }
        return false // Deny for others
      },
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      required: false,
      admin: {
        condition: (data) => data.company && data.company.length > 0,
      },
      filterOptions: ({ data }): false | Where => {
        // Sync version; no Promise needed here as it's not async
        if (!data?.company || data.company.length === 0) return false
        return { company: { in: data.company } }
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req: _req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          if (!data.company || data.company.length === 0) {
            throw new Error('At least one company must be selected.')
          }
        }
        return data
      },
    ],
  },
  timestamps: true,
}

export default Categories
