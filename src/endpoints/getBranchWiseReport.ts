import { PayloadRequest, PayloadHandler } from 'payload'

export const getBranchWiseReportHandler: PayloadHandler = async (
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

  // Start of day (00:00:00) for startDate
  const startOfDay = new Date(startDateParam)
  startOfDay.setHours(0, 0, 0, 0)

  // End of day (23:59:59) for endDate
  const endOfDay = new Date(endDateParam)
  endOfDay.setHours(23, 59, 59, 999)

  try {
    const BillingModel = payload.db.collections['billings']
    // MongoDB Aggregation Pipeline
    const stats = await BillingModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: '$branch', // Group by Branch ID
          totalBills: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          cash: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0],
            },
          },
          upi: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$totalAmount', 0],
            },
          },
          card: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$totalAmount', 0],
            },
          },
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
          totalBills: 1,
          totalAmount: 1,
          cash: 1,
          upi: 1,
          card: 1,
        },
      },
      // Sort by Total Amount Descending
      {
        $sort: { totalAmount: -1 },
      },
    ])

    // Calculate Grand Totals
    const totals = stats.reduce(
      (acc, curr) => ({
        totalBills: acc.totalBills + curr.totalBills,
        totalAmount: acc.totalAmount + curr.totalAmount,
        cash: acc.cash + curr.cash,
        upi: acc.upi + curr.upi,
        card: acc.card + curr.card,
      }),
      { totalBills: 0, totalAmount: 0, cash: 0, upi: 0, card: 0 },
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
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
