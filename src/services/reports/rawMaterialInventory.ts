import { PayloadRequest } from 'payload'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

export type RawMaterialInventoryItem = {
  rawMaterialId: string
  rawMaterialName: string
  variantName?: string
  unit: string
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
  }[]
  totalValue: number
  lastBillingDate: string
  dealerName?: string
  companyName?: string
}

export type RawMaterialInventoryGroup = {
  companyId: string
  companyName: string
  totalStockCount: number
  totalStockValue: number
  items: RawMaterialInventoryItem[]
}

export type RawMaterialInventoryResult = {
  groups: RawMaterialInventoryGroup[]
  meta: {
    grandTotalValue: number
    grandTotalStockCount: number
    totalRawMaterialsCount: number
  }
}

type RawMaterialInventoryArgs = {
  branch?: null | string
  dealer?: null | string
  rawMaterial?: null | string
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toNonEmptyString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export const getRawMaterialInventoryReportData = async (
  req: PayloadRequest,
  args: RawMaterialInventoryArgs = {},
): Promise<RawMaterialInventoryResult> => {
  const { payload } = req

  const branchParam = typeof args.branch === 'string' ? args.branch : ''
  const dealerParam = typeof args.dealer === 'string' ? args.dealer : ''
  const rawMaterialParam = typeof args.rawMaterial === 'string' ? args.rawMaterial : ''

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

  const RawMaterialBillingModel = payload.db.collections['raw-material-billings']
  if (!RawMaterialBillingModel) {
    throw new Error('Raw Material Billings collection not found')
  }

  const selectedBranches = branchIds ?? []
  let selectedDealers: string[] = []
  if (dealerParam && dealerParam !== 'all') {
    selectedDealers = dealerParam.split(',').filter((id) => id.trim().length > 0)
  }

  let selectedRawMaterials: string[] = []
  if (rawMaterialParam && rawMaterialParam !== 'all') {
    selectedRawMaterials = rawMaterialParam.split(',').filter((id) => id.trim().length > 0)
  }

  const matchQuery: Record<string, any> = {}

  const exprAnd: any[] = []
  if (selectedBranches.length > 0) {
    exprAnd.push({
      $in: [{ $toString: '$company' }, selectedBranches],
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
      $unwind: '$rawMaterialsList',
    },
  ]

  if (selectedRawMaterials.length > 0) {
    pipeline.push({
      $match: {
        $expr: {
          $in: [{ $toString: '$rawMaterialsList.rawMaterial' }, selectedRawMaterials],
        },
      },
    })
  }

  pipeline.push(
    {
      $lookup: {
        from: 'companies',
        localField: 'company',
        foreignField: '_id',
        as: 'companyInfo',
      },
    },
    {
      $unwind: {
        path: '$companyInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'raw-material-dealers',
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
        from: 'raw-materials',
        let: { rmId: '$rawMaterialsList.rawMaterial' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$_id',
                  { $convert: { input: '$$rmId', to: 'objectId', onError: '$$rmId', onNull: '$$rmId' } },
                ],
              },
            },
          },
        ],
        as: 'rawMaterialInfo',
      },
    },
    {
      $unwind: {
        path: '$rawMaterialInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: {
          company: '$company',
          rawMaterial: '$rawMaterialsList.rawMaterial',
        },
        companyName: { $first: { $ifNull: ['$companyInfo.name', 'Unknown Company'] } },
        dealerName: { $first: { $ifNull: ['$dealerInfo.name', { $ifNull: ['$dealerInfo.companyName', 'Unknown Dealer'] }] } },
        rawMaterialName: { $first: { $ifNull: ['$rawMaterialInfo.name', 'Unknown Raw Material'] } },
        unit: { $first: { $ifNull: ['$rawMaterialInfo.unit', '-'] } },
        stockCount: { $sum: { $ifNull: ['$rawMaterialsList.quantity', 0] } },
        standardStockLevel: { $first: '$rawMaterialInfo.standardStockLevel' },
        minimumStockLevel: { $first: '$rawMaterialInfo.minimumStockLevel' },
        maximumStockLevel: { $first: '$rawMaterialInfo.maximumStockLevel' },
        packSize: { $first: '$rawMaterialInfo.packSize' },
        variants: { $first: '$rawMaterialInfo.variants' },
        totalValue: { $sum: { $ifNull: ['$rawMaterialsList.totalAmount', 0] } },
        lastBillingDate: { $max: '$date' },
      },
    },
    {
      $group: {
        _id: '$_id.company',
        companyName: { $first: '$companyName' },
        totalStockCount: { $sum: '$stockCount' },
        totalStockValue: { $sum: '$totalValue' },
        items: {
          $push: {
            rawMaterialId: { $toString: '$_id.rawMaterial' },
            rawMaterialName: '$rawMaterialName',
            unit: '$unit',
            stockCount: '$stockCount',
            standardStockLevel: '$standardStockLevel',
            minimumStockLevel: '$minimumStockLevel',
            maximumStockLevel: '$maximumStockLevel',
            packSize: '$packSize',
            variants: '$variants',
            totalValue: '$totalValue',
            lastBillingDate: '$lastBillingDate',
            dealerName: '$dealerName',
            companyName: '$companyName',
          },
        },
      },
    },
    {
      $sort: { totalStockValue: -1 },
    },
  )

  const rawGroups = await RawMaterialBillingModel.aggregate(pipeline)

  let grandTotalValue = 0
  let grandTotalStockCount = 0
  let totalRawMaterialsCount = 0

  const groups: RawMaterialInventoryGroup[] = (rawGroups || []).map((group: any) => {
    const branchStockCount = toNumber(group.totalStockCount)
    const branchStockValue = toNumber(group.totalStockValue)

    grandTotalStockCount += branchStockCount
    grandTotalValue += branchStockValue

    const items: RawMaterialInventoryItem[] = []

    ;(group.items || []).forEach((item: any) => {
      const baseName = toNonEmptyString(item.rawMaterialName, 'Unknown Raw Material')
      const baseUnit = toNonEmptyString(item.unit, '-')
      const variants = Array.isArray(item.variants) ? item.variants : []
      const baseStock = toNumber(item.stockCount)
      const baseValue = toNumber(item.totalValue)

      if (variants.length > 0) {
        variants.forEach((v: any, vIdx: number) => {
          totalRawMaterialsCount++
          items.push({
            rawMaterialId: `${toNonEmptyString(item.rawMaterialId)}-v${vIdx}`,
            rawMaterialName: `${baseName} (${v.name})`,
            variantName: v.name,
            unit: toNonEmptyString(v.unit || baseUnit, '-'),
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
            lastBillingDate: item.lastBillingDate ? String(item.lastBillingDate) : '',
            dealerName: toNonEmptyString(item.dealerName),
            companyName: toNonEmptyString(item.companyName),
          })
        })
      } else {
        totalRawMaterialsCount++
        items.push({
          rawMaterialId: toNonEmptyString(item.rawMaterialId),
          rawMaterialName: baseName,
          unit: baseUnit,
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
          lastBillingDate: item.lastBillingDate ? String(item.lastBillingDate) : '',
          dealerName: toNonEmptyString(item.dealerName),
          companyName: toNonEmptyString(item.companyName),
        })
      }
    })

    items.sort((a, b) => b.totalValue - a.totalValue)

    return {
      companyId: toNonEmptyString(group._id),
      companyName: toNonEmptyString(group.companyName, 'Unknown Company'),
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
      totalRawMaterialsCount,
    },
  }
}
