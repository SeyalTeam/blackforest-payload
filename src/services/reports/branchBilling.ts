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
}

export type BranchBillingReportTotals = {
  totalBills: number
  totalAmount: number
  cash: number
  upi: number
  card: number
}

export type BranchBillingReportResult = {
  startDate: string
  endDate: string
  stats: BranchBillingReportStat[]
  totals: BranchBillingReportTotals
}

type BranchBillingReportArgs = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
}

const FINALIZED_BILL_STATUSES = ['completed', 'settled'] as const

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
    status: {
      $in: [...FINALIZED_BILL_STATUSES],
    },
  }
  if (branchIds) {
    matchQuery.$expr = {
      $in: [{ $toString: '$branch' }, branchIds],
    }
  }

  const BillingModel = payload.db.collections['billings']
  const stats = await BillingModel.aggregate([
    {
      $match: matchQuery,
    },
    {
      $group: {
        _id: '$branch',
        totalBills: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        cash: {
          $sum: {
            $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0],
          },
        },
        upi: {
          $sum: {
            $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$totalAmount', 0],
          },
        },
        card: {
          $sum: {
            $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$totalAmount', 0],
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
        _id: 0,
        branchName: { $ifNull: ['$branchDetails.name', 'Unknown Branch'] },
        totalBills: 1,
        totalAmount: 1,
        cash: 1,
        upi: 1,
        card: 1,
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ])

  const totals = stats.reduce<BranchBillingReportTotals>(
    (acc, curr) => ({
      totalBills: acc.totalBills + curr.totalBills,
      totalAmount: acc.totalAmount + curr.totalAmount,
      cash: acc.cash + curr.cash,
      upi: acc.upi + curr.upi,
      card: acc.card + curr.card,
    }),
    { totalBills: 0, totalAmount: 0, cash: 0, upi: 0, card: 0 },
  )

  const statsWithSn: BranchBillingReportStat[] = stats.map((item, index) => ({
    ...item,
    sNo: index + 1,
  }))

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    stats: statsWithSn,
    totals,
  }
}
