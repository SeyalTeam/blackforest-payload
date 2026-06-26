import { CollectionConfig, PayloadRequest, Where } from 'payload'

const RawMaterialCategories: CollectionConfig = {
  slug: 'raw-material-categories',
  admin: {
    useAsTitle: 'name',
    group: 'Inventory',
    defaultColumns: ['name', 'company'],
  },
  access: {
    read: () => true,
    create: ({ req }: { req: PayloadRequest }) =>
      req.user?.role === 'superadmin' ||
      req.user?.role === 'company' ||
      req.user?.role === 'branch',
    update: ({ req }: { req: PayloadRequest }) =>
      req.user?.role === 'superadmin' || req.user?.role === 'company',
    delete: ({ req }: { req: PayloadRequest }) => req.user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      hasMany: true,
      required: true,
      label: 'Associated Companies',
      filterOptions: async ({ req }: { req: PayloadRequest }): Promise<Where | boolean> => {
        const user = req.user
        if (user?.role === 'superadmin') return true
        if (user?.role === 'company') {
          const company = user.company
          const companyId =
            typeof company === 'object' && company !== null
              ? company.id
              : (company as string | undefined)
          if (!companyId) return false
          return { id: { equals: companyId } } as Where
        }
        if (user?.role === 'branch') {
          const branchId = typeof user.branch === 'string' ? user.branch : user.branch?.id
          if (!branchId) return false

          const branch = await req.payload.findByID({
            collection: 'branches',
            id: branchId,
            depth: 0,
          })

          const companyId =
            typeof branch.company === 'object' && branch.company !== null
              ? branch.company.id
              : (branch.company as string | undefined)
          if (!companyId) return false

          return { id: { equals: companyId } } as Where
        }
        return false
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          if (!data.company || data.company.length === 0) {
            throw new Error('At least one company must be selected.')
          }
        }
        if (operation === 'update') {
          if (data.company !== undefined && (!data.company || data.company.length === 0)) {
            throw new Error('At least one company must be selected.')
          }
        }
        return data
      },
    ],
  },
  timestamps: true,
}

export default RawMaterialCategories
