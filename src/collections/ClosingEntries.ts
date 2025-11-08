import { CollectionConfig, Where } from 'payload'

const ClosingEntries: CollectionConfig = {
  slug: 'closing-entries',

  admin: {
    useAsTitle: 'closingNumber',
    description:
      'Multiple daily closing entries allowed for all branches. Automatically calculates totals, cash, and net values.',
  },

  // ✅ Make this collection fully public
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },

  fields: [
    {
      name: 'closingNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: { readOnly: true },
    },
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
      required: true, // Changed to required for generating closingNumber
    },
  ],

  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        const { user } = req

        // ✅ Assign branch if a branch user is logged in
        if (operation === 'create' && user?.role === 'branch' && user?.branch) {
          data.branch = typeof user.branch === 'object' ? user.branch.id : user.branch
        }

        if (operation === 'create' && data.branch) {
          // Fetch branch document to get name
          const branchDoc = await req.payload.findByID({
            collection: 'branches',
            id: data.branch,
          })

          if (branchDoc) {
            const prefix = branchDoc.name.slice(0, 3).toUpperCase()

            // Count existing entries for this branch
            const { totalDocs: count } = await req.payload.count({
              collection: 'closing-entries',
              where: { branch: { equals: data.branch } } as Where,
            })

            const seq = count + 1
            const padded = seq.toString().padStart(3, '0')

            data.closingNumber = `${prefix}-CLO-${padded}`
          }
        }

        // ✅ Calculate cash from denominations
        const denoms = data.denominations || {}
        data.cash =
          (denoms.count2000 || 0) * 2000 +
          (denoms.count500 || 0) * 500 +
          (denoms.count200 || 0) * 200 +
          (denoms.count100 || 0) * 100 +
          (denoms.count50 || 0) * 50 +
          (denoms.count10 || 0) * 10 +
          (denoms.count5 || 0) * 5

        // ✅ Calculate total sales
        data.totalSales =
          (data.systemSales || 0) + (data.manualSales || 0) + (data.onlineSales || 0)

        // ✅ Calculate total payments
        data.totalPayments = (data.creditCard || 0) + (data.upi || 0) + (data.cash || 0)

        // ✅ Calculate net profit
        data.net = data.totalSales - (data.expenses || 0)

        // ✅ Always return data so Payload saves it
        return data
      },
    ],
  },

  // ✅ Disable versioning (no drafts or soft deletes)
  versions: false,
}

export default ClosingEntries
