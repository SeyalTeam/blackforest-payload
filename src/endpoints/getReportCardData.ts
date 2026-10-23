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
        const whereClause: any = { status: { equals: 'active' } }
        if (role && role !== 'all') {
          whereClause.team = { equals: role }
        }
        if (typeof req.query.branch === 'string' && req.query.branch !== 'all') {
          whereClause.branch = { equals: req.query.branch }
        }
        const empsRes = await req.payload.find({
          collection: 'employees',
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
          limit: 200,
          depth: 0,
          overrideAccess: true,
        })
        targetEmployeeIds = (empsRes.docs || []).map((e) => String(e.id))
      }

      // Resolve date range for requested period to find who worked
      let startDateStr = `${month}-01`
      const [yStr, mStr] = month.split('-')
      const lastDayOfMonth = new Date(parseInt(yStr, 10), parseInt(mStr, 10), 0).getDate()
      let endDateStr = `${month}-${String(lastDayOfMonth).padStart(2, '0')}`

      if (period === 'today') {
        const now = new Date()
        const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
        startDateStr = istNow.toISOString().split('T')[0]
        endDateStr = startDateStr
      } else if (period === 'week') {
        const now = new Date()
        const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
        const day = istNow.getUTCDay()
        const diffToMonday = day === 0 ? -6 : 1 - day
        const ws = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + diffToMonday))
        const we = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + diffToMonday + 6))
        startDateStr = ws.toISOString().split('T')[0]
        endDateStr = we.toISOString().split('T')[0]
      }

      const workedEmployeeIdsSet = new Set<string>()
      try {
        const attWhere: any = {
          and: [
            { dateString: { greater_than_equal: startDateStr } },
            { dateString: { less_than_equal: endDateStr } },
          ],
        }
        if (typeof req.query.branch === 'string' && req.query.branch !== 'all') {
          attWhere.and.push({ loginBranch: { equals: req.query.branch } })
        }
        const attRes = await req.payload.find({
          collection: 'attendance',
          where: attWhere,
          limit: 2000,
          depth: 0,
          overrideAccess: true,
        })
        for (const doc of (attRes.docs || [])) {
          const eId = doc.employee
            ? typeof doc.employee === 'string'
              ? doc.employee
              : String((doc.employee as any).id || (doc.employee as any)._id)
            : ''
          const uId = doc.user
            ? typeof doc.user === 'string'
              ? doc.user
              : String((doc.user as any).id || (doc.user as any)._id)
            : ''
          if (eId) workedEmployeeIdsSet.add(eId)
          if (uId) workedEmployeeIdsSet.add(uId)
        }
      } catch (_attErr) {}

      // If we found employees who worked in this period, prioritize them
      let candidateIds = targetEmployeeIds
      if (workedEmployeeIdsSet.size > 0) {
        const workedCandidates = targetEmployeeIds.filter((id) => workedEmployeeIdsSet.has(id))
        if (workedCandidates.length > 0) {
          candidateIds = workedCandidates
        }
      }

      const idsToCompute = candidateIds.slice(0, 50)
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
        startDateStr,
        endDateStr,
        workedEmployeeIds: Array.from(workedEmployeeIdsSet),
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
