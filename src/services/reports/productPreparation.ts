import type { PayloadRequest } from 'payload'
import mongoose, { type PipelineStage } from 'mongoose'
import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { resolveReportBranchScope } from '../../endpoints/reportScope'
import { getAllKotTimeConfigs, DEFAULT_TIMINGS } from '../../lib/kot-time'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type RawPreparationItem = {
  billCreatedAt: unknown
  billingId: unknown
  branchId: unknown
  chefName: unknown
  confirmedByName: unknown
  deliveredByName: unknown
  confirmedAt: unknown
  deliveredAt: unknown
  waiterName: unknown
  finalLineTotal: unknown
  invoiceNumber: unknown
  kotNumber: unknown
  orderedAt: unknown
  preparedAt: unknown
  preparingTime: unknown
  productId: unknown
  productName: unknown
  productStandardPreparationTime: unknown
  supervisorConfirmingTime?: unknown
  waiterDeliverTime?: unknown
  quantity: unknown
  subtotal: unknown
}

export type ProductPreparationStatus = 'exceeded' | 'lower' | 'neutral'
export type ProductPreparationStatusFilter =
  | 'all'
  | ProductPreparationStatus
  | 'chef_preparing_time'
  | 'supervisor_exceeded'
  | 'waiter_exceeded'
  | 'chef_exceeded'

export type ProductPreparationBillDetail = {
  amount: null | number
  billNumber: string
  billingId: string
  chefName: string
  confirmedByName: string
  deliveredByName: string
  confirmedAt: string
  deliveredAt: string
  waiterName: string
  chefPreparationTime: null | number
  orderedAt: string
  preparedAt: string
  preparationTime: null | number
  productId: string
  productName: string
  productStandardPreparationTime: null | number
  quantity: number
  status: ProductPreparationStatus
  chefStatus: ProductPreparationStatus
  supervisorConfirmingTime: null | number
  supervisorStandardTime: null | number
  supervisorStatus: ProductPreparationStatus
  waiterDeliverTime: null | number
  waiterStandardTime: null | number
  waiterStatus: ProductPreparationStatus
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
  orderType?: null | string
  productId?: null | string
  startDate?: null | string
  stationType?: null | string
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

const parseTimeLikeValue = (value: unknown, fallbackDate: Dayjs | null): Dayjs | null => {
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

  if (!fallbackDate) return null

  return fallbackDate
    .tz('Asia/Kolkata')
    .hour(hour)
    .minute(minute)
    .second(second)
    .millisecond(0)
}

const formatRailwayTime = (value: unknown, fallbackDate: Dayjs | null = null): string => {
  if (value == null) return '--'

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '--') return '--'
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed

    const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (timeOnlyMatch) {
      const h = timeOnlyMatch[1].padStart(2, '0')
      const m = timeOnlyMatch[2].padStart(2, '0')
      const s = (timeOnlyMatch[3] || '00').padStart(2, '0')
      return `${h}:${m}:${s}`
    }
  }

  const parsed = parseTimeLikeValue(value, fallbackDate)
  if (parsed && parsed.isValid()) {
    return parsed.format('HH:mm:ss')
  }

  return '--'
}

const parsePreparingTimeValue = (value: unknown): null | number => {
  if (value == null) return null
  if (typeof value === 'string' && value.trim().length === 0) return null

  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return parsed
}

const parseAmountValue = (value: unknown): null | number => {
  if (value == null) return null
  if (typeof value === 'string' && value.trim().length === 0) return null

  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(parsed)) return null

  return parsed
}

const parseStatusParam = (value: unknown): ProductPreparationStatusFilter => {
  if (typeof value !== 'string') return 'all'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'supervisor_exceeded' || normalized.includes('supervisor')) return 'supervisor_exceeded'
  if (normalized === 'waiter_exceeded' || normalized.includes('waiter')) return 'waiter_exceeded'
  if (normalized === 'chef_exceeded') return 'chef_exceeded'
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
  if (actual <= baseline) return 'lower'
  return 'neutral'
}

