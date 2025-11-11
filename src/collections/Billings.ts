import { CollectionConfig } from 'payload'

const Billings: CollectionConfig = {
  slug: 'billings',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) => user?.role === 'superadmin',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create') {
          // 🧾 Auto-generate invoice number like CHI-YYYYMMDD-SEQ
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')

          if (data.branch) {
            let branchId: string

            if (typeof data.branch === 'string') {
              branchId = data.branch
            } else if (
              typeof data.branch === 'object' &&
              data.branch !== null &&
              'id' in data.branch &&
              typeof data.branch.id === 'string'
            ) {
              branchId = data.branch.id
            } else {
              return data
            }

            const branch = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })

            if (branch?.name) {
              const prefix = branch.name.substring(0, 3).toUpperCase()
              const existingCount = await req.payload.db.collections.billings.countDocuments({
                invoiceNumber: { $regex: `^${prefix}-${formattedDate}-` },
              })
              const seq = (existingCount + 1).toString().padStart(3, '0')
              data.invoiceNumber = `${prefix}-${formattedDate}-${seq}`
            }

            // 🏢 Auto-set company from branch
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
        }

        // 🧮 Auto-calculate subtotals & total
        if (data.items && Array.isArray(data.items)) {
          data.items = data.items.map((item: any) => {
            const qty = parseFloat(item.quantity) || 0
            const unitPrice = parseFloat(item.unitPrice) || 0
            return {
              ...item,
              subtotal: parseFloat((qty * unitPrice).toFixed(2)),
            }
          })

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
      name: 'invoiceNumber',
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
          // ✅ Fractional quantities (e.g. 0.5 kg)
          name: 'quantity',
          type: 'number',
          required: true,
          min: 0.01,
          validate: (val?: number | null) => {
            if (typeof val !== 'number' || val <= 0) {
              return 'Quantity must be greater than 0'
            }
            return true
          },
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          // ✅ Calculated automatically
          name: 'subtotal',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true },
        },
        {
          name: 'branchOverride',
          type: 'checkbox',
          label: 'Branch-Specific Override Applied',
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
      name: 'customerDetails',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'address', type: 'text' },
      ],
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Card', value: 'card' },
        { label: 'UPI', value: 'upi' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' },
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

export default Billings
