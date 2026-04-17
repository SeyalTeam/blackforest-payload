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
  productName: unknown
  productStandardPreparationTime: unknown
  chefName: unknown
  quantity: unknown
}

type PreparationStatus = 'exceeded' | 'lower' | 'neutral'
type StatusFilter = 'all' | PreparationStatus | 'chef_preparing_time'

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
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return parsed
}

const parseStatusParam = (value: unknown): StatusFilter => {
  if (typeof value !== 'string') return 'all'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'exceeded' || normalized.includes('exceed')) return 'exceeded'
  if (normalized === 'lower' || normalized.includes('lower') || normalized.includes('green')) return 'lower'
  if (normalized === 'neutral' || normalized.includes('neutral')) return 'neutral'
  if (
    normalized === 'chef_preparing_time' ||
    normalized.includes('chef') ||
    normalized.includes('preparing')
  ) {
    return 'chef_preparing_time'
  }
  return 'all'
}

const getPreparationStatus = (
  actual: number | null | undefined,
  baseline: number | null | undefined,
): PreparationStatus => {
  if (actual == null || baseline == null) return 'neutral'
  if (!Number.isFinite(actual) || !Number.isFinite(baseline)) return 'neutral'
  if (baseline <= 0) return 'neutral'
  if (actual > baseline) return 'exceeded'
  if (actual < baseline) return 'lower'
  return 'neutral'
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
  const chefId = typeof req.query.chefId === 'string' ? req.query.chefId.trim() : ''
  const kitchenId = typeof req.query.kitchenId === 'string' ? req.query.kitchenId.trim() : ''
  const selectedStatus = parseStatusParam(req.query.status)

  const isAllProducts = !productId || productId === 'all'
  if (!isAllProducts && !mongoose.Types.ObjectId.isValid(productId)) {
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

    let finalCategoryIds: string[] = []
    let resolvedBranchIds: string[] = branchIds || []

    // 1. Resolve Kitchen Scope if provided
    if (kitchenId && mongoose.Types.ObjectId.isValid(kitchenId)) {
      const kitchenRes = await payload.findByID({
        collection: 'kitchens',
        id: kitchenId,
        depth: 0,
      })

      if (kitchenRes) {
        // Kitchen's allowed branches
        const kitchenBranchIds = (Array.isArray(kitchenRes.branches) ? kitchenRes.branches : [])
          .map((b) => (typeof b === 'object' ? b.id : b))
          .filter(Boolean) as string[]

        if (resolvedBranchIds.length > 0) {
          // Intersection: requested branch must belong to the kitchen
          resolvedBranchIds = resolvedBranchIds.filter((id) => kitchenBranchIds.includes(id))
          // If no intersection, set to dummy to ensure zero results
          if (resolvedBranchIds.length === 0) {
            resolvedBranchIds = ['000000000000000000000000']
          }
        } else {
          // No specific branch requested, lock to all kitchen branches
          resolvedBranchIds = kitchenBranchIds
        }

        // Kitchen's allowed categories
        const kitchenCategoryIds = (Array.isArray(kitchenRes.categories) ? kitchenRes.categories : [])
          .map((c) => (typeof c === 'object' ? c.id : c))
          .filter(Boolean) as string[]

        const requestedCategoryIds =
          categoryParam && categoryParam !== 'all'
            ? categoryParam
                .split(',')
                .map((id) => id.trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
            : []

        if (requestedCategoryIds.length > 0) {
          // Intersection
          finalCategoryIds = requestedCategoryIds.filter((id) => kitchenCategoryIds.includes(id))
          if (finalCategoryIds.length === 0) {
            finalCategoryIds = ['000000000000000000000000']
          }
        } else {
          // Lock to all kitchen categories
          finalCategoryIds = kitchenCategoryIds
        }
      } else {
        // Invalid kitchen ID provided -> Zero results
        resolvedBranchIds = ['000000000000000000000000']
      }
    } else {
      // No kitchen selected, use standard category param
      if (categoryParam && categoryParam !== 'all') {
        finalCategoryIds = categoryParam
          .split(',')
          .map((id) => id.trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      }
    }

    // Apply resolved branch filter
    if (resolvedBranchIds.length > 0) {
      matchQuery.branch = {
        $in: resolvedBranchIds.map((id) => {
          try {
            return new mongoose.Types.ObjectId(id)
          } catch {
            return id // Fallback to string if not a valid ObjectId
          }
        }),
      }
    }

    const itemMatchWithoutChef: Record<string, unknown> = {
      'items.status': { $ne: 'cancelled' },
    }
    if (!isAllProducts) {
      itemMatchWithoutChef['items.product'] = { $eq: new mongoose.Types.ObjectId(productId) }
    }

    const chefMatch: Record<string, unknown> = {}
    if (chefId && chefId !== 'all' && mongoose.Types.ObjectId.isValid(chefId)) {
      chefMatch['items.preparedBy'] = { $eq: new mongoose.Types.ObjectId(chefId) }
    }

    const pipeline: PipelineStage[] = [
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $match: itemMatchWithoutChef,
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
      {
        $lookup: {
          from: 'users',
          localField: 'items.preparedBy',
          foreignField: '_id',
          as: 'chefDetails',
        },
      },
      {
        $unwind: {
          path: '$chefDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
    ]

    // Apply category filter if requested or locked to kitchen
    if (finalCategoryIds.length > 0) {
      pipeline.push({
        $match: {
          'productDetails.category': {
            $in: finalCategoryIds.map((id) => {
              try {
                return new mongoose.Types.ObjectId(id)
              } catch {
                return id
              }
            }),
          },
        },
      })
    } else if (kitchenId || (categoryParam && categoryParam !== 'all')) {
      pipeline.push({
        $match: {
          'productDetails.category': {
            $in: [new mongoose.Types.ObjectId('000000000000000000000000')],
          },
        },
      })
    }

    if (
      departmentParam &&
      departmentParam !== 'all' &&
      mongoose.Types.ObjectId.isValid(departmentParam)
    ) {
      pipeline.push({
        $match: {
          'categoryDetails.department': { $eq: new mongoose.Types.ObjectId(departmentParam) },
        },
      })
    }

    // Now use facet to get both filtered rows and all available chefs in the scope
    pipeline.push({
      $facet: {
        filteredRows: [
          { $match: chefMatch },
          {
            $project: {
              _id: 0,
              billingId: '$_id',
              invoiceNumber: '$invoiceNumber',
              kotNumber: '$kotNumber',
              billCreatedAt: '$createdAt',
              orderedAt: '$items.orderedAt',
              preparedAt: '$items.preparedAt',
              preparingTime: '$items.preparingTime',
              productName: '$productDetails.name',
              productStandardPreparationTime: '$productDetails.preparationTime',
              chefName: '$chefDetails.name',
              quantity: '$items.quantity',
            },
          },
        ],
        activeChefs: [
          {
            $group: {
              _id: '$items.preparedBy',
              name: { $first: '$chefDetails.name' },
            },
          },
          { $match: { _id: { $ne: null } } },
          { $project: { id: '$_id', name: '$name', _id: 0 } },
        ],
      },
    })

    const [facetResult] = (await BillingModel.aggregate(pipeline)) as unknown as Array<{
      filteredRows: RawPreparationItem[]
      activeChefs: Array<{ id: string; name: string }>
    }>

    const rows = Array.isArray(facetResult?.filteredRows) ? facetResult.filteredRows : []
    const availableChefs = Array.isArray(facetResult?.activeChefs) ? facetResult.activeChefs : []

    const details = rows
      .map((row) => {
        const prep = resolveItemPreparationMinutes(row)
        const chefTime = parsePreparingTimeValue(row.preparingTime)
        const quantity = typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0 ? row.quantity : 1
        const configuredPerUnit = parsePreparingTimeValue(row.productStandardPreparationTime)
        const totalStandardTime =
          configuredPerUnit != null && configuredPerUnit > 0 ? configuredPerUnit * quantity : null

        return {
          billingId: toId(row.billingId) || '',
          billNumber: resolveBillNumber(row),
          productName: typeof row.productName === 'string' ? row.productName : '--',
          orderedAt: typeof row.orderedAt === 'string' ? row.orderedAt : '--',
          preparedAt: typeof row.preparedAt === 'string' ? row.preparedAt : '--',
          preparationTime: prep != null && Number.isFinite(prep) ? prep : null,
          chefPreparationTime: chefTime != null && Number.isFinite(chefTime) ? chefTime : null,
          productStandardPreparationTime: configuredPerUnit,
          chefName: typeof row.chefName === 'string' ? row.chefName : '--',
          createdAt: parseToDayjs(row.billCreatedAt),
          quantity,
          status: getPreparationStatus(prep, totalStandardTime),
        }
      })
      .filter((item) => {
        if (selectedStatus === 'all') return true
        if (selectedStatus === 'chef_preparing_time') return item.chefPreparationTime != null
        return item.status === selectedStatus
      })
      .sort((a, b) => {
        const aMs = a.createdAt ? a.createdAt.valueOf() : 0
        const bMs = b.createdAt ? b.createdAt.valueOf() : 0

        // If createdAt is same (same bill), fallback to descending bill number string
        if (aMs === bMs) {
          return b.billNumber.localeCompare(a.billNumber)
        }
        return bMs - aMs
      })
      .map((item) => ({
        billingId: item.billingId,
        billNumber: item.billNumber,
        productName: item.productName,
        orderedAt: item.orderedAt,
        preparedAt: item.preparedAt,
        preparationTime: item.preparationTime,
        chefPreparationTime: item.chefPreparationTime,
        productStandardPreparationTime: item.productStandardPreparationTime,
        chefName: item.chefName,
        quantity: item.quantity,
        status: item.status,
      }))

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      productId,
      availableChefs,
      details,
    })
  } catch (error) {
    payload.logger.error({ msg: 'Product preparation bill details error', error })
    return Response.json({ error: 'Failed to fetch product preparation bill details' }, { status: 500 })
  }
}
