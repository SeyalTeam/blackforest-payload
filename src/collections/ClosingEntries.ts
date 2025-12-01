import { CollectionConfig, Where } from 'payload'

const ClosingEntries: CollectionConfig = {
  slug: 'closing-entries',

  admin: {
    useAsTitle: 'closingNumber',
    description:
      'Daily closing entries for branches. Auto-calculates totals, returns, stock receipts (sending), and net.',
  },

  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },

  fields: [
    // Closing number
    {
      name: 'closingNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: { readOnly: true },
    },

    // Date
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

    // Return Orders
    {
      name: 'returnTotal',
      type: 'number',
      required: true,
      admin: { readOnly: true },
      min: 0,
    },

    // Stock Orders (SENDING based)
    {
      name: 'stockOrders',
      type: 'number',
      admin: { readOnly: true },
      defaultValue: 0,
    },

    // Payments
    { name: 'creditCard', type: 'number', required: true, min: 0 },
    { name: 'upi', type: 'number', required: true, min: 0 },

    // Cash (auto calc)
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
        { name: 'count2000', type: 'number', defaultValue: 0, min: 0 },
        { name: 'count500', type: 'number', defaultValue: 0, min: 0 },
        { name: 'count200', type: 'number', defaultValue: 0, min: 0 },
        { name: 'count100', type: 'number', defaultValue: 0, min: 0 },
        { name: 'count50', type: 'number', defaultValue: 0, min: 0 },
        { name: 'count10', type: 'number', defaultValue: 0, min: 0 },
        { name: 'count5', type: 'number', defaultValue: 0, min: 0 },
      ],
    },

    // Totals
    { name: 'totalSales', type: 'number', admin: { readOnly: true } },
    { name: 'totalPayments', type: 'number', admin: { readOnly: true } },
    { name: 'net', type: 'number', admin: { readOnly: true } },

    // Branch link
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

        // ------------------------------------------
        // AUTO ASSIGN BRANCH FOR BRANCH USERS
        // ------------------------------------------
        if (operation === 'create' && user?.role === 'branch' && user?.branch) {
          data.branch = typeof user.branch === 'object' ? user.branch.id : user.branch
        }

        // ------------------------------------------
        // NORMALIZE DATE TO START OF DAY (UTC)
        // ------------------------------------------
        if (data.date) {
          const d = new Date(data.date)
          data.date = new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
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
        // GENERATE CLOSING NUMBER
        // ------------------------------------------
        if (operation === 'create' && data.branch) {
          try {
            const branchDoc = await req.payload.findByID({
              collection: 'branches',
              id: data.branch,
            })

            let prefix = 'BRN'

            // special case
            if (data.branch === '690e326cea6f468d6fe462e6') prefix = 'TH1'
            else if (branchDoc?.name) {
              prefix = branchDoc.name
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 3)
            }

            const dd = entryDate.getUTCDate().toString().padStart(2, '0')
            const mm = (entryDate.getUTCMonth() + 1).toString().padStart(2, '0')
            const yy = entryDate.getUTCFullYear().toString().slice(-2)
            const dateStr = `${dd}${mm}${yy}`

            // sequence
            let seq = 0

            for (let attempt = 0; attempt < 20; attempt++) {
              const { totalDocs } = await req.payload.count({
                collection: 'closing-entries',
                where: {
                  and: [
                    { branch: { equals: data.branch } },
                    { date: { greater_than_equal: startOfDay } },
                    { date: { less_than: endOfDay } },
                  ],
                } as Where,
              })

              seq = totalDocs + 1 + attempt
              const padded = seq.toString().padStart(2, '0')
              const candidate = `${prefix}-CLO-${dateStr}-${padded}`

              const exists = await req.payload.find({
                collection: 'closing-entries',
                where: { closingNumber: { equals: candidate } },
                limit: 1,
              })

              if (!exists.docs.length) {
                data.closingNumber = candidate
                break
              }
            }

            if (!data.closingNumber) {
              data.closingNumber = `${prefix}-CLO-${dateStr}-${seq}-${Date.now()}`
            }
          } catch (err) {
            req.payload.logger.error('Error generating closingNumber:', err)
          }
        }

        // ------------------------------------------
        // GET LAST REAL CLOSING OF TODAY
        // (skip the one being created now)
        // ------------------------------------------
        let lastClosingTime = startOfDay

        try {
          const closings = await req.payload.find({
            collection: 'closing-entries',
            where: {
              and: [
                { branch: { equals: data.branch } },
                { date: { greater_than_equal: startOfDay } },
                { date: { less_than: endOfDay } },
              ],
            },
            sort: '-createdAt',
            limit: 2,
          })

          if (closings.docs.length > 1) {
            lastClosingTime = new Date(closings.docs[1].createdAt).toISOString()
          }
        } catch (err) {
          /* fallback already set */
        }

        // ------------------------------------------
        // 1️⃣ RETURN ORDERS (INCREMENTAL)
        // ------------------------------------------
        try {
          const returnOrders = await req.payload.find({
            collection: 'return-orders',
            where: {
              and: [
                { branch: { equals: data.branch } },
                { createdAt: { greater_than: lastClosingTime } },
                { createdAt: { less_than: endOfDay } },
                { status: { equals: 'returned' } },
              ],
            } as Where,
          })

          data.returnTotal = returnOrders.docs.reduce(
            (sum, order) => sum + (order.totalAmount || 0),
            0,
          )
        } catch (err) {
          req.payload.logger.error('Error calculating returnTotal:', err)
          data.returnTotal = 0
        }

        // ------------------------------------------
        // 2️⃣ STOCK ORDERS — SENDING ONLY (Incremental)
        // ------------------------------------------
        try {
          const stockOrders = await req.payload.find({
            collection: 'stock-orders',
            where: {
              and: [
                { branch: { equals: data.branch } },
                { createdAt: { greater_than_equal: startOfDay } },
                { createdAt: { less_than: endOfDay } },
              ],
            } as Where,
            limit: 500,
          })

          let sendingTotal = 0

          for (const so of stockOrders.docs) {
            if (!Array.isArray(so.items)) continue

            for (const item of so.items) {
              if (!item?.sendingDate) continue

              const sDate = new Date(item.sendingDate).toISOString()
              const sAmount = item.sendingAmount || 0

              if (sDate > lastClosingTime && sDate <= endOfDay) {
                sendingTotal += sAmount
              }
            }
          }

          data.stockOrders = sendingTotal
        } catch (err) {
          req.payload.logger.error('Error calculating stockOrders:', err)
          data.stockOrders = 0
        }

        // ------------------------------------------
        // 3️⃣ CASH FROM DENOMINATIONS
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

        // ------------------------------------------
        // 4️⃣ TOTALS
        // ------------------------------------------
        data.totalSales =
          (data.systemSales || 0) + (data.manualSales || 0) + (data.onlineSales || 0)

        data.totalPayments = (data.creditCard || 0) + (data.upi || 0) + (data.cash || 0)

        data.net =
          (data.totalSales || 0) -
          (data.expenses || 0) -
          (data.returnTotal || 0) -
          (data.stockOrders || 0)

        return data
      },
    ],
  },

  versions: false,
}

export default ClosingEntries
