import type { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from './reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata')
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
}

export const getTallyExportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  try {
    const startDateParam =
      typeof req.query.startDate === 'string' && req.query.startDate.trim().length > 0
        ? req.query.startDate
        : new Date().toISOString().split('T')[0]
    const endDateParam =
      typeof req.query.endDate === 'string' && req.query.endDate.trim().length > 0
        ? req.query.endDate
        : new Date().toISOString().split('T')[0]
    const branchParam =
      typeof req.query.branch === 'string' && req.query.branch.trim().length > 0
        ? req.query.branch
        : null
    const gstFilter =
      typeof req.query.gstFilter === 'string' && req.query.gstFilter.trim().length > 0
        ? req.query.gstFilter
        : 'gst'

    const startOfDay = toDayBoundary(startDateParam, 'start')
    const endOfDay = toDayBoundary(endDateParam, 'end')

    const { branchIds } = await resolveReportBranchScope(req, branchParam)

    // Query completed/settled bills
    const result = await payload.find({
      collection: 'billings',
      where: {
        createdAt: {
          greater_than_equal: startOfDay,
          less_than_equal: endOfDay,
        },
        status: {
          in: ['completed', 'settled'],
        },
        ...(branchIds
          ? {
              branch: {
                in: branchIds,
              },
            }
          : {}),
      },
      limit: 50000,
      depth: 1, // Populate branch name
    })

    const csvRows: string[] = []

    // CSV Header row
    csvRows.push(
      [
        'Date',
        'Voucher No',
        'Voucher Type',
        'Branch Name',
        'Party Name',
        'Taxable Value',
        'GST Rate',
        'CGST Amount',
        'SGST Amount',
        'IGST Amount',
        'Round Off',
        'Invoice Total',
      ].join(','),
    )

    for (const bill of result.docs) {
      const billDate = dayjs(bill.createdAt).tz('Asia/Kolkata').format('DD-MM-YYYY')
      const invoiceNo = bill.invoiceNumber
      const branchName =
        typeof bill.branch === 'object' && bill.branch ? (bill.branch as any).name : 'Unknown Branch'

      const customerName = bill.customerDetails?.name?.trim()
      const customerPhone = bill.customerDetails?.phoneNumber?.trim()

      let partyName = 'Cash Sales'
      if (customerName) {
        partyName = customerName
      } else if (customerPhone) {
        partyName = customerPhone
      }

      // Filter out cancelled items
      const activeItems = (bill.items || []).filter((item: any) => item.status !== 'cancelled')
      if (activeItems.length === 0) continue

      // Group items by GST rate
      const taxGroups: Record<number, { taxable: number; gst: number }> = {}
      for (const item of activeItems) {
        const rate = typeof item.gstRate === 'number' ? item.gstRate : 0
        const taxable = typeof item.taxableAmount === 'number' ? item.taxableAmount : 0
        const gst = typeof item.gstAmount === 'number' ? item.gstAmount : 0

        if (!taxGroups[rate]) {
          taxGroups[rate] = { taxable: 0, gst: 0 }
        }
        taxGroups[rate].taxable += taxable
        taxGroups[rate].gst += gst
      }

      const rates = Object.keys(taxGroups).map(Number)

      let filteredRates = rates
      if (gstFilter === 'gst') {
        filteredRates = rates.filter((r) => r > 0)
      } else if (gstFilter === 'nongst') {
        filteredRates = rates.filter((r) => r <= 0)
      }

      if (filteredRates.length === 0) continue

      const invoiceTotal = typeof bill.totalAmount === 'number' ? bill.totalAmount : 0

      // Calculate total item values for rounding calculation
      let sumTaxableAndGst = 0
      for (const rate of rates) {
        sumTaxableAndGst += taxGroups[rate].taxable + taxGroups[rate].gst
      }
      const invoiceRoundOff = invoiceTotal - sumTaxableAndGst

      // Write row for each tax rate group
      filteredRates.forEach((rate, index) => {
        const group = taxGroups[rate]
        const cgst = rate > 0 ? Number((group.gst / 2).toFixed(2)) : 0
        const sgst = rate > 0 ? Number((group.gst / 2).toFixed(2)) : 0
        const igst = 0 // Default to local sales
        const roundOffVal = index === 0 ? Number(invoiceRoundOff.toFixed(2)) : 0

        csvRows.push(
          [
            billDate,
            `"${invoiceNo}"`,
            'Sales',
            `"${branchName}"`,
            `"${partyName.replace(/"/g, '""')}"`,
            group.taxable.toFixed(2),
            rate.toFixed(2),
            cgst.toFixed(2),
            sgst.toFixed(2),
            igst.toFixed(2),
            roundOffVal.toFixed(2),
            invoiceTotal.toFixed(2),
          ].join(','),
        )
      })
    }

    const csvContent = csvRows.join('\r\n')

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=tally_export_${startDateParam}_to_${endDateParam}.csv`,
      },
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate Tally export' }, { status: 500 })
  }
}
