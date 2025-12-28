import { PayloadHandler, PayloadRequest } from 'payload'

export const getInventoryReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  try {
    // 1. Fetch all Products and Branches to build the skeleton
    // We use limit: 0 to get all docs
    const [productsResult, branchesResult] = await Promise.all([
      payload.find({
        collection: 'products',
        limit: 1000,
        pagination: false,
      }),
      payload.find({
        collection: 'branches',
        limit: 100,
        pagination: false,
      }),
    ])

    const products = productsResult.docs
    const branches = branchesResult.docs

    // 2. Aggregate Received Qty (Stock In)
    // We look at StockOrders. We sum 'items.receivedQty'.
    // We match any order that has valid items.
    const StockOrderModel = payload.db.collections['stock-orders']
    const stockInStats = await StockOrderModel.aggregate([
      {
        $unwind: '$items',
      },
      {
        $match: {
          'items.receivedQty': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: {
            branch: '$branch',
            product: '$items.product',
          },
          totalReceived: { $sum: '$items.receivedQty' },
        },
      },
    ])

    // 3. Aggregate Sold Qty (Stock Out)
    // We look at Billings. We sum 'items.quantity'.
    // Filter out cancelled bills.
    const BillingModel = payload.db.collections['billings']
    const stockOutStats = await BillingModel.aggregate([
      {
        $match: {
          status: { $ne: 'cancelled' },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: {
            branch: '$branch',
            product: '$items.product', // In Billings, checks relation
          },
          totalSold: { $sum: '$items.quantity' },
        },
      },
    ])

    // 4. Combine Data
    // We want a structure:
    // [
    //   {
    //     productId, productName,
    //     inventory: {
    //        branchId1: count,
    //        branchId2: count
    //     },
    //     totalInventory: number
    //   }
    // ]

    // Initialize map with all products
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
      // Initialize 0 for all known branches
      branches.forEach((b) => {
        inventoryMap[p.id].branches[b.id] = 0
      })
    })

    // Helper to get product ID safely
    const getId = (ref: any): string | null => {
      if (!ref) return null
      // If string, return as is
      if (typeof ref === 'string') return ref
      // If it has a string ID (Payload populated doc), use it
      if (ref.id && typeof ref.id === 'string') return ref.id
      // Fallback to toString() which handles MongoDB ObjectId correctly (returns hex string)
      // (ref.id on an ObjectId returns a Buffer, so we avoid that path if it's not a string)
      return ref.toString()
    }

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

    // Calculate Totals and Format Output
    const reportData = Object.entries(inventoryMap).map(([productId, data]) => {
      // Calculate row total
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

    // Sort by name
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
