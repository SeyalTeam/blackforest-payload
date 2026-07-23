import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type OtherProductsInventoryItem = {
  productId: string
  productName: string
  stockCount: number
  totalValue: number
  lastBillingDate: string
  dealerName?: string
  branchName?: string
}

export type OtherProductsInventoryGroup = {
  branchId: string
  branchName: string
  totalStockCount: number
  totalStockValue: number
  items: OtherProductsInventoryItem[]
}

export type OtherProductsInventoryResult = {
  groups: OtherProductsInventoryGroup[]
  meta: {
    grandTotalValue: number
    grandTotalStockCount: number
    totalProductsCount: number
  }
}

type OtherProductsInventoryArgs = {
  branch?: null | string
  dealer?: null | string
  product?: null | string
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toDateString = (value: unknown): string => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
  }
  return ''
}

const toNonEmptyString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export const getOtherProductsInventoryReportData = async (
  req: PayloadRequest,
  args: OtherProductsInventoryArgs = {},
): Promise<OtherProductsInventoryResult> => {
  const { payload } = req

  const branchParam = typeof args.branch === 'string' ? args.branch : ''
  const dealerParam = typeof args.dealer === 'string' ? args.dealer : ''
  const productParam = typeof args.product === 'string' ? args.product : ''

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

  const DealerBillingModel = payload.db.collections['dealer-billings']
  if (!DealerBillingModel) {
    throw new Error('Dealer Billings collection not found')
  }

  const selectedBranches = branchIds ?? []
  let selectedDealers: string[] = []
  if (dealerParam && dealerParam !== 'all') {
    selectedDealers = dealerParam.split(',').filter((id) => id.trim().length > 0)
  }

  let selectedProducts: string[] = []
  if (productParam && productParam !== 'all') {
    selectedProducts = productParam.split(',').filter((id) => id.trim().length > 0)
  }

  const matchQuery: Record<string, any> = {}

  const exprAnd: any[] = []
  if (selectedBranches.length > 0) {
    exprAnd.push({
      $in: [{ $toString: '$branch' }, selectedBranches],
    })
  }
  if (selectedDealers.length > 0) {
    exprAnd.push({
      $in: [{ $toString: '$dealer' }, selectedDealers],
    })
  }

  if (exprAnd.length > 0) {
    matchQuery.$expr = {
      $and: exprAnd,
    }
  }

  const pipeline: any[] = [
    {
      $match: matchQuery,
    },
    {
      $unwind: '$productsList',
    },
  ]

  if (selectedProducts.length > 0) {
    pipeline.push({
      $match: {
        $expr: {
          $in: [{ $toString: '$productsList.product' }, selectedProducts],
        },
      },
    })
  }

  pipeline.push(
    {
      $lookup: {
        from: 'branches',
        localField: 'branch',
        foreignField: '_id',
        as: 'branchInfo',
      },
    },
    {
      $unwind: {
        path: '$branchInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'dealers',
        localField: 'dealer',
        foreignField: '_id',
        as: 'dealerInfo',
      },
    },
    {
      $unwind: {
        path: '$dealerInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'products',
        let: { prodId: '$productsList.product' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$_id',
                  { $convert: { input: '$$prodId', to: 'objectId', onError: '$$prodId', onNull: '$$prodId' } },
                ],
              },
            },
          },
        ],
        as: 'productInfo',
      },
    },
    {
      $unwind: {
        path: '$productInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: {
          branch: '$branch',
          product: '$productsList.product',
        },
        branchName: { $first: { $ifNull: ['$branchInfo.name', 'Unknown Branch'] } },
        dealerName: { $first: { $ifNull: ['$dealerInfo.companyName', { $ifNull: ['$dealerInfo.name', 'Unknown Dealer'] }] } },
        productName: { $first: { $ifNull: ['$productInfo.name', 'Unknown Product'] } },
        stockCount: { $sum: { $ifNull: ['$productsList.quantity', 0] } },
        totalValue: { $sum: { $ifNull: ['$productsList.totalAmount', 0] } },
        lastBillingDate: { $max: '$date' },
      },
    },
    {
      $group: {
        _id: '$_id.branch',
        branchName: { $first: '$branchName' },
        totalStockCount: { $sum: '$stockCount' },
        totalStockValue: { $sum: '$totalValue' },
        items: {
          $push: {
            productId: { $toString: '$_id.product' },
            productName: '$productName',
            stockCount: '$stockCount',
            totalValue: '$totalValue',
            lastBillingDate: '$lastBillingDate',
            dealerName: '$dealerName',
            branchName: '$branchName',
          },
        },
      },
    },
    {
      $sort: { totalStockValue: -1 },
    },
  )

  const rawGroups = await DealerBillingModel.aggregate(pipeline)

  let grandTotalValue = 0
  let grandTotalStockCount = 0
  let totalProductsCount = 0

  const groups: OtherProductsInventoryGroup[] = (rawGroups || []).map((group: any) => {
    const branchStockCount = toNumber(group.totalStockCount)
    const branchStockValue = toNumber(group.totalStockValue)

    grandTotalStockCount += branchStockCount
    grandTotalValue += branchStockValue

    const items: OtherProductsInventoryItem[] = (Array.isArray(group.items) ? group.items : [])
      .map((item: any) => {
        totalProductsCount += 1
        return {
          productId: toNonEmptyString(item.productId),
          productName: toNonEmptyString(item.productName, 'Unknown Product').trim(),
          stockCount: toNumber(item.stockCount),
          totalValue: toNumber(item.totalValue),
          lastBillingDate: toDateString(item.lastBillingDate),
          dealerName: toNonEmptyString(item.dealerName),
          branchName: toNonEmptyString(item.branchName),
        }
      })
      .sort((a: OtherProductsInventoryItem, b: OtherProductsInventoryItem) => b.totalValue - a.totalValue)

    return {
      branchId: toNonEmptyString(group._id),
      branchName: toNonEmptyString(group.branchName, 'Unknown Branch'),
      totalStockCount: branchStockCount,
      totalStockValue: branchStockValue,
      items,
    }
  })

  return {
    groups,
    meta: {
      grandTotalValue,
      grandTotalStockCount,
      totalProductsCount,
    },
  }
}
