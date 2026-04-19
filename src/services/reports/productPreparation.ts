import type { PayloadRequest } from 'payload'
import mongoose, { type PipelineStage } from 'mongoose'
import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type RawPreparationItem = {
  billCreatedAt: unknown
  billingId: unknown
  chefName: unknown
  invoiceNumber: unknown
  kotNumber: unknown
  orderedAt: unknown
  preparedAt: unknown
  preparingTime: unknown
  productId: unknown
  productName: unknown
  productStandardPreparationTime: unknown
  quantity: unknown
}

export type ProductPreparationStatus = 'exceeded' | 'lower' | 'neutral'
export type ProductPreparationStatusFilter =
  | 'all'
  | ProductPreparationStatus
  | 'chef_preparing_time'

export type ProductPreparationBillDetail = {
  billNumber: string
  billingId: string
  chefName: string
  chefPreparationTime: null | number
  orderedAt: string
  preparedAt: string
  preparationTime: null | number
  productId: string
  productName: string
  productStandardPreparationTime: null | number
  quantity: number
  status: ProductPreparationStatus
}

export type ProductPreparationAvailableChef = {
  id: string
  name: string
}

export type ProductPreparationBillDetailsResult = {
  availableChefs: ProductPreparationAvailableChef[]
  details: ProductPreparationBillDetail[]
  endDate: string
  productId: string
  startDate: string
}

type ProductPreparationBillDetailsArgs = {
  branch?: null | string
  category?: null | string
  chefId?: null | string
  department?: null | string
  endDate?: null | string
  kitchenId?: null | string
  productId?: null | string
  startDate?: null | string
  status?: null | string
}

const parseDateParam = (value: unknown): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  return dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD')
}

const toId = (value: unknown): null | string => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value instanceof mongoose.Types.ObjectId) return value.toString()

  if (value && typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown }
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

const parsePreparingTimeValue = (value: unknown): null | number => {
  if (value == null) return null
  if (typeof value === 'string' && value.trim().length === 0) return null

  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return parsed
}

const parseStatusParam = (value: unknown): ProductPreparationStatusFilter => {
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
  actual: null | number | undefined,
  baseline: null | number | undefined,
): ProductPreparationStatus => {
  if (actual == null || baseline == null) return 'neutral'
  if (!Number.isFinite(actual) || !Number.isFinite(baseline)) return 'neutral'
  if (baseline <= 0) return 'neutral'
  if (actual > baseline) return 'exceeded'
  if (actual < baseline) return 'lower'
  return 'neutral'
}

