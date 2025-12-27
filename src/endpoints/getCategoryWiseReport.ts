import { PayloadRequest, PayloadHandler } from 'payload'

export const getCategoryWiseReportHandler: PayloadHandler = async (
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
  const departmentParam = typeof req.query.department === 'string' ? req.query.department : ''

  try {
    // 1. Fetch all branches map (ID -> Code)
    // ... (rest of simple fetch) ...
    const branches = await payload.find({
      collection: 'branches',
      limit: 100,
      pagination: false,
    })

    const branchMap: Record<string, string> = {}
    branches.docs.forEach((b) => {
      branchMap[b.id] = b.name.substring(0, 3).toUpperCase()
    })

    const BillingModel = payload.db.collections['billings']

    // Construct match query
    const matchQuery: any = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }

    if (branchParam && branchParam !== 'all') {
      // Use $expr to match string ID against ObjectId
      matchQuery.$expr = {
        $eq: [{ $toString: '$branch' }, branchParam],
      }
    }

    // Pipeline stages
    const pipeline: any[] = [
      {
        $match: matchQuery,
      },
      {
        $unwind: '$items',
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $unwind: '$productDetails',
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDetails.category',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      {
        $unwind: '$categoryDetails',
      },
    ]

    // Optional Department Filter
    if (departmentParam && departmentParam !== 'all') {
      pipeline.push({
        $match: {
          $expr: {
            $eq: [{ $toString: '$categoryDetails.department' }, departmentParam],
          },
        },
      })
    }

    // Continue with grouping
    pipeline.push(
      {
        $group: {
          _id: {
            categoryName: '$categoryDetails.name',
            branchId: '$branch',
          },
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.subtotal' },
        },
      },
      {
        $group: {
          _id: '$_id.categoryName',
          totalQuantity: { $sum: '$quantity' },
          totalAmount: { $sum: '$amount' },
          branchData: {
            $push: {
              branchId: '$_id.branchId',
              amount: '$amount',
              quantity: '$quantity',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          categoryName: '$_id',
          totalQuantity: 1,
          totalAmount: 1,
          branchData: 1,
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    )

    // 2. Aggregate Data
    const rawStats = await BillingModel.aggregate(pipeline)

    // 3. Calculate Branch Totals to Sort Headers
    const branchTotals: Record<string, number> = {}

    // Initialize branch totals for all known branches to 0 (optional, but good for completeness if we wanted to show all)
    // But requirement says "if zero mean dont add", so we will rely on accumulation.

    rawStats.forEach((stat: any) => {
      stat.branchData.forEach((b: any) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchTotals[code] = (branchTotals[code] || 0) + b.amount
        }
      })
    })

    // 4. Create Sorted Header List
    // Filter out branches with <= 0 sales and Sort by Amount Desc
    const branchHeaders = Object.keys(branchTotals)
      .filter((code) => branchTotals[code] > 0)
      .sort((a, b) => branchTotals[b] - branchTotals[a])

    // 5. Format Stats with Sorted Columns
    const formattedStats = rawStats.map((item: any, index: number) => {
      const branchSales: Record<string, { amount: number; quantity: number }> = {}

      item.branchData.forEach((b: any) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchSales[code] = { amount: b.amount, quantity: b.quantity }
        }
      })

      return {
        sNo: index + 1,
        categoryName: item.categoryName,
        totalQuantity: item.totalQuantity,
        totalAmount: item.totalAmount,
        branchSales,
      }
    })

    // Calculate Grand Totals
    // Calculate Grand Totals
    const aggregatedStats = formattedStats.reduce(
      (acc: any, curr: any) => ({
        totalQuantity: acc.totalQuantity + curr.totalQuantity,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { totalQuantity: 0, totalAmount: 0 },
    )

    // Add computed branch totals to the final response
    const totals = {
      ...aggregatedStats,
      branchTotals,
    }

    payload.logger.info(`Generated Category Wise Report: ${formattedStats.length} categories found`)

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      branchHeaders,
      stats: formattedStats,
      totals,
    })
  } catch (error: any) {
    payload.logger.error({ msg: 'Category Report Error', error, stack: error.stack })
    return Response.json({ error: 'Failed to generate category report' }, { status: 500 })
  }
}
