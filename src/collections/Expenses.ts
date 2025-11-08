import { CollectionConfig } from 'payload'

const Expenses: CollectionConfig = {
  slug: 'expenses',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  access: {
    read: () => true, // Public read access
    create: () => true, // Public create access (use cautiously)
    update: () => true, // Public update access (use cautiously)
    delete: () => true, // Public delete access (use cautiously)
  },
  fields: [
    {
      name: 'invoiceNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      access: {
        create: ({ req: { user } }) => user?.role !== 'branch',
        update: () => false,
      },
    },
    {
      name: 'details',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'source',
          type: 'select',
          options: [
            { label: 'EB', value: 'EB' },
            { label: 'Water Bill', value: 'Water Bill' },
            { label: 'Rent', value: 'Rent' },
            { label: 'Maintenance', value: 'Maintenance' },
            { label: 'Supplies', value: 'Supplies' },
            { label: 'Other', value: 'Other' },
          ],
          required: true,
        },
        {
          name: 'reason',
          type: 'text',
          required: true,
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
      ],
    },
    {
      name: 'total',
      type: 'number',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      required: true,
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation === 'create') {
          if (req.user?.role === 'branch') {
            data.branch = req.user.branch // Auto-set branch if authenticated
          }
          // Generate invoiceNumber
          if (data.branch) {
            const branch = await req.payload.findByID({
              collection: 'branches',
              id: data.branch,
            })
            if (branch && branch.name) {
              const prefix = branch.name.substring(0, 3).toUpperCase()
              const existing = await req.payload.find({
                collection: 'expenses',
                where: { branch: { equals: data.branch } },
                limit: 0,
              })
              const count = existing.totalDocs + 1
              data.invoiceNumber = `${prefix}-EXP-${count.toString().padStart(4, '0')}`
            }
          }
        }
        // Recalculate total
        if (data.details) {
          const calculatedTotal = data.details.reduce(
            (sum: number, detail: any) => sum + (detail.amount || 0),
            0,
          )
          data.total = calculatedTotal
        }
        return data
      },
    ],
  },
}

export default Expenses
