import { CollectionConfig } from 'payload'
import type { Where } from 'payload'

const ReturnOrders: CollectionConfig = {
  slug: 'return-orders',
  admin: {
    useAsTitle: 'returnNumber',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'superadmin') return true

      if (user?.role === 'company') {
        const company = user.company
        if (!company) return false
        let companyId: string
        if (typeof company === 'string') companyId = company
        else if (
          typeof company === 'object' &&
          company !== null &&
          'id' in company &&
          typeof company.id === 'string'
        )
          companyId = company.id
        else return false

        return { company: { equals: companyId } } as Where
      }

      if (user?.role === 'branch' || user?.role === 'waiter') {
        const branch = user.branch
        if (!branch) return false
        let branchId: string
        if (typeof branch === 'string') branchId = branch
        else if (
          typeof branch === 'object' &&
          branch !== null &&
          'id' in branch &&
          typeof branch.id === 'string'
        )
          branchId = branch.id
        else return false

        return { branch: { equals: branchId } } as Where
      }

      return false
    },
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) => user?.role === 'superadmin',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },

  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create') {
          // === AUTO-GENERATE UNIQUE RETURN NUMBER ===
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')

          // Fetch branch info
          let branchCode = 'BRANCH'
          if (data.branch) {
            const branch = await req.payload.findByID({
              collection: 'branches',
              id: typeof data.branch === 'string' ? data.branch : data.branch.id,
              depth: 0,
            })

            if (branch && branch.name) {
              // use branch name (shortened) for unique prefix
              branchCode = branch.name.replace(/\s+/g, '').toUpperCase().slice(0, 6)
            }

            // Auto-set company from branch
            if (branch?.company) {
              let companyToSet = branch.company
              if (
                typeof companyToSet === 'object' &&
                companyToSet !== null &&
                'id' in companyToSet &&
                typeof companyToSet.id === 'string'
              ) {
                companyToSet = companyToSet.id
              }
              if (typeof companyToSet === 'string') {
                data.company = companyToSet
              }
            }
          }

          // Count existing returns for same date + branch
          const existingCount = await req.payload.db.collections['return-orders'].countDocuments({
            returnNumber: { $regex: `^RET-${formattedDate}-${branchCode}-` },
          })

          const seq = (existingCount + 1).toString().padStart(3, '0')

          // Final unique return number
          data.returnNumber = `RET-${formattedDate}-${branchCode}-${seq}`
        }

        // === Recalculate total if items updated ===
        if (data.items) {
          data.totalAmount = data.items.reduce(
            (sum: number, item: any) => sum + (item.subtotal || 0),
            0,
          )
        }

        return data
      },
    ],
  },

  fields: [
    {
      name: 'returnNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { readOnly: true },
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
          admin: { readOnly: true },
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { readOnly: true },
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
          admin: { readOnly: true },
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true },
        },
        {
          name: 'subtotal',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      min: 0,
      admin: { readOnly: true },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      defaultValue: ({ user }) => user?.id,
      admin: { readOnly: true },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Returned', value: 'returned' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],

  timestamps: true,
}

export default ReturnOrders
