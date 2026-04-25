import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type BranchBillingReportStat = {
  sNo: number
  branchName: string
  totalBills: number
  totalAmount: number
  cash: number
  upi: number
  card: number
  completedCount: number
  completedAmount: number
  settledCount: number
  settledAmount: number
  cancelledCount: number
  cancelledAmount: number
}

export type BranchBillingReportTotals = {
  totalBills: number
  totalAmount: number
  cash: number
  upi: number
  card: number
  completedCount: number
  completedAmount: number
  settledCount: number
  settledAmount: number
  cancelledCount: number
  cancelledAmount: number
  tableOrderCount: number
  tableOrderAmount: number
  nonTableOrderCount: number
  nonTableOrderAmount: number
  totalExpenses: number
  totalReturns: number
  totalClosingSales: number
}

export type TrendPoint = {
  label: string
  fullLabel: string
  totalAmount: number
  totalExpense: number
  totalReturn: number
}

export type BranchBillingSummary = {
  averageTrendAmount: number
  trendPercentage: number
  medianAmount: number
}

export type HeatmapPoint = {
  day: number
  hour: number
  amount: number
  count: number
}

export type BranchBillingReportResult = {
  startDate: string
  endDate: string
  stats: BranchBillingReportStat[]
  totals: BranchBillingReportTotals
  trendData: TrendPoint[]
  heatmapData: HeatmapPoint[]
  summary: BranchBillingSummary
}

type BranchBillingReportArgs = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
  trendPeriod?: null | string
}

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata')
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
}

