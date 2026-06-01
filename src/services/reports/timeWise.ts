import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type TimeWiseHourlyStat = {
  hour: number
  totalAmount: number
  totalBills: number
  completedCount: number
  completedAmount: number
  settledCount: number
  settledAmount: number
  cancelledCount: number
  cancelledAmount: number
}

export type TimeWiseBillDetail = {
  id: string
  createdAt: string
  totalAmount: number
  status: string
  paymentMethod: string
}

export type TimeWiseReportTotals = {
  totalAmount: number
  totalBills: number
  completedCount: number
  completedAmount: number
  settledCount: number
  settledAmount: number
  cancelledCount: number
  cancelledAmount: number
}

export type TimeWiseClosingEntry = {
  id: string
  createdAt: string
  totalSales: number
  cash: number
  upi: number
  card: number
  expenses: number
  systemSales: number
  manualSales: number
  onlineSales: number
}

export type TimeWiseReportResult = {
  startDate: string
  endDate: string
  totals: TimeWiseReportTotals
  closingEntries: TimeWiseClosingEntry[]
  hourlyStats: TimeWiseHourlyStat[]
  bills: TimeWiseBillDetail[]
}

type TimeWiseReportArgs = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
}

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata')
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
}

export const getTimeWiseReportData = async (
  req: PayloadRequest,
  args: TimeWiseReportArgs = {},
): Promise<TimeWiseReportResult> => {
  const { payload } = req

  const startDateParam =
    typeof args.startDate === 'string' && args.startDate.trim().length > 0
      ? args.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof args.endDate === 'string' && args.endDate.trim().length > 0
      ? args.endDate
      : startDateParam // default to start date for single day report

  const startOfDay = toDayBoundary(startDateParam, 'start')
  const endOfDay = toDayBoundary(endDateParam, 'end')

  const { branchIds } = await resolveReportBranchScope(req, args.branch)

  const matchQuery: Record<string, unknown> = {
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }
  
  if (branchIds) {
    matchQuery.$expr = {
      $in: [{ $toString: '$branch' }, branchIds],
    }
  }

  const completedOrSettledExpression = { $in: ['$status', ['completed', 'settled']] }

  const BillingModel = payload.db.collections['billings']
  
  // Aggregate for Hourly Stats
  const rawHourlyStats = await BillingModel.aggregate([
    {
      $match: matchQuery,
    },
    {
      $group: {
        _id: { $hour: { $add: ['$createdAt', 19800000] } }, // Asia/Kolkata offset is +05:30 (19800000 ms)
        totalBills: {
          $sum: { $cond: [completedOrSettledExpression, 1, 0] },
        },
        totalAmount: {
          $sum: { $cond: [completedOrSettledExpression, '$totalAmount', 0] },
        },
        completedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        completedAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] },
        },
        settledCount: {
          $sum: { $cond: [{ $eq: ['$status', 'settled'] }, 1, 0] },
        },
        settledAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'settled'] }, '$totalAmount', 0] },
        },
        cancelledCount: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        cancelledAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, '$totalAmount', 0] },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ])

  // Fetch individual bills for precision tracking
  const rawBills = await BillingModel.find(matchQuery, {
    createdAt: 1,
    totalAmount: 1,
    status: 1,
    paymentMethod: 1,
  }).sort({ createdAt: 1 }).lean()

  const hourlyStats: TimeWiseHourlyStat[] = rawHourlyStats.map((stat) => ({
    hour: stat._id,
    totalAmount: stat.totalAmount,
    totalBills: stat.totalBills,
    completedCount: stat.completedCount,
    completedAmount: stat.completedAmount,
    settledCount: stat.settledCount,
    settledAmount: stat.settledAmount,
    cancelledCount: stat.cancelledCount,
    cancelledAmount: stat.cancelledAmount,
  }))

  const totals: TimeWiseReportTotals = hourlyStats.reduce(
    (acc, curr) => ({
      totalAmount: acc.totalAmount + curr.totalAmount,
      totalBills: acc.totalBills + curr.totalBills,
      completedCount: acc.completedCount + curr.completedCount,
      completedAmount: acc.completedAmount + curr.completedAmount,
      settledCount: acc.settledCount + curr.settledCount,
      settledAmount: acc.settledAmount + curr.settledAmount,
      cancelledCount: acc.cancelledCount + curr.cancelledCount,
      cancelledAmount: acc.cancelledAmount + curr.cancelledAmount,
    }),
    {
      totalAmount: 0,
      totalBills: 0,
      completedCount: 0,
      completedAmount: 0,
      settledCount: 0,
      settledAmount: 0,
      cancelledCount: 0,
      cancelledAmount: 0,
    }
  )

  const bills: TimeWiseBillDetail[] = rawBills.map((bill: any) => ({
    id: bill._id.toString(),
    createdAt: bill.createdAt.toISOString(),
    totalAmount: bill.totalAmount || 0,
    status: bill.status || '',
    paymentMethod: bill.paymentMethod || 'unknown',
  }))

  const ClosingModel = payload.db.collections['closing-entries']
  const rawClosingEntries = await ClosingModel.find(matchQuery, {
    createdAt: 1,
    totalSales: 1,
    cash: 1,
    upi: 1,
    creditCard: 1,
    expenses: 1,
    systemSales: 1,
    manualSales: 1,
    onlineSales: 1,
  }).sort({ createdAt: 1 }).lean()

  const closingEntries = rawClosingEntries.map((entry: any) => ({
    id: entry._id.toString(),
    createdAt: entry.createdAt.toISOString(),
    totalSales: entry.totalSales || 0,
    cash: entry.cash || 0,
    upi: entry.upi || 0,
    card: entry.creditCard || 0,
    expenses: entry.expenses || 0,
    systemSales: entry.systemSales || 0,
    manualSales: entry.manualSales || 0,
    onlineSales: entry.onlineSales || 0,
  }))

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    totals,
    hourlyStats,
    bills,
    closingEntries,
  }
}
