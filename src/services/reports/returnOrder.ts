import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import type { PipelineStage } from 'mongoose'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type ReturnOrderReportItem = {
  id: string
  itemId?: string
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
  id: unknown
  itemId: unknown
  returnNumber: unknown
  status: unknown
  product: unknown
  quantity: unknown
  unitPrice: unknown
  subtotal: unknown
  notes: unknown
  time: unknown
  filename: unknown
  prefix: unknown
  imageUrl: unknown
  proofPhoto: unknown
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

const resolveMediaUrl = (
  url?: string | null,
  filename?: string | null,
  prefix?: string | null,
): string | undefined => {
  if (url && typeof url === 'string') {
    const trimmed = url.trim()
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:')
    ) {
      return trimmed
    }
  }

  if (!filename || typeof filename !== 'string') return undefined

  const publicURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL
  if (!publicURL) {
    return `/api/media/file/${filename}`
  }

  const cleanURL = publicURL.endsWith('/') ? publicURL.slice(0, -1) : publicURL
  const rootPrefix = 'blackforest/uploads'
  const docPrefix = prefix ? String(prefix).trim() : 'returnorder'

  const cleanRoot = rootPrefix.replace(/^\/+|\/+$/g, '')
  const cleanDocPrefix = docPrefix.replace(/^\/+|\/+$/g, '')

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
        let: { proofPhoto: '$items.proofPhoto' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ['$$proofPhoto', null] },
                  { $ne: ['$$proofPhoto', ''] },
                  {
                    $or: [
                      { $eq: ['$_id', '$$proofPhoto'] },
                      { $eq: [{ $toString: '$_id' }, { $toString: '$$proofPhoto' }] },
                    ],
                  },
                ],
              },
            },
          },
        ],
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
            id: { $toString: '$_id' },
            itemId: { $toString: '$items._id' },
            returnNumber: '$returnNumber',
            status: '$status',
            product: '$items.name',
            quantity: { $ifNull: ['$items.quantity', 0] },
            unitPrice: { $ifNull: ['$items.unitPrice', 0] },
            subtotal: { $ifNull: ['$items.subtotal', 0] },
            notes: { $ifNull: ['$items.notes', '$notes'] },
            time: '$createdAt',
            imageUrl: '$mediaInfo.url',
            filename: '$mediaInfo.filename',
            prefix: '$mediaInfo.prefix',
            proofPhoto: '$items.proofPhoto',
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

  // Collect any proofPhoto IDs that were not resolved via $lookup
  const missingMediaIdSet = new Set<string>()
  for (const group of groupsRaw) {
    if (Array.isArray(group.items)) {
      for (const it of group.items) {
        const hasUrlOrFile = Boolean(it.imageUrl || it.filename)
        if (!hasUrlOrFile && it.proofPhoto) {
          const idStr = toNonEmptyString(it.proofPhoto)
          if (
            idStr &&
            !idStr.startsWith('http://') &&
            !idStr.startsWith('https://') &&
            !idStr.startsWith('data:') &&
            /^[0-9a-fA-F]{24}$/.test(idStr)
          ) {
            missingMediaIdSet.add(idStr)
          }
        }
      }
    }
  }

  const mediaMap = new Map<string, string>()
  if (missingMediaIdSet.size > 0) {
    const missingIds = Array.from(missingMediaIdSet)
    try {
      const mediaRes = await payload.find({
        collection: 'media',
        where: {
          id: {
            in: missingIds,
          },
        },
        depth: 0,
        pagination: false,
        limit: missingIds.length,
        overrideAccess: true,
      })

      for (const m of mediaRes.docs as any[]) {
        const idStr = String(m.id || m._id)
        const resolved = resolveMediaUrl(m.url, m.filename, m.prefix) || m.thumbnailURL
        if (resolved) {
          mediaMap.set(idStr, resolved)
        }
      }
    } catch (e) {
      req.payload.logger.warn({
        err: e,
        msg: '[ReturnOrderReport] Error batch resolving media via payload.find',
      })
    }

    const stillMissing = missingIds.filter((id) => !mediaMap.has(id))
    if (stillMissing.length > 0 && payload.db.collections['media']) {
      try {
        const MediaModel = payload.db.collections['media']
        const mongoose = await import('mongoose')
        const objectIds = stillMissing
          .map((id) => {
            try {
              return new mongoose.Types.ObjectId(id)
            } catch {
              return null
            }
          })
          .filter(Boolean)

        const fallbackDocs = await MediaModel.find({
          $or: [{ _id: { $in: objectIds } }, { _id: { $in: stillMissing } }],
        }).lean()

        for (const m of fallbackDocs as any[]) {
          const idStr = String(m._id || m.id)
          const resolved = resolveMediaUrl(m.url, m.filename, m.prefix) || m.thumbnailURL
          if (resolved) {
            mediaMap.set(idStr, resolved)
          }
        }
      } catch (err) {
        req.payload.logger.warn({ err, msg: '[ReturnOrderReport] Fallback media query error' })
      }
    }
  }

  const groups: ReturnOrderReportGroup[] = groupsRaw.map((group) => {
    const items = (Array.isArray(group.items) ? [...group.items] : [])
      .sort((a, b) => new Date(toDateString(b.time)).getTime() - new Date(toDateString(a.time)).getTime())
      .map((item) => {
        const filename = toNonEmptyString(item.filename)
        const imageUrl = toNonEmptyString(item.imageUrl)
        const prefix = toNonEmptyString(item.prefix)
        const proofPhotoId = toNonEmptyString(item.proofPhoto)

        let resolvedUrl = resolveMediaUrl(imageUrl, filename, prefix)
        if (!resolvedUrl && proofPhotoId) {
          if (
            proofPhotoId.startsWith('http://') ||
            proofPhotoId.startsWith('https://') ||
            proofPhotoId.startsWith('data:')
          ) {
            resolvedUrl = proofPhotoId
          } else if (mediaMap.has(proofPhotoId)) {
            resolvedUrl = mediaMap.get(proofPhotoId)
          }
        }

        return {
          id: toNonEmptyString(item.id),
          itemId: toNonEmptyString(item.itemId),
          returnNumber: toNonEmptyString(item.returnNumber),
          status: toNonEmptyString(item.status, 'pending'),
          product: toNonEmptyString(item.product),
          quantity: toNumber(item.quantity),
          unitPrice: toNumber(item.unitPrice),
          subtotal: toNumber(item.subtotal),
          notes: toNonEmptyString(item.notes, '') || undefined,
          time: toDateString(item.time),
          imageUrl: resolvedUrl,
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
