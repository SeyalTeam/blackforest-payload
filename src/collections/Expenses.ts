import { CollectionConfig, Where } from 'payload'

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
      required: false,
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
        {
          name: 'image',
          type: 'relationship',
          relationTo: 'media',
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
    {
      name: 'cashierId',
      type: 'text',
      index: true,
      admin: {
        description: 'ID of the cashier who created/submitted the expense.',
      },
    },
    {
      name: 'cashierName',
      type: 'text',
      index: true,
      admin: {
        description: 'Name of the cashier who created/submitted the expense.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        if (!data.cashierId && req.user) {
          const emp = (req.user as any)?.employee
          const empId = typeof emp === 'object' && emp !== null ? (emp.id || emp._id) : emp
          data.cashierId = empId ? String(empId) : String(req.user.id)
        }
        if (!data.cashierName && req.user) {
          const emp = (req.user as any)?.employee
          const empName = typeof emp === 'object' && emp !== null ? emp.name : null
          data.cashierName = empName || req.user.name || (req.user as any).username || ''
        }
        if (operation === 'create') {
          if (req.user?.role === 'branch' && req.user.branch) {
            data.branch = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
          }
          // Generate invoiceNumber
          if (data.branch) {
            const branch = await req.payload.findByID({
              collection: 'branches',
              id: data.branch,
            })
            if (branch && branch.name) {
              let prefix
              if (data.branch === '690e326cea6f468d6fe462e6') {
                prefix = 'TH1'
              } else {
                prefix = branch.name.substring(0, 3).toUpperCase()
              }

              // Parse and format date as DDMMYY
              const entryDate = new Date(data.date)
              const dd = entryDate.getDate().toString().padStart(2, '0')
              const mm = (entryDate.getMonth() + 1).toString().padStart(2, '0')
              const yy = entryDate.getFullYear().toString().slice(-2)
              const dateStr = `${dd}${mm}${yy}`

              // Calculate start and end of day for query
              const startOfDay = new Date(entryDate.setHours(0, 0, 0, 0)).toISOString()
              const endOfDay = new Date(entryDate.setHours(23, 59, 59, 999)).toISOString()

              let seq = 0
              let invoiceNumberCandidate = ''

              // Try a few times to find unused number
              for (let attempt = 0; attempt < 20; attempt++) {
                const { totalDocs: count } = await req.payload.count({
                  collection: 'expenses',
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
                invoiceNumberCandidate = `${prefix}-EXP-${dateStr}-${padded}`

                const exists = await req.payload.find({
                  collection: 'expenses',
                  where: { invoiceNumber: { equals: invoiceNumberCandidate } },
                  limit: 1,
                })

                if (!exists?.docs?.length) {
                  data.invoiceNumber = invoiceNumberCandidate
                  break
                }
              }

              // Fallback (extremely rare)
              if (!data.invoiceNumber) {
                const padded = (seq || 0).toString().padStart(2, '0')
                data.invoiceNumber = `${prefix}-EXP-${dateStr}-${padded}-${Date.now()}`
              }
            }
          }
        }
        // Recalculate total
        if (data.details) {
          const calculatedTotal = data.details.reduce(
            (sum: number, detail: { amount?: number }) => sum + (detail.amount || 0),
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
