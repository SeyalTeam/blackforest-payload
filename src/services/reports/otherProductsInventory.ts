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
  variantName?: string
  stockCount: number
  standardStockLevel?: number
  minimumStockLevel?: number
  maximumStockLevel?: number
  packSize?: number
  variants?: {
    name: string
    weight?: number
    unit?: string
    standardStockLevel?: number
    minimumStockLevel?: number
    maximumStockLevel?: number
    purchaseFrequency?: string
  }[]
  totalValue: number
  lastBillingDate: string
  dealerName?: string
  branchName?: string
  purchaseFrequency?: string
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
  purchaseFrequency?: null | string
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
  const purchaseFrequencyParam = typeof args.purchaseFrequency === 'string' ? args.purchaseFrequency : ''

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
    ...(purchaseFrequencyParam && purchaseFrequencyParam !== 'all'
      ? [
          {
            $match: {
              $or: [
                { 'productInfo.purchaseFrequency': purchaseFrequencyParam },
                { 'productInfo.variants.purchaseFrequency': purchaseFrequencyParam },
              ],
            },
          },
        ]
      : []),
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
        standardStockLevel: { $first: '$productInfo.standardStockLevel' },
        minimumStockLevel: { $first: '$productInfo.minimumStockLevel' },
        maximumStockLevel: { $first: '$productInfo.maximumStockLevel' },
        packSize: { $first: '$productInfo.packSize' },
        purchaseFrequency: { $first: '$productInfo.purchaseFrequency' },
        variants: { $first: '$productInfo.variants' },
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
            standardStockLevel: '$standardStockLevel',
            minimumStockLevel: '$minimumStockLevel',
            maximumStockLevel: '$maximumStockLevel',
            packSize: '$packSize',
            purchaseFrequency: '$purchaseFrequency',
            variants: '$variants',
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

    const items: OtherProductsInventoryItem[] = []

    ;(Array.isArray(group.items) ? group.items : []).forEach((item: any) => {
      const baseName = toNonEmptyString(item.productName, 'Unknown Product').trim()
      const variants = Array.isArray(item.variants) ? item.variants : []
      const baseStock = toNumber(item.stockCount)
      const baseValue = toNumber(item.totalValue)

      if (variants.length > 0) {
        variants.forEach((v: any, vIdx: number) => {
          const variantFrequency = toNonEmptyString(v.purchaseFrequency, toNonEmptyString(item.purchaseFrequency))
          if (purchaseFrequencyParam && purchaseFrequencyParam !== 'all' && variantFrequency !== purchaseFrequencyParam) {
            return
          }
          totalProductsCount += 1
          items.push({
            productId: `${toNonEmptyString(item.productId)}-v${vIdx}`,
            productName: `${baseName} (${v.name})`,
            variantName: v.name,
            stockCount: baseStock,
            standardStockLevel:
              v.standardStockLevel !== undefined && v.standardStockLevel !== null
                ? toNumber(v.standardStockLevel)
                : item.standardStockLevel !== undefined && item.standardStockLevel !== null
                  ? toNumber(item.standardStockLevel)
                  : undefined,
            minimumStockLevel:
              v.minimumStockLevel !== undefined && v.minimumStockLevel !== null
                ? toNumber(v.minimumStockLevel)
                : item.minimumStockLevel !== undefined && item.minimumStockLevel !== null
                  ? toNumber(item.minimumStockLevel)
                  : undefined,
            maximumStockLevel:
              v.maximumStockLevel !== undefined && v.maximumStockLevel !== null
                ? toNumber(v.maximumStockLevel)
                : item.maximumStockLevel !== undefined && item.maximumStockLevel !== null
                  ? toNumber(item.maximumStockLevel)
                  : undefined,
            packSize:
              v.weight !== undefined && v.weight !== null
                ? toNumber(v.weight)
                : item.packSize !== undefined && item.packSize !== null
                  ? toNumber(item.packSize)
                  : undefined,
            variants: [v],
            totalValue: baseValue,
            lastBillingDate: toDateString(item.lastBillingDate),
            dealerName: toNonEmptyString(item.dealerName),
            branchName: toNonEmptyString(item.branchName),
            purchaseFrequency: variantFrequency,
          })
        })
      } else {
        totalProductsCount += 1
        items.push({
          productId: toNonEmptyString(item.productId),
          productName: baseName,
          stockCount: baseStock,
          standardStockLevel:
            item.standardStockLevel !== undefined && item.standardStockLevel !== null
              ? toNumber(item.standardStockLevel)
              : undefined,
          minimumStockLevel:
            item.minimumStockLevel !== undefined && item.minimumStockLevel !== null
              ? toNumber(item.minimumStockLevel)
              : undefined,
          maximumStockLevel:
            item.maximumStockLevel !== undefined && item.maximumStockLevel !== null
              ? toNumber(item.maximumStockLevel)
              : undefined,
          packSize:
            item.packSize !== undefined && item.packSize !== null
              ? toNumber(item.packSize)
              : undefined,
          totalValue: baseValue,
          lastBillingDate: toDateString(item.lastBillingDate),
          dealerName: toNonEmptyString(item.dealerName),
          branchName: toNonEmptyString(item.branchName),
          purchaseFrequency: toNonEmptyString(item.purchaseFrequency),
        })
      }
    })

    items.sort((a, b) => b.totalValue - a.totalValue)

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
