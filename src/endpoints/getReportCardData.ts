import type { PayloadHandler, PayloadRequest } from 'payload'
import { calculateReportCardData } from '../services/reports/reportCard'

export const getReportCardDataHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    let employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : ''
    let userId = typeof req.query.userId === 'string' ? req.query.userId : null
    let role = typeof req.query.role === 'string' ? req.query.role : ''

    if (!userId && req.user) {
      userId = String(req.user.id)
    }

    if (!employeeId && req.user?.employee) {
      employeeId =
        typeof req.user.employee === 'string'
          ? req.user.employee
          : String((req.user.employee as any).id || (req.user.employee as any)._id || '')
    }

    if (!employeeId && userId) {
      try {
        const uDoc = await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
          overrideAccess: true,
        })
        if (uDoc?.employee) {
          employeeId =
            typeof uDoc.employee === 'string'
              ? uDoc.employee
              : String((uDoc.employee as any).id || (uDoc.employee as any)._id || '')
        }
        if (!role && uDoc?.role) {
          role = uDoc.role
        }
      } catch (_e) {}
    }

    if (!role) {
      role = (req.user?.role as string) || 'waiter'
    }

    if (!employeeId) {
      employeeId = userId || (req.user ? String(req.user.id) : '')
    }

    let month = typeof req.query.month === 'string' ? req.query.month : ''
    if (!month || !month.match(/^\d{4}-\d{2}$/)) {
      const now = new Date()
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }

    if (!employeeId) {
      return Response.json(
        { error: 'employeeId parameter is required' },
        { status: 400 },
      )
    }

    if (employeeId === 'all') {
      return Response.json({
        isAll: true,
        month,
        role,
      })
    }

    const data = await calculateReportCardData(req, {
      employeeId,
      userId,
      month,
      role,
    })

    return Response.json(data)
  } catch (error: unknown) {
    req.payload.logger.error({ msg: 'Report Card Data Error', error } as any)
    return Response.json(
      { error: 'Failed to generate report card data' },
      { status: 500 },
    )
  }
}
