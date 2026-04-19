import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type ExpenseReportItem = {
  amount: number
  category: string
  imageUrl?: string
  reason: string
  time: string
}

export type ExpenseReportGroup = {
  _id: string
  branchName: string
  count: number
  items: ExpenseReportItem[]
  total: number
}

export type ExpenseReportCategoryStat = {
  category: string
  count: number
  percentage: number
  total: number
}

export type ExpenseReportMeta = {
  categories: string[]
  categoryStats: ExpenseReportCategoryStat[]
  grandTotal: number
  totalCount: number
}

export type ExpenseReportResult = {
  endDate: string
  groups: ExpenseReportGroup[]
  meta: ExpenseReportMeta
  startDate: string
}

type ExpenseReportArgs = {
  branch?: null | string
  category?: null | string
  endDate?: null | string
  startDate?: null | string
}

type RawExpenseItem = {
  amount: unknown
  category: unknown
  filename?: unknown
  imageUrl?: unknown
  reason: unknown
  time: unknown
}

type RawExpenseGroup = {
  _id: unknown
  branchName: unknown
  count: unknown
  items: RawExpenseItem[]
  total: unknown
}

const ALL_CATEGORIES = [
  'MAINTENANCE',
  'TRANSPORT',
  'FUEL',
  'PACKING',
  'STAFF WELFARE',
  'Supplies',
  'ADVERTISEMENT',
  'ADVANCE',
  'COMPLEMENTARY',
  'RAW MATERIAL',
  'SALARY',
  'OC PRODUCTS',
  'OTHERS',
]

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

export const getExpenseReportData = async (
  req: PayloadRequest,
  args: ExpenseReportArgs = {},
): Promise<ExpenseReportResult> => {
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
  const categoryParam = typeof args.category === 'string' ? args.category : ''

  // Keep existing behavior exactly:
  // expense dates are queried as UTC day boundaries without timezone shift.
  const startOfDay = dayjs.utc(startDateParam).startOf('day').toDate()
  const endOfDay = dayjs.utc(endDateParam).endOf('day').toDate()

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

  const ExpenseModel = payload.db.collections['expenses']
  if (!ExpenseModel) {
    throw new Error('Expenses collection not found')
  }

  const selectedBranches = branchIds ?? []
  const selectedCategory = categoryParam !== 'all' && categoryParam.length > 0 ? categoryParam : 'all'

  const matchQuery: Record<string, any> = {
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }

  if (selectedBranches.length > 0) {
    matchQuery.$expr = {
      $in: [{ $toString: '$branch' }, selectedBranches],
    }
  }

  const pipeline: any[] = [
    {
      $match: matchQuery,
    },
    {
      $unwind: '$details',
    },
  ]

  if (selectedCategory !== 'all') {
    pipeline.push({
      $match: {
        'details.source': selectedCategory,
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
        from: 'media',
        localField: 'details.image',
        foreignField: '_id',
        as: 'mediaInfo',
      },
    },
    {
      $unwind: {
        path: '$mediaInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: '$branch',
        branchName: { $first: { $ifNull: ['$branchInfo.name', 'Unknown Branch'] } },
        total: { $sum: '$details.amount' },
        count: { $sum: 1 },
        items: {
          $push: {
            category: '$details.source',
            reason: '$details.reason',
            amount: '$details.amount',
            time: '$date',
            imageUrl: '$mediaInfo.url',
            filename: '$mediaInfo.filename',
          },
        },
      },
    },
    {
      $sort: { total: -1 },
    },
  )

  const groupsRaw = (await ExpenseModel.aggregate(pipeline)) as RawExpenseGroup[]

  const groups: ExpenseReportGroup[] = groupsRaw.map((group) => {
    const sortedItems = (Array.isArray(group.items) ? [...group.items] : [])
      .sort((a, b) => {
        const aTime = new Date(toDateString(a.time)).getTime()
        const bTime = new Date(toDateString(b.time)).getTime()
        return bTime - aTime
      })
      .map((item) => {
        const filename = toNonEmptyString(item.filename)
        const imageUrl = toNonEmptyString(item.imageUrl)

        return {
          category: toNonEmptyString(item.category),
          reason: toNonEmptyString(item.reason),
          amount: toNumber(item.amount),
          time: toDateString(item.time),
          imageUrl: imageUrl || (filename ? `/api/media/file/${filename}` : undefined),
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

  const categoryStatsMap: Record<string, { count: number; total: number }> = {}
  groups.forEach((group) => {
    group.items.forEach((item) => {
      if (!categoryStatsMap[item.category]) {
        categoryStatsMap[item.category] = { total: 0, count: 0 }
      }
      categoryStatsMap[item.category].total += item.amount
      categoryStatsMap[item.category].count += 1
    })
  })

  const categoryStats: ExpenseReportCategoryStat[] = Object.keys(categoryStatsMap)
    .map((category) => ({
      category,
      total: categoryStatsMap[category].total,
      count: categoryStatsMap[category].count,
      percentage: grandTotal > 0 ? (categoryStatsMap[category].total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    groups,
    meta: {
      grandTotal,
      totalCount,
      categories: ALL_CATEGORIES,
      categoryStats,
    },
  }
}
