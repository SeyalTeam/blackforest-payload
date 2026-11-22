import { PayloadHandler } from 'payload'

export const getLiveStaffForCheckingHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    // 1. Calculate today's date in IST
    const now = new Date()
    const utcOffset = now.getTime() + 5.5 * 60 * 60 * 1000
    const localDate = new Date(utcOffset)
    const year = localDate.getUTCFullYear()
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(localDate.getUTCDate()).padStart(2, '0')
    const todayDateString = `${year}-${month}-${day}`

    // 2. Fetch today's attendance records
    const attendanceRes = await req.payload.find({
      collection: 'attendance',
      where: {
        dateString: { equals: todayDateString },
      },
      limit: 1000,
      depth: 2,
    })

    // 3. Filter only staff who are currently LIVE (active session, NOT punched out)
    const liveStaffList: any[] = []

    for (const doc of attendanceRes.docs as any[]) {
      const activities = Array.isArray(doc.activities) ? doc.activities : []
      const sessions = activities.filter((a: any) => a.type === 'session')

      // Check if there is an active session without punchOut
      const hasActiveSession = sessions.some(
        (s: any) => s.punchIn && (!s.punchOut || s.status === 'active'),
      )

      // Strict user rule: "பஞ்ச் அவுட் பண்ணிட்டாங்கன்னா அவங்க நேம் வரக்கூடாது"
      // If no active session, skip
      if (!hasActiveSession) continue

      // Resolve Employee Info
      const empDoc = doc.employee && typeof doc.employee === 'object' ? doc.employee : null
      const userDoc = doc.user && typeof doc.user === 'object' ? doc.user : null
      const branchDoc =
        doc.loginBranch && typeof doc.loginBranch === 'object'
          ? doc.loginBranch
          : doc.branch && typeof doc.branch === 'object'
          ? doc.branch
          : null

      const employeeId = empDoc?.id || (typeof doc.employee === 'string' ? doc.employee : '')
      const employeeName = empDoc?.name || userDoc?.name || doc.userName || 'Employee'
      const userId = userDoc?.id || (typeof doc.user === 'string' ? doc.user : '')
      const rawRole =
        empDoc?.team || userDoc?.role || doc.userRole || (userDoc?.isChef ? 'chef' : 'waiter')
      const role = String(rawRole).toLowerCase().trim()

      const branchId =
        branchDoc?.id ||
        (typeof doc.loginBranch === 'string'
          ? doc.loginBranch
          : typeof doc.branch === 'string'
          ? doc.branch
          : '')
      const branchName = branchDoc?.name || doc.branchName || doc.loginBranchName || 'Main Branch'

      const firstSession = sessions[0]
      const firstPunchIn = firstSession?.punchIn || doc.firstPunchIn || ''

      liveStaffList.push({
        attendanceId: doc.id,
        employeeId,
        employeeName,
        userId,
        role,
        branchId,
        branchName,
        firstPunchIn,
        status: doc.status || 'active',
      })
    }

    // 4. Fetch all audits for today to map audit status: check_in | waiting | updated
    const startOfTodayIso = new Date(Date.UTC(year, localDate.getUTCMonth(), localDate.getUTCDate(), 0, 0, 0)).toISOString()

    const auditsRes = await req.payload.find({
      collection: 'task-photo-audits',
      where: {
        createdAt: { greater_than_equal: startOfTodayIso },
      },
      limit: 1000,
      depth: 1,
      sort: '-createdAt',
    })

    const audits = auditsRes.docs as any[]

    // Map audits to each live staff
    const staffWithAudits = liveStaffList.map((staff) => {
      // Find latest audit for this staff member
      const staffAudits = audits.filter((a) => {
        const aEmpId = a.employee && typeof a.employee === 'object' ? a.employee.id : a.employee
        const aUserId = a.user && typeof a.user === 'object' ? a.user.id : a.user
        return (
          (staff.employeeId && aEmpId === staff.employeeId) ||
          (staff.userId && aUserId === staff.userId)
        )
      })

      const latestAudit = staffAudits[0] || null

      let auditState: 'check_in' | 'waiting' | 'updated' = 'check_in'
      if (latestAudit) {
        if (latestAudit.status === 'pending') {
          auditState = 'waiting'
        } else if (
          latestAudit.status === 'submitted' ||
          latestAudit.status === 'verified' ||
          latestAudit.status === 'flagged' ||
          (latestAudit.photos && latestAudit.photos.length > 0)
        ) {
          auditState = 'updated'
        }
      }

      return {
        ...staff,
        auditState,
        latestAudit: latestAudit
          ? {
              id: latestAudit.id,
              taskTitle: latestAudit.taskTitle,
              status: latestAudit.status,
              photoCount: latestAudit.photoCount || latestAudit.photos?.length || 0,
              photos: latestAudit.photos || [],
              notes: latestAudit.notes || '',
              requestedAt: latestAudit.createdAt,
              submittedAt: latestAudit.submittedAt,
            }
          : null,
      }
    })

    return Response.json({
      success: true,
      dateString: todayDateString,
      count: staffWithAudits.length,
      staff: staffWithAudits,
    })
  } catch (error: any) {
    req.payload.logger.error({ msg: 'Error getting live staff for checking', error })
    return Response.json(
      { success: false, message: error.message || 'Internal error' },
      { status: 500 },
    )
  }
}

