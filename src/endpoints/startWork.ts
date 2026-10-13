import { PayloadHandler } from 'payload'

export const startWorkHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: any = {}
    try {
      body = await req.json?.()
    } catch (_e) {}

    let dateString = body?.dateString
    if (!dateString) {
      const d = new Date()
      const utcOffset = d.getTime() + (5.5 * 60 * 60 * 1000)
      const localDate = new Date(utcOffset)
      const year = localDate.getUTCFullYear()
      const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
      const day = String(localDate.getUTCDate()).padStart(2, '0')
      dateString = `${year}-${month}-${day}`
    }

    // Resolve employee
    let employeeId: string | null = null
    const userEmp = (req.user as any).employee
    if (userEmp) {
      employeeId = typeof userEmp === 'string' ? userEmp : userEmp.id
    }

    if (!employeeId) {
      const empSearch = await req.payload.find({
        collection: 'employees',
        where: {
          or: [
            { phoneNumber: { equals: (req.user as any).phone || (req.user as any).phoneNumber || '__none__' } },
            { employeeId: { equals: (req.user as any).employeeId || '__none__' } },
          ],
        },
        limit: 1,
      })
      if (empSearch.docs.length > 0) {
        employeeId = empSearch.docs[0].id
      }
    }

    const userConditions: any[] = [{ user: { equals: req.user.id } }]
    if (employeeId) {
      userConditions.push({ employee: { equals: employeeId } })
    }

    // Find today's attendance document
    let attSearch = await req.payload.find({
      collection: 'attendance',
      where: {
        and: [
          { dateString: { equals: dateString } },
          { or: userConditions },
        ],
      },
      limit: 1,
    })

    if (attSearch.docs.length === 0) {
      // Fallback: look for attendance record for this user/employee created in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      attSearch = await req.payload.find({
        collection: 'attendance',
        where: {
          and: [
            { createdAt: { greater_than_equal: oneDayAgo } },
            { or: userConditions },
          ],
        },
        sort: '-createdAt',
        limit: 1,
      })
    }

    if (attSearch.docs.length === 0) {
      return Response.json({
        success: false,
        message: 'No attendance record found for today. Please punch in attendance before starting work.',
      }, { status: 400 })
    }

    const attDoc = attSearch.docs[0]
    const nowIso = new Date().toISOString()
    const currentStartTime = (attDoc as any).workStartTime || nowIso

    const updated = await req.payload.update({
      collection: 'attendance',
      id: attDoc.id,
      data: {
        workStatus: 'in_progress',
        workStartTime: currentStartTime,
      },
      overrideAccess: true,
    })

    return Response.json({
      success: true,
      message: 'Work officially started!',
      workStatus: 'in_progress',
      workStartTime: currentStartTime,
      attendanceId: attDoc.id,
      dateString,
    })
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Error in startWorkHandler',
    })
    return Response.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
