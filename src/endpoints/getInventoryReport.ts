import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getInventoryReportData } from '../services/reports/inventory'

export const getInventoryReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getInventoryReportData(req, {
      department: typeof req.query.department === 'string' ? req.query.department : null,
      category: typeof req.query.category === 'string' ? req.query.category : null,
      product: typeof req.query.product === 'string' ? req.query.product : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
    })

    return Response.json(report)
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json(
      {
        error: 'Failed to generate inventory report',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
