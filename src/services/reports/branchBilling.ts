import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { resolveReportBranchScope, toBranchQueryFilter } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type BranchBillingReportStat = {
  sNo: number
  branchId?: string
  branchName: string
  gstMode: string
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
  tableOrderCount?: number
  tableOrderAmount?: number
  nonTableOrderCount?: number
  nonTableOrderAmount?: number
  gstInclusiveAmount: number
  gstExclusiveAmount: number
  gstInclusiveTaxableAmount: number
  gstExclusiveTaxableAmount: number
  nonGstAmount: number
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
  gstInclusiveAmount: number
  gstExclusiveAmount: number
  gstInclusiveTaxableAmount: number
  gstExclusiveTaxableAmount: number
  nonGstAmount: number
  totalExpenses: number
  totalReturns: number
  totalClosingSales: number
  totalStockOrderReceivedAmount: number
  stockOrderOrderedAmount?: number
  stockOrderChefPreparedAmount?: number
  stockOrderSupervisorConfirmedAmount?: number
  stockOrderDriverPickedAmount?: number
  stockOrderIcingOrderedAmount?: number
  stockOrderBakeryOrderedAmount?: number
  stockOrderIcingChefPreparedAmount?: number
  stockOrderBakeryChefPreparedAmount?: number
  stockOrderIcingSupervisorConfirmedAmount?: number
  stockOrderBakerySupervisorConfirmedAmount?: number
  stockOrderIcingDriverPickedAmount?: number
  stockOrderBakeryDriverPickedAmount?: number
  stockOrderIcingReceivedAmount?: number
  stockOrderBakeryReceivedAmount?: number
  totalSalary: number
  totalDealerBillingAmount?: number
  monthlySalary?: number
  employeeCount?: number
}

