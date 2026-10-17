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

    const period = typeof req.query.period === 'string' ? req.query.period : undefined
    const branchId =
      typeof req.query.branch === 'string'
        ? req.query.branch
        : typeof req.query.branchId === 'string'
          ? req.query.branchId
          : null
    const branchName =
      typeof req.query.branchName === 'string' ? req.query.branchName : null

    if (employeeId === 'all') {
      let targetEmployeeIds: string[] = []
      if (typeof req.query.employeeIds === 'string' && req.query.employeeIds.trim()) {
        targetEmployeeIds = req.query.employeeIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      } else {
        const whereClause: any = {}
        if (role && role !== 'all') {
          whereClause.team = { equals: role }
        }
        if (typeof req.query.branch === 'string' && req.query.branch !== 'all') {
          whereClause.branch = { equals: req.query.branch }
        }
        const empsRes = await req.payload.find({
          collection: 'employees',
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })
        targetEmployeeIds = (empsRes.docs || []).map((e) => String(e.id))
      }

      const idsToCompute = targetEmployeeIds.slice(0, 50)
      const dataByEmployeeId: Record<string, any> = {}

      await Promise.all(
        idsToCompute.map(async (empId) => {
          try {
            const empData = await calculateReportCardData(req, {
              employeeId: empId,
              month,
              role,
              period,
            })
            dataByEmployeeId[String(empId)] = empData
          } catch (_e) {
            // Ignore failure for individual employee
          }
        }),
      )

      return Response.json({
        isAll: true,
        month,
        role,
        period,
        dataByEmployeeId,
      })
    }

    const data = await calculateReportCardData(req, {
      employeeId,
      userId,
      branchId,
      branchName,
      month,
      role,
      period,
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