const getDurationMinutes = (start: dayjs.Dayjs, end: dayjs.Dayjs): number => {
  let diff = end.diff(start, 'minute', true)
  if (diff < 0) {
    // If start is late evening (>= 18:00) and end is early morning (<= 06:00), it rolled over midnight
    if (start.hour() >= 18 && end.hour() <= 6) {
      diff = end.add(1, 'day').diff(start, 'minute', true)
    } else {
      // Clock jitter / recorded at almost identical second
      diff = 0
    }
  }
  return Math.max(0, Number(diff.toFixed(2)))
}

const resolveSupervisorConfirmingMinutes = (row: RawPreparationItem): null | number => {
  if (!row.confirmedAt || typeof row.confirmedAt !== 'string' || row.confirmedAt.trim() === '' || row.confirmedAt.trim() === '--') {
    return null
  }
  const fallbackDate = parseToDayjs(row.billCreatedAt) ?? dayjs().tz('Asia/Kolkata')
  const orderedAt = parseTimeLikeValue(row.orderedAt, fallbackDate) || fallbackDate
  const preparedAt = parseTimeLikeValue(row.preparedAt, fallbackDate)
  const confirmedAt = parseTimeLikeValue(row.confirmedAt, fallbackDate)

  if (!confirmedAt) return null

  // If chef finished preparing before supervisor confirmed, supervisor confirming duration is preparedAt -> confirmedAt.
  // Otherwise (or if there is no preparedAt, e.g. counter products), duration is orderedAt -> confirmedAt.
  const start = preparedAt && preparedAt.isBefore(confirmedAt) ? preparedAt : orderedAt
  return getDurationMinutes(start, confirmedAt)
}

const resolveWaiterDeliverMinutes = (row: RawPreparationItem): null | number => {
  if (!row.deliveredAt || typeof row.deliveredAt !== 'string' || row.deliveredAt.trim() === '' || row.deliveredAt.trim() === '--') {
    return null
  }
  const fallbackDate = parseToDayjs(row.billCreatedAt) ?? dayjs().tz('Asia/Kolkata')
  const preparedAt = parseTimeLikeValue(row.preparedAt, fallbackDate)
  const confirmedAt = parseTimeLikeValue(row.confirmedAt, fallbackDate)
  const orderedAt = parseTimeLikeValue(row.orderedAt, fallbackDate)
  const deliveredAt = parseTimeLikeValue(row.deliveredAt, fallbackDate)

  if (!deliveredAt) return null

  // Food is ready for waiter delivery only after both preparation and confirmation have occurred.
  // Whichever occurred latest before delivery is when waiter delivery begins.
  let readyTime: dayjs.Dayjs | null = null
  if (preparedAt && confirmedAt) {
    readyTime = confirmedAt.isAfter(preparedAt) ? confirmedAt : preparedAt
  } else if (confirmedAt) {
    readyTime = confirmedAt
  } else if (preparedAt) {
    readyTime = preparedAt
  } else {
    readyTime = orderedAt
  }

  if (readyTime) {
    return getDurationMinutes(readyTime, deliveredAt)
  }
  return null
}

const resolveChefActualMinutes = (row: RawPreparationItem): null | number => {
  const preparingTime = parsePreparingTimeValue(row.preparingTime)
  if (preparingTime != null) return preparingTime

  return resolveItemPreparationMinutes(row)
}

