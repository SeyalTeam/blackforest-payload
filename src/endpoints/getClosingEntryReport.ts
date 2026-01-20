import { PayloadRequest, PayloadHandler } from 'payload'

export const getClosingEntryReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  // 1. Get dates from query params or use today
  const startDateParam =
    typeof req.query.startDate === 'string'
      ? req.query.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof req.query.endDate === 'string'
      ? req.query.endDate
      : new Date().toISOString().split('T')[0]

  // Start of day (00:00:00 UTC) for startDate
  const [startYear, startMonth, startDay] = startDateParam.split('-').map(Number)
  const startOfDay = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0))

  // End of day (23:59:59 UTC) for endDate
  const [endYear, endMonth, endDay] = endDateParam.split('-').map(Number)
  const endOfDay = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999))

  console.log('--- REPORT DEBUG ---')
  console.log('Params:', { startDateParam, endDateParam })
  console.log('Constructed:', { startOfDay, endOfDay })
  console.log('Epoch:', { start: startOfDay.getTime(), end: endOfDay.getTime() })
  console.log('--------------------')

  try {
    const ClosingModel = payload.db.collections['closing-entries']
    // MongoDB Aggregation Pipeline
    const stats = await ClosingModel.aggregate([
      {
        $match: {
          date: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: '$branch', // Group by Branch ID
          totalEntries: { $sum: 1 },
          closingNumbers: { $push: '$closingNumber' },
          lastUpdated: { $max: '$createdAt' },
          entries: {
            $push: {
              closingNumber: '$closingNumber',
              createdAt: '$createdAt',
              systemSales: '$systemSales',
              totalBills: '$totalBills',
              manualSales: '$manualSales',
              onlineSales: '$onlineSales',
              totalSales: '$totalSales',
              expenses: '$expenses',
              cash: '$cash',
              upi: '$upi',
              card: '$creditCard',
              denominations: '$denominations',
            },
          },
          systemSales: { $sum: '$systemSales' },
          totalBills: { $sum: '$totalBills' }, // Add totalBills aggregation
          manualSales: { $sum: '$manualSales' },
          onlineSales: { $sum: '$onlineSales' },
          totalSales: { $sum: '$totalSales' },
          expenses: { $sum: '$expenses' },
          returnTotal: { $sum: '$returnTotal' },
          stockOrders: { $sum: '$stockOrders' },
          net: { $sum: '$net' },
          cash: { $sum: '$cash' },
          upi: { $sum: '$upi' },
          card: { $sum: '$creditCard' },
          count2000: { $sum: { $ifNull: ['$denominations.count2000', 0] } },
          count500: { $sum: { $ifNull: ['$denominations.count500', 0] } },
          count200: { $sum: { $ifNull: ['$denominations.count200', 0] } },
          count100: { $sum: { $ifNull: ['$denominations.count100', 0] } },
          count50: { $sum: { $ifNull: ['$denominations.count50', 0] } },
          count10: { $sum: { $ifNull: ['$denominations.count10', 0] } },
          count5: { $sum: { $ifNull: ['$denominations.count5', 0] } },
        },
      },
      // Lookup Branch Details
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branchDetails',
        },
      },
      {
        $unwind: {
          path: '$branchDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          branchName: { $ifNull: ['$branchDetails.name', 'Unknown Branch'] },
          totalEntries: 1,
          closingNumbers: 1,
          lastUpdated: 1,
          entries: 1,
          systemSales: 1,
          totalBills: 1,
          manualSales: 1,
          onlineSales: 1,
          totalSales: 1,
          expenses: 1,
          returnTotal: 1,
          stockOrders: 1,
          net: 1,
          cash: 1,
          upi: 1,
          card: 1,
          count2000: 1,
          count500: 1,
          count200: 1,
          count100: 1,
          count50: 1,
          count10: 1,
          count5: 1,
        },
      },
      // Sort by Branch Name
      {
        $sort: { branchName: 1 },
      },
    ])

    // Calculate Grand Totals
    const totals = stats.reduce(
      (acc, curr) => ({
        totalEntries: acc.totalEntries + curr.totalEntries,
        systemSales: acc.systemSales + curr.systemSales,
        totalBills: (acc.totalBills || 0) + (curr.totalBills || 0),
        manualSales: acc.manualSales + curr.manualSales,
        onlineSales: acc.onlineSales + curr.onlineSales,
        totalSales: acc.totalSales + curr.totalSales,
        expenses: acc.expenses + curr.expenses,
        returnTotal: acc.returnTotal + curr.returnTotal,
        stockOrders: acc.stockOrders + curr.stockOrders,
        net: acc.net + curr.net,
        cash: acc.cash + curr.cash,
        upi: acc.upi + curr.upi,
        card: acc.card + curr.card,
      }),
      {
        totalEntries: 0,
        systemSales: 0,
        totalBills: 0,
        manualSales: 0,
        onlineSales: 0,
        totalSales: 0,
        expenses: 0,
        returnTotal: 0,
        stockOrders: 0,
        net: 0,
        cash: 0,
        upi: 0,
        card: 0,
      },
    )

    // 4. Fetch all expenses for the range to enrich the stats
    const expensesRes = await payload.find({
      collection: 'expenses',
      where: {
        and: [
          { date: { greater_than_equal: startOfDay.toISOString() } },
          { date: { less_than_equal: endOfDay.toISOString() } },
        ],
      },
      limit: 1000,
      pagination: false,
      depth: 2,
    })
    const allExpenses = expensesRes.docs

    // Add Serial Number and Expense Details
    const statsWithEnrichment = stats.map((item, index) => {
      const branchId = item._id
      if (!branchId) {
        return { ...item, sNo: index + 1, entries: item.entries || [] }
      }
      // Sort entries by createdAt to handle temporal attribution
      const sortedEntries = [...(item.entries || [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )

      const branchExpenses = allExpenses.filter((ex) => {
        const exBranchId = typeof ex.branch === 'object' ? ex.branch.id : ex.branch
        return exBranchId === branchId.toString()
      })

      // Calculate categorized expenses for each entry
      const entriesWithExpenses = sortedEntries.map((entry, idx) => {
        const entryTime = new Date(entry.createdAt).getTime()
        const prevTime =
          idx === 0
            ? new Date(startOfDay).getTime()
            : new Date(sortedEntries[idx - 1].createdAt).getTime()

        const relevantExpenses = branchExpenses.filter((ex) => {
          const exTime = new Date(ex.date).getTime()
          return exTime > prevTime && exTime <= entryTime
        })

        const expenseDetails: {
          category: string
          reason: string
          amount: number
          imageUrl: string
          date: string
        }[] = []
        relevantExpenses.forEach((ex) => {
          if (ex.details) {
            ex.details.forEach((det: any) => {
              let imageUrl = ''
              if (det.image) {
                if (typeof det.image === 'object' && det.image.url) {
                  imageUrl = det.image.url
                }
              }

              expenseDetails.push({
                category: det.source || 'OTHERS',
                reason: det.reason || '(No reason)',
                amount: det.amount || 0,
                imageUrl,
                date: ex.date,
              })
            })
          }
        })

        return {
          ...entry,
          expenseDetails,
        }
      })

      // Branch total expense details (Individual items, no grouping for full detail)
      const branchExpenseDetails: {
        category: string
        reason: string
        amount: number
        imageUrl: string
        date: string
      }[] = []
      branchExpenses.forEach((ex) => {
        if (ex.details) {
          ex.details.forEach((det: any) => {
            let imageUrl = ''
            if (det.image) {
              if (typeof det.image === 'object' && det.image.url) {
                imageUrl = det.image.url
              }
            }
            branchExpenseDetails.push({
              category: det.source || 'OTHERS',
              reason: det.reason || '(No reason)',
              amount: det.amount || 0,
              imageUrl,
              date: ex.date,
            })
          })
        }
      })

      return {
        ...item,
        sNo: index + 1,
        entries: entriesWithExpenses,
        expenseDetails: branchExpenseDetails,
      }
    })

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      stats: statsWithEnrichment,
      totals,
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate closing entry report' }, { status: 500 })
  }
}
