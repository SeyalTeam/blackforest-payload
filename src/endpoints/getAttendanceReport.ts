import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getAttendanceReportData } from '../services/reports/attendance'

export const getAttendanceReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getAttendanceReportData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      role: typeof req.query.role === 'string' ? req.query.role : null,
      employee: typeof req.query.employee === 'string' ? req.query.employee : null,
      status: typeof req.query.status === 'string' ? req.query.status : null,
    })

    req.payload.logger.info(`Generated Attendance Report: ${report.items.length} records found`)
    return Response.json(report)
  } catch (error: unknown) {
    req.payload.logger.error({ msg: 'Attendance Report Error', error } as any)
    return Response.json({ error: 'Failed to generate attendance report' }, { status: 500 })
  }
}
