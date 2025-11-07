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
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'branch',
      type: 'text',
      required: true,
      label: 'Branch Name',
    },
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
        },
      ],
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      label: 'Total Expense',
    },
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
