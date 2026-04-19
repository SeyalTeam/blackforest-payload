import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type WaiterWiseReportStat = {
  waiterId: string
  waiterName: string
  employeeId?: string
  branchNames: string[]
  branchIds: string[]
  lastBillTime?: string
  totalBills: number
  totalAmount: number
  cashAmount: number
  upiAmount: number
  cardAmount: number
  customerCount: number
}

export type WaiterWiseReportTotals = {
  totalBills: number
  totalAmount: number
  cashAmount: number
  upiAmount: number
  cardAmount: number
}

export type WaiterWiseReportActiveBranch = {
  id: string
  name: string
}

export type WaiterWiseReportTimeline = {
  minHour: number
  maxHour: number
}

export type WaiterWiseReportBranchBenchmark = {
  _id: string
  totalAmount: number
  totalBills: number
  totalWaiters: number
}

export type WaiterWiseReportResult = {
  startDate: string
  endDate: string
  stats: WaiterWiseReportStat[]
  totals: WaiterWiseReportTotals
  activeBranches: WaiterWiseReportActiveBranch[]
  timeline: WaiterWiseReportTimeline
  branchBenchmarks: WaiterWiseReportBranchBenchmark[]
}

type WaiterWiseReportArgs = {
  branch?: null | string
  endDate?: null | string
  hour?: null | number | string
  startDate?: null | string
  waiter?: null | string
}

type RawBranchBenchmark = {
  _id: unknown
  totalAmount: unknown
  totalBills: unknown
  totalWaiters: unknown
}

type RawWaiterStat = {
  waiterId: unknown
  waiterName: unknown
  employeeId: unknown
  branchNames: unknown
  branchIds: unknown
  lastBillTime: unknown
  totalBills: unknown
  totalAmount: unknown
  cashAmount: unknown
  upiAmount: unknown
  cardAmount: unknown
  customerCount: unknown
}

type RawActiveBranch = {
  id: unknown
  name: unknown
}

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata')
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
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

const toIsoString = (value: unknown): string | undefined => {
  if (value == null) return undefined

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
  }

  return undefined
}

const parseHourParam = (hour: null | number | string | undefined): null | number => {
  if (typeof hour === 'number' && Number.isFinite(hour)) {
    return Math.trunc(hour)
  }

  if (typeof hour === 'string' && hour.trim().length > 0) {
    const parsed = Number.parseInt(hour, 10)
    if (!Number.isNaN(parsed)) return parsed
  }

  return null
}

