import { PayloadRequest, PayloadHandler } from 'payload'
import mongoose from 'mongoose'

interface BranchData {
  branchId: string
  amount: number
}

interface RawStat {
  productName: string
  totalQuantity: number
  totalAmount: number
  branchData: BranchData[]
}

export const getProductWiseReportHandler: PayloadHandler = async (
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

  // Start of day (00:00:00)
  const startOfDay = new Date(startDateParam)
  startOfDay.setHours(0, 0, 0, 0)

  // End of day (23:59:59)
  const endOfDay = new Date(endDateParam)
  endOfDay.setHours(23, 59, 59, 999)

  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : ''
  const categoryParam = typeof req.query.category === 'string' ? req.query.category : ''
  const departmentParam = typeof req.query.department === 'string' ? req.query.department : ''

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
    // Provide a default empty aggregation if BillingModel is undefined, though it shouldn't be
    if (!BillingModel) {
      throw new Error('Billings collection not found')
    }

    // Construct match query
    // Construct matchQuery
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

    // 2. Aggregate Data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aggregationPipeline: any[] = [
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

    // Apply Category Filter if present
    if (categoryParam && categoryParam !== 'all') {
      aggregationPipeline.push({
        $match: {
          'categoryDetails._id': { $eq: new mongoose.Types.ObjectId(categoryParam) },
        },
      })
    }

    // Apply Department Filter if present
    if (departmentParam && departmentParam !== 'all') {
      aggregationPipeline.push({
        $match: {
          'categoryDetails.department': { $eq: new mongoose.Types.ObjectId(departmentParam) },
        },
      })
    }

    aggregationPipeline.push(
      {
        $group: {
          _id: {
            productName: '$productDetails.name',
            branchId: '$branch',
          },
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.subtotal' }, // Assuming subtotal is at item level
        },
      },
      {
        $group: {
          _id: '$_id.productName',
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
          productName: '$_id',
          totalQuantity: 1,
          totalAmount: 1,
          branchData: 1,
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    )

    // Cast the result to unknown first, then to our expected type, to avoid 'any' lint errors
    const rawStats = (await BillingModel.aggregate(aggregationPipeline)) as unknown as RawStat[]

    // 3. Calculate Branch Totals to Sort Headers
    const branchTotals: Record<string, number> = {}

    rawStats.forEach((stat) => {
      stat.branchData.forEach((b) => {
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
    const formattedStats = rawStats.map((item, index) => {
      const branchSales: Record<string, number> = {}

      item.branchData.forEach((b) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchSales[code] = b.amount
        }
      })

      return {
        sNo: index + 1,
        productName: item.productName,
        totalQuantity: item.totalQuantity,
        totalAmount: item.totalAmount,
        branchSales,
      }
    })

    // Calculate Grand Totals
    const totals = formattedStats.reduce(
      (acc, curr) => ({
        totalQuantity: acc.totalQuantity + curr.totalQuantity,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { totalQuantity: 0, totalAmount: 0 },
    )

    payload.logger.info(`Generated Product Wise Report: ${formattedStats.length} products found`)

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      branchHeaders,
      stats: formattedStats,
      totals: {
        ...totals,
        branchTotals,
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    payload.logger.error({ msg: 'Product Report Error', error, stack: error.stack })
    return Response.json({ error: 'Failed to generate product report' }, { status: 500 })
  }
}
