import { BasePayload } from 'payload'
import { ObjectId } from 'mongodb'

// Helper to add granular reset matching to aggregation pipeline
// This is exported so it can be reused in getInventoryReport.ts
// It uses $lookup which is necessary when processing documents from multiple branches in one pipeline
export const addGranularMatch = (pipeline: any[], dateField: string = 'createdAt') => {
  // 1. Unwind items first
  pipeline.push({ $unwind: '$items' })

  // 2. Lookup branch to get productResets
  pipeline.push({
    $lookup: {
      from: 'branches',
      let: { bId: '$branch' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: [{ $toString: '$_id' }, { $toString: '$$bId' }] },
          },
        },
      ],
      as: 'branchData',
    },
  })
  pipeline.push({ $unwind: '$branchData' })

  // 3. Add applicable reset date for the product
  pipeline.push({
    $addFields: {
      appliedResetDate: {
        $let: {
          vars: {
            productReset: {
              $filter: {
                input: { $ifNull: ['$branchData.productResets', []] },
                as: 'pr',
                cond: { $eq: [{ $toString: '$$pr.product' }, { $toString: '$items.product' }] },
              },
            },
          },
          in: {
            $max: [
              { $ifNull: ['$branchData.inventoryResetDate', new Date(0)] },
              { $ifNull: [{ $arrayElemAt: ['$$productReset.resetDate', 0] }, new Date(0)] },
            ],
          },
        },
      },
    },
  })

  // 4. Match items that are after the reset date
  pipeline.push({
    $match: {
      $expr: {
        $gte: [{ $toDate: `$${dateField}` }, { $toDate: '$appliedResetDate' }],
      },
    },
  })
}

// Optimized version of Granular Match that uses pre-fetched branch data
// Best for single-branch lookups to avoid expensive $lookups
export const addOptimizedGranularMatch = (
  pipeline: any[],
  branch: any,
  dateField: string = 'createdAt',
) => {
  pipeline.push({ $unwind: '$items' })

  // Instead of $lookup, we use the pre-fetched branch data
  const inventoryResetDate = branch.inventoryResetDate ? new Date(branch.inventoryResetDate) : new Date(0)
  const productResets = branch.productResets || []

  pipeline.push({
    $addFields: {
      appliedResetDate: {
        $let: {
          vars: {
            productReset: {
              $filter: {
                input: productResets,
                as: 'pr',
                cond: { $eq: [{ $toString: '$$pr.product' }, { $toString: '$items.product' }] },
              },
            },
          },
          in: {
            $max: [
              inventoryResetDate,
              { $ifNull: [{ $arrayElemAt: ['$$productReset.resetDate', 0] }, new Date(0)] },
            ],
          },
        },
      },
    },
  })

  pipeline.push({
    $match: {
      $expr: {
        $gte: [{ $toDate: `$${dateField}` }, { $toDate: '$appliedResetDate' }],
      },
    },
  })
}

/**
 * Calculates current stock for multiple products in a branch efficiently
 */