export const getWaiterWiseBillingReportData = async (
  req: PayloadRequest,
  args: WaiterWiseReportArgs = {},
): Promise<WaiterWiseReportResult> => {
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

  const branchParam = typeof args.branch === 'string' ? args.branch : ''
  const waiterParam = typeof args.waiter === 'string' ? args.waiter : ''
  const hourParam = parseHourParam(args.hour)

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

  const BillingModel = payload.db.collections['billings']
  if (!BillingModel) {
    throw new Error('Billings collection not found')
  }

  const matchQuery: Record<string, any> = {
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }

  const exprConditions: any[] = []

  if (branchIds) {
    exprConditions.push({ $in: [{ $toString: '$branch' }, branchIds] })
  }

  if (waiterParam && waiterParam !== 'all') {
    const waiterIds = waiterParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && id !== 'all')

    if (waiterIds.length > 0) {
      exprConditions.push({ $in: [{ $toString: '$createdBy' }, waiterIds] })
    }
  }

  if (hourParam !== null && !Number.isNaN(hourParam)) {
    exprConditions.push({
      $eq: [{ $hour: { date: '$createdAt', timezone: '+05:30' } }, hourParam],
    })
  }

  if (exprConditions.length > 0) {
    if (exprConditions.length === 1) {
      matchQuery.$expr = exprConditions[0]
    } else {
      matchQuery.$expr = { $and: exprConditions }
    }
  }

  const benchmarkExprConditions: any[] = []
  const benchmarkMatchBase: Record<string, any> = {
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }

  if (branchIds) {
    benchmarkExprConditions.push({ $in: [{ $toString: '$branch' }, branchIds] })
  }

  if (hourParam !== null && !Number.isNaN(hourParam)) {
    benchmarkExprConditions.push({
      $eq: [{ $hour: { date: '$createdAt', timezone: '+05:30' } }, hourParam],
    })
  }

  const benchmarkMatchQuery: Record<string, any> = { ...benchmarkMatchBase }
  if (benchmarkExprConditions.length > 0) {
    if (benchmarkExprConditions.length === 1) {
      benchmarkMatchQuery.$expr = benchmarkExprConditions[0]
    } else {
      benchmarkMatchQuery.$expr = { $and: benchmarkExprConditions }
    }
  }

  const branchBenchmarksRaw = (await BillingModel.aggregate([
    { $match: benchmarkMatchQuery },
    {
      $group: {
        _id: '$branch',
        totalAmount: { $sum: '$totalAmount' },
        totalBills: { $sum: 1 },
        waiterIds: { $addToSet: '$createdBy' },
      },
    },
    {
      $project: {
        totalAmount: 1,
        totalBills: 1,
        totalWaiters: {
          $size: {
            $filter: {
              input: '$waiterIds',
              as: 'waiterId',
              cond: {
                $and: [{ $ne: ['$$waiterId', null] }, { $ne: ['$$waiterId', ''] }],
              },
            },
          },
        },
      },
    },
  ])) as RawBranchBenchmark[]

  const branchBenchmarks: WaiterWiseReportBranchBenchmark[] = branchBenchmarksRaw
    .map((item) => ({
      _id: item._id == null ? '' : String(item._id),
      totalAmount: toNumber(item.totalAmount),
      totalBills: toInteger(item.totalBills),
      totalWaiters: toInteger(item.totalWaiters),
    }))
    .filter((item) => item._id.length > 0)

  const aggregationPipeline: any[] = [
    {
      $match: matchQuery,
    },
    {
      $addFields: {
        createdById: {
          $convert: {
            input: '$createdBy',
            to: 'objectId',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'createdById',
        foreignField: '_id',
        as: 'waiterDetails',
      },
    },
    {
      $unwind: {
        path: '$waiterDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'waiterDetails.employee',
        foreignField: '_id',
        as: 'employeeDetails',
      },
    },
    {
      $unwind: {
        path: '$employeeDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: '$waiterDetails._id',
        waiterName: {
          $first: {
            $ifNull: [
              '$employeeDetails.name',
              '$waiterDetails.name',
              '$waiterDetails.email',
              'Unknown',
            ],
          },
        },
        employeeId: { $first: '$employeeDetails.employeeId' },
        billingBranchIds: { $addToSet: '$branch' },
        lastBillTime: { $max: '$createdAt' },
        totalBills: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        cashAmount: {
          $sum: {
            $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0],
          },
        },
        upiAmount: {
          $sum: {
            $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$totalAmount', 0],
          },
        },
        cardAmount: {
          $sum: {
            $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$totalAmount', 0],
          },
        },
        customerCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $ne: [{ $ifNull: ['$customerDetails.name', ''] }, ''] },
                  { $ne: [{ $ifNull: ['$customerDetails.phoneNumber', ''] }, ''] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $addFields: {
        billingBranchObjectIds: {
          $map: {
            input: '$billingBranchIds',
            as: 'branchId',
            in: {
              $convert: {
                input: '$$branchId',
                to: 'objectId',
                onError: null,
                onNull: null,
              },
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: 'branches',
        localField: 'billingBranchObjectIds',
        foreignField: '_id',
        as: 'branchDetails',
      },
    },
    {
      $project: {
        _id: 0,
        waiterId: '$_id',
        waiterName: { $toUpper: '$waiterName' },
        employeeId: 1,
        branchNames: '$branchDetails.name',
        branchIds: '$billingBranchIds',
        lastBillTime: 1,
        totalBills: 1,
        totalAmount: 1,
        cashAmount: 1,
        upiAmount: 1,
        cardAmount: 1,
        customerCount: 1,
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ]

  const rawStats = (await BillingModel.aggregate(aggregationPipeline)) as RawWaiterStat[]

  const stats: WaiterWiseReportStat[] = rawStats.map((item) => ({
    waiterId: item.waiterId == null ? '' : String(item.waiterId),
    waiterName:
      typeof item.waiterName === 'string' && item.waiterName.trim().length > 0
        ? item.waiterName
        : 'UNKNOWN',
    employeeId:
      typeof item.employeeId === 'string' && item.employeeId.trim().length > 0
        ? item.employeeId
        : undefined,
    branchNames: Array.isArray(item.branchNames)
      ? item.branchNames
          .map((name) => String(name))
          .filter((name) => name.length > 0)
      : [],
    branchIds: Array.isArray(item.branchIds)
      ? item.branchIds
          .map((id) => String(id))
          .filter((id) => id.length > 0)
      : [],
    lastBillTime: toIsoString(item.lastBillTime),
    totalBills: toInteger(item.totalBills),
    totalAmount: toNumber(item.totalAmount),
    cashAmount: toNumber(item.cashAmount),
    upiAmount: toNumber(item.upiAmount),
    cardAmount: toNumber(item.cardAmount),
    customerCount: toInteger(item.customerCount),
  }))

  const totals = stats.reduce<WaiterWiseReportTotals>(
    (acc, current) => ({
      totalBills: acc.totalBills + current.totalBills,
      totalAmount: acc.totalAmount + current.totalAmount,
      cashAmount: acc.cashAmount + current.cashAmount,
      upiAmount: acc.upiAmount + current.upiAmount,
      cardAmount: acc.cardAmount + current.cardAmount,
    }),
    {
      totalBills: 0,
      totalAmount: 0,
      cashAmount: 0,
      upiAmount: 0,
      cardAmount: 0,
    },
  )

  const branchMatchQuery: Record<string, any> = {
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    branch: { $exists: true, $ne: null },
  }

  if (branchIds) {
    branchMatchQuery.$expr = { $in: [{ $toString: '$branch' }, branchIds] }
  }

  let timeline: WaiterWiseReportTimeline = { minHour: 6, maxHour: 23 }

  const timelineMeta = (await BillingModel.aggregate([
    { $match: branchMatchQuery },
    {
      $project: {
        hour: { $hour: { date: '$createdAt', timezone: '+05:30' } },
      },
    },
    {
      $group: {
        _id: null,
        minHour: { $min: '$hour' },
        maxHour: { $max: '$hour' },
      },
    },
  ])) as Array<{ maxHour: unknown; minHour: unknown }>

  if (timelineMeta.length > 0) {
    const minHour = toInteger(timelineMeta[0].minHour)
    const maxHour = toInteger(timelineMeta[0].maxHour)

    timeline = {
      minHour: minHour >= 0 ? minHour : 6,
      maxHour: maxHour <= 23 ? maxHour : 23,
    }
  }

  const activeBranchesRaw = (await BillingModel.aggregate([
    { $match: branchMatchQuery },
    { $group: { _id: '$branch' } },
    {
      $addFields: {
        branchObjectId: {
          $convert: {
            input: '$_id',
            to: 'objectId',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { branchObjectId: { $ne: null } } },
    {
      $lookup: {
        from: 'branches',
        localField: 'branchObjectId',
        foreignField: '_id',
        as: 'details',
      },
    },
    { $unwind: '$details' },
    { $project: { id: '$_id', name: '$details.name', _id: 0 } },
    { $sort: { name: 1 } },
  ])) as RawActiveBranch[]

  const activeBranches: WaiterWiseReportActiveBranch[] = activeBranchesRaw
    .map((item) => ({
      id: item.id == null ? '' : String(item.id),
      name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name : 'Unknown',
    }))
    .filter((item) => item.id.length > 0)

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    stats,
    totals,
    activeBranches,
    timeline,
    branchBenchmarks,
  }
}
