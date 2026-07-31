import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportCompanyScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type RawMaterialBillingReportItem = {
  id: string
  dealerName: string
  amount: number
  paidAmount?: number
  payments?: { amount: number; date: string }[]
  billCopyUrl?: string
  productsPhotoUrls?: string[]
  deliveryPersonPhotoUrl?: string
  time: string
  status: string
  rawMaterials?: {
    name: string
    quantity: number
    unit: string
    packageSize?: number
    numberOfPackages?: number
    totalAmount?: number
  }[]
}

export type CompanyGroup = {
  _id: string
  companyName: string
  count: number
  items: RawMaterialBillingReportItem[]
  total: number
}

export type RawMaterialBillingReportMeta = {
  grandTotal: number
  totalCount: number
}

export type RawMaterialBillingReportResult = {
  endDate: string
  groups: CompanyGroup[]
  meta: RawMaterialBillingReportMeta
  startDate: string
}

type RawMaterialBillingReportArgs = {
  company?: null | string
  endDate?: null | string
  startDate?: null | string
  dealer?: null | string
}

type RawItem = {
  id: unknown
  dealerName: unknown
  amount: unknown
  paidAmount?: unknown
  payments?: unknown
  billCopyUrl?: unknown
  billCopyFilename?: unknown
  productsPhotos?: { url?: string; filename?: string }[]
  deliveryPersonPhotoUrl?: unknown
  deliveryPersonPhotoFilename?: unknown
  time: unknown
  status: unknown
  rawMaterialsList?: {
    rawMaterialName?: string
    packageSize?: number
    numberOfPackages?: number
    quantity?: number
    totalAmount?: number
    unit?: string
  }[]
}

type RawGroup = {
  _id: unknown
  companyName: unknown
  count: unknown
  items: RawItem[]
  total: unknown
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toInteger = (value: unknown): number => Math.trunc(toNumber(value))

const toDateString = (value: unknown): string => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }

  if (typeof value === 'string') {
    if (value.trim().length === 0) return ''
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
  }

  return ''
}

const toNonEmptyString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (typeof value === 'object' && value !== null) {
    const record = value as {
      _id?: unknown
      id?: unknown
      toString?: () => string
    }

    const nestedId = toNonEmptyString(record.id, '')
    if (nestedId.length > 0) return nestedId

    const nestedMongoId = toNonEmptyString(record._id, '')
    if (nestedMongoId.length > 0) return nestedMongoId

    if (typeof record.toString === 'function') {
      const stringified = record.toString()
      if (stringified && stringified !== '[object Object]') return stringified
    }
  }

  return fallback
}