export const getBranchBillingReportData = async (
  req: PayloadRequest,
  args: BranchBillingReportArgs = {},
): Promise<BranchBillingReportResult> => {
  const { payload } = req

  const startDateParam =
    typeof args.startDate === 'string' && args.startDate.trim().length > 0
      ? args.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof args.endDate === 'string' && args.endDate.trim().length > 0
      ? args.endDate
      : new Date().toISOString().split('T')[0]
  const branchParam =
    typeof args.branch === 'string' && args.branch.trim().length > 0 ? args.branch : null

  const startOfDay = toDayBoundary(startDateParam, 'start')
  const endOfDay = toDayBoundary(endDateParam, 'end')

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

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

  const BillingModel = payload.db.collections['billings']
  const stats = await BillingModel.aggregate([
    {
      $match: matchQuery,
    },
    {
      $group: {
        _id: '$branch',
        // Total should only include completed/settled as per previous request
        totalBills: {
          $sum: {
            $cond: [completedOrSettledExpression, 1, 0],
          },
        },
        totalAmount: {
          $sum: {
            $cond: [completedOrSettledExpression, '$totalAmount', 0],
          },
        },
        cash: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$paymentMethod', 'cash'] }, completedOrSettledExpression] },
              '$totalAmount',
              0,
            ],
          },
        },
        upi: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$paymentMethod', 'upi'] }, completedOrSettledExpression] },
              '$totalAmount',
              0,
            ],
          },
        },
        card: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$paymentMethod', 'card'] }, completedOrSettledExpression] },
              '$totalAmount',
              0,
            ],
          },
        },
        // Detailed Status breakdown
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
        tableOrderCount: {
          $sum: {
            $cond: [{ $and: [completedOrSettledExpression, hasTableOrderReferenceExpression] }, 1, 0],
          },
        },
        tableOrderAmount: {
          $sum: {
            $cond: [{ $and: [completedOrSettledExpression, hasTableOrderReferenceExpression] }, '$totalAmount', 0],
          },
        },
        nonTableOrderCount: {
          $sum: {
            $cond: [
              { $and: [completedOrSettledExpression, { $not: [hasTableOrderReferenceExpression] }] },
              1,
              0,
            ],
          },
        },
        nonTableOrderAmount: {
          $sum: {
            $cond: [
              { $and: [completedOrSettledExpression, { $not: [hasTableOrderReferenceExpression] }] },
              '$totalAmount',
              0,
            ],
          },
        },
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
        _id: 1, // Keep _id for stats.find logic
        branchName: { $ifNull: ['$branchDetails.name', 'Unknown Branch'] },
        totalBills: 1,
        totalAmount: 1,
        cash: 1,
        upi: 1,
        card: 1,
        completedCount: 1,
        completedAmount: 1,
        settledCount: 1,
        settledAmount: 1,
        cancelledCount: 1,
        cancelledAmount: 1,
        tableOrderCount: 1,
        tableOrderAmount: 1,
        nonTableOrderCount: 1,
        nonTableOrderAmount: 1,
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ])

  const totalsWithoutExpenses = stats.reduce(
    (acc, curr) => ({
      totalBills: acc.totalBills + curr.totalBills,
      totalAmount: acc.totalAmount + curr.totalAmount,
      cash: acc.cash + curr.cash,
      upi: acc.upi + curr.upi,
      card: acc.card + curr.card,
      completedCount: acc.completedCount + curr.completedCount,
      completedAmount: acc.completedAmount + curr.completedAmount,
      settledCount: acc.settledCount + curr.settledCount,
      settledAmount: acc.settledAmount + curr.settledAmount,
      cancelledCount: acc.cancelledCount + curr.cancelledCount,
      cancelledAmount: acc.cancelledAmount + curr.cancelledAmount,
      tableOrderCount: acc.tableOrderCount + curr.tableOrderCount,
      tableOrderAmount: acc.tableOrderAmount + curr.tableOrderAmount,
      nonTableOrderCount: acc.nonTableOrderCount + curr.nonTableOrderCount,
      nonTableOrderAmount: acc.nonTableOrderAmount + curr.nonTableOrderAmount,
    }),
    {
      totalBills: 0,
      totalAmount: 0,
      cash: 0,
      upi: 0,
      card: 0,
      completedCount: 0,
      completedAmount: 0,
      settledCount: 0,
      settledAmount: 0,
      cancelledCount: 0,
      cancelledAmount: 0,
      tableOrderCount: 0,
      tableOrderAmount: 0,
      nonTableOrderCount: 0,
      nonTableOrderAmount: 0,
    },
  )

  const ExpenseModel = payload.db.collections['expenses']
  const ReturnOrderModel = payload.db.collections['return-orders']

  // Align with detail report logic: source dates are queried as UTC day boundaries
  const utcStart = dayjs.utc(startDateParam).startOf('day').toDate()
  const utcEnd = dayjs.utc(endDateParam).endOf('day').toDate()

  // Branch filter condition
  const branchFilter = branchIds
    ? {
        $expr: {
          $in: [{ $toString: '$branch' }, branchIds],
        },
      }
    : {}

  // Calculate Expenses
  const expenseStats = await ExpenseModel.aggregate([
    {
      $match: {
        date: { $gte: utcStart, $lte: utcEnd },
        ...branchFilter,
      },
    },
    { $unwind: '$details' },
    { $group: { _id: null, total: { $sum: '$details.amount' } } },
  ])

  // Calculate Returns
  const returnStats = await ReturnOrderModel.aggregate([
    {
      $match: {
        createdAt: { $gte: utcStart, $lte: utcEnd },
        ...branchFilter,
      },
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ])

  const totalExpenses = expenseStats[0]?.total ?? 0
  const totalReturns = returnStats[0]?.total ?? 0

  // Calculate Closing Entries
  const ClosingModel = payload.db.collections['closing-entries']
  const closingStats = await ClosingModel.aggregate([
    {
      $match: {
        date: { $gte: utcStart, $lte: utcEnd },
        ...branchFilter,
      },
    },
    { $group: { _id: null, total: { $sum: '$totalSales' } } },
  ])
  const totalClosingSales = closingStats[0]?.total ?? 0

  const totals: BranchBillingReportTotals = {
    ...totalsWithoutExpenses,
    totalExpenses,
    totalReturns,
    totalClosingSales,
  }

  const statsWithSn: BranchBillingReportStat[] = stats.map((item, index) => ({
    ...item,
    sNo: index + 1,
  }))

  // Calculate Sales Trend based on Selected Period
  const trendPeriod = args.trendPeriod ?? '12months'
  const now = dayjs().tz('Asia/Kolkata')
  let trendStartDate = now.subtract(11, 'month').startOf('month')
  let granularity: 'month' | 'day' = 'month'
  let pointsCount = 12

  if (trendPeriod === 'thisMonth') {
    trendStartDate = now.startOf('month')
    pointsCount = now.date()
    granularity = 'day'
  } else if (trendPeriod === '6months') {
    trendStartDate = now.subtract(5, 'month').startOf('month')
    pointsCount = 6
    granularity = 'month'
  } else if (trendPeriod === '30days') {
    trendStartDate = now.subtract(29, 'day').startOf('day')
    pointsCount = 30
    granularity = 'day'
  } else if (trendPeriod === '7days') {
    trendStartDate = now.subtract(6, 'day').startOf('day')
    pointsCount = 7
    granularity = 'day'
  }

  const trendMatch: any = {
    createdAt: { $gte: trendStartDate.toDate() },
    status: { $in: ['completed', 'settled'] },
    ...branchFilter,
  }

  const rawTrendStats = await BillingModel.aggregate([
    { $match: trendMatch },
    {
      $group: {
        _id: {
          year: { $year: { $add: ['$createdAt', 19800000] } },
          month: { $month: { $add: ['$createdAt', 19800000] } },
          day: granularity === 'day' ? { $dayOfMonth: { $add: ['$createdAt', 19800000] } } : null,
        },
        totalAmount: { $sum: '$totalAmount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ])

  // Aggregate Expenses for the same trend period
  const expenseTrendMatch: any = {
    date: { $gte: trendStartDate.toDate() },
    ...branchFilter,
  }

  const rawExpenseTrendStats = await ExpenseModel.aggregate([
    { $match: expenseTrendMatch },
    { $unwind: '$details' },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: granularity === 'day' ? { $dayOfMonth: '$date' } : null,
        },
        totalExpense: { $sum: '$details.amount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ])

  // Aggregate Returns for the same trend period
  const returnTrendMatch: any = {
    createdAt: { $gte: trendStartDate.toDate() },
    ...branchFilter,
  }

  const rawReturnTrendStats = await ReturnOrderModel.aggregate([
    { $match: returnTrendMatch },
    {
      $group: {
        _id: {
          year: { $year: { $add: ['$createdAt', 19800000] } },
          month: { $month: { $add: ['$createdAt', 19800000] } },
          day: granularity === 'day' ? { $dayOfMonth: { $add: ['$createdAt', 19800000] } } : null,
        },
        totalReturn: { $sum: '$totalAmount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ])

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const trendData: TrendPoint[] = []

  for (let i = pointsCount - 1; i >= 0; i -= 1) {
    const d = granularity === 'month' ? now.subtract(i, 'month') : now.subtract(i, 'day')
    const year = d.year()
    const month = d.month() + 1
    const day = granularity === 'day' ? d.date() : null

    const found = rawTrendStats.find(
      (s) =>
        s._id.year === year &&
        s._id.month === month &&
        (granularity === 'month' || s._id.day === day),
    )

    const foundExpense = rawExpenseTrendStats.find(
      (s) =>
        s._id.year === year &&
        s._id.month === month &&
        (granularity === 'month' || s._id.day === day),
    )

    const foundReturn = rawReturnTrendStats.find(
      (s) =>
        s._id.year === year &&
        s._id.month === month &&
        (granularity === 'month' || s._id.day === day),
    )

    const dayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const label =
      granularity === 'month'
        ? monthNames[month - 1]
        : `${d.date()}|${dayInitials[d.day()]}`

    const fullLabel =
      granularity === 'month'
        ? `${monthNames[month - 1]} ${year}`
        : `${monthNames[month - 1]} ${d.date()}`

    trendData.push({
      label,
      fullLabel,
      totalAmount: found?.totalAmount ?? 0,
      totalExpense: foundExpense?.totalExpense ?? 0,
      totalReturn: foundReturn?.totalReturn ?? 0,
    })
  }

  const nonZeroSales = trendData.map((s) => s.totalAmount).filter((a) => a > 0)
  const averageTrendAmount =
    nonZeroSales.length > 0 ? nonZeroSales.reduce((a, b) => a + b, 0) / nonZeroSales.length : 0

  const sortedSales = [...trendData].map((s) => s.totalAmount).sort((a, b) => a - b)
  const mid = Math.floor(sortedSales.length / 2)
  const medianAmount =
    sortedSales.length % 2 !== 0
      ? sortedSales[mid]
      : (sortedSales[mid - 1] + sortedSales[mid]) / 2

  // Trend Calculation: compare current half of points vs previous half
  const half = Math.floor(pointsCount / 2)
  const currentTotal = trendData.slice(pointsCount - half).reduce((acc, curr) => acc + curr.totalAmount, 0)
  const previousTotal = trendData.slice(0, half).reduce((acc, curr) => acc + curr.totalAmount, 0)
  const trendPercentage = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0

  // Calculate Heatmap Data (Day vs Hour)
  const heatmapStats = await BillingModel.aggregate([
    { $match: trendMatch },
    {
      $group: {
        _id: {
          day: { $dayOfWeek: { $add: ['$createdAt', 19800000] } },
          hour: { $hour: { $add: ['$createdAt', 19800000] } },
        },
        amount: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
  ])

  const heatmapData: HeatmapPoint[] = heatmapStats.map((s) => ({
    day: s._id.day,
    hour: s._id.hour,
    amount: s.amount,
    count: s.count,
  }))

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    stats: statsWithSn,
    totals,
    trendData,
    heatmapData,
    summary: {
      averageTrendAmount,
      trendPercentage,
      medianAmount,
    },
  }
}