export type TrendPoint = {
  label: string
  fullLabel: string
  totalAmount: number
  totalBills: number
  totalExpense: number
  totalReturn: number
  totalStockOrder?: number
  totalDealerBilling?: number
  tableOrderAmount?: number
  tableOrderBills?: number
  nonTableOrderAmount?: number
  nonTableOrderBills?: number
  branchesData?: { branchId: string; amount: number; billCount: number; tableOrderAmount?: number; nonTableOrderAmount?: number }[]
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

export type ProductGSTStat = {
  productName: string
  gstRate: number
  count: number
  taxableAmount: number
  gstAmount: number
  totalAmount: number
}

export type CategoryGSTStat = {
  categoryName: string
  count: number
  taxableAmount: number
  gstAmount: number
  totalAmount: number
}

export type DealerGSTStat = {
  dealerName: string
  count: number
  taxableAmount: number
  gstAmount: number
  totalAmount: number
}

export type BranchBillingReportResult = {
  startDate: string
  endDate: string
  stats: BranchBillingReportStat[]
  totals: BranchBillingReportTotals
  trendData: TrendPoint[]
  heatmapData: HeatmapPoint[]
  summary: BranchBillingSummary
  productGstStats: ProductGSTStat[]
  categoryGstStats: CategoryGSTStat[]
  dealerGstStats: DealerGSTStat[]
}

type BranchBillingReportArgs = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
  trendPeriod?: null | string
  trendMetricFilter?: null | string
  gstFilter?: null | string
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
  requestedFields: string[] = [],
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
  if (branchIds && branchIds.length > 0) {
    Object.assign(matchQuery, toBranchQueryFilter(branchIds, 'branch'))
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

  const isGST = args.gstFilter !== 'nongst'
  const gstRateCond = args.gstFilter === 'nongst'
    ? { $lte: [{ $ifNull: ['$$this.gstRate', 0] }, 0] }
    : { $gt: [{ $ifNull: ['$$this.gstRate', 0] }, 0] }

  const gstTaxableAmountExpression = {
    $reduce: {
      input: { $ifNull: ['$items', []] },
      initialValue: 0,
      in: {
        $add: [
          '$$value',
          {
            $cond: [
              gstRateCond,
              { $ifNull: ['$$this.taxableAmount', 0] },
              0,
            ],
          },
        ],
      },
    },
  }

  const gstInclusiveAmountExpression = {
    $reduce: {
      input: { $ifNull: ['$items', []] },
      initialValue: 0,
      in: {
        $add: [
          '$$value',
          {
            $cond: [
              gstRateCond,
              { $ifNull: ['$$this.finalLineTotal', 0] },
              0,
            ],
          },
        ],
      },
    },
  }

  const gstAmountExpression = {
    $reduce: {
      input: { $ifNull: ['$items', []] },
      initialValue: 0,
      in: {
        $add: [
          '$$value',
          {
            $cond: [
              gstRateCond,
              { $ifNull: ['$$this.gstAmount', 0] },
              0,
            ],
          },
        ],
      },
    },
  }

  // When no gstFilter is set (default), or 'both', use doc-level $totalAmount
  // to include ALL items (GST and non-GST). Only use the GST-filtered
  // item-level sum when explicitly filtering by 'gst' or 'nongst'.
  const totalAmountExpression =
    args.gstFilter === 'gst' || args.gstFilter === 'nongst'
      ? gstInclusiveAmountExpression
      : '$totalAmount'

  const nonGstAmountExpression = {
    $reduce: {
      input: { $ifNull: ['$items', []] },
      initialValue: 0,
      in: {
        $add: [
          '$$value',
          {
            $cond: [
              { $lte: [{ $ifNull: ['$$this.gstRate', 0] }, 0] },
              { $ifNull: ['$$this.finalLineTotal', 0] },
              0,
            ],
          },
        ],
      },
    },
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
            $cond: [completedOrSettledExpression, totalAmountExpression, 0],
          },
        },
        totalGSTAmount: {
          $sum: {
            $cond: [completedOrSettledExpression, gstAmountExpression, 0],
          },
        },
        totalGSTTaxableAmount: {
          $sum: {
            $cond: [completedOrSettledExpression, gstTaxableAmountExpression, 0],
          },
        },
        totalGSTInclusiveAmount: {
          $sum: {
            $cond: [completedOrSettledExpression, gstInclusiveAmountExpression, 0],
          },
        },
        totalNonGSTAmount: {
          $sum: {
            $cond: [completedOrSettledExpression, nonGstAmountExpression, 0],
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
        gstMode: { $ifNull: ['$branchDetails.gstMode', 'inclusive'] },
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
        gstInclusiveAmount: {
          $cond: [
            { $eq: ['$branchDetails.gstMode', 'exclusive'] },
            0,
            {
              $cond: [
                { $eq: [isGST, true] },
                { $ifNull: ['$totalGSTAmount', 0] },
                { $ifNull: ['$totalGSTInclusiveAmount', 0] },
              ],
            },
          ],
        },
        gstExclusiveAmount: {
          $cond: [
            { $eq: ['$branchDetails.gstMode', 'exclusive'] },
            {
              $cond: [
                { $eq: [isGST, true] },
                { $ifNull: ['$totalGSTAmount', 0] },
                { $ifNull: ['$totalGSTInclusiveAmount', 0] },
              ],
            },
            0,
          ],
        },
        gstInclusiveTaxableAmount: {
          $cond: [
            { $eq: ['$branchDetails.gstMode', 'exclusive'] },
            0,
            { $ifNull: ['$totalGSTTaxableAmount', 0] },
          ],
        },
        gstExclusiveTaxableAmount: {
          $cond: [
            { $eq: ['$branchDetails.gstMode', 'exclusive'] },
            { $ifNull: ['$totalGSTTaxableAmount', 0] },
            0,
          ],
        },
        nonGstAmount: { $ifNull: ['$totalNonGSTAmount', 0] },
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
      gstInclusiveAmount: acc.gstInclusiveAmount + curr.gstInclusiveAmount,
      gstExclusiveAmount: acc.gstExclusiveAmount + curr.gstExclusiveAmount,
      gstInclusiveTaxableAmount: acc.gstInclusiveTaxableAmount + (curr.gstInclusiveTaxableAmount || 0),
      gstExclusiveTaxableAmount: acc.gstExclusiveTaxableAmount + (curr.gstExclusiveTaxableAmount || 0),
      nonGstAmount: acc.nonGstAmount + (curr.nonGstAmount || 0),
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
      gstInclusiveAmount: 0,
      gstExclusiveAmount: 0,
      gstInclusiveTaxableAmount: 0,
      gstExclusiveTaxableAmount: 0,
      nonGstAmount: 0,
    },
  )

  const ExpenseModel = payload.db.collections['expenses']
  const ReturnOrderModel = payload.db.collections['return-orders']

  // Align with detail report logic: source dates are queried as UTC day boundaries
  const utcStart = dayjs.utc(startDateParam).startOf('day').toDate()
  const utcEnd = dayjs.utc(endDateParam).endOf('day').toDate()

  // Branch filter condition
  const branchFilter = branchIds && branchIds.length > 0
    ? toBranchQueryFilter(branchIds, 'branch')
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

  // Calculate Stock Orders Stages (Order, Chef Prepared, Supervisor Confirmed, Driver Picked, Branch Received)
  const StockOrderModel = payload.db.collections['stock-orders']
  const stockOrderStats = StockOrderModel
    ? await StockOrderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: utcStart, $lte: utcEnd },
            ...branchFilter,
          },
        },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            let: { prodId: '$items.product' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$_id', '$$prodId'] },
                      { $eq: [{ $toString: '$_id' }, { $toString: '$$prodId' }] },
                    ],
                  },
                },
              },
            ],
            as: 'productDoc',
          },
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            let: { catId: '$productDoc.category' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$_id', '$$catId'] },
                      { $eq: [{ $toString: '$_id' }, { $toString: '$$catId' }] },
                    ],
                  },
                },
              },
            ],
            as: 'categoryDoc',
          },
        },
        { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'departments',
            let: { deptId: '$categoryDoc.department' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$_id', '$$deptId'] },
                      { $eq: [{ $toString: '$_id' }, { $toString: '$$deptId' }] },
                    ],
                  },
                },
              },
            ],
            as: 'deptDoc',
          },
        },
        { $unwind: { path: '$deptDoc', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            isIcingDept: {
              $or: [
                {
                  $regexMatch: {
                    input: { $ifNull: ['$deptDoc.name', ''] },
                    regex: 'icing',
                    options: 'i',
                  },
                },
                {
                  $regexMatch: {
                    input: { $ifNull: ['$categoryDoc.name', ''] },
                    regex: 'icing',
                    options: 'i',
                  },
                },
                { $eq: ['$categoryDoc.isCake', true] },
              ],
            },
          },
        },
        {
          $addFields: {
            deptGroup: {
              $cond: ['$isIcingDept', 'ICING', 'BAKERY'],
            },
            itemReceivedVal: {
              $ifNull: [
                '$items.receivedAmount',
                {
                  $multiply: [
                    { $ifNull: ['$items.receivedQty', 0] },
                    { $ifNull: ['$items.price', 0] },
                  ],
                },
              ],
            },
            itemOrderedVal: {
              $ifNull: [
                '$items.requiredAmount',
                {
                  $multiply: [
                    { $ifNull: ['$items.requiredQty', 0] },
                    { $ifNull: ['$items.price', 0] },
                  ],
                },
              ],
            },
            itemChefPreparedVal: {
              $ifNull: [
                '$items.sendingAmount',
                {
                  $multiply: [
                    { $ifNull: ['$items.sendingQty', 0] },
                    { $ifNull: ['$items.price', 0] },
                  ],
                },
              ],
            },
            itemSupervisorConfirmedVal: {
              $ifNull: [
                '$items.confirmedAmount',
                {
                  $multiply: [
                    { $ifNull: ['$items.confirmedQty', 0] },
                    { $ifNull: ['$items.price', 0] },
                  ],
                },
              ],
            },
            itemDriverPickedVal: {
              $ifNull: [
                '$items.pickedAmount',
                {
                  $multiply: [
                    { $ifNull: ['$items.pickedQty', 0] },
                    { $ifNull: ['$items.price', 0] },
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalReceived: { $sum: '$itemReceivedVal' },
            totalOrdered: { $sum: '$itemOrderedVal' },
            totalChefPrepared: { $sum: '$itemChefPreparedVal' },
            totalSupervisorConfirmed: { $sum: '$itemSupervisorConfirmedVal' },
            totalDriverPicked: { $sum: '$itemDriverPickedVal' },

            icingReceived: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'ICING'] }, '$itemReceivedVal', 0] },
            },
            bakeryReceived: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'BAKERY'] }, '$itemReceivedVal', 0] },
            },

            icingOrdered: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'ICING'] }, '$itemOrderedVal', 0] },
            },
            bakeryOrdered: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'BAKERY'] }, '$itemOrderedVal', 0] },
            },

            icingChefPrepared: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'ICING'] }, '$itemChefPreparedVal', 0] },
            },
            bakeryChefPrepared: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'BAKERY'] }, '$itemChefPreparedVal', 0] },
            },

            icingSupervisorConfirmed: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'ICING'] }, '$itemSupervisorConfirmedVal', 0] },
            },
            bakerySupervisorConfirmed: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'BAKERY'] }, '$itemSupervisorConfirmedVal', 0] },
            },

            icingDriverPicked: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'ICING'] }, '$itemDriverPickedVal', 0] },
            },
            bakeryDriverPicked: {
              $sum: { $cond: [{ $eq: ['$deptGroup', 'BAKERY'] }, '$itemDriverPickedVal', 0] },
            },
          },
        },
      ])
    : []
  const totalStockOrderReceivedAmount = stockOrderStats[0]?.totalReceived ?? stockOrderStats[0]?.total ?? 0
  const stockOrderOrderedAmount = stockOrderStats[0]?.totalOrdered ?? 0
  const stockOrderChefPreparedAmount = stockOrderStats[0]?.totalChefPrepared ?? 0
  const stockOrderSupervisorConfirmedAmount = stockOrderStats[0]?.totalSupervisorConfirmed ?? 0
  const stockOrderDriverPickedAmount = stockOrderStats[0]?.totalDriverPicked ?? 0

  const stockOrderIcingOrderedAmount = stockOrderStats[0]?.icingOrdered ?? 0
  const stockOrderBakeryOrderedAmount = stockOrderStats[0]?.bakeryOrdered ?? 0
  const stockOrderIcingChefPreparedAmount = stockOrderStats[0]?.icingChefPrepared ?? 0
  const stockOrderBakeryChefPreparedAmount = stockOrderStats[0]?.bakeryChefPrepared ?? 0
  const stockOrderIcingSupervisorConfirmedAmount = stockOrderStats[0]?.icingSupervisorConfirmed ?? 0
  const stockOrderBakerySupervisorConfirmedAmount = stockOrderStats[0]?.bakerySupervisorConfirmed ?? 0
  const stockOrderIcingDriverPickedAmount = stockOrderStats[0]?.icingDriverPicked ?? 0
  const stockOrderBakeryDriverPickedAmount = stockOrderStats[0]?.bakeryDriverPicked ?? 0
  const stockOrderIcingReceivedAmount = stockOrderStats[0]?.icingReceived ?? 0
  const stockOrderBakeryReceivedAmount = stockOrderStats[0]?.bakeryReceived ?? 0

  // Calculate Employees Salary
  const EmployeeModel = payload.db.collections['employees']
  const UserModel = payload.db.collections['users']

  let empIdsForBranch: any[] = []
  if (branchIds && branchIds.length > 0 && UserModel) {
    const usersWithBranch = await UserModel.find(
      {
        branch: { $in: branchIds },
        employee: { $exists: true, $ne: null },
      },
      { employee: 1 },
    ).lean()
    empIdsForBranch = usersWithBranch.map((u: any) => u.employee).filter(Boolean)
  }

  const empMatch: any = {
    status: { $ne: 'inactive' },
  }
  if (branchIds && branchIds.length > 0) {
    empMatch.$or = [
      { branch: { $in: branchIds } },
      ...(empIdsForBranch.length > 0 ? [{ _id: { $in: empIdsForBranch } }] : []),
    ]
  }

  const empSalaryStats = EmployeeModel
    ? await EmployeeModel.aggregate([
        { $match: empMatch },
        {
          $group: {
            _id: null,
            monthlySalary: { $sum: { $ifNull: ['$salary', 0] } },
            count: { $sum: 1 },
          },
        },
      ])
    : []

  const monthlySalary = empSalaryStats[0]?.monthlySalary ?? 0
  const employeeCount = empSalaryStats[0]?.count ?? 0

  // Prorate salary based on selected date range
  const daysDiff = Math.max(1, dayjs(endDateParam).diff(dayjs(startDateParam), 'day') + 1)
  let totalSalary = monthlySalary
  if (daysDiff < 28) {
    totalSalary = Math.round((monthlySalary / 30) * daysDiff)
  } else {
    const monthsCount = Math.max(1, Math.round(daysDiff / 30))
    totalSalary = monthlySalary * monthsCount
  }

  // Calculate Other Products (Dealer Billings - Paid Amount Only)
  const DealerBillingModel = payload.db.collections['dealer-billings']
  const dealerBillingStats = DealerBillingModel
    ? await DealerBillingModel.aggregate([
        {
          $match: {
            date: { $gte: utcStart, $lte: utcEnd },
            status: { $ne: 'cancelled' },
            ...branchFilter,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$paidAmount', 0] } },
          },
        },
      ])
    : []
  const totalDealerBillingAmount = dealerBillingStats[0]?.total ?? 0

  const totals: BranchBillingReportTotals = {
    ...totalsWithoutExpenses,
    totalExpenses,
    totalReturns,
    totalClosingSales,
    totalStockOrderReceivedAmount,
    stockOrderOrderedAmount,
    stockOrderChefPreparedAmount,
    stockOrderSupervisorConfirmedAmount,
    stockOrderDriverPickedAmount,
    stockOrderIcingOrderedAmount,
    stockOrderBakeryOrderedAmount,
    stockOrderIcingChefPreparedAmount,
    stockOrderBakeryChefPreparedAmount,
    stockOrderIcingSupervisorConfirmedAmount,
    stockOrderBakerySupervisorConfirmedAmount,
    stockOrderIcingDriverPickedAmount,
    stockOrderBakeryDriverPickedAmount,
    stockOrderIcingReceivedAmount,
    stockOrderBakeryReceivedAmount,
    totalSalary,
    totalDealerBillingAmount,
    monthlySalary,
    employeeCount,
  }

  const statsWithSn: BranchBillingReportStat[] = stats.map((item, index) => ({
    ...item,
    branchId: String(item._id || ''),
    sNo: index + 1,
  }))

  // Calculate Sales Trend based on Selected Period
  const trendPeriod = args.trendPeriod ?? '12months'
  const now = dayjs().tz('Asia/Kolkata')
  
  let granularity: 'month' | 'day' | 'hour' | 'year' = 'month'
  let trendStartDate = now.subtract(11, 'month').startOf('month')
  let pointsCount = 12

  if (trendPeriod === 'hourly') {
    granularity = 'hour'
    trendStartDate = dayjs(startOfDay).tz('Asia/Kolkata').startOf('day')
    pointsCount = 24
  } else if (trendPeriod === 'daily') {
    granularity = 'day'
    trendStartDate = dayjs(startOfDay).tz('Asia/Kolkata').startOf('day')
    pointsCount = dayjs(endOfDay).tz('Asia/Kolkata').diff(trendStartDate, 'day') + 1
  } else if (trendPeriod === 'monthly') {
    const startDayjs = dayjs(startOfDay).tz('Asia/Kolkata')
    const endDayjs = dayjs(endOfDay).tz('Asia/Kolkata')
    const diffMonths = endDayjs.diff(startDayjs.startOf('month'), 'month') + 1
    const diffYears = endDayjs.year() - startDayjs.year() + 1

    if (diffMonths > 24) {
      granularity = 'year'
      trendStartDate = startDayjs.startOf('year')
      pointsCount = Math.max(1, diffYears)
    } else {
      granularity = 'month'
      trendStartDate = startDayjs.startOf('month')
      pointsCount = Math.max(1, diffMonths)
    }
  } else if (trendPeriod === 'thisMonth') {
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
    ...branchFilter,
  }
  
  const metricFilter = args.trendMetricFilter
  if (metricFilter === 'cancelled') {
    trendMatch.status = 'cancelled'
  } else {
    trendMatch.status = { $in: ['completed', 'settled'] }
    if (metricFilter === 'table') {
      trendMatch.$expr = hasTableOrderReferenceExpression
    } else if (metricFilter === 'counter') {
      trendMatch.$expr = { $not: hasTableOrderReferenceExpression }
    }
  }

  if (trendPeriod === 'hourly' || trendPeriod === 'daily' || trendPeriod === 'monthly') {
    trendMatch.createdAt = { $gte: startOfDay, $lte: endOfDay }
  }

  const needsTrendData = requestedFields.length === 0 || requestedFields.includes('trendData') || requestedFields.includes('summary')

  // Aggregate Expenses for the same trend period
  const expenseTrendMatch: any = {
    date: { $gte: trendStartDate.toDate() },
    ...branchFilter,
  }
  if (trendPeriod === 'hourly' || trendPeriod === 'daily' || trendPeriod === 'monthly') {
    expenseTrendMatch.date = { $gte: startOfDay, $lte: endOfDay }
  }

  // Aggregate Returns for the same trend period
  const returnTrendMatch: any = {
    createdAt: { $gte: trendStartDate.toDate() },
    ...branchFilter,
  }
  if (trendPeriod === 'hourly' || trendPeriod === 'daily' || trendPeriod === 'monthly') {
    returnTrendMatch.createdAt = { $gte: startOfDay, $lte: endOfDay }
  }

  // Aggregate Stock Orders for the same trend period
  const stockOrderTrendMatch: any = {
    createdAt: { $gte: trendStartDate.toDate() },
    ...branchFilter,
  }
  if (trendPeriod === 'hourly' || trendPeriod === 'daily' || trendPeriod === 'monthly') {
    stockOrderTrendMatch.createdAt = { $gte: startOfDay, $lte: endOfDay }
  }

  // Aggregate Dealer Billings for the same trend period
  const dealerBillingTrendMatch: any = {
    createdAt: { $gte: trendStartDate.toDate() },
    ...branchFilter,
  }
  if (trendPeriod === 'hourly' || trendPeriod === 'daily' || trendPeriod === 'monthly') {
    dealerBillingTrendMatch.createdAt = { $gte: startOfDay, $lte: endOfDay }
  }

  const [rawTrendStats, rawExpenseTrendStats, rawReturnTrendStats, rawStockOrderTrendStats, rawDealerBillingTrendStats] = await Promise.all([
    needsTrendData ? BillingModel.aggregate([
      { $match: trendMatch },
      {
        $group: {
          _id: {
            year: granularity === 'hour' ? null : { $year: { $add: ['$createdAt', 19800000] } },
            month: (granularity === 'hour' || granularity === 'year') ? null : { $month: { $add: ['$createdAt', 19800000] } },
            day: granularity === 'day' ? { $dayOfMonth: { $add: ['$createdAt', 19800000] } } : null,
            hour: granularity === 'hour' ? { $hour: { $add: ['$createdAt', 19800000] } } : null,
            branch: '$branch',
          },
          totalAmount: { $sum: '$totalAmount' },
          totalBills: { $sum: 1 },
          tableOrderAmount: {
            $sum: {
              $cond: [hasTableOrderReferenceExpression, '$totalAmount', 0],
            },
          },
          tableOrderBills: {
            $sum: {
              $cond: [hasTableOrderReferenceExpression, 1, 0],
            },
          },
          nonTableOrderAmount: {
            $sum: {
              $cond: [{ $not: [hasTableOrderReferenceExpression] }, '$totalAmount', 0],
            },
          },
          nonTableOrderBills: {
            $sum: {
              $cond: [{ $not: [hasTableOrderReferenceExpression] }, 1, 0],
            },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
    ]) : Promise.resolve([]),
    needsTrendData ? ExpenseModel.aggregate([
      { $match: expenseTrendMatch },
      { $unwind: '$details' },
      {
        $group: {
          _id: {
            year: granularity === 'hour' ? null : { $year: '$date' },
            month: (granularity === 'hour' || granularity === 'year') ? null : { $month: '$date' },
            day: granularity === 'day' ? { $dayOfMonth: '$date' } : null,
            hour: granularity === 'hour' ? { $hour: '$date' } : null,
          },
          totalExpense: { $sum: '$details.amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
    ]) : Promise.resolve([]),
    needsTrendData ? ReturnOrderModel.aggregate([
      { $match: returnTrendMatch },
      {
        $group: {
          _id: {
            year: granularity === 'hour' ? null : { $year: { $add: ['$createdAt', 19800000] } },
            month: (granularity === 'hour' || granularity === 'year') ? null : { $month: { $add: ['$createdAt', 19800000] } },
            day: granularity === 'day' ? { $dayOfMonth: { $add: ['$createdAt', 19800000] } } : null,
            hour: granularity === 'hour' ? { $hour: { $add: ['$createdAt', 19800000] } } : null,
          },
          totalReturn: { $sum: '$totalAmount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
    ]) : Promise.resolve([]),
    needsTrendData && StockOrderModel ? StockOrderModel.aggregate([
      { $match: stockOrderTrendMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            year: granularity === 'hour' ? null : { $year: { $add: ['$createdAt', 19800000] } },
            month: (granularity === 'hour' || granularity === 'year') ? null : { $month: { $add: ['$createdAt', 19800000] } },
            day: granularity === 'day' ? { $dayOfMonth: { $add: ['$createdAt', 19800000] } } : null,
            hour: granularity === 'hour' ? { $hour: { $add: ['$createdAt', 19800000] } } : null,
          },
          totalStockOrder: {
            $sum: {
              $ifNull: [
                '$items.receivedAmount',
                {
                  $multiply: [
                    { $ifNull: ['$items.receivedQty', 0] },
                    { $ifNull: ['$items.price', 0] },
                  ],
                },
              ],
            },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
    ]) : Promise.resolve([]),
    needsTrendData && DealerBillingModel ? DealerBillingModel.aggregate([
      { $match: dealerBillingTrendMatch },
      {
        $group: {
          _id: {
            year: granularity === 'hour' ? null : { $year: { $add: ['$createdAt', 19800000] } },
            month: (granularity === 'hour' || granularity === 'year') ? null : { $month: { $add: ['$createdAt', 19800000] } },
            day: granularity === 'day' ? { $dayOfMonth: { $add: ['$createdAt', 19800000] } } : null,
            hour: granularity === 'hour' ? { $hour: { $add: ['$createdAt', 19800000] } } : null,
          },
          totalDealerBilling: { $sum: { $ifNull: ['$paidAmount', 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
    ]) : Promise.resolve([]),
  ])

  // Hourly range calculation: from first bill hour to till now / last bill
  if (granularity === 'hour') {
    const hoursWithData = rawTrendStats
      .map((s) => s._id.hour)
      .filter((h): h is number => typeof h === 'number')

    const isToday = dayjs(startOfDay).tz('Asia/Kolkata').isSame(now, 'day')
    const isYesterday = dayjs(startOfDay).tz('Asia/Kolkata').isSame(now.subtract(1, 'day'), 'day')

    let startHour = 9
    let endHour = 22

    if (isToday) {
      if (hoursWithData.length > 0) {
        startHour = Math.min(...hoursWithData)
        // First bill hour to till now (current hour)
        endHour = Math.max(now.hour(), ...hoursWithData)
      } else {
        startHour = Math.min(now.hour(), 9)
        endHour = Math.max(now.hour(), startHour)
      }
    } else if (isYesterday) {
      if (hoursWithData.length > 0) {
        startHour = Math.min(...hoursWithData)
        endHour = Math.max(...hoursWithData)
      } else {
        startHour = 9
        endHour = 22
      }
    } else {
      if (hoursWithData.length > 0) {
        startHour = Math.min(...hoursWithData)
        endHour = Math.max(...hoursWithData)
      } else {
        startHour = 9
        endHour = 22
      }
    }

    trendStartDate = dayjs(startOfDay).tz('Asia/Kolkata').hour(startHour).minute(0).second(0).millisecond(0)
    pointsCount = Math.max(1, endHour - startHour + 1)
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const trendData: TrendPoint[] = []

  for (let i = 0; i < pointsCount; i += 1) {
    let d = trendStartDate
    if (granularity === 'year') d = trendStartDate.add(i, 'year')
    else if (granularity === 'month') d = trendStartDate.add(i, 'month')
    else if (granularity === 'day') d = trendStartDate.add(i, 'day')
    else if (granularity === 'hour') d = trendStartDate.add(i, 'hour')

    const year = d.year()
    const month = d.month() + 1
    const day = (granularity === 'day' || granularity === 'hour') ? d.date() : null
    const hour = granularity === 'hour' ? d.hour() : null

    const foundItems = rawTrendStats.filter(
      (s) =>
        (granularity === 'hour' || s._id.year === year) &&
        (granularity === 'hour' || granularity === 'year' || s._id.month === month) &&
        (granularity === 'month' || granularity === 'year' || granularity === 'hour' || s._id.day === day) &&
        (granularity !== 'hour' || s._id.hour === hour),
    )
    const totalAmount = foundItems.reduce((acc, curr) => acc + curr.totalAmount, 0)
    const totalBills = foundItems.reduce((acc, curr) => acc + curr.totalBills, 0)
    const tableOrderAmount = foundItems.reduce((acc, curr) => acc + (curr.tableOrderAmount || 0), 0)
    const tableOrderBills = foundItems.reduce((acc, curr) => acc + (curr.tableOrderBills || 0), 0)
    const nonTableOrderAmount = foundItems.reduce((acc, curr) => acc + (curr.nonTableOrderAmount || 0), 0)
    const nonTableOrderBills = foundItems.reduce((acc, curr) => acc + (curr.nonTableOrderBills || 0), 0)
    const branchesData = foundItems.map(item => ({
      branchId: String(item._id.branch),
      amount: item.totalAmount,
      billCount: item.totalBills,
      tableOrderAmount: item.tableOrderAmount || 0,
      nonTableOrderAmount: item.nonTableOrderAmount || 0,
    }))

    const matchFilter = (s: any) =>
      (granularity === 'hour' || s._id.year === year) &&
      (granularity === 'hour' || granularity === 'year' || s._id.month === month) &&
      (granularity === 'month' || granularity === 'year' || granularity === 'hour' || s._id.day === day) &&
      (granularity !== 'hour' || s._id.hour === hour)

    const foundExpense = rawExpenseTrendStats.find(matchFilter)
    const foundReturn = rawReturnTrendStats.find(matchFilter)
    const foundStockOrder = rawStockOrderTrendStats.find(matchFilter)
    const foundDealerBilling = rawDealerBillingTrendStats.find(matchFilter)

    let label = ''
    let fullLabel = ''

    if (granularity === 'year') {
      label = String(year)
      fullLabel = `Year ${year}`
    } else if (granularity === 'month') {
      const spansMultipleYears =
        trendStartDate.year() !== trendStartDate.add(pointsCount - 1, 'month').year()
      label = spansMultipleYears
        ? `${monthNames[month - 1]} '${String(year).slice(-2)}`
        : monthNames[month - 1]
      fullLabel = `${monthNames[month - 1]} ${year}`
    } else if (granularity === 'day') {
      label = d.format('D MMM')
      fullLabel = d.format('D MMMM YYYY')
    } else if (granularity === 'hour') {
      label = d.format('h A')
      fullLabel = `${monthNames[month - 1]} ${d.date()}, ${d.format('h A')}`
    }

    trendData.push({
      label,
      fullLabel,
      totalAmount,
      totalBills,
      totalExpense: foundExpense?.totalExpense ?? 0,
      totalReturn: foundReturn?.totalReturn ?? 0,
      totalStockOrder: foundStockOrder?.totalStockOrder ?? 0,
      totalDealerBilling: foundDealerBilling?.totalDealerBilling ?? 0,
      tableOrderAmount,
      tableOrderBills,
      nonTableOrderAmount,
      nonTableOrderBills,
      branchesData,
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
  const needsHeatmapData = requestedFields.length === 0 || requestedFields.includes('heatmapData')
  
  const heatmapStats = needsHeatmapData ? await BillingModel.aggregate([
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
  ]) : []

  const heatmapData: HeatmapPoint[] = heatmapStats.map((s) => ({
    day: s._id.day,
    hour: s._id.hour,
    amount: s.amount,
    count: s.count,
  }))

  const gstFilterMatch = args.gstFilter === 'both'
    ? {}
    : (isGST
        ? { 'items.gstRate': { $gt: 0 } }
        : {
            $or: [
              { 'items.gstRate': { $lte: 0 } },
              { 'items.gstRate': { $exists: false } },
              { 'items.gstRate': null },
            ],
          })

  const subReportSort = (args.gstFilter === 'gst' ? { gstAmount: -1 } : { totalAmount: -1 }) as any

  const needsProductGstStats = requestedFields.length === 0 || requestedFields.includes('productGstStats')
  const needsCategoryGstStats = requestedFields.length === 0 || requestedFields.includes('categoryGstStats')
  const needsDealerGstStats = requestedFields.length === 0 || requestedFields.includes('dealerGstStats')

  const [productGstStats, categoryGstStats, dealerGstStats] = await Promise.all([
    needsProductGstStats ? BillingModel.aggregate([
      {
        $match: {
          ...matchQuery,
          status: { $in: ['completed', 'settled'] },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $match: {
          'items.status': { $ne: 'cancelled' },
          ...gstFilterMatch,
        },
      },
      {
        $group: {
          _id: {
            productName: '$items.name',
            gstRate: '$items.gstRate',
          },
          count: { $sum: '$items.quantity' },
          taxableAmount: { $sum: '$items.taxableAmount' },
          gstAmount: { $sum: '$items.gstAmount' },
          totalAmount: { $sum: '$items.finalLineTotal' },
        },
      },
      {
        $project: {
          _id: 0,
          productName: '$_id.productName',
          gstRate: '$_id.gstRate',
          count: { $ifNull: ['$count', 0] },
          taxableAmount: { $ifNull: ['$taxableAmount', 0] },
          gstAmount: { $ifNull: ['$gstAmount', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
        },
      },
      {
        $sort: subReportSort,
      },
    ]) : Promise.resolve([]),
    needsCategoryGstStats ? BillingModel.aggregate([
      {
        $match: {
          ...matchQuery,
          status: { $in: ['completed', 'settled'] },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $match: {
          'items.status': { $ne: 'cancelled' },
          ...gstFilterMatch,
        },
      },
      // Group first by product to reduce documents from ~100k to ~1k
      {
        $group: {
          _id: '$items.product',
          count: { $sum: '$items.quantity' },
          taxableAmount: { $sum: '$items.taxableAmount' },
          gstAmount: { $sum: '$items.gstAmount' },
          totalAmount: { $sum: '$items.finalLineTotal' },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
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
      {
        $group: {
          _id: {
            categoryName: '$categoryDetails.name',
          },
          count: { $sum: '$count' },
          taxableAmount: { $sum: '$taxableAmount' },
          gstAmount: { $sum: '$gstAmount' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      {
        $project: {
          _id: 0,
          categoryName: '$_id.categoryName',
          count: { $ifNull: ['$count', 0] },
          taxableAmount: { $ifNull: ['$taxableAmount', 0] },
          gstAmount: { $ifNull: ['$gstAmount', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
        },
      },
      {
        $sort: subReportSort,
      },
    ]) : Promise.resolve([]),
    needsDealerGstStats ? BillingModel.aggregate([
      {
        $match: {
          ...matchQuery,
          status: { $in: ['completed', 'settled'] },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $match: {
          'items.status': { $ne: 'cancelled' },
          ...gstFilterMatch,
        },
      },
      // Group first by product to reduce documents from ~100k to ~1k
      {
        $group: {
          _id: '$items.product',
          count: { $sum: '$items.quantity' },
          taxableAmount: { $sum: '$items.taxableAmount' },
          gstAmount: { $sum: '$items.gstAmount' },
          totalAmount: { $sum: '$items.finalLineTotal' },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $unwind: '$productDetails',
      },
      {
        $match: {
          'productDetails.dealer': { $ne: null },
        },
      },
      {
        $lookup: {
          from: 'dealers',
          localField: 'productDetails.dealer',
          foreignField: '_id',
          as: 'dealerDetails',
        },
      },
      {
        $unwind: '$dealerDetails',
      },
      {
        $group: {
          _id: {
            dealerName: '$dealerDetails.companyName',
          },
          count: { $sum: '$count' },
          taxableAmount: { $sum: '$taxableAmount' },
          gstAmount: { $sum: '$gstAmount' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      {
        $project: {
          _id: 0,
          dealerName: '$_id.dealerName',
          count: { $ifNull: ['$count', 0] },
          taxableAmount: { $ifNull: ['$taxableAmount', 0] },
          gstAmount: { $ifNull: ['$gstAmount', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
        },
      },
      {
        $sort: subReportSort,
      },
    ]) : Promise.resolve([])
  ])


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
    productGstStats,
    categoryGstStats,
    dealerGstStats,
  }
}
