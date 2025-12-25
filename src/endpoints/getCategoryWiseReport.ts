import { PayloadRequest, PayloadHandler } from 'payload'

export const getCategoryWiseReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  const dateParam =
    typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().split('T')[0]

  const startOfDay = new Date(dateParam)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(dateParam)
  endOfDay.setHours(23, 59, 59, 999)

  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : ''

  try {
    // 1. Fetch all branches map (ID -> Code)
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

    // 2. Aggregate Data
    const rawStats = await BillingModel.aggregate([
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
    ])

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
      const branchSales: Record<string, number> = {}

      item.branchData.forEach((b: any) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchSales[code] = b.amount
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
    const totals = formattedStats.reduce(
      (acc: any, curr: any) => ({
        totalQuantity: acc.totalQuantity + curr.totalQuantity,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { totalQuantity: 0, totalAmount: 0 },
    )

    return Response.json({
      date: dateParam,
      branchHeaders,
      stats: formattedStats,
      totals,
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate category report' }, { status: 500 })
  }
}
