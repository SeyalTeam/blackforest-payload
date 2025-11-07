import { CollectionConfig } from 'payload'

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

  // ✅ Public access (anyone can read/create/update/delete)
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },

  fields: [
    // ✅ Proper relationship to Branch collection (shows branch name)
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      label: 'Branch',
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

    // ✅ Total amount (auto-calculated in beforeChange hook)
    {
      name: 'total',
      type: 'number',
      required: true,
      label: 'Total Expense',
      min: 0,
      admin: {
        readOnly: true,
      },
    },

    // ✅ Optional date (auto default)
    {
      name: 'date',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'yyyy-MM-dd',
        },
      },
    },

    // ✅ Created By (not required in public mode)
    {
      name: 'createdBy',
      type: 'text',
      label: 'Created By (Optional)',
      admin: { position: 'sidebar' },
    },
  ],

  // ✅ Automatically calculate total before save
  hooks: {
    beforeChange: [
      async ({ data }) => {
        if (data.details && Array.isArray(data.details)) {
          const total = data.details.reduce((sum: number, item: any) => {
            const amount = typeof item.amount === 'number' ? item.amount : 0
            return sum + amount
          }, 0)
          data.total = total
        }
        return data
      },
    ],
  },

  timestamps: true,
}

export default Expenses
