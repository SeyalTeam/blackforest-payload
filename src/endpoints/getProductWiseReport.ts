import { PayloadRequest, PayloadHandler } from 'payload'
import mongoose from 'mongoose'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

interface BranchData {
  branchId: string
  amount: number
  quantity: number
}

interface RawStat {
  productName: string
  price: number
  unit: string
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
  const categoryParam = typeof req.query.category === 'string' ? req.query.category : ''
  const departmentParam = typeof req.query.department === 'string' ? req.query.department : ''
  const productParam = typeof req.query.product === 'string' ? req.query.product : ''

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
      const branchIds = branchParam.split(',').filter(Boolean)
      if (branchIds.length > 0) {
        matchQuery.$expr = {
          $in: [{ $toString: '$branch' }, branchIds],
        }
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
          let: { productId: '$items.product' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$productId'] },
                    { $eq: [{ $toString: '$_id' }, '$$productId'] },
                    {
                      $eq: [
                        '$_id',
                        {
                          $convert: {
                            input: '$$productId',
                            to: 'objectId',
                            onError: null,
                            onNull: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'productDetails',
        },
      },
      {
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'categories',
          let: { categoryId: '$productDetails.category' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$categoryId'] },
                    { $eq: [{ $toString: '$_id' }, '$$categoryId'] },
                    {
                      $eq: [
                        '$_id',
                        {
                          $convert: {
                            input: '$$categoryId',
                            to: 'objectId',
                            onError: null,
                            onNull: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'categoryDetails',
        },
      },
      {
        $unwind: {
          path: '$categoryDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
    ]

    // Apply Category Filter if present
    if (categoryParam && categoryParam !== 'all') {
      const catIds = categoryParam.split(',').filter(Boolean)
      if (catIds.length > 0) {
        aggregationPipeline.push({
          $match: {
            'categoryDetails._id': {
              $in: catIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
        })
      }
    } else {
      // If "all" categories, we still might want to exclude items that failed lookup if they are invalid
      // But typically we show what we found.
      // However, the original code had $unwind which dropped items without products/categories.
      // To maintain similar behavior (only show items with valid products/categories) when not filtering:
      aggregationPipeline.push({
        $match: {
          'productDetails._id': { $exists: true },
          'categoryDetails._id': { $exists: true },
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

    // Apply Product Filter if present
    if (productParam && productParam !== 'all') {
      const prodIds = productParam.split(',').filter(Boolean)
      if (prodIds.length > 0) {
        aggregationPipeline.push({
          $match: {
            'items.product': {
              $in: prodIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
        })
      }
    }

    aggregationPipeline.push(
      {
        $group: {
          _id: {
            productName: '$productDetails.name',
            branchId: '$branch',
            price: '$productDetails.defaultPriceDetails.price',
            unit: '$productDetails.defaultPriceDetails.unit',
          },
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.subtotal' }, // Assuming subtotal is at item level
        },
      },
      {
        $group: {
          _id: '$_id.productName',
          price: { $first: '$_id.price' },
          unit: { $first: '$_id.unit' },
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
          productName: '$_id',
          price: 1,
          unit: 1,
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
      const branchSales: Record<string, { amount: number; quantity: number }> = {}

      item.branchData.forEach((b) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchSales[code] = { amount: b.amount, quantity: b.quantity }
        }
      })

      return {
        sNo: index + 1,
        productName: item.productName,
        price: item.price || 0,
        unit: item.unit || '',
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