export const getMultipleProductsStock = async (
  payload: BasePayload,
  productIds: string[],
  branchId: string,
): Promise<Map<string, number>> => {
  const stockMap = new Map<string, number>()
  if (productIds.length === 0) return stockMap

  const productObjectIds = productIds.map((id) => new ObjectId(id))

  // 0. Fetch branch once
  const branch = await payload.findByID({
    collection: 'branches',
    id: branchId,
    depth: 0,
    overrideAccess: true,
  })

  const aggregateStock = async (collectionSlug: string, pipeline: any[], valueField: string) => {
    const model = payload.db.collections[collectionSlug]
    const results = await model.aggregate(pipeline)
    return results
  }

  // Define common matching for multiple products
  const productMatch = { 'items.product': { $in: productObjectIds } }

  // 1. Initial Stock
  const initialStockPipeline: any[] = [
    {
      $match: {
        $and: [
          { $expr: { $eq: [{ $toString: '$branch' }, branchId] } },
          { notes: 'INITIAL STOCK' },
        ],
      },
    },
  ]
  addOptimizedGranularMatch(initialStockPipeline, branch)
  initialStockPipeline.push(
    { $match: { ...productMatch, 'items.inStock': { $gt: 0 } } },
    {
      $group: {
        _id: '$items.product',
        total: { $sum: '$items.inStock' },
      },
    },
  )
  const initialStocks = await aggregateStock('stock-orders', initialStockPipeline, 'total')

  // 2. Stock In (Received)
  const stockInPipeline: any[] = [
    {
      $match: {
        $expr: { $eq: [{ $toString: '$branch' }, branchId] },
      },
    },
  ]
  addOptimizedGranularMatch(stockInPipeline, branch, 'items.receivedDate')
  stockInPipeline.push(
    { $match: { ...productMatch, 'items.receivedQty': { $gt: 0 } } },
    {
      $group: {
        _id: '$items.product',
        total: { $sum: '$items.receivedQty' },
      },
    },
  )
  const stockIns = await aggregateStock('stock-orders', stockInPipeline, 'total')

  // 3. Stock Out (Sold)
  const stockOutPipeline: any[] = [
    {
      $match: {
        $and: [
          { $expr: { $eq: [{ $toString: '$branch' }, branchId] } },
          { status: { $ne: 'cancelled' } },
        ],
      },
    },
  ]
  addOptimizedGranularMatch(stockOutPipeline, branch)
  stockOutPipeline.push(
    { $match: productMatch },
    {
      $group: {
        _id: '$items.product',
        total: { $sum: '$items.quantity' },
      },
    },
  )
  const stockOuts = await aggregateStock('billings', stockOutPipeline, 'total')

  // 4. Returns
  const returnPipeline: any[] = [
    {
      $match: {
        $and: [
          { $expr: { $eq: [{ $toString: '$branch' }, branchId] } },
          { status: { $ne: 'cancelled' } },
        ],
      },
    },
  ]
  addOptimizedGranularMatch(returnPipeline, branch)
  returnPipeline.push(
    { $match: productMatch },
    {
      $group: {
        _id: '$items.product',
        total: { $sum: '$items.quantity' },
      },
    },
  )
  const returns = await aggregateStock('return-orders', returnPipeline, 'total')

  // 5. Instock Entries
  const instockPipeline: any[] = [
    {
      $match: {
        $and: [{ $expr: { $eq: [{ $toString: '$branch' }, branchId] } }, { status: 'approved' }],
      },
    },
  ]
  addOptimizedGranularMatch(instockPipeline, branch)
  instockPipeline.push(
    { $match: { ...productMatch, 'items.instock': { $gt: 0 } } },
    {
      $group: {
        _id: '$items.product',
        total: { $sum: '$items.instock' },
      },
    },
  )
  const instockAddeds = await aggregateStock('instock-entries', instockPipeline, 'total')

  // Merge all totals into the map
  const updateMap = (results: any[], sign: number) => {
    results.forEach((r) => {
      const pid = r._id.toString()
      stockMap.set(pid, (stockMap.get(pid) || 0) + r.total * sign)
    })
  }

  updateMap(initialStocks, 1)
  updateMap(stockIns, 1)
  updateMap(instockAddeds, 1)
  updateMap(stockOuts, -1)
  updateMap(returns, -1)

  // Ensure all requested products are in the map
  productIds.forEach((id) => {
    if (!stockMap.has(id)) stockMap.set(id, 0)
  })

  return stockMap
}

/**
 * Calculates current stock for a product in a branch
 */
export const getProductStock = async (
  payload: BasePayload,
  productId: string,
  branchId: string,
): Promise<number> => {
  const stockMap = await getMultipleProductsStock(payload, [productId], branchId)
  return stockMap.get(productId) || 0
}
