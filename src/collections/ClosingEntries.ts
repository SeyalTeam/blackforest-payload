import { CollectionConfig, Where } from 'payload'

const ClosingEntries: CollectionConfig = {
  slug: 'closing-entries',

  admin: {
    useAsTitle: 'closingNumber',
    description:
      'Multiple daily closing entries allowed for all branches. Automatically calculates totals, cash, and net values.',
  },

  // ✅ Make collection fully public
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
      required: true,
    },
  ],

  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        const { user } = req

        // ✅ Auto-assign branch for branch users
        if (operation === 'create' && user?.role === 'branch' && user?.branch) {
          data.branch = typeof user.branch === 'object' ? user.branch.id : user.branch
        }

        // ✅ Generate closing number (safe & unique per branch)
        if (operation === 'create' && data.branch) {
          try {
            // Fetch branch name
            const branchDoc = await req.payload.findByID({
              collection: 'branches',
              id: data.branch,
            })

            if (branchDoc) {
              let prefix
              if (data.branch === '690e326cea6f468d6fe462e6') {
                prefix = 'TH1'
              } else {
                const rawName = (branchDoc.name || 'BRANCH').toString().trim().toUpperCase()
                prefix = rawName.replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'BRN'
              }

              // Parse and format date as DDMMYY
              const entryDate = new Date(data.date)
              const dd = entryDate.getDate().toString().padStart(2, '0')
              const mm = (entryDate.getMonth() + 1).toString().padStart(2, '0')
              const yy = entryDate.getFullYear().toString().slice(-2)
              const dateStr = `${dd}${mm}${yy}`

              // Normalize date to start of day for consistency
              data.date = new Date(entryDate.setHours(0, 0, 0, 0)).toISOString()

              // Calculate start and end of day for query
              const startOfDay = new Date(entryDate.setHours(0, 0, 0, 0)).toISOString()
              const endOfDay = new Date(entryDate.setHours(23, 59, 59, 999)).toISOString()

              let seq = 0
              let closingNumberCandidate = ''

              // Try a few times to find unused number
              for (let attempt = 0; attempt < 20; attempt++) {
                const { totalDocs: count } = await req.payload.count({
                  collection: 'closing-entries',
                  where: {
                    and: [
                      { branch: { equals: data.branch } },
                      { date: { greater_than_equal: startOfDay } },
                      { date: { less_than: endOfDay } },
                    ],
                  } as Where,
                })

                seq = count + 1 + attempt
                const padded = seq.toString().padStart(2, '0')
                closingNumberCandidate = `${prefix}-CLO-${dateStr}-${padded}`

                const exists = await req.payload.find({
                  collection: 'closing-entries',
                  where: { closingNumber: { equals: closingNumberCandidate } },
                  limit: 1,
                })

                if (!exists?.docs?.length) {
                  data.closingNumber = closingNumberCandidate
                  break
                }
              }

              // Fallback (extremely rare)
              if (!data.closingNumber) {
                const padded = (seq || 0).toString().padStart(2, '0')
                data.closingNumber = `${prefix}-CLO-${dateStr}-${padded}-${Date.now()}`
              }
            }
          } catch (err) {
            req.payload.logger.error('Error generating closingNumber:', err)
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

        // ✅ Totals
        data.totalSales =
          (data.systemSales || 0) + (data.manualSales || 0) + (data.onlineSales || 0)

        data.totalPayments = (data.creditCard || 0) + (data.upi || 0) + (data.cash || 0)

        data.net = data.totalSales - (data.expenses || 0)

        return data
      },
    ],
  },

  versions: false, // disable drafts/soft delete
}

export default ClosingEntries
