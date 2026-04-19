import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getExpenseReportData } from '../services/reports/expense'

export const getExpenseReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getExpenseReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      category: typeof req.query.category === 'string' ? req.query.category : null,
    })

    req.payload.logger.info(`Generated Expense Report: ${report.groups.length} branch groups found`)
    return Response.json(report)
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
