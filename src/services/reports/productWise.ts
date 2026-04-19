import type { PayloadRequest } from 'payload'
import mongoose, { type PipelineStage } from 'mongoose'
import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type BranchSalesMap = Record<
  string,
  {
    amount: number
    quantity: number
  }
>

export type ProductWiseReportStat = {
  sNo: number
  productId: string
  productName: string
  price: number
  unit: string
  preparationTime: number | null
  averagePreparationTime: number | null
  averagePreparationSampleSize: number
  totalQuantity: number
  totalAmount: number
  branchSales: BranchSalesMap
}

export type ProductWiseReportTotals = {
  totalQuantity: number
  totalAmount: number
  branchTotals: Record<string, number>
}

export type ProductWiseReportResult = {
  startDate: string
  endDate: string
  branchHeaders: string[]
  stats: ProductWiseReportStat[]
  totals: ProductWiseReportTotals
}

type ProductWiseReportArgs = {
  branch?: null | string
  category?: null | string
  chefId?: null | string
  department?: null | string
  endDate?: null | string
  kitchenId?: null | string
  product?: null | string
  startDate?: null | string
}

type RawBranchData = {
  branchId: unknown
  amount: number
  quantity: number
}

type RawStat = {
  productId: unknown
  productName: string
  price: number
  unit: string
  preparationTime: number | null
  totalQuantity: number
  totalAmount: number
  branchData: RawBranchData[]
}

type RawPreparationItem = {
  productId: unknown
  orderedAt: unknown
  preparedAt: unknown
  preparingTime: unknown
  billCreatedAt: unknown
}

type RawBranch = {
  id: string
  name: string
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

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata')
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
}

export const getProductWiseReportData = async (
  req: PayloadRequest,
  args: ProductWiseReportArgs = {},
): Promise<ProductWiseReportResult> => {
  const { payload } = req

  const startDateParam =
    typeof args.startDate === 'string' && args.startDate.trim().length > 0
      ? args.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof args.endDate === 'string' && args.endDate.trim().length > 0
      ? args.endDate
      : new Date().toISOString().split('T')[0]

  const startOfDay = toDayBoundary(startDateParam, 'start')
  const endOfDay = toDayBoundary(endDateParam, 'end')

  const branchParam = typeof args.branch === 'string' ? args.branch : 'all'
  const categoryParam = typeof args.category === 'string' ? args.category : ''
  const departmentParam = typeof args.department === 'string' ? args.department : ''
  const productParam = typeof args.product === 'string' ? args.product : ''
  const chefId = typeof args.chefId === 'string' ? args.chefId.trim() : ''
  const kitchenId = typeof args.kitchenId === 'string' ? args.kitchenId.trim() : ''

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

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
  ;(branches.docs as RawBranch[]).forEach((branch) => {
    branchMap[branch.id] = branch.name.substring(0, 3).toUpperCase()
  })

  const BillingModel = payload.db.collections['billings']
  if (!BillingModel) {
    throw new Error('Billings collection not found')
  }

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
        .map((branch) => (typeof branch === 'object' ? branch.id : branch))
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
        .map((category) => (typeof category === 'object' ? category.id : category))
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
      $in: resolvedBranchIds.map((id) => new mongoose.Types.ObjectId(id)),
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
        $match: {
          'items.status': { $ne: 'cancelled' },
        },
      },
    ]

    if (chefId && chefId !== 'all' && mongoose.Types.ObjectId.isValid(chefId)) {
      pipeline.push({
        $match: {
          'items.preparedBy': { $eq: new mongoose.Types.ObjectId(chefId) },
        },
      })
    }

    pipeline.push(
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
    )

    if (finalCategoryIds.length > 0) {
      pipeline.push({
        $match: {
          'categoryDetails._id': {
            $in: finalCategoryIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      })
    } else {
      pipeline.push({
        $match: {
          'productDetails._id': { $exists: true },
          'categoryDetails._id': { $exists: true },
        },
      })
    }

    if (departmentParam && departmentParam !== 'all') {
      pipeline.push({
        $match: {
          'categoryDetails.department': { $eq: new mongoose.Types.ObjectId(departmentParam) },
        },
      })
    }

    if (productParam && productParam !== 'all') {
      const productIds = productParam.split(',').filter(Boolean)
      if (productIds.length > 0) {
        pipeline.push({
          $match: {
            'items.product': {
              $in: productIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
        })
      }
    }

    return pipeline
  }

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
        amount: { $sum: '$items.subtotal' },
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

  const rawStats = (await BillingModel.aggregate(aggregationPipeline)) as RawStat[]

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

  const rawPreparationItems = (await BillingModel.aggregate(preparationPipeline)) as RawPreparationItem[]
  const preparationByProductId: Record<string, { totalMinutes: number; count: number }> = {}

  rawPreparationItems.forEach((row) => {
    const productId = toId(row.productId)
    if (!productId) return

    const minutes = resolveItemPreparationMinutes(row)
    if (minutes == null || !Number.isFinite(minutes)) return

    if (!preparationByProductId[productId]) {
      preparationByProductId[productId] = { totalMinutes: 0, count: 0 }
    }

    preparationByProductId[productId].totalMinutes += minutes
    preparationByProductId[productId].count += 1
  })

  const branchTotals: Record<string, number> = {}

  rawStats.forEach((stat) => {
    stat.branchData.forEach((branchData) => {
      const branchId = String(branchData.branchId)
      if (branchMap[branchId]) {
        const code = branchMap[branchId]
        branchTotals[code] = (branchTotals[code] || 0) + branchData.amount
      }
    })
  })

  const branchHeaders = Object.keys(branchTotals)
    .filter((code) => branchTotals[code] > 0)
    .sort((a, b) => branchTotals[b] - branchTotals[a])

  const stats: ProductWiseReportStat[] = rawStats.map((item, index) => {
    const branchSales: BranchSalesMap = {}
    const productId = toId(item.productId) || ''
    const preparationAggregate = productId ? preparationByProductId[productId] : null
    const averagePreparationTime =
      preparationAggregate && preparationAggregate.count > 0
        ? Number((preparationAggregate.totalMinutes / preparationAggregate.count).toFixed(2))
        : null

    item.branchData.forEach((branchData) => {
      const branchId = String(branchData.branchId)
      if (branchMap[branchId]) {
        const code = branchMap[branchId]
        branchSales[code] = { amount: branchData.amount, quantity: branchData.quantity }
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

  const totals = stats.reduce(
    (acc, current) => ({
      totalQuantity: acc.totalQuantity + current.totalQuantity,
      totalAmount: acc.totalAmount + current.totalAmount,
    }),
    { totalQuantity: 0, totalAmount: 0 },
  )

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    branchHeaders,
    stats,
    totals: {
      ...totals,
      branchTotals,
    },
  }
}
