import { PayloadHandler } from 'payload'

export const toggleDailyTaskHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: any = {}
    try {
      body = await req.json?.()
    } catch (_e) {}

    const { taskId, completed, notes } = body || {}
    let dateString = body?.dateString

    if (!taskId) {
      return Response.json({ success: false, message: 'Missing taskId' }, { status: 400 })
    }

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

    // Check if task completion record already exists
    const existing = await req.payload.find({
      collection: 'task-completions',
      where: {
        and: [
          { task: { equals: taskId } },
          { dateString: { equals: dateString } },
          { or: userConditions },
        ],
      },
      limit: 1,
    })

    let updatedDoc: any = null
    const d = new Date()
    const utcOffset = d.getTime() + (5.5 * 60 * 60 * 1000)
    const localDate = new Date(utcOffset)
    localDate.setUTCHours(0, 0, 0, 0)
    const dateObj = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000))

    if (existing.docs.length > 0) {
      const existingDoc = existing.docs[0]
      const newCompleted = completed !== undefined ? Boolean(completed) : !existingDoc.completed
      const completedAt = newCompleted
        ? existingDoc.completedAt || new Date().toISOString()
        : null

      updatedDoc = await req.payload.update({
        collection: 'task-completions',
        id: existingDoc.id,
        data: {
          completed: newCompleted,
          completedAt,
          notes: notes !== undefined ? notes : existingDoc.notes,
        },
      })
    } else {
      const newCompleted = completed !== undefined ? Boolean(completed) : true
      const completedAt = newCompleted ? new Date().toISOString() : null

      const userBranch = (req.user as any).branch
      const branchId = userBranch
        ? typeof userBranch === 'string'
          ? userBranch
          : userBranch.id
        : undefined

      updatedDoc = await req.payload.create({
        collection: 'task-completions',
        data: {
          task: taskId,
          employee: employeeId,
          user: req.user.id,
          branch: branchId,
          dateString,
          date: dateObj.toISOString(),
          completed: newCompleted,
          completedAt,
          notes: notes || '',
        },
      })
    }

    return Response.json({
      success: true,
      completed: Boolean(updatedDoc?.completed),
      completedAt: updatedDoc?.completedAt || null,
      doc: updatedDoc,
    })
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Error in toggleDailyTaskHandler',
    })
    return Response.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
