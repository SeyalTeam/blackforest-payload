// src/collections/ReturnOrders.ts
import { CollectionConfig, AccessArgs, Where } from 'payload'
import { ObjectId } from 'mongodb'

const ReturnOrders: CollectionConfig = {
  slug: 'return-orders',
  admin: {
    useAsTitle: 'returnNumber',
  },
  access: {
    read: () => true,
    create: ({ req }: AccessArgs<any>) => {
      const user = req.user
      return !!user && ['branch', 'waiter'].includes(user.role)
    },

    update: async ({ req, id }: AccessArgs<any>) => {
      const user = req.user
      if (!user) return false

      if (user.role === 'superadmin') return true

      if (['branch', 'waiter'].includes(user.role)) {
        const branch = user.branch
        if (!branch) return false

        let userBranchId: string
        if (typeof branch === 'string') userBranchId = branch
        else if (typeof branch === 'object' && branch !== null && 'id' in branch)
          userBranchId = (branch as any).id
        else return false

        const doc = await req.payload.findByID({
          collection: 'return-orders',
          id: id as string,
          depth: 0,
        })

        let docBranchId: string | undefined
        const docBranch = doc?.branch
        if (typeof docBranch === 'string') docBranchId = docBranch
        else if (typeof docBranch === 'object' && docBranch !== null && 'id' in docBranch)
          docBranchId = (docBranch as any).id

        return (
          docBranchId === userBranchId && (doc?.status === 'pending' || doc?.status === undefined)
        )
      }

      return false
    },

    delete: ({ req }: AccessArgs<any>) => req.user?.role === 'superadmin',
  },

  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (operation === 'create') {
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')

          const existingCount = await req.payload.db.collections['return-orders'].countDocuments({
            returnNumber: { $regex: `^RET-${formattedDate}-` },
          })

          const seq = (existingCount + 1).toString().padStart(3, '0')
          data.returnNumber = `RET-${formattedDate}-${seq}`
          data.date = date.toISOString().slice(0, 10)

          // Auto-set company from branch
          if (data.branch) {
            let branchId: string
            if (typeof data.branch === 'string') branchId = data.branch
            else if (typeof data.branch === 'object' && data.branch !== null && 'id' in data.branch)
              branchId = (data.branch as any).id
            else return data

            const branchDoc = await req.payload.db.collections['branches'].findOne(
              { _id: new ObjectId(branchId) },
              { projection: { company: 1 } },
            )

            const company = branchDoc?.company
            if (company) {
              let companyId: string
              if (typeof company === 'string') companyId = company
              else if (typeof company === 'object' && company !== null && 'id' in company)
                companyId = (company as any).id
              else return data

              data.company = companyId
            }
          }
        }

        if (operation === 'update') {
          if (originalDoc?.status !== 'pending') {
            throw new Error('Cannot update non-pending return orders')
          }
        }

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
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'yyyy-MM-dd',
        },
        readOnly: true,
      },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'subtotal',
          type: 'number',
          required: true,
          min: 0,
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
        { label: 'Returned', value: 'returned' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],

  timestamps: true,

  indexes: [
    {
      fields: ['branch', 'date', 'status'],
      unique: true,
      // @ts-expect-error: partialFilterExpression is a valid MongoDB option but not typed in Payload
      partialFilterExpression: { status: 'pending' },
    },
  ],
}

export default ReturnOrders
