import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type DealerReportProductItem = {
  name: string
  quantity?: number
  totalAmount?: number
  photoUrl?: string
}

export type DealerReportItem = {
  id: string
  dealerName: string
  dealerAccountNumber?: string
  branchName?: string
  amount: number
  paidAmount?: number
  payments?: { amount: number; date: string }[]
  billCopyUrl?: string
  productsUrl?: string
  productsPhotoUrls?: string[]
  deliveryPersonPhotoUrl?: string
  time: string
  status: string
  plannedPaymentDate?: string
  products?: DealerReportProductItem[]
}

export type DealerReportGroup = {
  _id: string
  branchName: string
  count: number
  items: DealerReportItem[]
  total: number
}

export type DealerReportMeta = {
  grandTotal: number
  totalCount: number
  plannedDatesWithBills?: string[]
}

export type DealerReportResult = {
  endDate: string
  groups: DealerReportGroup[]
  meta: DealerReportMeta
  startDate: string
}

type DealerReportArgs = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
  dealer?: null | string
  plannedStartDate?: null | string
  plannedEndDate?: null | string
}

type RawDealerItem = {
  id: unknown
  dealerName: unknown
  branchName?: unknown
  amount: unknown
  paidAmount?: unknown
  payments?: unknown
  billCopyUrl?: unknown
  billCopyFilename?: unknown
  billCopyPrefix?: unknown
  productsUrl?: unknown
  productsFilename?: unknown
  productsPrefix?: unknown
  deliveryPersonPhotoUrl?: unknown
  deliveryPersonPhotoFilename?: unknown
  deliveryPersonPhotoPrefix?: unknown
  time?: unknown
  status: unknown
  products?: unknown
  productsList?: unknown
  productsListResolvedProducts?: unknown
  dealerAccountNumber?: unknown
  plannedPaymentDate?: unknown
}

