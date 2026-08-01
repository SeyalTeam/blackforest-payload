import { CollectionConfig } from 'payload'

const Cakes: CollectionConfig = {
  slug: 'cakes',
  admin: {
    useAsTitle: 'kotNumber',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'kotNumber',
      type: 'text',
      required: true,
    },
    {
      name: 'cakePrice',
      type: 'number',
      required: true,
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Card', value: 'card' },
        { label: 'UPI', value: 'upi' },
        { label: 'Cashfree', value: 'cashfree' },
        { label: 'Other', value: 'other' },
      ],
      required: true,
    },
    {
      name: 'paymentType',
      type: 'select',
      options: [
        { label: 'Advance', value: 'advance' },
        { label: 'Full', value: 'full' },
      ],
      required: true,
    },
    {
      name: 'paymentAmount',
      type: 'number',
      required: true,
    },
    {
      name: 'pendingAmount',
      type: 'number',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'deliveryDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'kotPhoto',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'cakePhoto',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Paid', value: 'paid' },
        { label: 'Pending', value: 'pending' },
      ],
      required: true,
      defaultValue: 'pending',
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
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

        // Calculate pendingAmount
        const price = data.cakePrice || 0
        const paid = data.paymentAmount || 0
        const pending = price - paid
        data.pendingAmount = pending < 0 ? 0 : pending

        // Set status based on pending amount
        data.status = data.pendingAmount <= 0 ? 'paid' : 'pending'

        return data
      },
    ],
  },
}

export default Cakes