export const triggerCheckingAuditHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: any = {}
    try {
      body = await req.json?.()
    } catch (_e) {}

    const { employeeId, userId, branchId, role = 'chef', chefType = 'kitchen' } = body || {}

    if (!employeeId && !userId) {
      return Response.json(
        { success: false, message: 'Missing employeeId or userId' },
        { status: 400 },
      )
    }

    const cleanRole = String(role).toLowerCase().trim()
    const isWaiter = cleanRole.includes('waiter') || cleanRole.includes('billing')
    const taskTitle = isWaiter
      ? 'Table Cleaning Audit'
      : cleanRole.includes('chef')
      ? 'Mandatory Kitchen Cleaning Audit'
      : 'Sudden Cleaning Audit'

    // Create a pending audit request
    const auditData: any = {
      taskTitle,
      employee: employeeId || undefined,
      user: userId || undefined,
      branch: branchId || undefined,
      role: cleanRole,
      chefType: isWaiter ? 'both' : chefType,
      status: 'pending',
      photoCount: 0,
      photos: [],
      notes: 'Sudden inspection triggered manually from Admin Checking Menu',
      createdAt: new Date().toISOString(),
    }

    const created = await (req.payload.create as any)({
      collection: 'task-photo-audits',
      data: auditData,
    })

    return Response.json({
      success: true,
      message: 'Sudden inspection triggered successfully',
      audit: created,
    })
  } catch (error: any) {
    req.payload.logger.error({ msg: 'Error triggering sudden audit', error })
    return Response.json(
      { success: false, message: error.message || 'Failed to trigger audit' },
      { status: 500 },
    )
  }
}

export const getPendingAuditForAppHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : null
    const userId =
      typeof req.query.userId === 'string'
        ? req.query.userId
        : req.user
        ? String(req.user.id)
        : null
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : null
    const role = typeof req.query.role === 'string' ? req.query.role.toLowerCase() : null

    const conditions: any[] = [{ status: { equals: 'pending' } }]

    if (employeeId && userId) {
      conditions.push({
        or: [{ employee: { equals: employeeId } }, { user: { equals: userId } }],
      })
    } else if (employeeId) {
      conditions.push({ employee: { equals: employeeId } })
    } else if (userId) {
      conditions.push({ user: { equals: userId } })
    } else if (branchId) {
      conditions.push({ branch: { equals: branchId } })
    }

    // Only look for audits from the last 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    conditions.push({ createdAt: { greater_than_equal: twelveHoursAgo } })

    const auditsRes = await req.payload.find({
      collection: 'task-photo-audits',
      where: {
        and: conditions,
      },
      sort: '-createdAt',
      limit: 1,
      depth: 1,
    })

    if (auditsRes.docs.length > 0) {
      const pendingAudit: any = auditsRes.docs[0]
      return Response.json({
        success: true,
        hasPendingAudit: true,
        audit: {
          id: pendingAudit.id,
          taskTitle: pendingAudit.taskTitle,
          role: pendingAudit.role,
          chefType: pendingAudit.chefType,
          branch: pendingAudit.branch,
          createdAt: pendingAudit.createdAt,
        },
      })
    }

    return Response.json({
      success: true,
      hasPendingAudit: false,
    })
  } catch (error: any) {
    req.payload.logger.error({ msg: 'Error getting pending audits for app', error })
    return Response.json(
      { success: false, message: error.message || 'Error checking pending audits' },
      { status: 500 },
    )
  }
}
