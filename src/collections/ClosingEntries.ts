import { CollectionConfig, Where } from 'payload'

const ClosingEntries: CollectionConfig = {
  slug: 'closing-entries',
  admin: {
    useAsTitle: 'closingNumber',
    defaultColumns: ['closingNumber', 'branch', 'date', 'createdByName', 'totalSales', 'net'],
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
    // Closing number
    {
      name: 'closingNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: { readOnly: true },
    },

    // Date saved as start-of-day UTC
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy-MM-dd' },
      },
      defaultValue: () => new Date().toISOString(),
    },

    // Creator tracking
    {
      type: 'row',
      fields: [
        {
          name: 'createdByName',
          label: 'Created By (Name)',
          type: 'text',
          required: false,
          admin: {
            width: '50%',
            description: 'Name of the user who created this closing entry',
          },
        },
        {
          name: 'createdBy',
          label: 'Created By User',
          type: 'relationship',
          relationTo: 'users',
          required: false,
          admin: {
            width: '50%',
            readOnly: true,
          },
        },
      ],
    },

    // Sales
    {
      name: 'systemSales',
      type: 'number',
      admin: { readOnly: true },
      min: 0,
    },
    {
      name: 'totalBills',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Auto-calculated from Billings (can be overridden)',
      },
    },
    { name: 'manualSales', type: 'number', required: true, min: 0 },
    { name: 'onlineSales', type: 'number', required: true, min: 0 },

    // Expenses
    { name: 'expenses', type: 'number', required: true, min: 0 },

    // Returns
    {
      name: 'returnTotal',
      type: 'number',
      required: true,
      admin: { readOnly: true },
      min: 0,
    },

    // Stock Orders (NEW)
    {
      name: 'stockOrders',
      type: 'number',
      admin: { readOnly: true },
      defaultValue: 0,
    },

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

    // Branch relation
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Notes from the accounts team about this closing',
      },
    },
  ],

  hooks: {
    afterRead: [
      async ({ doc }) => {
        if (doc && !doc.createdByName && doc.createdBy && typeof doc.createdBy === 'object') {
          doc.createdByName = doc.createdBy.name || doc.createdBy.email || 'Unknown'
        }
        return doc
      },
    ],
    beforeChange: [
      async ({ req, operation, data, originalDoc }) => {
        const { user } = req
        const doc = operation === 'update' ? { ...originalDoc, ...data } : data

        // AUTO ASSIGN CREATED BY USER & NAME
        if (operation === 'create' && user) {
          if (!data.createdBy) {
            data.createdBy = user.id
          }
          if (!data.createdByName) {
            data.createdByName = user.name || user.email || (user as any).username || 'Unknown'
          }
        }

        // AUTO ASSIGN BRANCH FOR BRANCH USERS
        if (operation === 'create' && user?.role === 'branch' && user?.branch) {
          data.branch = typeof user.branch === 'object' ? user.branch.id : user.branch
        }

        // ------------------------------------------
        // 1️⃣ NORMALIZE DATE TO START OF DAY (IST)
        // ------------------------------------------
        if (data.date) {
          const d = new Date(data.date)
          data.date = new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
          ).toISOString()
          doc.date = data.date
        }

        const entryDate = new Date(doc.date)
        
        // Adjust to IST (UTC+5:30) for logical day boundaries
        const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
        const startOfDay = new Date(entryDate.getTime() - IST_OFFSET_MS).toISOString()
        const endOfDay = new Date(entryDate.getTime() - IST_OFFSET_MS + 24 * 60 * 60 * 1000 - 1).toISOString()

        // ------------------------------------------
        // 2️⃣ GENERATE CLOSING NUMBER PER BRANCH
        // ------------------------------------------
        if (operation === 'create' && data.branch) {
          try {
            const branchDoc = await req.payload.findByID({
              collection: 'branches',
              id: data.branch,
            })

            let prefix = 'BRN'

            if (data.branch === '690e326cea6f468d6fe462e6') {
              prefix = 'TH1'
            } else if (branchDoc?.name) {
              prefix = branchDoc.name
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 3)
            }

            const dd = entryDate.getUTCDate().toString().padStart(2, '0')
            const mm = (entryDate.getUTCMonth() + 1).toString().padStart(2, '0')
            const yy = entryDate.getUTCFullYear().toString().slice(-2)
            const dateStr = `${dd}${mm}${yy}`

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
            req.payload.logger.error('Closing number generation failed:', err)
          }
        }

        // ------------------------------------------
        // HELPER: GET LAST CLOSING TIME TODAY
        // ------------------------------------------
        let lastClosingTime = startOfDay
        try {
          const lastClosingWhere: any = {
            and: [
              { branch: { equals: doc.branch } },
              { date: { greater_than_equal: startOfDay } },
              { date: { less_than: endOfDay } },
            ],
          }
          if (operation === 'update' && originalDoc?.createdAt) {
            lastClosingWhere.and.push({
              createdAt: { less_than: new Date(originalDoc.createdAt).toISOString() }
            })
          }

          const lastClosing = await req.payload.find({
            collection: 'closing-entries',
            where: lastClosingWhere,
            sort: '-createdAt',
            limit: 1,
          })

          if (lastClosing.docs.length > 0) {
            lastClosingTime = new Date(lastClosing.docs[0].createdAt).toISOString()
          }
        } catch {
          /* safe fallback */
        }

        // ------------------------------------------
        // 3️⃣ CALCULATE RETURN ORDERS (INCREMENTAL)
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
          doc.returnTotal = data.returnTotal
        } catch (err) {
          req.payload.logger.error('Error calculating returnTotal:', err)
          data.returnTotal = 0
          doc.returnTotal = 0
        }

        // ------------------------------------------
        // 4️⃣ CALCULATE STOCK ORDERS (INCREMENTAL)
        // Using each item's sendingDate & sendingAmount
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
          doc.stockOrders = data.stockOrders
        } catch (err) {
          req.payload.logger.error('Error calculating stockOrders:', err)
          data.stockOrders = 0
          doc.stockOrders = 0
        }

        // ------------------------------------------
        // 4.5️⃣ FETCH BILLS AND AUTO-CALCULATE SYSTEM SALES & TOTAL BILLS
        // ------------------------------------------
        try {
          const windowEnd = operation === 'update' ? new Date(originalDoc.createdAt).toISOString() : new Date().toISOString()
          const bills = await req.payload.find({
            collection: 'billings',
            where: {
              and: [
                { branch: { equals: doc.branch } },
                { createdAt: { greater_than_equal: startOfDay } },
                { createdAt: { less_than_equal: windowEnd } },
                { status: { in: ['completed', 'settled'] } },
              ],
            } as Where,
            limit: 2000,
            depth: 0,
          })

          const completedBills = bills.docs.filter((b: any) => {
            if (b.status !== 'completed' && b.status !== 'settled') return false
            const billTimeRaw = b.settledAt || b.createdAt
            if (!billTimeRaw) return false
            const billTime = new Date(billTimeRaw).toISOString()
            return billTime > lastClosingTime && billTime <= windowEnd
          })

          data.totalBills = completedBills.length
          data.systemSales = completedBills.reduce(
            (sum, b: any) => sum + (b.totalAmount || 0),
            0,
          )
          doc.totalBills = data.totalBills
          doc.systemSales = data.systemSales
        } catch (err) {
          req.payload.logger.error('Error calculating systemSales & totalBills:', err)
          data.totalBills = 0
          data.systemSales = 0
          doc.totalBills = 0
          doc.systemSales = 0
        }

        // ------------------------------------------
        // 5️⃣ CASH FROM DENOMINATIONS
        // ------------------------------------------
        const d = doc.denominations || {}
        data.cash =
          (d.count2000 || 0) * 2000 +
          (d.count500 || 0) * 500 +
          (d.count200 || 0) * 200 +
          (d.count100 || 0) * 100 +
          (d.count50 || 0) * 50 +
          (d.count10 || 0) * 10 +
          (d.count5 || 0) * 5
        doc.cash = data.cash

        // ------------------------------------------
        // 6️⃣ TOTALS
        // ------------------------------------------
        data.totalSales =
          (doc.systemSales || 0) + (doc.manualSales || 0) + (doc.onlineSales || 0)

        data.totalPayments = (doc.creditCard || 0) + (doc.upi || 0) + (data.cash !== undefined ? data.cash : doc.cash || 0)

        // Net = Sales – Expenses – Returns – StockOrders
        data.net =
          (data.totalSales || 0) -
          (doc.expenses || 0) -
          (doc.returnTotal || 0) -
          (doc.stockOrders || 0)

        return data
      },
    ],
  },

  versions: false,
}

export default ClosingEntries
