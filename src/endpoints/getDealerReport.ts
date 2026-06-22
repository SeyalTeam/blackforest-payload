import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getDealerReportData } from '../services/reports/dealer'

export const getDealerReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getDealerReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      dealer: typeof req.query.dealer === 'string' ? req.query.dealer : null,
    })

    req.payload.logger.info(`Generated Dealer Report: ${report.groups.length} branch groups found`)
    return Response.json(report)
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
