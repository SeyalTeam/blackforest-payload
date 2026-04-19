import type { PayloadRequest } from 'payload'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

export type ClosingEntryExpenseDetail = {
  amount: number
  category: string
  date: string
  imageUrl: string
  reason: string
}

export type ClosingEntryDenominations = {
  count10: number
  count100: number
  count200: number
  count2000: number
  count5: number
  count50: number
  count500: number
}

export type ClosingEntryDetail = {
  card: number
  cash: number
  closingNumber: string
  createdAt: string
  denominations: ClosingEntryDenominations
  expenseDetails: ClosingEntryExpenseDetail[]
  expenses: number
  manualSales: number
  onlineSales: number
  systemSales: number
  totalBills: number
  totalSales: number
  upi: number
}

export type ClosingEntryStat = {
  _id: string
  branchName: string
  card: number
  cash: number
  closingNumbers: string[]
  count10: number
  count100: number
  count200: number
  count2000: number
  count5: number
  count50: number
  count500: number
  entries: ClosingEntryDetail[]
  expenseDetails: ClosingEntryExpenseDetail[]
  expenses: number
  lastUpdated: string
  manualSales: number
  net: number
  onlineSales: number
  returnTotal: number
  sNo: number
  stockOrders: number
  systemSales: number
  totalBills: number
  totalEntries: number
  totalSales: number
  upi: number
}

export type ClosingEntryTotals = {
  card: number
  cash: number
  expenses: number
  manualSales: number
  net: number
  onlineSales: number
  returnTotal: number
  stockOrders: number
  systemSales: number
  totalBills: number
  totalEntries: number
  totalSales: number
  upi: number
}

export type ClosingEntryReportResult = {
  endDate: string
  startDate: string
  stats: ClosingEntryStat[]
  totals: ClosingEntryTotals
}

type ClosingEntryReportArgs = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
}

type RawExpenseDetail = {
  amount?: unknown
  image?: unknown
  reason?: unknown
  source?: unknown
}

type RawExpenseDoc = {
  branch?: unknown
  date?: unknown
  details?: unknown
}

type RawClosingEntryItem = {
  card?: unknown
  cash?: unknown
  closingNumber?: unknown
  createdAt?: unknown
  denominations?: unknown
  expenses?: unknown
  manualSales?: unknown
  onlineSales?: unknown
  systemSales?: unknown
  totalBills?: unknown
  totalSales?: unknown
  upi?: unknown
}

type RawClosingStat = {
  _id?: unknown
  branchName?: unknown
  card?: unknown
  cash?: unknown
  closingNumbers?: unknown
  count10?: unknown
  count100?: unknown
  count200?: unknown
  count2000?: unknown
  count5?: unknown
  count50?: unknown
  count500?: unknown
  entries?: unknown
  expenses?: unknown
  lastUpdated?: unknown
  manualSales?: unknown
  net?: unknown
  onlineSales?: unknown
  returnTotal?: unknown
  stockOrders?: unknown
  systemSales?: unknown
  totalBills?: unknown
  totalEntries?: unknown
  totalSales?: unknown
  upi?: unknown
}

const EMPTY_OBJECT_ID = '000000000000000000000000'

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

const toDateParam = (value: unknown): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  return new Date().toISOString().split('T')[0]
}

