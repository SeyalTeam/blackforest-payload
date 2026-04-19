import { PayloadRequest, PayloadHandler } from 'payload'
import { getBranchBillingReportData } from '../services/reports/branchBilling'

export const getBranchBillingReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  try {
    const report = await getBranchBillingReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
    })

    return Response.json(report)
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
