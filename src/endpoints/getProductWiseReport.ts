import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getProductWiseReportData } from '../services/reports/productWise'

export const getProductWiseReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getProductWiseReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      category: typeof req.query.category === 'string' ? req.query.category : null,
      department: typeof req.query.department === 'string' ? req.query.department : null,
      product: typeof req.query.product === 'string' ? req.query.product : null,
      chefId: typeof req.query.chefId === 'string' ? req.query.chefId : null,
      kitchenId: typeof req.query.kitchenId === 'string' ? req.query.kitchenId : null,
    })

    req.payload.logger.info(`Generated Product Wise Report: ${report.stats.length} products found`)
    return Response.json(report)
  } catch (error: unknown) {
    const resolvedError = error as Error
    req.payload.logger.error({
      msg: 'Product Report Error',
      error: resolvedError,
      stack: resolvedError?.stack,
    })
    return Response.json({ error: 'Failed to generate product report' }, { status: 500 })
  }
}
