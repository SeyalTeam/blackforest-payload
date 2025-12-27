import { PayloadRequest, PayloadHandler } from 'payload'
// import { User } from '../payload-types' // Removed as it might not be generated yet or path differs

export const getWaiterWiseBillingReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  // 1. Get date from query param or use today
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

  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : ''
  const waiterParam = typeof req.query.waiter === 'string' ? req.query.waiter : ''

  try {
    const BillingModel = payload.db.collections['billings']
    if (!BillingModel) {
      throw new Error('Billings collection not found')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchQuery: Record<string, any> = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }

    if (branchParam && branchParam !== 'all') {
      matchQuery.$expr = {
        $eq: [{ $toString: '$branch' }, branchParam],
      }
    }

    if (waiterParam && waiterParam !== 'all') {
      // Assuming waiterParam is the ID string
      // In Payload 3.0 / Mongoose adapter, relationship fields might be stored as ObjectIds or Strings depending on config
      // Safest is to try both or rely on the fact that createdBy is a relationship.
      // Usually matchQuery on a relationship field expects the ID.
      matchQuery.createdBy = { $eq: waiterParam }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aggregationPipeline: any[] = [
      {
        $match: matchQuery,
      },
      // Lookup to get waiter details (user)
      {
        // Ensure createdBy is treated as ObjectId for lookup if it's stored as such
        // If Payload stores it as string, this might need adjustment, but usually it's ObjectId in Mongo
        $addFields: {
          createdById: { $toObjectId: '$createdBy' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdById',
          foreignField: '_id',
          as: 'waiterDetails',
        },
      },
      {
        $unwind: {
          path: '$waiterDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Lookup Employee details from User.employee
      {
        $lookup: {
          from: 'employees',
          localField: 'waiterDetails.employee',
          foreignField: '_id',
          as: 'employeeDetails',
        },
      },
      {
        $unwind: {
          path: '$employeeDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$waiterDetails._id', // Group by User ID
          waiterName: {
            $first: {
              $ifNull: [
                '$employeeDetails.name',
                '$waiterDetails.name',
                '$waiterDetails.email',
                'Unknown',
              ],
            },
          },
          employeeId: { $first: '$employeeDetails.employeeId' }, // Fetch explicit employeeId
          billingBranchId: { $first: '$branch' }, // Capture branch from the bill
          totalBills: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          cashAmount: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0],
            },
          },
          upiAmount: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$totalAmount', 0],
            },
          },
          cardAmount: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$totalAmount', 0],
            },
          },
        },
      },
      // Lookup Branch details using the captured billingBranchId
      {
        $addFields: {
          billingBranchObjectId: { $toObjectId: '$billingBranchId' },
        },
      },
      {
        $lookup: {
          from: 'branches',
          localField: 'billingBranchObjectId', // Use the converted ObjectId
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
          waiterId: '$_id',
          waiterName: { $toUpper: '$waiterName' },
          employeeId: 1, // Pass explicit ID through
          branchName: '$branchDetails.name', // Project from the new lookup
          totalBills: 1,
          totalAmount: 1,
          cashAmount: 1,
          upiAmount: 1,
          cardAmount: 1,
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats: any[] = await BillingModel.aggregate(aggregationPipeline)

    // Calculate Grand Totals
    const totals = stats.reduce(
      (acc, curr) => ({
        totalBills: acc.totalBills + curr.totalBills,
        totalAmount: acc.totalAmount + curr.totalAmount,
        cashAmount: acc.cashAmount + curr.cashAmount,
        upiAmount: acc.upiAmount + curr.upiAmount,
        cardAmount: acc.cardAmount + curr.cardAmount,
      }),
      { totalBills: 0, totalAmount: 0, cashAmount: 0, upiAmount: 0, cardAmount: 0 },
    )

    // Fetch active branches for the date range (unfiltered by branch/waiter params if possible,
    // but the user context implies "for the date". If we want GLOBAL active branches for the DATE,
    // we should run a separate aggregation or use the matchQuery before branch/waiter filters are applied.
    // However, the current flow applies filters in matchQuery.
    // To support "options for the date", we usually want the options available BEFORE filtering.
    // Since re-writing the whole pipeline is complex, let's assume we want to show branches involved in the current filtered view OR
    // we just fetch distinct branches for the *date range* specifically.

    // Let's run a lightweight query for active branches in this date range.
    const branchMatchQuery: Record<string, any> = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      branch: { $exists: true, $ne: null },
    }
    // Aggregate distinct branches
    const activeBranchesRaw = await BillingModel.aggregate([
      { $match: branchMatchQuery },
      { $group: { _id: '$branch' } }, // Group by branch ID
      // Lookup names
      {
        $addFields: {
          branchObjectId: { $toObjectId: '$_id' },
        },
      },
      {
        $lookup: {
          from: 'branches',
          localField: 'branchObjectId',
          foreignField: '_id',
          as: 'details',
        },
      },
      { $unwind: '$details' },
      {
        $project: {
          id: '$_id',
          name: '$details.name',
          _id: 0,
        },
      },
      { $sort: { name: 1 } },
    ])

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      stats,
      totals,
      activeBranches: activeBranchesRaw, // Return distinct active branches
    })
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload.logger.error({ msg: 'Waiter Wise Report Error', error } as any)
    return Response.json({ error: 'Failed to generate waiter wise report' }, { status: 500 })
  }
}
