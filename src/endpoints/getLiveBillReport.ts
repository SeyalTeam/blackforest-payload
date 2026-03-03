import type { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from './reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type LiveBillRow = {
  billId: string
  invoiceNumber: string
  itemCount: number
  totalAmount: number
  branchName: string
  createdAt: string
}

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata')
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
}

export const getLiveBillReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const startDateParam =
    typeof req.query.startDate === 'string'
      ? req.query.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof req.query.endDate === 'string'
      ? req.query.endDate
      : new Date().toISOString().split('T')[0]
  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : null

  const startOfDay = toDayBoundary(startDateParam, 'start')
  const endOfDay = toDayBoundary(endDateParam, 'end')

  try {
    const { branchIds, errorResponse } = await resolveReportBranchScope(req, branchParam)
    if (errorResponse) return errorResponse

    const bills = await req.payload.find({
      collection: 'billings',
      where: {
        and: [
          {
            createdAt: {
              greater_than_equal: startOfDay,
              less_than_equal: endOfDay,
            },
          },
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
      sort: '-createdAt',
      depth: 1,
      limit: 1000,
      pagination: false,
    })

    const stats: LiveBillRow[] = bills.docs.map((bill) => {
      const activeItemCount = Array.isArray(bill.items)
        ? bill.items.reduce((count, item) => {
            if (!item || typeof item !== 'object') return count
            const status = 'status' in item ? (item as { status?: unknown }).status : undefined
            return status === 'cancelled' ? count : count + 1
          }, 0)
        : 0

      const branchName =
        bill.branch && typeof bill.branch === 'object' && 'name' in bill.branch
          ? ((bill.branch as { name?: unknown }).name as string) || 'Unknown Branch'
          : 'Unknown Branch'

      return {
        billId: bill.id,
        invoiceNumber: bill.invoiceNumber || 'N/A',
        itemCount: activeItemCount,
        totalAmount: typeof bill.totalAmount === 'number' ? bill.totalAmount : 0,
        branchName,
        createdAt: bill.createdAt,
      }
    })

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      totalBills: stats.length,
      stats,
    })
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ error: 'Failed to generate live bill report' }, { status: 500 })
  }
}
