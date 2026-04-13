import { PayloadRequest, PayloadHandler } from 'payload'
import mongoose, { PipelineStage } from 'mongoose'
import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from './reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

interface BranchData {
  branchId: string
  amount: number
  quantity: number
}

interface RawStat {
  productId: string
  productName: string
  price: number
  unit: string
  preparationTime: number | null
  totalQuantity: number
  totalAmount: number
  branchData: BranchData[]
}

interface RawPreparationItem {
  productId: unknown
  orderedAt: unknown
  preparedAt: unknown
  preparingTime: unknown
  billCreatedAt: unknown
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

const resolveItemPreparationMinutes = (
  row: RawPreparationItem,
  now: Dayjs,
): number | null => {
  const fallbackDate = parseToDayjs(row.billCreatedAt) ?? now

  const orderedAt = parseTimeLikeValue(row.orderedAt, fallbackDate) ?? fallbackDate
  const preparedAt = parseTimeLikeValue(row.preparedAt, fallbackDate)

  if (preparedAt) {
    const adjustedPreparedAt =
      preparedAt.isBefore(orderedAt) ? preparedAt.add(1, 'day') : preparedAt
    return Math.max(0, adjustedPreparedAt.diff(orderedAt, 'minute'))
  }

  const preparingTime = parsePreparingTimeValue(row.preparingTime)
  if (preparingTime != null) return preparingTime

  return Math.max(0, now.diff(orderedAt, 'minute'))
}

export const getProductWiseReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  // 1. Get date from query param or use today
  const startDateParam =
    typeof req.query.startDate === 'string'
      ? req.query.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof req.query.endDate === 'string'
      ? req.query.endDate
      : new Date().toISOString().split('T')[0]

  // Start of day (00:00:00) for startDate
  const startAndYear = parseInt(startDateParam.split('-')[0])
  const startAndMonth = parseInt(startDateParam.split('-')[1])
  const startAndDay = parseInt(startDateParam.split('-')[2])
  const startOfDay = dayjs
    .tz(`${startAndYear}-${startAndMonth}-${startAndDay}`, 'YYYY-MM-DD', 'Asia/Kolkata')
    .startOf('day')
    .toDate()

  // End of day (23:59:59) for endDate
  const endAndYear = parseInt(endDateParam.split('-')[0])
  const endAndMonth = parseInt(endDateParam.split('-')[1])
  const endAndDay = parseInt(endDateParam.split('-')[2])
  const endOfDay = dayjs
    .tz(`${endAndYear}-${endAndMonth}-${endAndDay}`, 'YYYY-MM-DD', 'Asia/Kolkata')
    .endOf('day')
    .toDate()

  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : ''
  const categoryParam = typeof req.query.category === 'string' ? req.query.category : ''
  const departmentParam = typeof req.query.department === 'string' ? req.query.department : ''
  const productParam = typeof req.query.product === 'string' ? req.query.product : ''

