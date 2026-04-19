import { PayloadRequest, PayloadHandler } from 'payload'
import { getCategoryWiseReportData } from '../services/reports/categoryWise'

export const getCategoryWiseReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  try {
    const report = await getCategoryWiseReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      category: typeof req.query.category === 'string' ? req.query.category : null,
      department: typeof req.query.department === 'string' ? req.query.department : null,
    })

    payload.logger.info(`Generated Category Wise Report: ${report.stats.length} categories found`)
    return Response.json(report)
  } catch (error: any) {
    payload.logger.error({ msg: 'Category Report Error', error, stack: error.stack })
    return Response.json({ error: 'Failed to generate category report' }, { status: 500 })
  }
}