const resolveItemPreparationMinutes = (row: RawPreparationItem): null | number => {
  const fallbackDate = parseToDayjs(row.billCreatedAt) ?? dayjs().tz('Asia/Kolkata')

  const orderedAt = parseTimeLikeValue(row.orderedAt, fallbackDate)
  const preparedAt = parseTimeLikeValue(row.preparedAt, fallbackDate)

  if (orderedAt && preparedAt) {
    return getDurationMinutes(orderedAt, preparedAt)
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
  const chefIdParam = typeof args.chefId === 'string' ? args.chefId.trim() : ''
  const kitchenId = typeof args.kitchenId === 'string' ? args.kitchenId.trim() : ''
  const selectedStatus = parseStatusParam(args.status)
  const orderType = typeof args.orderType === 'string' ? args.orderType.trim().toLowerCase() : 'all'

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

  const hasTableOrderReferenceExpression = {
    $or: [
      {
        $gt: [
          {
            $strLenCP: {
              $trim: {
                input: {
                  $convert: { input: '$section', to: 'string', onError: '', onNull: '' },
                },
              },
            },
          },
          0,
        ],
      },
      {
        $gt: [
          {
            $strLenCP: {
              $trim: {
                input: {
                  $convert: { input: '$tableNumber', to: 'string', onError: '', onNull: '' },
                },
              },
            },
          },
          0,
        ],
      },
      {
        $gt: [
          {
            $strLenCP: {
              $trim: {
                input: {
                  $convert: { input: '$tableDetails.section', to: 'string', onError: '', onNull: '' },
                },
              },
            },
          },
          0,
        ],
      },
      {
        $gt: [
          {
            $strLenCP: {
              $trim: {
                input: {
                  $convert: { input: '$tableDetails.tableNumber', to: 'string', onError: '', onNull: '' },
                },
              },
            },
          },
          0,
        ],
      },
    ],
  }

  if (orderType === 'table') {
    matchQuery.$expr = hasTableOrderReferenceExpression
  }

  const stationType =
    typeof args.stationType === 'string' && args.stationType.trim().toLowerCase() === 'counter'
      ? 'counter'
      : 'kitchen'

  let finalCategoryIds: string[] = []
  let resolvedBranchIds: string[] = branchIds || []

  if (stationType === 'kitchen') {
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
  } else {
    // For counter, kitchenId is not required; if categoryParam is passed, filter by requested categories
    if (categoryParam && categoryParam !== 'all') {
      finalCategoryIds = categoryParam
        .split(',')
        .map((id) => id.trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    }
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
  const chefIds =
    chefIdParam && chefIdParam !== 'all'
      ? chefIdParam
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0 && id !== 'all')
      : []
  const validChefObjectIds = chefIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))

  if (validChefObjectIds.length > 0) {
    chefMatch['items.preparedBy'] = { $in: validChefObjectIds }
  } else if (chefIds.length > 0) {
    chefMatch['items.preparedBy'] = { $in: [new mongoose.Types.ObjectId('000000000000000000000000')] }
  }

  // Pre-fetch all departments & categories to avoid lookup stages
  const deptRes = await req.payload.find({
    collection: 'departments',
    limit: 1000,
    pagination: false,
    depth: 0,
  })
  const deptMap = new Map<string, string>()
  deptRes.docs.forEach((d: any) => {
    deptMap.set(String(d.id), d.name || '')
  })

  const catRes = await req.payload.find({
    collection: 'categories',
    limit: 1000,
    pagination: false,
    depth: 0,
  })
  const catMap = new Map<string, any>()
  catRes.docs.forEach((c: any) => {
    const deptId = typeof c.department === 'object' ? c.department?.id : c.department
    catMap.set(String(c.id), {
      name: c.name || '',
      departmentId: deptId,
      departmentName: deptId ? deptMap.get(String(deptId)) || 'No Department' : 'No Department',
    })
  })

  // Fetch billing docs using projection
  const billingDocs = await BillingModel.find(matchQuery, {
    branch: 1,
    invoiceNumber: 1,
    kotNumber: 1,
    createdAt: 1,
    createdBy: 1,
    section: 1,
    tableNumber: 1,
    'tableDetails.section': 1,
    'tableDetails.tableNumber': 1,
    'items.product': 1,
    'items.status': 1,
    'items.preparedBy': 1,
    'items.confirmedBy': 1,
    'items.deliveredBy': 1,
    'items.orderedAt': 1,
    'items.preparedAt': 1,
    'items.preparingTime': 1,
    'items.finalLineTotal': 1,
    'items.subtotal': 1,
    'items.quantity': 1,
    'items.confirmedAt': 1,
    'items.deliveredAt': 1,
  }).lean()

  // Gather referenced products and users
  const tableProductIds = new Set<string>()
  const tableUserIds = new Set<string>()

  billingDocs.forEach((b: any) => {
    const creatorId = String(b.createdBy || '')
    if (creatorId) tableUserIds.add(creatorId)

    if (b.items && Array.isArray(b.items)) {
      b.items.forEach((item: any) => {
        if (item.status === 'cancelled') return
        const pid = String(item.product || '')
        if (pid) tableProductIds.add(pid)

        const preparedBy = String(item.preparedBy || '')
        const confirmedBy = String(item.confirmedBy || '')
        const deliveredBy = String(item.deliveredBy || '')

        if (preparedBy) tableUserIds.add(preparedBy)
        if (confirmedBy) tableUserIds.add(confirmedBy)
        if (deliveredBy) tableUserIds.add(deliveredBy)
      })
    }
  })

  // Fetch referenced products and users in bulk with depth: 0
  const tableProductMap = new Map<string, any>()
  if (tableProductIds.size > 0) {
    const { docs: products } = await req.payload.find({
      collection: 'products',
      where: { id: { in: Array.from(tableProductIds) } },
      limit: 10000,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    products.forEach((p: any) => {
      const catId = typeof p.category === 'object' ? p.category?.id : p.category
      const catData = catId ? catMap.get(String(catId)) : null
      tableProductMap.set(String(p.id), {
        name: p.name || '',
        preparationTime: p.preparationTime,
        supervisorConfirmingTime: p.supervisorConfirmingTime,
        waiterDeliverTime: p.waiterDeliverTime,
        category: catId,
        categoryName: catData?.name || 'Uncategorized',
        departmentId: catData?.departmentId,
        departmentName: catData?.departmentName || 'No Department',
      })
    })
  }

  const tableUserMap = new Map<string, string>()
  const chefUserIds = new Set<string>()
  if (tableUserIds.size > 0) {
    const { docs: users } = await req.payload.find({
      collection: 'users',
      where: { id: { in: Array.from(tableUserIds) } },
      limit: 5000,
      pagination: false,
      depth: 0,
    })
    users.forEach((u: any) => {
      tableUserMap.set(String(u.id), u.name || '')
      if (u.role === 'chef' || u.role === 'kitchen') {
        chefUserIds.add(String(u.id))
      }
    })
  }

  const kotTimeConfigs = await getAllKotTimeConfigs(req.payload)

  const activeChefsMap = new Map<string, string>()
  const rows: RawPreparationItem[] = []

  billingDocs.forEach((b: any) => {
    if (!b.items || !Array.isArray(b.items)) return
    b.items.forEach((item: any) => {
      if (item.status === 'cancelled') return

      const prodId = String(item.product || '')
      const pDetails = tableProductMap.get(prodId)

      // 1. Filter by product
      if (!isAllProducts && prodId !== productId) return

      // 2. Filter by category
      if (finalCategoryIds.length > 0) {
        if (!pDetails?.category || !finalCategoryIds.includes(String(pDetails.category))) return
      } else if (stationType === 'kitchen' && (kitchenId || (categoryParam && categoryParam !== 'all'))) {
        return
      }

      // 3. Filter by department
      if (departmentParam && departmentParam !== 'all' && mongoose.Types.ObjectId.isValid(departmentParam)) {
        if (String(pDetails?.departmentId) !== departmentParam) return
      }

      if (!pDetails) return

      const prodPrepTime = pDetails.preparationTime != null ? Number(pDetails.preparationTime) : null
      const hasProductPrepTime = prodPrepTime != null && Number.isFinite(prodPrepTime) && prodPrepTime > 0

      // Station Type filter: Kitchen vs Counter
      // - Kitchen products: All products having preparation time (preparationTime > 0)
      // - Counter products: All products NOT having preparation time (preparationTime is empty, null, or 0)
      if (stationType === 'counter') {
        if (hasProductPrepTime) return
      } else {
        if (!hasProductPrepTime) return
      }

      const preparedBy = item.preparedBy ? String(item.preparedBy) : ''

      // Track active chefs (before chef ID filter)
      if (preparedBy) {
        const chefName = tableUserMap.get(preparedBy) || ''
        activeChefsMap.set(preparedBy, chefName)
      }

      // 4. Filter by chef ID
      if (chefIds.length > 0) {
        if (!preparedBy || !chefIds.includes(preparedBy)) return
      }

      const chefDetailsName = preparedBy ? tableUserMap.get(preparedBy) : undefined
      const resolvedDeliveredByName = item.deliveredBy
        ? tableUserMap.get(String(item.deliveredBy)) || ''
        : b.createdBy
          ? tableUserMap.get(String(b.createdBy)) || ''
          : ''

      rows.push({
        billingId: String(b._id),
        branchId: toId(b.branch),
        invoiceNumber: b.invoiceNumber,
        kotNumber: b.kotNumber,
        billCreatedAt: b.createdAt,
        productId: item.product,
        orderedAt: item.orderedAt,
        preparedAt: item.preparedAt,
        preparingTime: item.preparingTime,
        finalLineTotal: item.finalLineTotal,
        subtotal: item.subtotal,
        productName: pDetails?.name || '',
        productStandardPreparationTime: pDetails?.preparationTime,
        supervisorConfirmingTime: pDetails?.supervisorConfirmingTime,
        waiterDeliverTime: pDetails?.waiterDeliverTime,
        chefName: chefDetailsName || '',
        confirmedByName: item.confirmedBy ? tableUserMap.get(String(item.confirmedBy)) || '' : '',
        deliveredByName: resolvedDeliveredByName,
        confirmedAt: item.confirmedAt || '',
        deliveredAt: item.deliveredAt || '',
        waiterName: b.createdBy ? tableUserMap.get(String(b.createdBy)) || '' : resolvedDeliveredByName,
        quantity: item.quantity,
      })
    })
  })

  const availableChefs = Array.from(activeChefsMap.entries()).map(([id, name]) => ({
    id,
    name,
  }))

  const details = rows
    .map((row) => {
      const branchIdStr = String(row.branchId || (branchParam !== 'all' ? branchParam : '') || '')
      const branchConfig = kotTimeConfigs.get(branchIdStr)
      const supervisorStandardTime =
        row.supervisorConfirmingTime != null && Number(row.supervisorConfirmingTime) > 0
          ? Number(row.supervisorConfirmingTime)
          : (branchConfig?.supervisor?.timeInMinutes ?? DEFAULT_TIMINGS.supervisor.timeInMinutes)

      const waiterStandardTime =
        row.waiterDeliverTime != null && Number(row.waiterDeliverTime) > 0
          ? Number(row.waiterDeliverTime)
          : (branchConfig?.waiter?.timeInMinutes ?? DEFAULT_TIMINGS.waiter.timeInMinutes)

      const supervisorConfirmingTime = resolveSupervisorConfirmingMinutes(row)
      const waiterDeliverTime = resolveWaiterDeliverMinutes(row)
      const prep = resolveItemPreparationMinutes(row)
      const chefActual = resolveChefActualMinutes(row) ?? prep
      const quantity =
        typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0
          ? row.quantity
          : 1
      const configuredPerUnit = parsePreparingTimeValue(row.productStandardPreparationTime)
      const totalStandardTime =
        configuredPerUnit != null && configuredPerUnit > 0 ? configuredPerUnit * quantity : null
      const amount = parseAmountValue(row.finalLineTotal) ?? parseAmountValue(row.subtotal) ?? null

      // Standard KOT time shared by supervisor and waiter:
      const sharedKotTime = (supervisorStandardTime || 0) + (waiterStandardTime || 0)
      const chefStandardPreparationTime =
        configuredPerUnit != null && configuredPerUnit > 0
          ? (configuredPerUnit > sharedKotTime
              ? Number((configuredPerUnit - sharedKotTime).toFixed(2))
              : configuredPerUnit)
          : null
      const chefTotalTarget =
        totalStandardTime != null && totalStandardTime > 0
          ? (totalStandardTime > sharedKotTime
              ? Number((totalStandardTime - sharedKotTime).toFixed(2))
              : totalStandardTime)
          : null

      const manualChefTime = parsePreparingTimeValue(row.preparingTime)
      const chefTime = chefStandardPreparationTime ?? manualChefTime

      const supervisorStatus: ProductPreparationStatus =
        supervisorConfirmingTime != null && supervisorStandardTime != null && supervisorStandardTime > 0
          ? supervisorConfirmingTime > supervisorStandardTime
            ? 'exceeded'
            : 'lower'
          : 'neutral'

      const waiterStatus: ProductPreparationStatus =
        waiterDeliverTime != null && waiterStandardTime != null && waiterStandardTime > 0
          ? waiterDeliverTime > waiterStandardTime
            ? 'exceeded'
            : 'lower'
          : 'neutral'

      const chefStatus: ProductPreparationStatus = getPreparationStatus(
        prep,
        chefTime ?? configuredPerUnit,
      )

      let overallStatus: ProductPreparationStatus = 'neutral'
      if (chefStatus === 'exceeded' || supervisorStatus === 'exceeded' || waiterStatus === 'exceeded') {
        overallStatus = 'exceeded'
      } else if (chefStatus === 'lower' || supervisorStatus === 'lower' || waiterStatus === 'lower') {
        overallStatus = 'lower'
      }

      const fallbackBillDate = parseToDayjs(row.billCreatedAt)

      return {
        amount,
        billNumber: resolveBillNumber(row),
        billingId: toId(row.billingId) || '',
        chefName: typeof row.chefName === 'string' ? row.chefName : '--',
        confirmedByName: typeof row.confirmedByName === 'string' ? row.confirmedByName : '--',
        deliveredByName: typeof row.deliveredByName === 'string' && row.deliveredByName ? row.deliveredByName : '--',
        confirmedAt: formatRailwayTime(row.confirmedAt, fallbackBillDate),
        deliveredAt: formatRailwayTime(row.deliveredAt, fallbackBillDate),
        waiterName: typeof row.waiterName === 'string' && row.waiterName ? row.waiterName : '--',
        chefPreparationTime: chefTime != null && Number.isFinite(chefTime) ? chefTime : null,
        createdAt: fallbackBillDate,
        orderedAt: formatRailwayTime(row.orderedAt, fallbackBillDate),
        preparedAt: formatRailwayTime(row.preparedAt, fallbackBillDate),
        preparationTime: prep != null && Number.isFinite(prep) ? prep : null,
        productId: toId(row.productId) || '',
        productName: typeof row.productName === 'string' ? row.productName : '--',
        productStandardPreparationTime: configuredPerUnit,
        quantity,
        status: overallStatus,
        chefStatus,
        supervisorConfirmingTime,
        supervisorStandardTime,
        supervisorStatus,
        waiterDeliverTime,
        waiterStandardTime,
        waiterStatus,
      }
    })
    .filter((item) => {
      if (selectedStatus === 'all') return true
      if (selectedStatus === 'chef_preparing_time') return item.chefPreparationTime != null
      if (selectedStatus === 'supervisor_exceeded') return item.supervisorStatus === 'exceeded'
      if (selectedStatus === 'waiter_exceeded') return item.waiterStatus === 'exceeded'
      if (selectedStatus === 'chef_exceeded') return item.chefStatus === 'exceeded'
      return item.status === selectedStatus
    })
    .sort((a, b) => {
      const aOrderTime = parseTimeLikeValue(a.orderedAt, a.createdAt) || a.createdAt
      const bOrderTime = parseTimeLikeValue(b.orderedAt, b.createdAt) || b.createdAt

      const aMs = aOrderTime ? aOrderTime.valueOf() : 0
      const bMs = bOrderTime ? bOrderTime.valueOf() : 0

      if (aMs === bMs) {
        return b.billNumber.localeCompare(a.billNumber)
      }
      return bMs - aMs
    })
    .map((item) => ({
      billNumber: item.billNumber,
      billingId: item.billingId,
      amount: item.amount,
      chefName: item.chefName,
      confirmedByName: item.confirmedByName,
      deliveredByName: item.deliveredByName,
      confirmedAt: item.confirmedAt,
      deliveredAt: item.deliveredAt,
      waiterName: item.waiterName,
      chefPreparationTime: item.chefPreparationTime,
      orderedAt: item.orderedAt,
      preparedAt: item.preparedAt,
      preparationTime: item.preparationTime,
      productId: item.productId,
      productName: item.productName,
      productStandardPreparationTime: item.productStandardPreparationTime,
      quantity: item.quantity,
      status: item.status,
      chefStatus: item.chefStatus,
      supervisorConfirmingTime: item.supervisorConfirmingTime,
      supervisorStandardTime: item.supervisorStandardTime,
      supervisorStatus: item.supervisorStatus,
      waiterDeliverTime: item.waiterDeliverTime,
      waiterStandardTime: item.waiterStandardTime,
      waiterStatus: item.waiterStatus,
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
