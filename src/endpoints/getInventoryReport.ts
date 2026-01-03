import { PayloadHandler, PayloadRequest } from 'payload'
import { addGranularMatch } from '../utilities/inventory'

export const getInventoryReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  try {
    const { department, category, product, branch } = req.query as Record<string, string>

    // 1. Handle Department filter (Products link to Category, Category links to Department)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { and: [] }

    if (department && department !== 'all') {
      const categoriesInDept = await payload.find({
        collection: 'categories',
        where: { department: { equals: department } },
        limit: 1000,
        pagination: false,
      })
      const categoryIds = categoriesInDept.docs.map((c) => c.id)
      query.and.push({ category: { in: categoryIds } })
    }

    if (category && category !== 'all') {
      query.and.push({ category: { equals: category } })
    }

    if (product && product !== 'all') {
      query.and.push({ id: { equals: product } })
    }

    if (query.and.length === 0) delete query.and

    // 2. Handle Branch filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const branchQuery: any = { and: [] }
    if (branch && branch !== 'all') {
      branchQuery.and.push({ id: { equals: branch } })
    }
    if (branchQuery.and.length === 0) delete branchQuery.and

    const [productsResult, branchesResult] = await Promise.all([
      payload.find({
        collection: 'products',
        where: query,
        limit: 1000,
        pagination: false,
      }),
      payload.find({
        collection: 'branches',
        where: branchQuery,
        limit: 100,
        pagination: false,
      }),
    ])

    const products = productsResult.docs
    const branches = branchesResult.docs

    const branchIds = branches.map((b) => b.id)

    // 3. Aggregate Received Qty (Stock In)
    const StockOrderModel = payload.db.collections['stock-orders']

    // Fetch Initial Stock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialStockPipeline: any[] = [
      {
        $match: {
          $and: [
            { $expr: { $in: [{ $toString: '$branch' }, branchIds] } },
            { notes: 'INITIAL STOCK' },
          ],
        },
      },
    ]
    addGranularMatch(initialStockPipeline)
    initialStockPipeline.push(
      { $match: { 'items.inStock': { $gt: 0 } } },
      {
        $group: {
          _id: {
            branch: '$branch',
            product: '$items.product',
          },
          totalInStock: { $sum: '$items.inStock' },
        },
      },
    )
    const initialStockStats = await StockOrderModel.aggregate(initialStockPipeline)

    // Stock In
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stockInPipeline: any[] = [
      {
        $match: {
          $expr: { $in: [{ $toString: '$branch' }, branchIds] },
        },
      },
    ]
    addGranularMatch(stockInPipeline, 'items.receivedDate')
    stockInPipeline.push(
      { $match: { 'items.receivedQty': { $gt: 0 } } },
      {
        $group: {
          _id: {
            branch: '$branch',
            product: '$items.product',
          },
          totalReceived: { $sum: '$items.receivedQty' },
        },
      },
    )
    const stockInStats = await StockOrderModel.aggregate(stockInPipeline)

    // 4. Aggregate Sold Qty (Stock Out)
    const BillingModel = payload.db.collections['billings']
    const stockOutPipeline: any[] = [
      {
        $match: {
          $and: [
            { $expr: { $in: [{ $toString: '$branch' }, branchIds] } },
            { status: { $ne: 'cancelled' } },
          ],
        },
      },
    ]
    addGranularMatch(stockOutPipeline)
    stockOutPipeline.push({
      $group: {
        _id: {
          branch: '$branch',
          product: '$items.product',
        },
        totalSold: { $sum: '$items.quantity' },
      },
    })
    const stockOutStats = await BillingModel.aggregate(stockOutPipeline)

    // 5. Aggregate Returned Qty
    const ReturnOrderModel = payload.db.collections['return-orders']
    const returnPipeline: any[] = [
      {
        $match: {
          $and: [
            { $expr: { $in: [{ $toString: '$branch' }, branchIds] } },
            { status: { $ne: 'cancelled' } },
          ],
        },
      },
    ]
    addGranularMatch(returnPipeline)
    returnPipeline.push({
      $group: {
        _id: {
          branch: '$branch',
          product: '$items.product',
        },
        totalReturned: { $sum: '$items.quantity' },
      },
    })
    const returnStats = await ReturnOrderModel.aggregate(returnPipeline)

    // 6. Combine Data
    const inventoryMap: Record<
      string,
      {
        name: string
        totalInventory: number
        branches: Record<string, number>
      }
    > = {}

    products.forEach((p) => {
      inventoryMap[p.id] = {
        name: p.name,
        totalInventory: 0,
        branches: {},
      }
      branches.forEach((b) => {
        inventoryMap[p.id].branches[b.id] = 0
      })
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getId = (ref: any): string | null => {
      if (!ref) return null
      if (typeof ref === 'string') return ref
      if (ref.id && typeof ref.id === 'string') return ref.id
      return ref.toString()
    }

    // Process Initial Stock
    initialStockStats.forEach((stat) => {
      const branchId = getId(stat._id.branch)
      const productId = getId(stat._id.product)
      const inStock = stat.totalInStock || 0

      if (
        branchId &&
        productId &&
        inventoryMap[productId] &&
        inventoryMap[productId].branches[branchId] !== undefined
      ) {
        inventoryMap[productId].branches[branchId] += inStock
      }
    })

    // Process Stock In
    stockInStats.forEach((stat) => {
      const branchId = getId(stat._id.branch)
      const productId = getId(stat._id.product)
      const received = stat.totalReceived || 0

      if (
        branchId &&
        productId &&
        inventoryMap[productId] &&
        inventoryMap[productId].branches[branchId] !== undefined
      ) {
        inventoryMap[productId].branches[branchId] += received
      }
    })

    // Process Stock Out
    stockOutStats.forEach((stat) => {
      const branchId = getId(stat._id.branch)
      const productId = getId(stat._id.product)
      const sold = stat.totalSold || 0

      if (
        branchId &&
        productId &&
        inventoryMap[productId] &&
        inventoryMap[productId].branches[branchId] !== undefined
      ) {
        inventoryMap[productId].branches[branchId] -= sold
      }
    })

    // Process Returns
    returnStats.forEach((stat) => {
      const branchId = getId(stat._id.branch)
      const productId = getId(stat._id.product)
      const returned = stat.totalReturned || 0

      if (
        branchId &&
        productId &&
        inventoryMap[productId] &&
        inventoryMap[productId].branches[branchId] !== undefined
      ) {
        inventoryMap[productId].branches[branchId] -= returned
      }
    })

    // Calculate Totals and Format Output
    const reportData = Object.entries(inventoryMap).map(([productId, data]) => {
      const totalInventory = Object.values(data.branches).reduce((a, b) => a + b, 0)

      return {
        id: productId,
        name: data.name,
        totalInventory,
        branches: branches.map((b) => ({
          id: b.id,
          name: b.name,
          inventory: data.branches[b.id] || 0,
        })),
      }
    })

    reportData.sort((a, b) => a.name.localeCompare(b.name))

    return Response.json({
      timestamp: new Date().toISOString(),
      products: reportData,
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json(
      {
        error: 'Failed to generate inventory report',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
