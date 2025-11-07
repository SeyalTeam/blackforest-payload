import { CollectionConfig } from 'payload'

const ClosingEntries: CollectionConfig = {
  slug: 'closing-entries',
  admin: {
    useAsTitle: 'date',
  },
  access: {
    // ✅ PUBLIC ACCESS — Anyone can read and create
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
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
    {
      name: 'systemSales',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'manualSales',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'onlineSales',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'expenses',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'creditCard',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'upi',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'cash',
      type: 'number',
      required: true,
      min: 0,
      admin: { readOnly: true },
    },
    {
      name: 'denominations',
      type: 'group',
      fields: [
        { name: 'count2000', type: 'number', label: '2000 × Count', min: 0, defaultValue: 0 },
        { name: 'count500', type: 'number', label: '500 × Count', min: 0, defaultValue: 0 },
        { name: 'count200', type: 'number', label: '200 × Count', min: 0, defaultValue: 0 },
        { name: 'count100', type: 'number', label: '100 × Count', min: 0, defaultValue: 0 },
        { name: 'count50', type: 'number', label: '50 × Count', min: 0, defaultValue: 0 },
        { name: 'count10', type: 'number', label: '10 × Count', min: 0, defaultValue: 0 },
        { name: 'count5', type: 'number', label: '5 × Count', min: 0, defaultValue: 0 },
      ],
    },
    {
      name: 'totalSales',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'totalPayments',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'net',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false, // made optional for public access
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        const { user } = req

        // Auto-assign branch if branch user logged in
        if (operation === 'create' && user?.role === 'branch' && user?.branch) {
          data.branch = typeof user.branch === 'object' ? user.branch.id : user.branch
        }

        // Calculate cash from denominations
        const denoms = data.denominations || {}
        data.cash =
          (denoms.count2000 || 0) * 2000 +
          (denoms.count500 || 0) * 500 +
          (denoms.count200 || 0) * 200 +
          (denoms.count100 || 0) * 100 +
          (denoms.count50 || 0) * 50 +
          (denoms.count10 || 0) * 10 +
          (denoms.count5 || 0) * 5

        // Calculate totals
        data.totalSales =
          (data.systemSales || 0) + (data.manualSales || 0) + (data.onlineSales || 0)
        data.totalPayments = (data.creditCard || 0) + (data.upi || 0) + (data.cash || 0)
        data.net = data.totalSales - (data.expenses || 0)

        return data
      },
    ],
  },
}

export default ClosingEntries
