import { CollectionConfig } from 'payload'

const Expenses: CollectionConfig = {
  slug: 'expenses',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
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
            { label: 'MAINTENANCE', value: 'MAINTENANCE' },
            { label: 'TRANSPORT', value: 'TRANSPORT' },
            { label: 'FUEL', value: 'FUEL' },
            { label: 'PACKING', value: 'PACKING' },
            { label: 'STAFF WELFARE', value: 'STAFF WELFARE' },
            { label: 'Supplies', value: 'Supplies' },
            { label: 'ADVERTISEMENT', value: 'ADVERTISEMENT' },
            { label: 'ADVANE', value: 'ADVANCE' },
            { label: 'COMPLEMENTARY ', value: 'COMPLEMENTARY' },
            { label: 'RAW MATERIAL', value: 'RAW MATERIAL' },
            { label: 'SALARY', value: 'SALARY' },
            { label: 'OC PRODUCTS', value: 'OC PRODUCTS' },
            { label: 'OTHERS', value: 'OTHERS' },
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
              data.invoiceNumber = `${prefix}-EXP-${count.toString().padStart(3, '0')}`
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
