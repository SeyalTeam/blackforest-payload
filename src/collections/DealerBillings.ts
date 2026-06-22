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
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      required: false,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    {
      name: 'paidAmount',
      type: 'number',
      defaultValue: 0,
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'payments',
      type: 'array',
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
        {
          name: 'date',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        readOnly: true,
      },
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
        if (data.payments) {
          const totalPaid = data.payments.reduce(
            (sum: number, p: { amount?: number }) => sum + (p.amount || 0),
            0,
          )
          data.paidAmount = totalPaid
        }
        if (data.status === 'paid' && (!data.payments || data.payments.length === 0)) {
          data.paidAmount = data.total
          data.payments = [
            {
              amount: data.total,
              date: new Date().toISOString(),
            },
          ]
        } else if (data.status === 'paid' && !data.paidAmount) {
          data.paidAmount = data.total
        } else if (data.paidAmount !== undefined && data.total !== undefined && data.paidAmount >= data.total) {
          data.status = 'paid'
        }
        return data
      },
    ],
  },
}

export default DealerBillings
