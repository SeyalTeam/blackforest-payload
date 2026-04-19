import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { PipelineStage } from 'mongoose'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type ReturnOrderReportItem = {
  returnNumber: string
  status: string
  product: string
  quantity: number
  unitPrice: number
  subtotal: number
  notes?: string
  time: string
  imageUrl?: string
}

export type ReturnOrderReportGroup = {
  _id: string
  branchName: string
  totalAmount: number
  totalQuantity: number
  count: number
  orderCount: number
  items: ReturnOrderReportItem[]
}

export type ReturnOrderReportStatusStat = {
  status: string
  total: number
  count: number
  percentage: number
}

export type ReturnOrderReportResult = {
  startDate: string
  endDate: string
  groups: ReturnOrderReportGroup[]
  meta: {
    grandTotal: number
    totalCount: number
    totalQuantity: number
    statuses: string[]
    statusStats: ReturnOrderReportStatusStat[]
  }
}

type ReturnOrderReportArgs = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
  status?: null | string
}

type RawReturnOrderItem = {
  returnNumber: unknown
  status: unknown
  product: unknown
  quantity: unknown
  unitPrice: unknown
  subtotal: unknown
  notes: unknown
  time: unknown
  filename: unknown
  imageUrl: unknown
}

type RawReturnOrderGroup = {
  _id: unknown
  branchName: unknown
  totalAmount: unknown
  totalQuantity: unknown
  count: unknown
  orderCount: unknown
  items: RawReturnOrderItem[]
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

export const getReturnOrderReportData = async (
  req: PayloadRequest,
  args: ReturnOrderReportArgs = {},
): Promise<ReturnOrderReportResult> => {
  const { payload } = req

  const startDateParam =
    typeof args.startDate === 'string' && args.startDate.trim().length > 0
      ? args.startDate
      : dayjs().format('YYYY-MM-DD')
  const endDateParam =
    typeof args.endDate === 'string' && args.endDate.trim().length > 0
      ? args.endDate
      : dayjs().format('YYYY-MM-DD')

  const branchParam = typeof args.branch === 'string' ? args.branch : null

  const allowedStatuses = ['pending', 'accepted', 'returned', 'cancelled'] as const
  const requestedStatus =
    typeof args.status === 'string' && args.status.trim().length > 0 ? args.status.toLowerCase() : 'all'
  const selectedStatus = (allowedStatuses as readonly string[]).includes(requestedStatus)
    ? requestedStatus
    : 'all'

  // Keep existing behavior exactly:
  // date values are queried as UTC day boundaries.
  const startOfDay = dayjs.utc(startDateParam).startOf('day').toDate()
  const endOfDay = dayjs.utc(endDateParam).endOf('day').toDate()

  const { branchIds } = await resolveReportBranchScope(req, branchParam)
  const selectedBranches = branchIds ?? []

  const ReturnOrderModel = payload.db.collections['return-orders']
  if (!ReturnOrderModel) {
    throw new Error('Return orders collection not found')
  }

  const matchQuery: Record<string, unknown> = {
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }

  if (selectedBranches.length > 0) {
    ;(matchQuery as Record<string, unknown>).$expr = {
      $in: [{ $toString: '$branch' }, selectedBranches],
    }
  }

  if (selectedStatus !== 'all') {
    ;(matchQuery as Record<string, unknown>).status = selectedStatus
  }

  const pipeline: PipelineStage[] = [
    {
      $match: matchQuery,
    },
    {
      $unwind: '$items',
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
        from: 'media',
        localField: 'items.proofPhoto',
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
        totalAmount: { $sum: { $ifNull: ['$items.subtotal', 0] } },
        totalQuantity: { $sum: { $ifNull: ['$items.quantity', 0] } },
        count: { $sum: 1 },
        orders: { $addToSet: '$returnNumber' },
        items: {
          $push: {
            returnNumber: '$returnNumber',
            status: '$status',
            product: '$items.name',
            quantity: { $ifNull: ['$items.quantity', 0] },
            unitPrice: { $ifNull: ['$items.unitPrice', 0] },
            subtotal: { $ifNull: ['$items.subtotal', 0] },
            notes: '$notes',
            time: '$createdAt',
            imageUrl: '$mediaInfo.url',
            filename: '$mediaInfo.filename',
          },
        },
      },
    },
    {
      $addFields: {
        orderCount: { $size: '$orders' },
      },
    },
    {
      $project: {
        orders: 0,
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ]

  const groupsRaw = (await ReturnOrderModel.aggregate(pipeline)) as RawReturnOrderGroup[]

  const groups: ReturnOrderReportGroup[] = groupsRaw.map((group) => {
    const items = (Array.isArray(group.items) ? [...group.items] : [])
      .sort((a, b) => new Date(toDateString(b.time)).getTime() - new Date(toDateString(a.time)).getTime())
      .map((item) => {
        const filename = toNonEmptyString(item.filename)
        const imageUrl = toNonEmptyString(item.imageUrl)

        return {
          returnNumber: toNonEmptyString(item.returnNumber),
          status: toNonEmptyString(item.status, 'pending'),
          product: toNonEmptyString(item.product),
          quantity: toNumber(item.quantity),
          unitPrice: toNumber(item.unitPrice),
          subtotal: toNumber(item.subtotal),
          notes: toNonEmptyString(item.notes, '') || undefined,
          time: toDateString(item.time),
          imageUrl: imageUrl || (filename ? `/api/media/file/${filename}` : undefined),
        }
      })

    return {
      _id: toNonEmptyString(group._id),
      branchName: toNonEmptyString(group.branchName, 'Unknown Branch'),
      totalAmount: toNumber(group.totalAmount),
      totalQuantity: toNumber(group.totalQuantity),
      count: toInteger(group.count),
      orderCount: toInteger(group.orderCount),
      items,
    }
  })

  const grandTotal = groups.reduce((acc, group) => acc + group.totalAmount, 0)
  const totalCount = groups.reduce((acc, group) => acc + group.count, 0)
  const totalQuantity = groups.reduce((acc, group) => acc + group.totalQuantity, 0)

  const statusStatsMap: Record<string, { total: number; count: number }> = {}
  groups.forEach((group) => {
    group.items.forEach((item) => {
      const key = item.status || 'pending'
      if (!statusStatsMap[key]) {
        statusStatsMap[key] = { total: 0, count: 0 }
      }
      statusStatsMap[key].total += item.subtotal || 0
      statusStatsMap[key].count += 1
    })
  })

  const statusStats: ReturnOrderReportStatusStat[] = allowedStatuses.map((status) => {
    const bucket = statusStatsMap[status] || { total: 0, count: 0 }
    return {
      status,
      total: bucket.total,
      count: bucket.count,
      percentage: grandTotal > 0 ? (bucket.total / grandTotal) * 100 : 0,
    }
  })

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    groups,
    meta: {
      grandTotal,
      totalCount,
      totalQuantity,
      statuses: ['all', ...allowedStatuses],
      statusStats,
    },
  }
}
