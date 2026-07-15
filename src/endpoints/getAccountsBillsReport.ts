import { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from './reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)

const BILLING_TIMEZONE = 'Asia/Kolkata'

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', BILLING_TIMEZONE)
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
}

export const getAccountsBillsReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  try {
    const startDateParam = typeof req.query.startDate === 'string' ? req.query.startDate : null
    const endDateParam = typeof req.query.endDate === 'string' ? req.query.endDate : null
    const branchParam = typeof req.query.branch === 'string' ? req.query.branch : null
    const verificationStatusParam = typeof req.query.verificationStatus === 'string' ? req.query.verificationStatus : null
    const searchParam = typeof req.query.search === 'string' ? req.query.search : null

    const todayStr = dayjs().tz(BILLING_TIMEZONE).format('YYYY-MM-DD')
    const startStr = startDateParam || todayStr
    const endStr = endDateParam || todayStr

    const startOfDay = toDayBoundary(startStr, 'start')
    const endOfDay = toDayBoundary(endStr, 'end')

    const { branchIds } = await resolveReportBranchScope(req, branchParam)

    const whereClause: any = {
      and: [
        {
          createdAt: {
            greater_than_equal: startOfDay.toISOString(),
          },
        },
        {
          createdAt: {
            less_than_equal: endOfDay.toISOString(),
          },
        },
      ],
    }

    if (branchIds && branchIds.length > 0) {
      whereClause.and.push({
        branch: {
          in: branchIds,
        },
      })
    }

    if (verificationStatusParam && verificationStatusParam !== 'all') {
      whereClause.and.push({
        verificationStatus: {
          equals: verificationStatusParam,
        },
      })
    }

    if (searchParam && searchParam.trim().length > 0) {
      whereClause.and.push({
        invoiceNumber: {
          like: searchParam.trim(),
        },
      })
    }

    const result = await payload.find({
      collection: 'billings',
      where: whereClause,
      depth: 2,
      limit: 1000,
      sort: '-createdAt',
      pagination: false,
    })

    const bills = result.docs.map((bill: any) => {
      const waiterName = bill.createdBy && typeof bill.createdBy === 'object'
        ? bill.createdBy.name || bill.createdBy.email || 'N/A'
        : 'N/A'
      const branchName = bill.branch && typeof bill.branch === 'object'
        ? bill.branch.name || 'N/A'
        : 'N/A'
      const itemsCount = Array.isArray(bill.items) ? bill.items.length : 0

      return {
        id: bill.id,
        invoiceNumber: bill.invoiceNumber,
        totalAmount: bill.totalAmount,
        paymentMethod: bill.paymentMethod || 'other',
        itemsCount,
        waiterName,
        branchName,
        createdAt: bill.createdAt,
        verificationStatus: bill.verificationStatus || 'pending',
      }
    })

    return Response.json({ bills })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
