import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type DealerReportItem = {
  id: string
  dealerName: string
  amount: number
  billCopyUrl?: string
  productsUrl?: string
  time: string
  status: string
  products?: string[]
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
}

type RawDealerItem = {
  id: unknown
  dealerName: unknown
  amount: unknown
  billCopyUrl?: unknown
  billCopyFilename?: unknown
  productsUrl?: unknown
  productsFilename?: unknown
  time: unknown
  status: unknown
  products?: unknown
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

  const matchQuery: Record<string, any> = {
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
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
        localField: 'productsPhoto',
        foreignField: '_id',
        as: 'productsInfo',
      },
    },
    {
      $unwind: {
        path: '$productsInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: 'products',
        foreignField: '_id',
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
            amount: '$total',
            time: '$date',
            billCopyUrl: '$billCopyInfo.url',
            billCopyFilename: '$billCopyInfo.filename',
            productsUrl: '$productsInfo.url',
            productsFilename: '$productsInfo.filename',
            status: { $ifNull: ['$status', 'pending'] },
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
        const billCopyUrl = toNonEmptyString(item.billCopyUrl)
        const productsFilename = toNonEmptyString(item.productsFilename)
        const productsUrl = toNonEmptyString(item.productsUrl)

        const products: string[] = []
        if (Array.isArray(item.products)) {
          item.products.forEach((p) => {
            const name = toNonEmptyString(p)
            if (name.length > 0) {
              products.push(name)
            }
          })
        }

        return {
          id: toNonEmptyString(item.id),
          dealerName: toNonEmptyString(item.dealerName, 'Unknown Dealer'),
          amount: toNumber(item.amount),
          time: toDateString(item.time),
          billCopyUrl: billCopyUrl || (billCopyFilename ? `/api/media/file/${billCopyFilename}` : undefined),
          productsUrl: productsUrl || (productsFilename ? `/api/media/file/${productsFilename}` : undefined),
          status: toNonEmptyString(item.status, 'pending'),
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
