import { PayloadRequest, PayloadHandler } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import mongoose from 'mongoose'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

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

  // Start of day (00:00:00) for startDate
  const startAndYear = parseInt(startDateParam.split('-')[0])
  const startAndMonth = parseInt(startDateParam.split('-')[1])
  const startAndDay = parseInt(startDateParam.split('-')[2])
  const startOfDay = dayjs
    .tz(`${startAndYear}-${startAndMonth}-${startAndDay}`, 'YYYY-MM-DD', 'Asia/Kolkata')
    .startOf('day')
    .toDate()

  // End of day (23:59:59) for endDate
  const endAndYear = parseInt(endDateParam.split('-')[0])
  const endAndMonth = parseInt(endDateParam.split('-')[1])
  const endAndDay = parseInt(endDateParam.split('-')[2])
  const endOfDay = dayjs
    .tz(`${endAndYear}-${endAndMonth}-${endAndDay}`, 'YYYY-MM-DD', 'Asia/Kolkata')
    .endOf('day')
    .toDate()

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

    const categoryParam = typeof req.query.category === 'string' ? req.query.category : ''

    if (branchParam && branchParam !== 'all') {
      const branchIds = branchParam.split(',').filter(Boolean)
      if (branchIds.length > 0) {
        matchQuery.$expr = {
          $in: [{ $toString: '$branch' }, branchIds],
        }
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

    // Apply Category Filter if present
    if (categoryParam && categoryParam !== 'all') {
      const catIds = categoryParam.split(',').filter(Boolean)
      if (catIds.length > 0) {
        pipeline.push({
          $match: {
            'categoryDetails._id': {
              $in: catIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
        })
      }
    }

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
