import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getReturnOrderReportData } from '../services/reports/returnOrder'

export const getReturnOrderReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getReturnOrderReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      status: typeof req.query.status === 'string' ? req.query.status : null,
    })

    req.payload.logger.info(`Generated Return Order Report: ${report.groups.length} branch groups found`)
    return Response.json(report)
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ error: 'Failed to generate return order report' }, { status: 500 })
  }
}
