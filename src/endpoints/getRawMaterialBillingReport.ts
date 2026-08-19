import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getRawMaterialBillingReportData } from '../services/reports/rawMaterialBilling'

export const getRawMaterialBillingReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getRawMaterialBillingReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      plannedStartDate: typeof req.query.plannedStartDate === 'string' ? req.query.plannedStartDate : null,
      plannedEndDate: typeof req.query.plannedEndDate === 'string' ? req.query.plannedEndDate : null,
      company: typeof req.query.company === 'string' ? req.query.company : null,
      dealer: typeof req.query.dealer === 'string' ? req.query.dealer : null,
    })

    req.payload.logger.info(`Generated Raw Material Billing Report: ${report.groups.length} company groups found`)
    return Response.json(report)
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
