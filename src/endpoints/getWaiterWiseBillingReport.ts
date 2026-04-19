import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getWaiterWiseBillingReportData } from '../services/reports/waiterWise'

export const getWaiterWiseBillingReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getWaiterWiseBillingReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      waiter: typeof req.query.waiter === 'string' ? req.query.waiter : null,
      hour: typeof req.query.hour === 'string' ? req.query.hour : null,
    })

    req.payload.logger.info(`Generated Waiter Wise Report: ${report.stats.length} waiters found`)
    return Response.json(report)
  } catch (error: unknown) {
    req.payload.logger.error({ msg: 'Waiter Wise Report Error', error } as any)
    return Response.json({ error: 'Failed to generate waiter wise report' }, { status: 500 })
  }
}
