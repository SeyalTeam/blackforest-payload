import { PayloadHandler, PayloadRequest } from 'payload'
import mongoose from 'mongoose'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

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
    const BillingModel = payload.db.collections['billings']
    if (!BillingModel) {
      throw new Error('Billings collection not found')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aggregationPipeline: any[] = [
      {
        $match: {
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
          // Filter out cancelled bills? Usually reports exclude cancelled
          status: { $ne: 'cancelled' },
          'customerDetails.phoneNumber': { $exists: true, $ne: null },
          ...(branchParam ? { branch: new mongoose.Types.ObjectId(branchParam) } : {}),
          ...(waiterParam ? { createdBy: new mongoose.Types.ObjectId(waiterParam) } : {}),
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$customerDetails.phoneNumber',
          customerName: { $first: '$customerDetails.name' },
          phoneNumber: { $first: '$customerDetails.phoneNumber' },
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

    const formattedStats = stats.map((stat, index) => ({
      sNo: index + 1,
      customerName: stat.customerName || 'Unknown',
      phoneNumber: stat.phoneNumber,
      branchName: stat.branchName || 'N/A',
      waiterName: stat.waiterName || 'N/A',
      totalBills: stat.totalBills,
      totalAmount: stat.totalAmount,
      lastPurchasingDate: stat.lastPurchasingDate,
    }))

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      stats: formattedStats,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    payload.logger.error({ msg: 'Customer Report Error', error, stack: error.stack })
    return Response.json({ error: 'Failed to generate customer report' }, { status: 500 })
  }
}
