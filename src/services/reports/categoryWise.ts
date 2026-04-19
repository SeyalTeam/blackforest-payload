import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import mongoose, { type PipelineStage } from 'mongoose'
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

export type CategoryWiseReportStat = {
  sNo: number
  categoryName: string
  totalQuantity: number
  totalAmount: number
  branchSales: BranchSalesMap
}

export type CategoryWiseReportTotals = {
  totalQuantity: number
  totalAmount: number
  branchTotals: Record<string, number>
}

export type CategoryWiseReportResult = {
  startDate: string
  endDate: string
  branchHeaders: string[]
  stats: CategoryWiseReportStat[]
  totals: CategoryWiseReportTotals
}

type CategoryWiseReportArgs = {
  branch?: null | string
  category?: null | string
  department?: null | string
  endDate?: null | string
  startDate?: null | string
}

type RawBranch = {
  id: string
  name: string
}

type RawBranchData = {
  branchId: unknown
  amount: number
  quantity: number
}

type RawCategoryStat = {
  categoryName: string
  totalQuantity: number
  totalAmount: number
  branchData: RawBranchData[]
}

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata')
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
}

export const getCategoryWiseReportData = async (
  req: PayloadRequest,
  args: CategoryWiseReportArgs = {},
): Promise<CategoryWiseReportResult> => {
  const { payload } = req

  const startDateParam =
    typeof args.startDate === 'string' && args.startDate.trim().length > 0
      ? args.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof args.endDate === 'string' && args.endDate.trim().length > 0
      ? args.endDate
      : new Date().toISOString().split('T')[0]

  const branchParam = typeof args.branch === 'string' ? args.branch : ''
  const categoryParam = typeof args.category === 'string' ? args.category : ''
  const departmentParam = typeof args.department === 'string' ? args.department : ''

  const startOfDay = toDayBoundary(startDateParam, 'start')
  const endOfDay = toDayBoundary(endDateParam, 'end')

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

  const pipeline: PipelineStage[] = [
    {
      $match: matchQuery,
    },
    {
      $unwind: '$items',
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
      $unwind: '$productDetails',
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
      $unwind: '$categoryDetails',
    },
  ]

  if (categoryParam && categoryParam !== 'all') {
    const categoryObjectIds = categoryParam
      .split(',')
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    pipeline.push({
      $match: {
        'categoryDetails._id': {
          $in: categoryObjectIds,
        },
      },
    })
  }

  if (departmentParam && departmentParam !== 'all') {
    pipeline.push({
      $match: {
        $expr: {
          $eq: [{ $toString: '$categoryDetails.department' }, departmentParam],
        },
      },
    })
  }

  pipeline.push(
    {
      $group: {
        _id: {
          categoryName: '$categoryDetails.name',
          branchId: '$branch',
        },
        quantity: { $sum: '$items.quantity' },
        amount: { $sum: '$items.subtotal' },
      },
    },
    {
      $group: {
        _id: '$_id.categoryName',
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
        categoryName: '$_id',
        totalQuantity: 1,
        totalAmount: 1,
        branchData: 1,
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  )

  const rawStats = (await BillingModel.aggregate(pipeline)) as RawCategoryStat[]

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

  const stats: CategoryWiseReportStat[] = rawStats.map((item, index) => {
    const branchSales: BranchSalesMap = {}

    item.branchData.forEach((branchData) => {
      const branchId = String(branchData.branchId)
      if (branchMap[branchId]) {
        const code = branchMap[branchId]
        branchSales[code] = {
          amount: branchData.amount,
          quantity: branchData.quantity,
        }
      }
    })

    return {
      sNo: index + 1,
      categoryName: item.categoryName,
      totalQuantity: item.totalQuantity,
      totalAmount: item.totalAmount,
      branchSales,
    }
  })

  const totals = stats.reduce<CategoryWiseReportTotals>(
    (acc, current) => ({
      totalQuantity: acc.totalQuantity + current.totalQuantity,
      totalAmount: acc.totalAmount + current.totalAmount,
      branchTotals: acc.branchTotals,
    }),
    {
      totalQuantity: 0,
      totalAmount: 0,
      branchTotals,
    },
  )

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    branchHeaders,
    stats,
    totals,
  }
}