  try {
    const { branchIds, errorResponse } = await resolveReportBranchScope(req, branchParam)
    if (errorResponse) return errorResponse

    // 1. Fetch all branches map (ID -> Code)
    const branches = await payload.find({
      collection: 'branches',
      where: branchIds
        ? {
            id: {
              in: branchIds,
            },
          }
        : undefined,
      limit: 100,
      pagination: false,
    })

    const branchMap: Record<string, string> = {}
    branches.docs.forEach((b) => {
      branchMap[b.id] = b.name.substring(0, 3).toUpperCase()
    })

    const BillingModel = payload.db.collections['billings']
    // Provide a default empty aggregation if BillingModel is undefined, though it shouldn't be
    if (!BillingModel) {
      throw new Error('Billings collection not found')
    }

    // Construct matchQuery
    const matchQuery: Record<string, unknown> = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $not: { $eq: 'cancelled' } }, // Optional: exclude cancelled bills if needed,
      // though items have their own status usually
    }

    if (branchIds) {
      matchQuery.$expr = {
        $in: [{ $toString: '$branch' }, branchIds],
      }
    }

    const buildCommonPipeline = (): PipelineStage[] => {
      const pipeline: PipelineStage[] = [
        {
          $match: matchQuery,
        },
        {
          $unwind: '$items',
        },
        {
          // Exclude cancelled items early
          $match: {
            'items.status': { $ne: 'cancelled' },
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

      // Apply Category Filter if present
      if (categoryParam && categoryParam !== 'all') {
        const catIds = categoryParam.split(',').filter(Boolean)
        if (catIds.length > 0) {
          pipeline.push({
            $match: {
              'categoryDetails._id': {
                $in: catIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
          })
        }
      } else {
        // Ensure we only show items with valid products/categories
        pipeline.push({
          $match: {
            'productDetails._id': { $exists: true },
            'categoryDetails._id': { $exists: true },
          },
        })
      }

      // Apply Department Filter if present
      if (departmentParam && departmentParam !== 'all') {
        pipeline.push({
          $match: {
            'categoryDetails.department': { $eq: new mongoose.Types.ObjectId(departmentParam) },
          },
        })
      }

      // Apply Product Filter if present
      if (productParam && productParam !== 'all') {
        const prodIds = productParam.split(',').filter(Boolean)
        if (prodIds.length > 0) {
          pipeline.push({
            $match: {
              'items.product': {
                $in: prodIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
          })
        }
      }

      return pipeline
    }

    // 2. Aggregate Data
    const aggregationPipeline: PipelineStage[] = [
      ...buildCommonPipeline(),
      {
        $group: {
          _id: {
            productId: '$productDetails._id',
            productName: '$productDetails.name',
            branchId: '$branch',
            price: '$productDetails.defaultPriceDetails.price',
            unit: '$productDetails.defaultPriceDetails.unit',
            preparationTime: '$productDetails.preparationTime',
          },
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.subtotal' }, // Assuming subtotal is at item level
        },
      },
      {
        $group: {
          _id: {
            productId: '$_id.productId',
            productName: '$_id.productName',
          },
          price: { $first: '$_id.price' },
          unit: { $first: '$_id.unit' },
          preparationTime: { $first: '$_id.preparationTime' },
          totalQuantity: { $sum: '$quantity' },
          totalAmount: { $sum: '$amount' },
          branchData: {
            $push: {
              branchId: '$_id.branchId',
              amount: '$amount',
              quantity: '$quantity',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          productId: '$_id.productId',
          productName: '$_id.productName',
          price: 1,
          unit: 1,
          preparationTime: 1,
          totalQuantity: 1,
          totalAmount: 1,
          branchData: 1,
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    ]

    // Cast the result to unknown first, then to our expected type, to avoid 'any' lint errors
    const rawStats = (await BillingModel.aggregate(aggregationPipeline)) as unknown as RawStat[]

    const preparationPipeline: PipelineStage[] = [
      ...buildCommonPipeline(),
      {
        $project: {
          _id: 0,
          productId: '$productDetails._id',
          orderedAt: '$items.orderedAt',
          preparedAt: '$items.preparedAt',
          preparingTime: '$items.preparingTime',
          billCreatedAt: '$createdAt',
        },
      },
    ]

    const rawPreparationItems = (await BillingModel.aggregate(
      preparationPipeline,
    )) as unknown as RawPreparationItem[]
    const now = dayjs().tz('Asia/Kolkata')
    const preparationByProductId: Record<string, { totalMinutes: number; count: number }> = {}

    rawPreparationItems.forEach((row) => {
      const productId = toId(row.productId)
      if (!productId) return

      const minutes = resolveItemPreparationMinutes(row, now)
      if (minutes == null || !Number.isFinite(minutes)) return

      if (!preparationByProductId[productId]) {
        preparationByProductId[productId] = { totalMinutes: 0, count: 0 }
      }

      preparationByProductId[productId].totalMinutes += minutes
      preparationByProductId[productId].count += 1
    })

    // 3. Calculate Branch Totals to Sort Headers
    const branchTotals: Record<string, number> = {}

    rawStats.forEach((stat) => {
      stat.branchData.forEach((b) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchTotals[code] = (branchTotals[code] || 0) + b.amount
        }
      })
    })

    // 4. Create Sorted Header List
    // Filter out branches with <= 0 sales and Sort by Amount Desc
    const branchHeaders = Object.keys(branchTotals)
      .filter((code) => branchTotals[code] > 0)
      .sort((a, b) => branchTotals[b] - branchTotals[a])

    // 5. Format Stats with Sorted Columns
    const formattedStats = rawStats.map((item, index) => {
      const branchSales: Record<string, { amount: number; quantity: number }> = {}
      const productId = toId(item.productId) || ''
      const preparationAggregate = productId ? preparationByProductId[productId] : null
      const averagePreparationTime =
        preparationAggregate && preparationAggregate.count > 0
          ? Number((preparationAggregate.totalMinutes / preparationAggregate.count).toFixed(2))
          : null

      item.branchData.forEach((b) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchSales[code] = { amount: b.amount, quantity: b.quantity }
        }
      })

      return {
        sNo: index + 1,
        productId,
        productName: item.productName,
        price: item.price || 0,
        unit: item.unit || '',
        preparationTime:
          typeof item.preparationTime === 'number' && Number.isFinite(item.preparationTime)
            ? item.preparationTime
            : null,
        averagePreparationTime,
        averagePreparationSampleSize: preparationAggregate?.count || 0,
        totalQuantity: item.totalQuantity,
        totalAmount: item.totalAmount,
        branchSales,
      }
    })

    // Calculate Grand Totals
    const totals = formattedStats.reduce(
      (acc, curr) => ({
        totalQuantity: acc.totalQuantity + curr.totalQuantity,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { totalQuantity: 0, totalAmount: 0 },
    )

    payload.logger.info(`Generated Product Wise Report: ${formattedStats.length} products found`)

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      branchHeaders,
      stats: formattedStats,
      totals: {
        ...totals,
        branchTotals,
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    payload.logger.error({ msg: 'Product Report Error', error, stack: error.stack })
    return Response.json({ error: 'Failed to generate product report' }, { status: 500 })
  }
}
