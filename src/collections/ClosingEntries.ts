import { CollectionConfig, Where } from 'payload'

const ClosingEntries: CollectionConfig = {
  slug: 'closing-entries',
  admin: {
    useAsTitle: 'closingNumber',
    description:
      'Daily closing entries for branches. Auto-calculates totals, returns, stock receipts, and net.',
  },

  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },

  fields: [
    // Closing Number
    {
      name: 'closingNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: { readOnly: true },
    },

    // Date (start of day UTC)
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy-MM-dd' } },
      defaultValue: () => new Date().toISOString(),
    },

    // Sales
    { name: 'systemSales', type: 'number', required: true, min: 0 },
    { name: 'manualSales', type: 'number', required: true, min: 0 },
    { name: 'onlineSales', type: 'number', required: true, min: 0 },

    // Expenses
    { name: 'expenses', type: 'number', required: true, min: 0 },

    // Returns
    { name: 'returnTotal', type: 'number', admin: { readOnly: true }, min: 0 },

    // Stock Orders Received Amount
    { name: 'stockOrders', type: 'number', admin: { readOnly: true }, defaultValue: 0 },

    // Payments
    { name: 'creditCard', type: 'number', required: true, min: 0 },
    { name: 'upi', type: 'number', required: true, min: 0 },

    // Cash auto-calculated
    {
      name: 'cash',
      type: 'number',
      required: true,
      admin: { readOnly: true },
    },

    // Denominations
    {
      name: 'denominations',
      type: 'group',
      fields: [
        { name: 'count2000', type: 'number', min: 0, defaultValue: 0 },
        { name: 'count500', type: 'number', min: 0, defaultValue: 0 },
        { name: 'count200', type: 'number', min: 0, defaultValue: 0 },
        { name: 'count100', type: 'number', min: 0, defaultValue: 0 },
        { name: 'count50', type: 'number', min: 0, defaultValue: 0 },
        { name: 'count10', type: 'number', min: 0, defaultValue: 0 },
        { name: 'count5', type: 'number', min: 0, defaultValue: 0 },
      ],
    },

    // Totals
    { name: 'totalSales', type: 'number', admin: { readOnly: true } },
    { name: 'totalPayments', type: 'number', admin: { readOnly: true } },
    { name: 'net', type: 'number', admin: { readOnly: true } },

    // Branch
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

        // Auto-assign branch for branch user
        if (operation === 'create' && user?.role === 'branch' && user?.branch) {
          data.branch = typeof user.branch === 'object' ? user.branch.id : user.branch
        }

        // Normalize date to start of day UTC
        if (data.date) {
          const d = new Date(data.date)
          data.date = new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0),
          ).toISOString()
        }

        const entryDate = new Date(data.date)
        const startOfDay = new Date(
          Date.UTC(
            entryDate.getUTCFullYear(),
            entryDate.getUTCMonth(),
            entryDate.getUTCDate(),
            0,
            0,
            0,
          ),
        ).toISOString()
        const endOfDay = new Date(
          Date.UTC(
            entryDate.getUTCFullYear(),
            entryDate.getUTCMonth(),
            entryDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        ).toISOString()

        // ------------------------------------------
        // Generate Closing Number
        // ------------------------------------------
        if (operation === 'create' && data.branch) {
          try {
            const branchDoc = await req.payload.findByID({
              collection: 'branches',
              id: data.branch,
            })

            let prefix = branchDoc?.name
              ? branchDoc.name
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 3)
              : 'BRN'

            const dd = entryDate.getUTCDate().toString().padStart(2, '0')
            const mm = (entryDate.getUTCMonth() + 1).toString().padStart(2, '0')
            const yy = entryDate.getUTCFullYear().toString().slice(-2)
            const dateStr = `${dd}${mm}${yy}`

            const { totalDocs } = await req.payload.count({
              collection: 'closing-entries',
              where: {
                and: [
                  { branch: { equals: data.branch } },
                  { date: { greater_than_equal: startOfDay } },
                  { date: { less_than: endOfDay } },
                ],
              },
            })

            const seq = (totalDocs + 1).toString().padStart(2, '0')
            data.closingNumber = `${prefix}-CLO-${dateStr}-${seq}`
          } catch (err) {
            req.payload.logger.error('Closing number generation failed:', err)
          }
        }

        // ------------------------------------------
        // Find last closing createdAt (real last closing)
        // ------------------------------------------
        let lastClosingTime = startOfDay
        try {
          const lastClosing = await req.payload.find({
            collection: 'closing-entries',
            where: {
              branch: { equals: data.branch },
              createdAt: { less_than: new Date().toISOString() },
            },
            sort: '-createdAt',
            limit: 1,
          })

          if (lastClosing.docs.length > 0) {
            lastClosingTime = new Date(lastClosing.docs[0].createdAt).toISOString()
          }
        } catch {}

        // ------------------------------------------
        // Return Orders – incremental
        // ------------------------------------------
        try {
          const returnOrders = await req.payload.find({
            collection: 'return-orders',
            where: {
              and: [
                { branch: { equals: data.branch } },
                { createdAt: { greater_than: lastClosingTime } },
                { createdAt: { less_than_equal: endOfDay } },
                { status: { equals: 'returned' } },
              ],
            },
          })

          data.returnTotal = returnOrders.docs.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
        } catch {
          data.returnTotal = 0
        }

        // ------------------------------------------
        // ⭐ FIXED: Stock Orders incremental using receivingLog
        // ------------------------------------------
        try {
          const stockOrders = await req.payload.find({
            collection: 'stock-orders',
            where: {
              branch: { equals: data.branch },
            },
            limit: 500,
          })

          let receivedTotal = 0

          for (const so of stockOrders.docs) {
            if (!Array.isArray(so.items)) continue

            for (const item of so.items) {
              if (!Array.isArray(item.receivingLog)) continue

              for (const log of item.receivingLog) {
                if (!log.receivedDate) continue

                const rDate = new Date(log.receivedDate).toISOString()
                const rAmount = log.amount || 0

                // Only entries AFTER last closing
                if (rDate > lastClosingTime && rDate <= endOfDay) {
                  receivedTotal += rAmount
                }
              }
            }
          }

          data.stockOrders = receivedTotal
        } catch (err) {
          req.payload.logger.error('StockOrders calc failed:', err)
          data.stockOrders = 0
        }

        // ------------------------------------------
        // Cash calculation
        // ------------------------------------------
        const d = data.denominations || {}
        data.cash =
          (d.count2000 || 0) * 2000 +
          (d.count500 || 0) * 500 +
          (d.count200 || 0) * 200 +
          (d.count100 || 0) * 100 +
          (d.count50 || 0) * 50 +
          (d.count10 || 0) * 10 +
          (d.count5 || 0) * 5

        // Totals
        data.totalSales =
          (data.systemSales || 0) + (data.manualSales || 0) + (data.onlineSales || 0)

        data.totalPayments = (data.creditCard || 0) + (data.upi || 0) + (data.cash || 0)

        data.net =
          data.totalSales - (data.expenses || 0) - (data.returnTotal || 0) - (data.stockOrders || 0)

        return data
      },
    ],
  },

  versions: false,
}

export default ClosingEntries
