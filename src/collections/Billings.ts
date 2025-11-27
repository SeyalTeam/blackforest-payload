import { CollectionConfig } from 'payload'

const Billings: CollectionConfig = {
  slug: 'billings',

  admin: {
    useAsTitle: 'invoiceNumber',
  },

  // ----------------------------------------------------------
  // ACCESS RULES
  // ----------------------------------------------------------
  access: {
    read: () => true,

    create: ({ req }) => req.user?.role != null && ['branch', 'waiter'].includes(req.user.role),

    update: ({ req }) => {
      const role = req.user?.role
      const data = req.data as { paymentMethod?: string } | undefined

      // ✔ Superadmin has full update access
      if (role === 'superadmin') return true

      // ✔ Waiter + Branch → ONLY update `paymentMethod`
      if (
        role && // <--- FIXED
        ['branch', 'waiter'].includes(role) && // <--- FIXED
        data &&
        typeof data.paymentMethod === 'string' &&
        Object.keys(data).length === 1
      ) {
        return true
      }

      return false
    },

    delete: ({ req }) => req.user?.role === 'superadmin',
  },

  // ----------------------------------------------------------
  // HOOKS
  // ----------------------------------------------------------
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        const payload = req.payload

        // ----------------------------------------------------------
        // 1. AUTO-GENERATE INVOICE NUMBER
        // ----------------------------------------------------------
        if (operation === 'create') {
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')

          let branchId: string | undefined

          if (typeof data.branch === 'string') {
            branchId = data.branch
          } else if (
            typeof data.branch === 'object' &&
            data.branch &&
            typeof (data.branch as any).id === 'string'
          ) {
            branchId = (data.branch as any).id
          }

          // ✔ Safe check before using branchId
          if (!branchId) return data

          const branch = await payload.findByID({
            collection: 'branches',
            id: branchId as string,
            depth: 0,
          })

          const prefix: string = (branch?.name ?? 'BIL').substring(0, 3).toUpperCase()

          const count = await payload.db.collections.billings.countDocuments({
            invoiceNumber: { $regex: `^${prefix}-${formattedDate}-` },
          })

          const seq = (count + 1).toString().padStart(3, '0')

          data.invoiceNumber = `${prefix}-${formattedDate}-${seq}`

          // ----------------------------------------------------------
          // 2. AUTO-SET COMPANY FROM BRANCH
          // ----------------------------------------------------------
          let companyId: string | undefined

          if (typeof branch.company === 'string') {
            companyId = branch.company
          } else if (
            typeof branch.company === 'object' &&
            branch.company &&
            typeof (branch.company as any).id === 'string'
          ) {
            companyId = (branch.company as any).id
          }

          if (companyId) {
            data.company = companyId
          }
        }

        // ----------------------------------------------------------
        // 3. AUTO-CALCULATE SUBTOTALS & TOTAL
        // ----------------------------------------------------------
        if (Array.isArray(data.items)) {
          data.items = data.items.map((item: any) => {
            const qty = Number(item.quantity) || 0
            const price = Number(item.unitPrice) || 0
            return {
              ...item,
              subtotal: Number((qty * price).toFixed(2)),
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

  // ----------------------------------------------------------
  // FIELDS
  // ----------------------------------------------------------
  fields: [
    {
      name: 'invoiceNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: { readOnly: true },
    },

    // ------------------------------
    // ITEMS ARRAY
    // ------------------------------
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
        { name: 'name', type: 'text', required: true },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 0.01,
          validate: (value: number | null | undefined) => {
            if (!value || value <= 0) return 'Quantity must be greater than 0'
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
      admin: { readOnly: true },
      defaultValue: ({ user }) => user?.id,
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
      required: true,
      defaultValue: 'cash',
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
