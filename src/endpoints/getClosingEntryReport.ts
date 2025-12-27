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
          _id: 0,
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

    // Add Serial Number
    const statsWithSn = stats.map((item, index) => ({
      ...item,
      sNo: index + 1,
    }))

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      stats: statsWithSn,
      totals,
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate closing entry report' }, { status: 500 })
  }
}
