import type { PayloadHandler, PayloadRequest } from 'payload'
import mongoose, { type PipelineStage } from 'mongoose'
import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from './reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type RawPreparationItem = {
  billingId: unknown
  invoiceNumber: unknown
  kotNumber: unknown
  billCreatedAt: unknown
  orderedAt: unknown
  preparedAt: unknown
  preparingTime: unknown
}

const parseDateParam = (value: unknown): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  return dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD')
}

const toId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value instanceof mongoose.Types.ObjectId) return value.toString()

  if (value && typeof value === 'object') {
    const record = value as { id?: unknown; _id?: unknown }
    if (record.id != null) return toId(record.id)
    if (record._id != null) return toId(record._id)
  }

  return null
}

const parseToDayjs = (value: unknown): Dayjs | null => {
  if (value == null) return null

  if (dayjs.isDayjs(value)) {
    const parsed = value.tz('Asia/Kolkata')
    return parsed.isValid() ? parsed : null
  }

  if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
    const parsed = dayjs(value).tz('Asia/Kolkata')
    return parsed.isValid() ? parsed : null
  }

  return null
}

const parseTimeLikeValue = (value: unknown, fallbackDate: Dayjs): Dayjs | null => {
  if (value == null) return null

  if (value instanceof Date) {
    const parsed = dayjs(value).tz('Asia/Kolkata')
    return parsed.isValid() ? parsed : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = dayjs(value).tz('Asia/Kolkata')
    return parsed.isValid() ? parsed : null
  }

  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const explicitDate = dayjs(trimmed)
  if (explicitDate.isValid()) return explicitDate.tz('Asia/Kolkata')

  const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!timeOnlyMatch) return null

  const hour = Number.parseInt(timeOnlyMatch[1], 10)
  const minute = Number.parseInt(timeOnlyMatch[2], 10)
  const second = Number.parseInt(timeOnlyMatch[3] || '0', 10)

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null
  }

  return fallbackDate
    .tz('Asia/Kolkata')
    .hour(hour)
    .minute(minute)
    .second(second)
    .millisecond(0)
}

const parsePreparingTimeValue = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === 'string' && value.trim().length === 0) return null

  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null

  return parsed
}

const resolveItemPreparationMinutes = (row: RawPreparationItem): number | null => {
  const fallbackDate = parseToDayjs(row.billCreatedAt) ?? dayjs().tz('Asia/Kolkata')

  const orderedAt = parseTimeLikeValue(row.orderedAt, fallbackDate)
  const preparedAt = parseTimeLikeValue(row.preparedAt, fallbackDate)

  if (orderedAt && preparedAt) {
    const adjustedPreparedAt = preparedAt.isBefore(orderedAt) ? preparedAt.add(1, 'day') : preparedAt
    const diffMinutes = adjustedPreparedAt.diff(orderedAt, 'minute', true)
    return Math.max(0, Number(diffMinutes.toFixed(2)))
  }

  const preparingTime = parsePreparingTimeValue(row.preparingTime)
  if (preparingTime != null) return preparingTime

  return null
}

const resolveBillNumber = (row: RawPreparationItem): string => {
  const invoice = typeof row.invoiceNumber === 'string' ? row.invoiceNumber.trim() : ''
  if (invoice) return invoice

  const kot = typeof row.kotNumber === 'string' ? row.kotNumber.trim() : ''
  if (kot) return kot

  return toId(row.billingId) || 'Unknown'
}

export const getProductPreparationBillDetailsHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  const startDateParam = parseDateParam(req.query.startDate)
  const endDateParam = parseDateParam(req.query.endDate)
  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : 'all'
  const categoryParam = typeof req.query.category === 'string' ? req.query.category : 'all'
  const departmentParam = typeof req.query.department === 'string' ? req.query.department : 'all'
  const productId = typeof req.query.productId === 'string' ? req.query.productId.trim() : ''

  if (!productId) {
    return Response.json({ error: 'Missing productId' }, { status: 400 })
  }
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return Response.json({ error: 'Invalid productId' }, { status: 400 })
  }

  try {
    const { branchIds, errorResponse } = await resolveReportBranchScope(req, branchParam)
    if (errorResponse) return errorResponse

    const BillingModel = payload.db.collections['billings']
    if (!BillingModel) {
      throw new Error('Billings collection not found')
    }

    const startOfDay = dayjs.tz(startDateParam, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day').toDate()
    const endOfDay = dayjs.tz(endDateParam, 'YYYY-MM-DD', 'Asia/Kolkata').endOf('day').toDate()

    const matchQuery: Record<string, unknown> = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $not: { $eq: 'cancelled' } },
    }

    if (branchIds) {
      matchQuery.$expr = {
        $in: [{ $toString: '$branch' }, branchIds],
      }
    }

    const pipeline: PipelineStage[] = [
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $match: {
          'items.status': { $ne: 'cancelled' },
          'items.product': { $eq: new mongoose.Types.ObjectId(productId) },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDetails.category',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      {
        $unwind: {
          path: '$categoryDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
    ]

    if (categoryParam && categoryParam !== 'all') {
      const categoryIds = categoryParam.split(',').map((id) => id.trim()).filter(Boolean)
      if (categoryIds.length > 0) {
        pipeline.push({
          $match: {
            'categoryDetails._id': {
              $in: categoryIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
        })
      }
    }

    if (departmentParam && departmentParam !== 'all') {
      pipeline.push({
        $match: {
          'categoryDetails.department': { $eq: new mongoose.Types.ObjectId(departmentParam) },
        },
      })
    }

    pipeline.push({
      $project: {
        _id: 0,
        billingId: '$_id',
        invoiceNumber: '$invoiceNumber',
        kotNumber: '$kotNumber',
        billCreatedAt: '$createdAt',
        orderedAt: '$items.orderedAt',
        preparedAt: '$items.preparedAt',
        preparingTime: '$items.preparingTime',
      },
    })

    const rows = (await BillingModel.aggregate(pipeline)) as unknown as RawPreparationItem[]

const groupedByBill = new Map<
      string,
      {
        billingId: string
        billNumber: string
        total: number
        count: number
        chefTotal: number
        chefCount: number
        createdAt: Dayjs | null
      }
    >()

    rows.forEach((row, index) => {
      const billingId = toId(row.billingId) || ''
      const billNumber = resolveBillNumber(row)
      const prep = resolveItemPreparationMinutes(row)
      const chefPreparingTime = parsePreparingTimeValue(row.preparingTime)

      const createdAt = parseToDayjs(row.billCreatedAt)
      const stableKey = billingId || `${billNumber}-${index}`
      const existing = groupedByBill.get(stableKey)

      if (!existing) {
        groupedByBill.set(stableKey, {
          billingId,
          billNumber,
          total: prep != null && Number.isFinite(prep) ? prep : 0,
          count: prep != null && Number.isFinite(prep) ? 1 : 0,
          chefTotal: chefPreparingTime != null ? chefPreparingTime : 0,
          chefCount: chefPreparingTime != null ? 1 : 0,
          createdAt,
        })
      } else {
        if (prep != null && Number.isFinite(prep)) {
          existing.total += prep
          existing.count += 1
        }
        if (chefPreparingTime != null) {
          existing.chefTotal += chefPreparingTime
          existing.chefCount += 1
        }
      }
    })

    const details = Array.from(groupedByBill.values())
      .map((item) => ({
        billingId: item.billingId,
        billNumber: item.billNumber,
        preparationTime: item.count > 0 ? Number((item.total / item.count).toFixed(2)) : null,
        chefPreparationTime:
          item.chefCount > 0 ? Number((item.chefTotal / item.chefCount).toFixed(2)) : null,
        createdAt: item.createdAt,
      }))
      .sort((a, b) => {
        const aMs = a.createdAt ? a.createdAt.valueOf() : 0
        const bMs = b.createdAt ? b.createdAt.valueOf() : 0
        return bMs - aMs
      })
      .map((item) => ({
        billingId: item.billingId,
        billNumber: item.billNumber,
        preparationTime: item.preparationTime,
        chefPreparationTime: item.chefPreparationTime,
      }))

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      productId,
      details,
    })
  } catch (error) {
    payload.logger.error({ msg: 'Product preparation bill details error', error })
    return Response.json({ error: 'Failed to fetch product preparation bill details' }, { status: 500 })
  }
}