const resolveItemPreparationMinutes = (row: RawPreparationItem): null | number => {
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

export const getProductPreparationBillDetailsData = async (
  req: PayloadRequest,
  args: ProductPreparationBillDetailsArgs = {},
): Promise<ProductPreparationBillDetailsResult> => {
  const { payload } = req

  const startDateParam = parseDateParam(args.startDate)
  const endDateParam = parseDateParam(args.endDate)
  const branchParam = typeof args.branch === 'string' ? args.branch : 'all'
  const categoryParam = typeof args.category === 'string' ? args.category : 'all'
  const departmentParam = typeof args.department === 'string' ? args.department : 'all'
  const productId = typeof args.productId === 'string' ? args.productId.trim() : ''
  const chefId = typeof args.chefId === 'string' ? args.chefId.trim() : ''
  const kitchenId = typeof args.kitchenId === 'string' ? args.kitchenId.trim() : ''
  const selectedStatus = parseStatusParam(args.status)

  const isAllProducts = !productId || productId === 'all'
  if (!isAllProducts && !mongoose.Types.ObjectId.isValid(productId)) {
    throw new Error('Invalid productId')
  }

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

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

  if (kitchenId && mongoose.Types.ObjectId.isValid(kitchenId)) {
    const kitchenRes = await payload.findByID({
      collection: 'kitchens',
      id: kitchenId,
      depth: 0,
    })

    if (kitchenRes) {
      const kitchenBranchIds = (Array.isArray(kitchenRes.branches) ? kitchenRes.branches : [])
        .map((b) => (typeof b === 'object' ? b.id : b))
        .filter(Boolean) as string[]

      if (resolvedBranchIds.length > 0) {
        resolvedBranchIds = resolvedBranchIds.filter((id) => kitchenBranchIds.includes(id))
        if (resolvedBranchIds.length === 0) {
          resolvedBranchIds = ['000000000000000000000000']
        }
      } else {
        resolvedBranchIds = kitchenBranchIds
      }

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
        finalCategoryIds = requestedCategoryIds.filter((id) => kitchenCategoryIds.includes(id))
        if (finalCategoryIds.length === 0) {
          finalCategoryIds = ['000000000000000000000000']
        }
      } else {
        finalCategoryIds = kitchenCategoryIds
      }
    } else {
      resolvedBranchIds = ['000000000000000000000000']
    }
  } else if (categoryParam && categoryParam !== 'all') {
    finalCategoryIds = categoryParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  }

  if (resolvedBranchIds.length > 0) {
    matchQuery.branch = {
      $in: resolvedBranchIds.map((id) => {
        try {
          return new mongoose.Types.ObjectId(id)
        } catch {
          return id
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
            productId: '$items.product',
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
    activeChefs: Array<{ id: unknown; name: unknown }>
    filteredRows: RawPreparationItem[]
  }>

  const rows = Array.isArray(facetResult?.filteredRows) ? facetResult.filteredRows : []
  const availableChefs = Array.isArray(facetResult?.activeChefs) ? facetResult.activeChefs : []

  const details = rows
    .map((row) => {
      const prep = resolveItemPreparationMinutes(row)
      const chefTime = parsePreparingTimeValue(row.preparingTime)
      const quantity =
        typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0
          ? row.quantity
          : 1
      const configuredPerUnit = parsePreparingTimeValue(row.productStandardPreparationTime)
      const totalStandardTime =
        configuredPerUnit != null && configuredPerUnit > 0 ? configuredPerUnit * quantity : null

      return {
        billNumber: resolveBillNumber(row),
        billingId: toId(row.billingId) || '',
        chefName: typeof row.chefName === 'string' ? row.chefName : '--',
        chefPreparationTime: chefTime != null && Number.isFinite(chefTime) ? chefTime : null,
        createdAt: parseToDayjs(row.billCreatedAt),
        orderedAt: typeof row.orderedAt === 'string' ? row.orderedAt : '--',
        preparedAt: typeof row.preparedAt === 'string' ? row.preparedAt : '--',
        preparationTime: prep != null && Number.isFinite(prep) ? prep : null,
        productId: toId(row.productId) || '',
        productName: typeof row.productName === 'string' ? row.productName : '--',
        productStandardPreparationTime: configuredPerUnit,
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

      if (aMs === bMs) {
        return b.billNumber.localeCompare(a.billNumber)
      }
      return bMs - aMs
    })
    .map((item) => ({
      billNumber: item.billNumber,
      billingId: item.billingId,
      chefName: item.chefName,
      chefPreparationTime: item.chefPreparationTime,
      orderedAt: item.orderedAt,
      preparedAt: item.preparedAt,
      preparationTime: item.preparationTime,
      productId: item.productId,
      productName: item.productName,
      productStandardPreparationTime: item.productStandardPreparationTime,
      quantity: item.quantity,
      status: item.status,
    }))

  return {
    availableChefs: availableChefs
      .map((chef) => ({
        id: toId(chef.id) || '',
        name: typeof chef.name === 'string' && chef.name.trim().length > 0 ? chef.name : '--',
      }))
      .filter((chef) => chef.id.length > 0),
    details,
    endDate: endDateParam,
    productId,
    startDate: startDateParam,
  }
}