export const getRawMaterialBillingReportData = async (
  req: PayloadRequest,
  args: RawMaterialBillingReportArgs = {},
): Promise<RawMaterialBillingReportResult> => {
  const { payload } = req

  const startDateParam =
    typeof args.startDate === 'string' && args.startDate.trim().length > 0
      ? args.startDate
      : dayjs().format('YYYY-MM-DD')
  const endDateParam =
    typeof args.endDate === 'string' && args.endDate.trim().length > 0
      ? args.endDate
      : dayjs().format('YYYY-MM-DD')

  const companyParam = typeof args.company === 'string' ? args.company : ''
  const dealerParam = typeof args.dealer === 'string' ? args.dealer : ''

  const startOfDay = dayjs.utc(startDateParam).startOf('day').toDate()
  const endOfDay = dayjs.utc(endDateParam).endOf('day').toDate()

  const { companyIds } = await resolveReportCompanyScope(req, companyParam)

  const RawMaterialBillingModel = payload.db.collections['raw-material-billings']
  if (!RawMaterialBillingModel) {
    throw new Error('Raw Material Billings collection not found')
  }

  const selectedCompanies = companyIds ?? []
  let selectedDealers: string[] = []
  if (dealerParam && dealerParam !== 'all') {
    selectedDealers = dealerParam.split(',').filter((id) => id.trim().length > 0)
  }

  const matchQuery: Record<string, any> = {
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }

  const exprAnd: any[] = []
  if (selectedCompanies.length > 0) {
    exprAnd.push({
      $in: [{ $toString: '$company' }, selectedCompanies],
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
        from: 'media',
        localField: 'billCopyPhoto',
        foreignField: '_id',
        as: 'billCopyInfo',
      },
    },
    {
      $unwind: {
        path: '$billCopyInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'media',
        localField: 'productsPhoto',
        foreignField: '_id',
        as: 'productsPhotoInfo',
      },
    },
    {
      $lookup: {
        from: 'media',
        localField: 'deliveryPersonPhoto',
        foreignField: '_id',
        as: 'deliveryPersonInfo',
      },
    },
    {
      $unwind: {
        path: '$deliveryPersonInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    // Unwind list items to lookup material details
    {
      $unwind: {
        path: '$rawMaterialsList',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'raw-materials',
        localField: 'rawMaterialsList.rawMaterial',
        foreignField: '_id',
        as: 'materialInfo',
      },
    },
    {
      $unwind: {
        path: '$materialInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'media',
        localField: 'rawMaterialsList.photo',
        foreignField: '_id',
        as: 'itemPhotoInfo',
      },
    },
    {
      $unwind: {
        path: '$itemPhotoInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    // Group back by billing id to reconstruct the rawMaterialsList
    {
      $group: {
        _id: '$_id',
        company: { $first: '$company' },
        companyInfo: { $first: '$companyInfo' },
        dealerInfo: { $first: '$dealerInfo' },
        total: { $first: '$total' },
        paidAmount: { $first: '$paidAmount' },
        payments: { $first: '$payments' },
        date: { $first: '$date' },
        billCopyInfo: { $first: '$billCopyInfo' },
        productsPhotoInfo: { $first: '$productsPhotoInfo' },
        deliveryPersonInfo: { $first: '$deliveryPersonInfo' },
        status: { $first: '$status' },
        rawMaterialsList: {
          $push: {
            $cond: {
              if: { $gt: ['$rawMaterialsList', null] },
              then: {
                rawMaterialName: '$materialInfo.name',
                name: '$materialInfo.name',
                packageSize: '$rawMaterialsList.packageSize',
                numberOfPackages: '$rawMaterialsList.numberOfPackages',
                quantity: '$rawMaterialsList.quantity',
                totalAmount: '$rawMaterialsList.totalAmount',
                unit: '$materialInfo.unit',
                variants: '$materialInfo.variants',
                packSize: '$materialInfo.packSize',
                photoUrl: '$itemPhotoInfo.url',
                photoFilename: '$itemPhotoInfo.filename',
              },
              else: '$$REMOVE',
            },
          },
        },
      },
    },
    // Finally group by company
    {
      $group: {
        _id: '$company',
        companyName: { $first: { $ifNull: ['$companyInfo.name', 'Unknown Company'] } },
        total: { $sum: '$total' },
        count: { $sum: 1 },
        items: {
          $push: {
            id: { $toString: '$_id' },
            dealerName: { $ifNull: ['$dealerInfo.companyName', 'Unknown Dealer'] },
            amount: '$total',
            paidAmount: { $ifNull: ['$paidAmount', 0] },
            payments: { $ifNull: ['$payments', []] },
            time: '$date',
            billCopyUrl: '$billCopyInfo.url',
            billCopyFilename: '$billCopyInfo.filename',
            productsPhotos: {
              $map: {
                input: '$productsPhotoInfo',
                as: 'p',
                in: {
                  url: '$$p.url',
                  filename: '$$p.filename',
                },
              },
            },
            deliveryPersonPhotoUrl: '$deliveryPersonInfo.url',
            deliveryPersonPhotoFilename: '$deliveryPersonInfo.filename',
            status: { $ifNull: ['$status', 'pending'] },
            rawMaterialsList: '$rawMaterialsList',
          },
        },
      },
    },
    {
      $sort: { total: -1 },
    },
  ]

  const groupsRaw = (await RawMaterialBillingModel.aggregate(pipeline)) as RawGroup[]

  const groups: CompanyGroup[] = groupsRaw.map((group) => {
    const sortedItems = (Array.isArray(group.items) ? [...group.items] : [])
      .sort((a, b) => {
        const aTime = new Date(toDateString(a.time)).getTime()
        const bTime = new Date(toDateString(b.time)).getTime()
        return bTime - aTime
      })
      .map((item) => {
        const billCopyFilename = toNonEmptyString(item.billCopyFilename)
        const billCopyUrl = toNonEmptyString(item.billCopyUrl)
        const deliveryPersonPhotoFilename = toNonEmptyString(item.deliveryPersonPhotoFilename)
        const deliveryPersonPhotoUrl = toNonEmptyString(item.deliveryPersonPhotoUrl)

        const productsPhotoUrls: string[] = []
        if (Array.isArray(item.productsPhotos)) {
          item.productsPhotos.forEach((p) => {
            const url = toNonEmptyString(p.url)
            const filename = toNonEmptyString(p.filename)
            const resolved = url || (filename ? `/api/media/file/${filename}` : '')
            if (resolved) {
              productsPhotoUrls.push(resolved)
            }
          })
        }

        const rawMaterials: {
          name: string
          quantity: number
          unit: string
          packageSize?: number
          numberOfPackages?: number
          totalAmount?: number
        }[] = []
        if (Array.isArray(item.rawMaterialsList)) {
          item.rawMaterialsList.forEach((m) => {
            if (m && typeof m === 'object') {
              rawMaterials.push({
                name: toNonEmptyString(m.rawMaterialName, 'Unknown Material').trim(),
                quantity: toNumber(m.quantity),
                unit: toNonEmptyString(m.unit, 'kg'),
                packageSize: m.packageSize !== undefined ? toNumber(m.packageSize) : undefined,
                numberOfPackages: m.numberOfPackages !== undefined ? toNumber(m.numberOfPackages) : undefined,
                totalAmount: m.totalAmount !== undefined ? toNumber(m.totalAmount) : undefined,
              })
            }
          })
        }

        const payments: { amount: number; date: string }[] = []
        if (Array.isArray(item.payments)) {
          item.payments.forEach((p) => {
            if (p && typeof p === 'object') {
              payments.push({
                amount: toNumber(p.amount),
                date: toDateString(p.date),
              })
            }
          })
        }

        return {
          id: toNonEmptyString(item.id),
          dealerName: toNonEmptyString(item.dealerName, 'Unknown Dealer'),
          amount: toNumber(item.amount),
          paidAmount: toNumber(item.paidAmount),
          payments,
          time: toDateString(item.time),
          billCopyUrl: billCopyUrl || (billCopyFilename ? `/api/media/file/${billCopyFilename}` : undefined),
          productsPhotoUrls,
          deliveryPersonPhotoUrl: deliveryPersonPhotoUrl || (deliveryPersonPhotoFilename ? `/api/media/file/${deliveryPersonPhotoFilename}` : undefined),
          status: toNonEmptyString(item.status, 'pending'),
          rawMaterials,
        }
      })

    return {
      _id: toNonEmptyString(group._id),
      companyName: toNonEmptyString(group.companyName, 'Unknown Company'),
      total: toNumber(group.total),
      count: toInteger(group.count),
      items: sortedItems,
    }
  })

  const grandTotal = groups.reduce((acc, group) => acc + group.total, 0)
  const totalCount = groups.reduce((acc, group) => acc + group.count, 0)

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    groups,
    meta: {
      grandTotal,
      totalCount,
    },
  }
}
