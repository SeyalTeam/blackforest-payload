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
    const paymentMethodParam = typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : null
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

    if (verificationStatusParam && verificationStatusParam !== 'all' && verificationStatusParam !== 'missed') {
      whereClause.and.push({
        verificationStatus: {
          equals: verificationStatusParam,
        },
      })
    }

    if (paymentMethodParam && paymentMethodParam !== 'all') {
      whereClause.and.push({
        paymentMethod: {
          equals: paymentMethodParam,
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

    // Fetch closing entries for mapping
    const branchIdsInBills = Array.from(
      new Set(
        result.docs
          .map((bill: any) => {
            return bill.branch && typeof bill.branch === 'object'
              ? bill.branch.id
              : bill.branch
          })
          .filter(Boolean)
      )
    )

    const [startYear, startMonth, startDay] = startStr.split('-').map(Number)
    const startUtc = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0)).toISOString()

    const [endYear, endMonth, endDay] = endStr.split('-').map(Number)
    const endUtc = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999)).toISOString()

    const closingEntriesResult = branchIdsInBills.length > 0
      ? await payload.find({
          collection: 'closing-entries',
          where: {
            and: [
              {
                branch: {
                  in: branchIdsInBills,
                },
              },
              {
                date: {
                  greater_than_equal: startUtc,
                },
              },
              {
                date: {
                  less_than_equal: endUtc,
                },
              },
            ],
          },
          limit: 1000,
          sort: 'createdAt',
          depth: 0,
        })
      : { docs: [] }

    const closingGroups: Record<string, any[]> = {}
    closingEntriesResult.docs.forEach((entry: any) => {
      const bId = entry.branch
      if (!bId || !entry.date) return
      const dateStr = new Date(entry.date).toISOString().slice(0, 10)
      const key = `${bId}_${dateStr}`
      if (!closingGroups[key]) {
        closingGroups[key] = []
      }
      closingGroups[key].push(entry)
    })

    // Sort each group by createdAt ascending just to be 100% sure
    Object.keys(closingGroups).forEach((k) => {
      closingGroups[k].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    })

    let bills = result.docs.map((bill: any) => {
      const waiterName = bill.createdBy && typeof bill.createdBy === 'object'
        ? bill.createdBy.name || bill.createdBy.email || 'N/A'
        : 'N/A'
      const branchName = bill.branch && typeof bill.branch === 'object'
        ? bill.branch.name || 'N/A'
        : 'N/A'
      const itemsCount = Array.isArray(bill.items) ? bill.items.length : 0

      const billBranchId = bill.branch && typeof bill.branch === 'object'
        ? bill.branch.id
        : bill.branch

      const billDateStr = new Date(bill.createdAt).toISOString().slice(0, 10)
      const key = `${billBranchId}_${billDateStr}`

      let closingNumber = '-'
      let originalClosingNumber = '-'
      let closingStatus = 'n_a'

      const isBillClosedStatus = bill.status === 'completed' || bill.status === 'settled'

      if (isBillClosedStatus) {
        const groupEntries = closingGroups[key] || []
        if (groupEntries.length > 0) {
          let matchedEntry = null
          const billTime = new Date(bill.createdAt).getTime()

          for (let i = 0; i < groupEntries.length; i++) {
            const currentEntry = groupEntries[i]
            const currentEntryTime = new Date(currentEntry.createdAt).getTime()

            let lastClosingTime = 0
            if (i > 0) {
              lastClosingTime = new Date(groupEntries[i - 1].createdAt).getTime()
            } else {
              const startOfDay = new Date(Date.UTC(
                new Date(currentEntry.date).getUTCFullYear(),
                new Date(currentEntry.date).getUTCMonth(),
                new Date(currentEntry.date).getUTCDate(),
                0, 0, 0, 0
              )).getTime()
              lastClosingTime = startOfDay
            }

            if (billTime > lastClosingTime && billTime <= currentEntryTime) {
              matchedEntry = currentEntry
              break
            }
          }

          if (matchedEntry) {
            const parts = matchedEntry.closingNumber.split('-')
            const seq = parts[3] || '00'
            const closingTimeStr = dayjs(matchedEntry.createdAt).tz(BILLING_TIMEZONE).format('HH:mm')
            closingNumber = `CLO-${seq} ${closingTimeStr}`
            originalClosingNumber = matchedEntry.closingNumber
            closingStatus = 'closed'
          } else {
            closingNumber = 'Missed'
            closingStatus = 'missed'
          }
        } else {
          closingNumber = 'Pending'
          closingStatus = 'pending'
        }
      }

      return {
        id: bill.id,
        invoiceNumber: bill.invoiceNumber,
        totalAmount: bill.totalAmount,
        paymentMethod: bill.paymentMethod || 'other',
        upiBankTransactionId: bill.upiBankTransactionId || '',
        itemsCount,
        waiterName,
        branchName,
        createdAt: bill.createdAt,
        verificationStatus: bill.verificationStatus || 'pending',
        closingNumber,
        originalClosingNumber,
        closingStatus,
      }
    })

    if (verificationStatusParam === 'missed') {
      bills = bills.filter((b) => b.closingStatus === 'missed')
    }

    return Response.json({ bills })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
