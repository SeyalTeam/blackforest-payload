import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getClosingEntryReportData } from '../services/reports/closingEntry'

export const getClosingEntryReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getClosingEntryReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
    })

    return Response.json(report)
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ error: 'Failed to generate closing entry report' }, { status: 500 })
  }
}