const buildUtcDayStart = (dateParam: string): Date => {
  const [year, month, day] = dateParam.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

const buildUtcDayEnd = (dateParam: string): Date => {
  const [year, month, day] = dateParam.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
}

const toDenominations = (value: unknown): ClosingEntryDenominations => {
  const source = typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {}
  return {
    count2000: toInteger(source.count2000),
    count500: toInteger(source.count500),
    count200: toInteger(source.count200),
    count100: toInteger(source.count100),
    count50: toInteger(source.count50),
    count10: toInteger(source.count10),
    count5: toInteger(source.count5),
  }
}

const toExpenseDetailsFromExpenseDoc = (expense: RawExpenseDoc): ClosingEntryExpenseDetail[] => {
  const details = Array.isArray(expense.details) ? (expense.details as RawExpenseDetail[]) : []

  return details.map((detail) => {
    let imageUrl = ''
    if (detail?.image && typeof detail.image === 'object' && detail.image !== null) {
      const imageRecord = detail.image as { url?: unknown }
      if (typeof imageRecord.url === 'string') {
        imageUrl = imageRecord.url
      }
    }

    return {
      category: toNonEmptyString(detail?.source, 'OTHERS'),
      reason: toNonEmptyString(detail?.reason, '(No reason)'),
      amount: toNumber(detail?.amount),
      imageUrl,
      date: toDateString(expense.date),
    }
  })
}

const normalizeEntry = (entry: RawClosingEntryItem): ClosingEntryDetail => {
  return {
    closingNumber: toNonEmptyString(entry.closingNumber, 'Unknown'),
    createdAt: toDateString(entry.createdAt),
    systemSales: toNumber(entry.systemSales),
    totalBills: toInteger(entry.totalBills),
    manualSales: toNumber(entry.manualSales),
    onlineSales: toNumber(entry.onlineSales),
    totalSales: toNumber(entry.totalSales),
    expenses: toNumber(entry.expenses),
    cash: toNumber(entry.cash),
    upi: toNumber(entry.upi),
    card: toNumber(entry.card),
    denominations: toDenominations(entry.denominations),
    expenseDetails: [],
  }
}

const toExpenseBranchId = (value: unknown): string => {
  if (typeof value === 'object' && value !== null) {
    const record = value as { id?: unknown; _id?: unknown }
    const id = toNonEmptyString(record.id, '')
    if (id.length > 0) return id

    const mongoId = toNonEmptyString(record._id, '')
    if (mongoId.length > 0) return mongoId
  }

  return toNonEmptyString(value, '')
}

export const getClosingEntryReportData = async (
  req: PayloadRequest,
  args: ClosingEntryReportArgs = {},
): Promise<ClosingEntryReportResult> => {
  const { payload } = req

  const startDateParam = toDateParam(args.startDate)
  const endDateParam = toDateParam(args.endDate)
  const branchParam = typeof args.branch === 'string' ? args.branch : null

  const startOfDay = buildUtcDayStart(startDateParam)
  const endOfDay = buildUtcDayEnd(endDateParam)

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

  const ClosingModel = payload.db.collections['closing-entries']
  if (!ClosingModel) {
    throw new Error('Closing entries collection not found')
  }

  const closingMatch: Record<string, unknown> = {
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }
  if (branchIds) {
    closingMatch.$expr = {
      $in: [{ $toString: '$branch' }, branchIds],
    }
  }

  const statsRaw = (await ClosingModel.aggregate([
    {
      $match: closingMatch,
    },
    {
      $group: {
        _id: '$branch',
        totalEntries: { $sum: 1 },
        closingNumbers: { $push: '$closingNumber' },
        lastUpdated: { $max: '$createdAt' },
        entries: {
          $push: {
            closingNumber: '$closingNumber',
            createdAt: '$createdAt',
            systemSales: '$systemSales',
            totalBills: '$totalBills',
            manualSales: '$manualSales',
            onlineSales: '$onlineSales',
            totalSales: '$totalSales',
            expenses: '$expenses',
            cash: '$cash',
            upi: '$upi',
            card: '$creditCard',
            denominations: '$denominations',
          },
        },
        systemSales: { $sum: '$systemSales' },
        totalBills: { $sum: '$totalBills' },
        manualSales: { $sum: '$manualSales' },
        onlineSales: { $sum: '$onlineSales' },
        totalSales: { $sum: '$totalSales' },
        expenses: { $sum: '$expenses' },
        returnTotal: { $sum: '$returnTotal' },
        stockOrders: { $sum: '$stockOrders' },
        net: { $sum: '$net' },
        cash: { $sum: '$cash' },
        upi: { $sum: '$upi' },
        card: { $sum: '$creditCard' },
        count2000: { $sum: { $ifNull: ['$denominations.count2000', 0] } },
        count500: { $sum: { $ifNull: ['$denominations.count500', 0] } },
        count200: { $sum: { $ifNull: ['$denominations.count200', 0] } },
        count100: { $sum: { $ifNull: ['$denominations.count100', 0] } },
        count50: { $sum: { $ifNull: ['$denominations.count50', 0] } },
        count10: { $sum: { $ifNull: ['$denominations.count10', 0] } },
        count5: { $sum: { $ifNull: ['$denominations.count5', 0] } },
      },
    },
    {
      $lookup: {
        from: 'branches',
        localField: '_id',
        foreignField: '_id',
        as: 'branchDetails',
      },
    },
    {
      $unwind: {
        path: '$branchDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        branchName: { $ifNull: ['$branchDetails.name', 'Unknown Branch'] },
        totalEntries: 1,
        closingNumbers: 1,
        lastUpdated: 1,
        entries: 1,
        systemSales: 1,
        totalBills: 1,
        manualSales: 1,
        onlineSales: 1,
        totalSales: 1,
        expenses: 1,
        returnTotal: 1,
        stockOrders: 1,
        net: 1,
        cash: 1,
        upi: 1,
        card: 1,
        count2000: 1,
        count500: 1,
        count200: 1,
        count100: 1,
        count50: 1,
        count10: 1,
        count5: 1,
      },
    },
    {
      $sort: { branchName: 1 },
    },
  ])) as RawClosingStat[]

  const normalizedStatsBase = (Array.isArray(statsRaw) ? statsRaw : []).map((item) => {
    const entriesRaw = Array.isArray(item.entries) ? (item.entries as RawClosingEntryItem[]) : []
    const closingNumbersRaw = Array.isArray(item.closingNumbers) ? item.closingNumbers : []

    return {
      _id: toNonEmptyString(item._id),
      branchName: toNonEmptyString(item.branchName, 'Unknown Branch'),
      totalEntries: toInteger(item.totalEntries),
      closingNumbers: closingNumbersRaw.map((value) => toNonEmptyString(value)).filter(Boolean),
      lastUpdated: toDateString(item.lastUpdated),
      entries: entriesRaw.map(normalizeEntry),
      systemSales: toNumber(item.systemSales),
      totalBills: toInteger(item.totalBills),
      manualSales: toNumber(item.manualSales),
      onlineSales: toNumber(item.onlineSales),
      totalSales: toNumber(item.totalSales),
      expenses: toNumber(item.expenses),
      returnTotal: toNumber(item.returnTotal),
      stockOrders: toNumber(item.stockOrders),
      net: toNumber(item.net),
      cash: toNumber(item.cash),
      upi: toNumber(item.upi),
      card: toNumber(item.card),
      count2000: toInteger(item.count2000),
      count500: toInteger(item.count500),
      count200: toInteger(item.count200),
      count100: toInteger(item.count100),
      count50: toInteger(item.count50),
      count10: toInteger(item.count10),
      count5: toInteger(item.count5),
    }
  })

  const totals: ClosingEntryTotals = normalizedStatsBase.reduce(
    (acc, curr) => ({
      totalEntries: acc.totalEntries + curr.totalEntries,
      systemSales: acc.systemSales + curr.systemSales,
      totalBills: acc.totalBills + curr.totalBills,
      manualSales: acc.manualSales + curr.manualSales,
      onlineSales: acc.onlineSales + curr.onlineSales,
      totalSales: acc.totalSales + curr.totalSales,
      expenses: acc.expenses + curr.expenses,
      returnTotal: acc.returnTotal + curr.returnTotal,
      stockOrders: acc.stockOrders + curr.stockOrders,
      net: acc.net + curr.net,
      cash: acc.cash + curr.cash,
      upi: acc.upi + curr.upi,
      card: acc.card + curr.card,
    }),
    {
      totalEntries: 0,
      systemSales: 0,
      totalBills: 0,
      manualSales: 0,
      onlineSales: 0,
      totalSales: 0,
      expenses: 0,
      returnTotal: 0,
      stockOrders: 0,
      net: 0,
      cash: 0,
      upi: 0,
      card: 0,
    },
  )

  const expensesRes = await payload.find({
    collection: 'expenses',
    where: {
      and: [
        { date: { greater_than_equal: startOfDay.toISOString() } },
        { date: { less_than_equal: endOfDay.toISOString() } },
        ...(branchIds
          ? [
              {
                branch: {
                  in: branchIds,
                },
              },
            ]
          : []),
      ],
    },
    limit: 1000,
    pagination: false,
    depth: 2,
  })

  const allExpenses = (Array.isArray(expensesRes.docs) ? expensesRes.docs : []) as RawExpenseDoc[]

  const stats: ClosingEntryStat[] = normalizedStatsBase.map((item, index) => {
    const branchId = item._id
    if (!branchId) {
      return {
        ...item,
        _id: '',
        sNo: index + 1,
        expenseDetails: [],
      }
    }

    const sortedEntries = [...item.entries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

    const branchExpenses = allExpenses.filter((expense) => {
      const expenseBranchId = toExpenseBranchId(expense.branch)
      return expenseBranchId === branchId
    })

    const entriesWithExpenses = sortedEntries.map((entry, entryIndex) => {
      const entryTime = new Date(entry.createdAt).getTime()
      const prevTime =
        entryIndex === 0
          ? new Date(startOfDay).getTime()
          : new Date(sortedEntries[entryIndex - 1]?.createdAt || startOfDay).getTime()

      const relevantExpenses = branchExpenses.filter((expense) => {
        const expenseTime = new Date(toDateString(expense.date)).getTime()
        return expenseTime > prevTime && expenseTime <= entryTime
      })

      return {
        ...entry,
        expenseDetails: relevantExpenses.flatMap(toExpenseDetailsFromExpenseDoc),
      }
    })

    const branchExpenseDetails = branchExpenses.flatMap(toExpenseDetailsFromExpenseDoc)

    return {
      ...item,
      _id: branchId === EMPTY_OBJECT_ID ? '' : branchId,
      sNo: index + 1,
      entries: entriesWithExpenses,
      expenseDetails: branchExpenseDetails,
    }
  })

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    stats,
    totals,
  }
}
