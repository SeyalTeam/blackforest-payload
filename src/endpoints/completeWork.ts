import { PayloadHandler } from 'payload'

export const completeWorkHandler: PayloadHandler = async (req): Promise<Response> => {
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
    const attSearch = await req.payload.find({
      collection: 'attendance',
      where: {
        and: [
          { dateString: { equals: dateString } },
          { or: userConditions },
        ],
      },
      limit: 1,
    })

    const nowIso = new Date().toISOString()
    let workDurationMinutes = 0
    let workStartTime = nowIso
    let attendanceId: string | null = null

    if (attSearch.docs.length > 0) {
      const attDoc = attSearch.docs[0]
      attendanceId = attDoc.id
      workStartTime = (attDoc as any).workStartTime || nowIso
      const startMs = new Date(workStartTime).getTime()
      const endMs = new Date(nowIso).getTime()
      workDurationMinutes = Math.max(0, Math.round((endMs - startMs) / (1000 * 60)))

      await req.payload.update({
        collection: 'attendance',
        id: attDoc.id,
        data: {
          workStatus: 'completed',
          workCompletedTime: nowIso,
          workDurationMinutes,
        },
        overrideAccess: true,
      })
    }

    // Also sync to task-completions collection for today if exists
    try {
      const compSearch = await req.payload.find({
        collection: 'task-completions',
        where: {
          and: [
            { dateString: { equals: dateString } },
            { or: userConditions },
          ],
        },
        limit: 1,
      })

      if (compSearch.docs.length > 0) {
        await req.payload.update({
          collection: 'task-completions',
          id: compSearch.docs[0].id,
          data: {
            notes: (compSearch.docs[0] as any).notes || `Work completed at ${nowIso}`,
          },
          overrideAccess: true,
        })
      }
    } catch (_compErr) {}

    return Response.json({
      success: true,
      message: 'Work officially completed and recorded in Attendance!',
      workStatus: 'completed',
      workStartTime,
      workCompletedTime: nowIso,
      workDurationMinutes,
      attendanceId,
      dateString,
    })
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Error in completeWorkHandler',
    })
    return Response.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
