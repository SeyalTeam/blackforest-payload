import { CollectionConfig, Where } from 'payload'

const Expenses: CollectionConfig = {
  slug: 'expenses',
  labels: {
    singular: 'Expense',
    plural: 'Expenses',
  },
  admin: {
    useAsTitle: 'branch',
    defaultColumns: ['branch', 'total', 'createdAt'],
  },

  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'superadmin') return true
      if (user?.role === 'company') {
        if (!user?.company) return false
        const companyId = typeof user.company === 'object' ? user.company.id : user.company
        return {
          'branch.company': { equals: companyId },
        } as Where
      }
      if (user?.role === 'branch') {
        if (!user?.branch) return false
        const branchId = typeof user.branch === 'object' ? user.branch.id : user.branch
        return { branch: { equals: branchId } } as Where
      }
      return false
    },
    create: ({ req: { user } }) => {
      if (user?.role === 'superadmin') return true
      if (user?.role === 'branch') return true
      return false
    },
    update: ({ req: { user } }) => user?.role === 'superadmin',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },

  fields: [
    // ✅ Proper relationship to Branch collection
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      label: 'Branch',
      // Auto-assign branch for branch users
      hooks: {
        beforeChange: [
          async ({ req, operation, value }) => {
            const { user } = req
            if (operation === 'create' && user?.role === 'branch' && user?.branch) {
              return typeof user.branch === 'object' ? user.branch.id : user.branch
            }
            return value
          },
        ],
      },
      admin: {
        description: 'Select the branch this expense belongs to',
      },
    },

    // ✅ Expense details
    {
      name: 'details',
      type: 'array',
      label: 'Expense Details',
      fields: [
        {
          name: 'source',
          type: 'text',
          required: true,
          label: 'Expense Source',
        },
        {
          name: 'reason',
          type: 'text',
          required: true,
          label: 'Reason',
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
          label: 'Amount',
          min: 0,
        },
      ],
    },

    // ✅ Total amount
    {
      name: 'total',
      type: 'number',
      required: true,
      label: 'Total Expense',
      min: 0,
    },

    // ✅ Auto-date field for tracking
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'yyyy-MM-dd',
        },
      },
      defaultValue: () => new Date().toISOString(),
    },

    // ✅ Creator tracking
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Created By',
      admin: { position: 'sidebar' },
    },
  ],

  timestamps: true,
}

export default Expenses