type RawDealerGroup = {
  _id: unknown
  branchName: unknown
  count: unknown
  items: RawDealerItem[]
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

  if (Buffer.isBuffer(value)) {
    return value.toString('hex')
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as {
      _id?: unknown
      id?: unknown
      toHexString?: () => string
      toString?: () => string
    }

    if (typeof record.toHexString === 'function') {
      const hex = record.toHexString()
      if (hex && hex.trim().length > 0) return hex
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

export const getDealerReportData = async (
  req: PayloadRequest,
  args: DealerReportArgs = {},
): Promise<DealerReportResult> => {
  const { payload } = req

  const startDateParam =
    typeof args.startDate === 'string' && args.startDate.trim().length > 0
      ? args.startDate
      : dayjs().format('YYYY-MM-DD')
  const endDateParam =
    typeof args.endDate === 'string' && args.endDate.trim().length > 0
      ? args.endDate
      : dayjs().format('YYYY-MM-DD')

  const branchParam = typeof args.branch === 'string' ? args.branch : ''
  const dealerParam = typeof args.dealer === 'string' ? args.dealer : ''

  const startOfDay = dayjs.utc(startDateParam).startOf('day').toDate()
  const endOfDay = dayjs.utc(endDateParam).endOf('day').toDate()

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

  const plannedStartDateParam = typeof args.plannedStartDate === 'string' ? args.plannedStartDate : ''
  const plannedEndDateParam = typeof args.plannedEndDate === 'string' ? args.plannedEndDate : ''

  const matchQuery: Record<string, any> = {}

  if (plannedStartDateParam && plannedEndDateParam) {
    const startPlanned = dayjs.utc(plannedStartDateParam).startOf('day').toDate()
    const endPlanned = dayjs.utc(plannedEndDateParam).endOf('day').toDate()
    matchQuery.plannedPaymentDate = {
      $gte: startPlanned,
      $lte: endPlanned,
    }
  } else {
    matchQuery.date = {
      $gte: startOfDay,
      $lte: endOfDay,
    }
  }

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
    {
      $lookup: {
        from: 'media',
        localField: 'productsPhoto',
        foreignField: '_id',
        as: 'productsInfo',
      },
    },
    {
      $lookup: {
        from: 'products',
        let: { prodIds: '$productsList.product' },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: [
                  '$_id',
                  {
                    $map: {
                      input: { $ifNull: ['$$prodIds', []] },
                      as: 'pid',
                      in: { $convert: { input: '$$pid', to: 'objectId', onError: '$$pid', onNull: '$$pid' } },
                    },
                  },
                ],
              },
            },
          },
        ],
        as: 'productsListResolvedProducts',
      },
    },
    {
      $lookup: {
        from: 'media',
        let: { mediaIds: '$productsList.photo' },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: [
                  '$_id',
                  {
                    $map: {
                      input: { $ifNull: ['$$mediaIds', []] },
                      as: 'mid',
                      in: { $convert: { input: '$$mid', to: 'objectId', onError: '$$mid', onNull: '$$mid' } },
                    },
                  },
                ],
              },
            },
          },
        ],
        as: 'productsListMedia',
      },
    },
    {
      $lookup: {
        from: 'products',
        let: { prodIds: '$products' },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: [
                  '$_id',
                  {
                    $map: {
                      input: { $ifNull: ['$$prodIds', []] },
                      as: 'pid',
                      in: { $convert: { input: '$$pid', to: 'objectId', onError: '$$pid', onNull: '$$pid' } },
                    },
                  },
                ],
              },
            },
          },
        ],
        as: 'resolvedProducts',
      },
    },
    {
      $group: {
        _id: '$branch',
        branchName: { $first: { $ifNull: ['$branchInfo.name', 'Unknown Branch'] } },
        total: { $sum: '$total' },
        count: { $sum: 1 },
        items: {
          $push: {
            id: { $toString: '$_id' },
            dealerName: { $ifNull: ['$dealerInfo.companyName', { $ifNull: ['$dealerInfo.name', 'Unknown Dealer'] }] },
            dealerAccountNumber: '$dealerInfo.bankDetails.accountNumber',
            amount: '$total',
            paidAmount: { $ifNull: ['$paidAmount', 0] },
            payments: { $ifNull: ['$payments', []] },
            time: '$date',
            billCopyUrl: '$billCopyInfo.url',
            billCopyFilename: '$billCopyInfo.filename',
            billCopyPrefix: '$billCopyInfo.prefix',
            deliveryPersonPhotoUrl: '$deliveryPersonInfo.url',
            deliveryPersonPhotoFilename: '$deliveryPersonInfo.filename',
            deliveryPersonPhotoPrefix: '$deliveryPersonInfo.prefix',
            productsUrl: { $arrayElemAt: ['$productsInfo.url', 0] },
            productsFilename: { $arrayElemAt: ['$productsInfo.filename', 0] },
            productsPrefix: { $arrayElemAt: ['$productsInfo.prefix', 0] },
            productsPhotoInfo: '$productsInfo',
            status: { $ifNull: ['$status', 'pending'] },
            plannedPaymentDate: '$plannedPaymentDate',
            productsList: '$productsList',
            productsListMedia: '$productsListMedia',
            productsListResolvedProducts: {
              $map: {
                input: '$productsListResolvedProducts',
                as: 'p',
                in: {
                  id: { $toString: '$$p._id' },
                  name: '$$p.name',
                },
              },
            },
            products: {
              $map: {
                input: '$resolvedProducts',
                as: 'p',
                in: '$$p.name',
              },
            },
          },
        },
      },
    },
    {
      $sort: { total: -1 },
    },
  ]

  const groupsRaw = (await DealerBillingModel.aggregate(pipeline)) as RawDealerGroup[]

  const groups: DealerReportGroup[] = groupsRaw.map((group) => {
    const sortedItems = (Array.isArray(group.items) ? [...group.items] : [])
      .sort((a, b) => {
        const aTime = new Date(toDateString(a.time)).getTime()
        const bTime = new Date(toDateString(b.time)).getTime()
        return bTime - aTime
      })
      .map((item) => {
        const billCopyFilename = toNonEmptyString(item.billCopyFilename)
        const billCopyPrefix = toNonEmptyString(item.billCopyPrefix)
        const billCopyUrl = toNonEmptyString(item.billCopyUrl)
        const productsFilename = toNonEmptyString(item.productsFilename)
        const productsPrefix = toNonEmptyString(item.productsPrefix)
        const productsUrl = toNonEmptyString(item.productsUrl)
        const deliveryPersonPhotoFilename = toNonEmptyString(item.deliveryPersonPhotoFilename)
        const deliveryPersonPhotoPrefix = toNonEmptyString(item.deliveryPersonPhotoPrefix)
        const deliveryPersonPhotoUrl = toNonEmptyString(item.deliveryPersonPhotoUrl)

        const products: DealerReportProductItem[] = []

        const productsPhotoUrls: string[] = []
        if (Array.isArray((item as any).productsPhotoInfo)) {
          ;(item as any).productsPhotoInfo.forEach((p: any) => {
            if (p && typeof p === 'object') {
              const url = toNonEmptyString(p.url)
              const filename = toNonEmptyString(p.filename)
              const prefix = toNonEmptyString(p.prefix)
              const resolved = url || resolveMediaUrl(filename, prefix) || ''
              if (resolved) {
                productsPhotoUrls.push(resolved)
              }
            }
          })
        }

        if (Array.isArray(item.productsList) && item.productsList.length > 0) {
          const resolvedMap = new Map<string, string>()
          if (Array.isArray(item.productsListResolvedProducts)) {
            item.productsListResolvedProducts.forEach((p: any) => {
              if (p && typeof p === 'object') {
                const id = toNonEmptyString(p.id)
                const name = toNonEmptyString(p.name).trim()
                if (id && name) {
                  resolvedMap.set(id, name)
                }
              }
            })
          }

          const mediaMap = new Map<string, string>()
          if (Array.isArray((item as any).productsListMedia)) {
            ;(item as any).productsListMedia.forEach((m: any) => {
              if (m && typeof m === 'object') {
                const id = toNonEmptyString(m._id || m.id)
                const url = toNonEmptyString(m.url) || resolveMediaUrl(toNonEmptyString(m.filename), toNonEmptyString(m.prefix)) || ''
                if (id && url) {
                  mediaMap.set(id, url)
                }
              }
            })
          }

          item.productsList.forEach((p: any, idx: number) => {
            if (p && typeof p === 'object') {
              let prodId = ''
              let name = ''
              if (typeof p.product === 'string') {
                prodId = p.product
              } else if (p.product && typeof p.product === 'object') {
                prodId = toNonEmptyString(p.product.id || p.product._id)
                name = toNonEmptyString(p.product.name)
              }
              if (!name && prodId) {
                name = resolvedMap.get(prodId) || ''
              }
              name = name.trim()
              if (!name) {
                name = 'Unknown Product'
              }

              const quantity = toNumber(p.quantity)
              const totalAmount = toNumber(p.totalAmount)

              let photoUrl = ''
              if (p.photo) {
                if (typeof p.photo === 'object' && p.photo.url) {
                  photoUrl = toNonEmptyString(p.photo.url)
                } else {
                  const photoId = toNonEmptyString(p.photo.id || p.photo._id || p.photo)
                  if (photoId) {
                    photoUrl = mediaMap.get(photoId) || ''
                  }
                }
              }

              products.push({
                name,
                quantity,
                totalAmount,
                photoUrl: photoUrl || undefined,
              })
            }
          })
        } else if (Array.isArray(item.products)) {
          item.products.forEach((p) => {
            const name = toNonEmptyString(p).trim()
            if (name.length > 0) {
              products.push({ name, quantity: 0, totalAmount: 0 })
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

        const resolvedBillCopyUrl = billCopyUrl || resolveMediaUrl(billCopyFilename, billCopyPrefix)
        const resolvedProductsUrl = productsUrl || resolveMediaUrl(productsFilename, productsPrefix) || productsPhotoUrls[0]
        const resolvedDeliveryPersonPhotoUrl = deliveryPersonPhotoUrl || resolveMediaUrl(deliveryPersonPhotoFilename, deliveryPersonPhotoPrefix)

        return {
          id: toNonEmptyString(item.id),
          dealerName: toNonEmptyString(item.dealerName, 'Unknown Dealer'),
          dealerAccountNumber: toNonEmptyString(item.dealerAccountNumber),
          amount: toNumber(item.amount),
          paidAmount: toNumber(item.paidAmount),
          payments,
          time: toDateString(item.time),
          billCopyUrl: resolvedBillCopyUrl,
          productsUrl: resolvedProductsUrl,
          productsPhotoUrls,
          deliveryPersonPhotoUrl: resolvedDeliveryPersonPhotoUrl,
          status: toNonEmptyString(item.status, 'pending'),
          plannedPaymentDate: item.plannedPaymentDate ? toDateString(item.plannedPaymentDate) : undefined,
          products,
        }
      })

    return {
      _id: toNonEmptyString(group._id),
      branchName: toNonEmptyString(group.branchName, 'Unknown Branch'),
      total: toNumber(group.total),
      count: toInteger(group.count),
      items: sortedItems,
    }
  })

  const grandTotal = groups.reduce((acc, group) => acc + group.total, 0)
  const totalCount = groups.reduce((acc, group) => acc + group.count, 0)

  // Query MongoDB for all distinct planned payment dates across all non-cancelled bills
  const plannedDocs = await DealerBillingModel.find(
    { plannedPaymentDate: { $exists: true, $ne: null }, status: { $ne: 'cancelled' } },
    { plannedPaymentDate: 1 },
  ).lean()

  const plannedDatesSet = new Set<string>()
  plannedDocs.forEach((doc: any) => {
    if (doc.plannedPaymentDate) {
      const dateStr = dayjs.utc(doc.plannedPaymentDate).format('YYYY-MM-DD')
      if (dateStr) plannedDatesSet.add(dateStr)
    }
  })

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    groups,
    meta: {
      grandTotal,
      totalCount,
      plannedDatesWithBills: Array.from(plannedDatesSet),
    },
  }
}

function resolveMediaUrl(filename?: string | null, prefix?: string | null): string | undefined {
  if (!filename) return undefined
  const publicURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL
  if (!publicURL) return undefined

  const rootPrefix = 'blackforest/uploads'
  const docPrefix = prefix || ''

  const cleanURL = publicURL.endsWith('/') ? publicURL.slice(0, -1) : publicURL
  const cleanRoot = rootPrefix.startsWith('/') ? rootPrefix.slice(1) : rootPrefix
  const cleanDocPrefix = docPrefix.startsWith('/') ? docPrefix.slice(1) : docPrefix

  const normalizedDocPrefix =
    cleanDocPrefix === cleanRoot
      ? ''
      : cleanDocPrefix.startsWith(`${cleanRoot}/`)
        ? cleanDocPrefix.slice(cleanRoot.length + 1)
        : cleanDocPrefix

  const filenameWithoutRoot = filename.startsWith(`${cleanRoot}/`)
    ? filename.slice(cleanRoot.length + 1)
    : filename

  const finalDocPrefix =
    normalizedDocPrefix && filenameWithoutRoot.startsWith(`${normalizedDocPrefix}/`)
      ? ''
      : normalizedDocPrefix

  const fullPath = [cleanRoot, finalDocPrefix, filenameWithoutRoot]
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')

  return `${cleanURL}/${fullPath}`
}
