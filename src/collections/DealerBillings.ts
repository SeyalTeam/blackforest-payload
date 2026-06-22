import { CollectionConfig } from 'payload'

const DealerBillings: CollectionConfig = {
  slug: 'dealer-billings',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'dealer',
      type: 'relationship',
      relationTo: 'dealers',
      required: true,
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
      name: 'bills',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
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
      name: 'billCopyPhoto',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'productsPhoto',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation === 'create') {
          if (req.user?.role === 'branch' && req.user.branch) {
            data.branch = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
          }
        }
        if (data.bills) {
          const calculatedTotal = data.bills.reduce(
            (sum: number, bill: { amount?: number }) => sum + (bill.amount || 0),
            0,
          )
          data.total = calculatedTotal
        }
        return data
      },
    ],
  },
}

export default DealerBillings
