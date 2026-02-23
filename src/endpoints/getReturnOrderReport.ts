import { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from './reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type ReturnOrderItem = {
  status?: string
  subtotal?: number
  quantity?: number
  time?: string
  filename?: string
  imageUrl?: string
}

type ReturnOrderGroup = {
  _id: string
  branchName: string
  totalAmount: number
  totalQuantity: number
  count: number
  orderCount: number
  items: ReturnOrderItem[]
}

export const getReturnOrderReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  const startDateParam =
    typeof req.query.startDate === 'string' ? req.query.startDate : dayjs().format('YYYY-MM-DD')
  const endDateParam =
    typeof req.query.endDate === 'string' ? req.query.endDate : dayjs().format('YYYY-MM-DD')
  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : null

  const allowedStatuses = ['pending', 'accepted', 'returned', 'cancelled'] as const
  const requestedStatus =
    typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'all'
  const selectedStatus = (allowedStatuses as readonly string[]).includes(requestedStatus)
    ? requestedStatus
    : 'all'

  // Date values are persisted in DB as UTC-marked local timestamps in this project.
  const startOfDay = dayjs.utc(startDateParam).startOf('day').toDate()
  const endOfDay = dayjs.utc(endDateParam).endOf('day').toDate()

  try {
    const { branchIds, errorResponse } = await resolveReportBranchScope(req, branchParam)
    if (errorResponse) return errorResponse

    const selectedBranches = branchIds ?? []
    const ReturnOrderModel = payload.db.collections['return-orders']

    const matchQuery: Record<string, unknown> = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }

    if (selectedBranches.length > 0) {
      matchQuery.$expr = {
        $in: [{ $toString: '$branch' }, selectedBranches],
      }
    }

    if (selectedStatus !== 'all') {
      matchQuery.status = selectedStatus
    }

    const pipeline: Record<string, unknown>[] = [
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

    const groups = (await ReturnOrderModel.aggregate(pipeline)) as ReturnOrderGroup[]

    const grandTotal = groups.reduce((acc, group) => acc + (group.totalAmount || 0), 0)
    const totalCount = groups.reduce((acc, group) => acc + (group.count || 0), 0)
    const totalQuantity = groups.reduce((acc, group) => acc + (group.totalQuantity || 0), 0)

    const statusStatsMap: Record<string, { total: number; count: number }> = {}
    groups.forEach((group) => {
      group.items.sort((a, b) => new Date(b.time || '').getTime() - new Date(a.time || '').getTime())
      group.items.forEach((item) => {
        if (item.filename && !item.imageUrl) {
          item.imageUrl = `/api/media/file/${item.filename}`
        }

        const key = item.status || 'pending'
        if (!statusStatsMap[key]) {
          statusStatsMap[key] = { total: 0, count: 0 }
        }
        statusStatsMap[key].total += item.subtotal || 0
        statusStatsMap[key].count += 1
      })
    })

    const statusStats = allowedStatuses.map((status) => {
      const bucket = statusStatsMap[status] || { total: 0, count: 0 }
      return {
        status,
        total: bucket.total,
        count: bucket.count,
        percentage: grandTotal > 0 ? (bucket.total / grandTotal) * 100 : 0,
      }
    })

    return Response.json({
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
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate return order report' }, { status: 500 })
  }
}
