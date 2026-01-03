import { BasePayload } from 'payload'
import { ObjectId } from 'mongodb'

// Helper to add granular reset matching to aggregation pipeline
// This is exported so it can be reused in getInventoryReport.ts
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

/**
 * Calculates current stock for a product in a branch
 */
export const getProductStock = async (
  payload: BasePayload,
  productId: string,
  branchId: string,
): Promise<number> => {
  const prodId = new ObjectId(productId)

  // 1. Initial Stock
  const StockOrderModel = payload.db.collections['stock-orders']
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
  addGranularMatch(initialStockPipeline)
  initialStockPipeline.push(
    { $match: { 'items.product': prodId, 'items.inStock': { $gt: 0 } } },
    {
      $group: {
        _id: null,
        total: { $sum: '$items.inStock' },
      },
    },
  )
  const [initialStock] = await StockOrderModel.aggregate(initialStockPipeline)

  // 2. Stock In (Received)
  const stockInPipeline: any[] = [
    {
      $match: {
        $expr: { $eq: [{ $toString: '$branch' }, branchId] },
      },
    },
  ]
  addGranularMatch(stockInPipeline, 'items.receivedDate')
  stockInPipeline.push(
    { $match: { 'items.product': prodId, 'items.receivedQty': { $gt: 0 } } },
    {
      $group: {
        _id: null,
        total: { $sum: '$items.receivedQty' },
      },
    },
  )
  const [stockIn] = await StockOrderModel.aggregate(stockInPipeline)

  // 3. Stock Out (Sold)
  const BillingModel = payload.db.collections['billings']
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
  addGranularMatch(stockOutPipeline)
  stockOutPipeline.push(
    { $match: { 'items.product': prodId } },
    {
      $group: {
        _id: null,
        total: { $sum: '$items.quantity' },
      },
    },
  )
  const [stockOut] = await BillingModel.aggregate(stockOutPipeline)

  // 4. Returns
  const ReturnOrderModel = payload.db.collections['return-orders']
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
  addGranularMatch(returnPipeline)
  returnPipeline.push(
    { $match: { 'items.product': prodId } },
    {
      $group: {
        _id: null,
        total: { $sum: '$items.quantity' },
      },
    },
  )
  const [returns] = await ReturnOrderModel.aggregate(returnPipeline)

  const currentStock =
    (initialStock?.total || 0) +
    (stockIn?.total || 0) -
    (stockOut?.total || 0) -
    (returns?.total || 0)

  return currentStock
}
