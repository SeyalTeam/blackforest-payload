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
    if (!BillingModel) {
      throw new Error('Billings collection not found')
    }

    // Construct match query
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

    // 2. Aggregate Data (Billings)
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

    // Apply Filter to Aggregation Pipeline
    if (categoryParam && categoryParam !== 'all') {
      aggregationPipeline.push({
        $match: { 'categoryDetails._id': { $eq: new mongoose.Types.ObjectId(categoryParam) } },
      })
    }
    if (departmentParam && departmentParam !== 'all') {
      aggregationPipeline.push({
        $match: {
          'categoryDetails.department': { $eq: new mongoose.Types.ObjectId(departmentParam) },
        },
      })
    }
    if (productParam && productParam !== 'all') {
      aggregationPipeline.push({
        $match: { 'items.product': { $eq: new mongoose.Types.ObjectId(productParam) } },
      })
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

    // 2b. Fetch Stock & Return Data
    // ensuring consistency with StockOrderReport logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stockWhere: any = {
      deliveryDate: {
        greater_than_equal: startOfDay.toISOString(),
        less_than_equal: endOfDay.toISOString(),
      },
    }

    // Return Orders Where Clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const returnWhere: any = {
      createdAt: {
        greater_than_equal: startOfDay.toISOString(),
        less_than_equal: endOfDay.toISOString(),
      },
      status: {
        not_equals: 'cancelled',
      },
    }

    if (branchParam && branchParam !== 'all') {
      stockWhere.branch = { equals: branchParam }
      returnWhere.branch = { equals: branchParam }
    }

    // Execute Billing, Stock, and Return Fetches in parallel
    const [rawStatsResult, stockOrdersResult, returnOrdersResult] = await Promise.all([
      BillingModel.aggregate(aggregationPipeline),
      payload.find({
        collection: 'stock-orders',
        where: stockWhere,
        depth: 2, // Populate Product -> Category -> Dept
        limit: 5000,
        pagination: false,
      }),
      payload.find({
        collection: 'return-orders',
        where: returnWhere,
        depth: 2,
        limit: 5000,
        pagination: false,
      }),
    ])

    const rawStats = rawStatsResult as unknown as RawStat[]
    const stockOrders = stockOrdersResult.docs
    const returnOrders = returnOrdersResult.docs

    // Map Stock Stats: Key = "ProductName_BranchId" -> Quantity
    const stockMap = new Map<string, number>()
    // Map Return Stats: Key = "ProductName_BranchId" -> Quantity
    const returnMap = new Map<string, number>()

    const processItems = (
      items: any[],
      branchId: string,
      map: Map<string, number>,
      field: string,
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items.forEach((item: any) => {
        const product = item.product
        if (!product || typeof product !== 'object') return

        // Memory Filters
        if (productParam && productParam !== 'all' && product.id !== productParam) return
        if (categoryParam && categoryParam !== 'all') {
          const catId =
            typeof product.category === 'object' ? product.category?.id : product.category
          if (catId !== categoryParam) return
        }
        if (departmentParam && departmentParam !== 'all') {
          const cat = typeof product.category === 'object' ? product.category : null
          const deptId =
            cat && typeof cat.department === 'object' ? cat.department?.id : cat?.department
          if (deptId !== departmentParam) return
        }

        const qty = item[field] || 0
        if (qty > 0) {
          const key = `${product.name}_${branchId}`
          map.set(key, (map.get(key) || 0) + qty)
        }
      })
    }

    stockOrders.forEach((order) => {
      const bId = typeof order.branch === 'object' ? order.branch?.id : order.branch
      if (!bId) return
      if (order.items && Array.isArray(order.items)) {
        processItems(order.items, bId, stockMap, 'receivedQty')
      }
    })

    returnOrders.forEach((order) => {
      const bId = typeof order.branch === 'object' ? order.branch?.id : order.branch
      if (!bId) return
      if (order.items && Array.isArray(order.items)) {
        processItems(order.items, bId, returnMap, 'quantity')
      }
    })

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
      const branchSales: Record<
        string,
        { amount: number; quantity: number; stockQuantity: number; returnQuantity: number }
      > = {}

      item.branchData.forEach((b) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]

          // Get Stock Qty
          const key = `${item.productName}_${bId}`
          const stockQty = stockMap.get(key) || 0
          const returnQty = returnMap.get(key) || 0

          branchSales[code] = {
            amount: b.amount,
            quantity: b.quantity,
            stockQuantity: stockQty,
            returnQuantity: returnQty,
          }
        }
      })

      // Ensure all headers have data
      branchHeaders.forEach((headerCode) => {
        if (!branchSales[headerCode]) {
          // Find branch ID for this code
          let bId = ''
          for (const [id, code] of Object.entries(branchMap)) {
            if (code === headerCode) {
              bId = id
              break
            }
          }
          if (bId) {
            const key = `${item.productName}_${bId}`
            const stockQty = stockMap.get(key) || 0
            const returnQty = returnMap.get(key) || 0
            branchSales[headerCode] = {
              amount: 0,
              quantity: 0,
              stockQuantity: stockQty,
              returnQuantity: returnQty,
            }
          } else {
            branchSales[headerCode] = {
              amount: 0,
              quantity: 0,
              stockQuantity: 0,
              returnQuantity: 0,
            }
          }
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
