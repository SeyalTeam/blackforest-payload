import { PayloadHandler, PayloadRequest } from 'payload'
import mongoose from 'mongoose'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from './reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export const getAfterstockCustomerReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  const startDateParam =
    typeof req.query.startDate === 'string'
      ? req.query.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof req.query.endDate === 'string'
      ? req.query.endDate
      : new Date().toISOString().split('T')[0]

  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : null
  const waiterParam = typeof req.query.waiter === 'string' ? req.query.waiter : null
  const orderSourceParam =
    req.query.orderSource === 'table' || req.query.orderSource === 'billing'
      ? req.query.orderSource
      : null

  // Start of day (00:00:00) for startDate
  const startAndYear = parseInt(startDateParam.split('-')[0])
  const startAndMonth = parseInt(startDateParam.split('-')[1])
  const startAndDay = parseInt(startDateParam.split('-')[2])
  const startOfDay = dayjs
    .tz(`${startAndYear}-${startAndMonth}-${startAndDay}`, 'YYYY-MM-DD', 'Asia/Kolkata')
    .startOf('day')
    .toDate()

  // End of day (23:59:59) for endDate
  const endAndYear = parseInt(endDateParam.split('-')[0])
  const endAndMonth = parseInt(endDateParam.split('-')[1])
  const endAndDay = parseInt(endDateParam.split('-')[2])
  const endOfDay = dayjs
    .tz(`${endAndYear}-${endAndMonth}-${endAndDay}`, 'YYYY-MM-DD', 'Asia/Kolkata')
    .endOf('day')
    .toDate()

  try {
    const { branchIds, errorResponse } = await resolveReportBranchScope(req, branchParam)
    if (errorResponse) return errorResponse

    const BillingModel = payload.db.collections['billings']
    if (!BillingModel) {
      throw new Error('Billings collection not found')
    }

    const tableOrderExpression = {
      $or: [
        {
          $gt: [
            {
              $strLenCP: {
                $trim: { input: { $toString: { $ifNull: ['$tableDetails.section', ''] } } },
              },
            },
            0,
          ],
        },
        {
          $gt: [
            {
              $strLenCP: {
                $trim: { input: { $toString: { $ifNull: ['$tableDetails.tableNumber', ''] } } },
              },
            },
            0,
          ],
        },
      ],
    }

    const getScopedMatchExpressions = (options: { includeOrderSource?: boolean } = {}) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const expressions: any[] = []
      const includeOrderSource = options.includeOrderSource ?? true

      if (branchIds) {
        expressions.push({ $in: [{ $toString: '$branch' }, branchIds] })
      }

      if (includeOrderSource && orderSourceParam === 'table') {
        expressions.push(tableOrderExpression)
      }

      if (includeOrderSource && orderSourceParam === 'billing') {
        expressions.push({ $not: [tableOrderExpression] })
      }

      return expressions
    }

    const applyScopedExpressions = (
      query: Record<string, unknown>,
      options: { includeOrderSource?: boolean } = {},
    ) => {
      const expressions = getScopedMatchExpressions(options)
      if (expressions.length === 1) {
        query.$expr = expressions[0]
      } else if (expressions.length > 1) {
        query.$expr = { $and: expressions }
      }
    }

    const matchQuery: Record<string, unknown> = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $ne: 'cancelled' },
    }
    applyScopedExpressions(matchQuery)
    if (waiterParam) {
      matchQuery.createdBy = new mongoose.Types.ObjectId(waiterParam)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aggregationPipeline: any[] = [
      {
        $match: matchQuery,
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $addFields: {
          normalizedCustomerName: {
            $trim: { input: { $toString: { $ifNull: ['$customerDetails.name', ''] } } },
          },
          normalizedCustomerPhone: {
            $trim: { input: { $toString: { $ifNull: ['$customerDetails.phoneNumber', ''] } } },
          },
        },
      },
      {
        $addFields: {
          hasCustomerPhone: { $ne: ['$normalizedCustomerPhone', ''] },
        },
      },
      {
        $group: {
          _id: {
            $cond: ['$hasCustomerPhone', '$normalizedCustomerPhone', { $toString: '$_id' }],
          },
          customerName: { $first: '$normalizedCustomerName' },
          phoneNumber: { $first: '$normalizedCustomerPhone' },
          hasCustomerPhone: { $first: '$hasCustomerPhone' },
          billId: { $first: '$_id' },
          billIds: { $push: '$_id' },
          totalBills: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          lastPurchasingDate: { $max: '$createdAt' },
          branchId: { $first: '$branch' },
          waiterId: { $first: '$createdBy' },
        },
      },
      {
        $lookup: {
          from: 'branches',
          localField: 'branchId',
          foreignField: '_id',
          as: 'branchDoc',
        },
      },
      {
        $unwind: {
          path: '$branchDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'waiterId',
          foreignField: '_id',
          as: 'waiterDoc',
        },
      },
      {
        $unwind: {
          path: '$waiterDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
      {
        $project: {
          _id: 0,
          customerName: 1,
          phoneNumber: 1,
          hasCustomerPhone: 1,
          billId: 1,
          billIds: 1,
          totalBills: 1,
          totalAmount: 1,
          lastPurchasingDate: 1,
          branchName: '$branchDoc.name',
          waiterName: '$waiterDoc.name',
        },
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = (await BillingModel.aggregate(aggregationPipeline)) as any[]

    const sourceSummaryMatchQuery: Record<string, unknown> = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $ne: 'cancelled' },
    }
    applyScopedExpressions(sourceSummaryMatchQuery, { includeOrderSource: false })
    if (waiterParam) {
      sourceSummaryMatchQuery.createdBy = new mongoose.Types.ObjectId(waiterParam)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceSummaryPipeline: any[] = [
      {
        $match: sourceSummaryMatchQuery,
      },
      {
        $addFields: {
          orderSource: {
            $cond: [tableOrderExpression, 'table', 'billing'],
          },
        },
      },
      {
        $group: {
          _id: '$orderSource',
          bills: { $sum: 1 },
          amount: { $sum: '$totalAmount' },
        },
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceSummaryRows = (await BillingModel.aggregate(sourceSummaryPipeline)) as any[]
    const sourceSummary = {
      table: { amount: 0, bills: 0 },
      billing: { amount: 0, bills: 0 },
    }
    sourceSummaryRows.forEach((row) => {
      if (row?._id !== 'table' && row?._id !== 'billing') return
      sourceSummary[row._id as 'table' | 'billing'] = {
        amount: Number(row.amount) || 0,
        bills: Number(row.bills) || 0,
      }
    })

    const historyPhones = Array.from(
      new Set(
        stats
          .filter((stat) => stat.hasCustomerPhone && stat.phoneNumber)
          .map((stat) => String(stat.phoneNumber)),
      ),
    )

    const historyByPhone = new Map<
      string,
      { count: number; billIds: unknown[]; totalAmount: number }
    >()

    if (historyPhones.length > 0) {
      const historyMatchQuery: Record<string, unknown> = {
        createdAt: { $lte: endOfDay },
        status: { $ne: 'cancelled' },
      }
      applyScopedExpressions(historyMatchQuery)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerHistoryPipeline: any[] = [
        {
          $match: historyMatchQuery,
        },
        {
          $addFields: {
            normalizedCustomerPhone: {
              $trim: { input: { $toString: { $ifNull: ['$customerDetails.phoneNumber', ''] } } },
            },
          },
        },
        {
          $match: {
            normalizedCustomerPhone: { $in: historyPhones },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: '$normalizedCustomerPhone',
            count: { $sum: 1 },
            billIds: { $push: '$_id' },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerHistory = (await BillingModel.aggregate(customerHistoryPipeline)) as any[]
      customerHistory.forEach((historyItem) => {
        if (!historyItem?._id) return
        historyByPhone.set(String(historyItem._id), {
          count: Number(historyItem.count) || 0,
          billIds: Array.isArray(historyItem.billIds) ? historyItem.billIds : [],
          totalAmount: Number(historyItem.totalAmount) || 0,
        })
      })
    }

    const mapBillIDs = (billIDs: unknown[]) =>
      Array.isArray(billIDs)
        ? billIDs
            .map((billID: unknown) => (billID ? String(billID) : ''))
            .filter((billID: string) => billID.length > 0)
        : []

    const formattedStats = stats.map((stat, index) => {
      const hasCustomerPhone = Boolean(stat.hasCustomerPhone && stat.phoneNumber)
      const history = hasCustomerPhone ? historyByPhone.get(String(stat.phoneNumber)) : undefined
      const lifetimeBillCount = hasCustomerPhone
        ? history?.count || stat.totalBills
        : stat.totalBills
      const lifetimeBillIds = hasCustomerPhone ? history?.billIds || stat.billIds : stat.billIds
      const lifetimeTotalAmount = hasCustomerPhone
        ? history?.totalAmount || stat.totalAmount
        : stat.totalAmount

      return {
        sNo: index + 1,
        customerName: stat.customerName || (hasCustomerPhone ? 'BF CUSTOMER' : 'UNKNOWN'),
        phoneNumber: stat.phoneNumber || 'N/A',
        billId: stat.billId ? String(stat.billId) : undefined,
        billIds: mapBillIDs(stat.billIds),
        branchName: stat.branchName || 'N/A',
        waiterName: stat.waiterName || 'N/A',
        totalBills: stat.totalBills,
        lifetimeBillCount,
        lifetimeBillIds: mapBillIDs(lifetimeBillIds),
        lifetimeTotalAmount,
        isExistingCustomer: hasCustomerPhone ? lifetimeBillCount > 1 : false,
        totalAmount: stat.totalAmount,
        lastPurchasingDate: stat.lastPurchasingDate,
      }
    })

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      stats: formattedStats,
      sourceSummary,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    payload.logger.error({ msg: 'Customer Report Error', error, stack: error.stack })
    return Response.json({ error: 'Failed to generate customer report' }, { status: 500 })
  }
}
