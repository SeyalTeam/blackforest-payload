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

    const { taskId, completed, notes, photo, photoUrl } = body || {}
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

    // Fetch task details for title and photo requirement
    let taskTitle = 'Task'
    let requiresPhoto = false
    try {
      const taskDoc = await req.payload.findByID({
        collection: 'tasks',
        id: taskId,
        depth: 0,
      })
      if (taskDoc) {
        if ((taskDoc as any).title) taskTitle = (taskDoc as any).title
        if ((taskDoc as any).requiresPhoto) requiresPhoto = true
      }
    } catch (_e) {}

    const userConditions: any[] = [{ user: { equals: req.user.id } }]
    if (employeeId) {
      userConditions.push({ employee: { equals: employeeId } })
    }

    // Check if daily record already exists for this employee/user on dateString
    const existing = await req.payload.find({
      collection: 'task-completions',
      where: {
        and: [
          { dateString: { equals: dateString } },
          { or: userConditions },
        ],
      },
      limit: 1,
    })

    let updatedDoc: any = null
    let isTaskCompleted = false
    let taskCompletedAt: string | null = null
    let savedPhoto: any = null
    let savedPhotoUrl: string | null = null

    const d = new Date()
    const utcOffset = d.getTime() + (5.5 * 60 * 60 * 1000)
    const localDate = new Date(utcOffset)
    localDate.setUTCHours(0, 0, 0, 0)
    const dateObj = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000))

    if (existing.docs.length > 0) {
      const existingDoc = existing.docs[0]
      const currentTasks: any[] = Array.isArray((existingDoc as any).tasks)
        ? [...(existingDoc as any).tasks]
        : []

      const taskIndex = currentTasks.findIndex((t: any) => {
        const id = typeof t.task === 'string' ? t.task : t.task?.id
        return id === taskId
      })

      if (taskIndex !== -1) {
        isTaskCompleted = completed !== undefined ? Boolean(completed) : !currentTasks[taskIndex].completed
        taskCompletedAt = isTaskCompleted ? (currentTasks[taskIndex].completedAt || new Date().toISOString()) : null

        // If completing and requires photo, ensure a photo is present or provided
        const existingPhoto = currentTasks[taskIndex].photo
        const existingPhotoUrl = currentTasks[taskIndex].photoUrl
        savedPhoto = photo !== undefined ? photo : (existingPhoto || null)
        savedPhotoUrl = photoUrl !== undefined ? photoUrl : (existingPhotoUrl || null)

        if (isTaskCompleted && requiresPhoto && !savedPhoto && !savedPhotoUrl) {
          return Response.json(
            { success: false, message: 'Photo proof is required before marking this task as completed.' },
            { status: 400 },
          )
        }

        currentTasks[taskIndex] = {
          ...currentTasks[taskIndex],
          task: taskId,
          taskTitle,
          completed: isTaskCompleted,
          completedAt: taskCompletedAt,
          photo: isTaskCompleted ? savedPhoto : null,
          photoUrl: isTaskCompleted ? savedPhotoUrl : null,
          notes: notes !== undefined ? notes : (currentTasks[taskIndex].notes || ''),
        }
      } else {
        isTaskCompleted = completed !== undefined ? Boolean(completed) : true
        taskCompletedAt = isTaskCompleted ? new Date().toISOString() : null
        savedPhoto = photo || null
        savedPhotoUrl = photoUrl || null

        if (isTaskCompleted && requiresPhoto && !savedPhoto && !savedPhotoUrl) {
          return Response.json(
            { success: false, message: 'Photo proof is required before marking this task as completed.' },
            { status: 400 },
          )
        }

        currentTasks.push({
          task: taskId,
          taskTitle,
          completed: isTaskCompleted,
          completedAt: taskCompletedAt,
          photo: isTaskCompleted ? savedPhoto : null,
          photoUrl: isTaskCompleted ? savedPhotoUrl : null,
          notes: notes || '',
        })
      }

      updatedDoc = await req.payload.update({
        collection: 'task-completions',
        id: existingDoc.id,
        data: {
          tasks: currentTasks,
        },
      })
    } else {
      isTaskCompleted = completed !== undefined ? Boolean(completed) : true
      taskCompletedAt = isTaskCompleted ? new Date().toISOString() : null
      savedPhoto = photo || null
      savedPhotoUrl = photoUrl || null

      if (isTaskCompleted && requiresPhoto && !savedPhoto && !savedPhotoUrl) {
        return Response.json(
          { success: false, message: 'Photo proof is required before marking this task as completed.' },
          { status: 400 },
        )
      }

      const userBranch = (req.user as any).branch
      const branchId = userBranch
        ? typeof userBranch === 'string'
          ? userBranch
          : userBranch.id
        : undefined

      const initialTasks = [
        {
          task: taskId,
          taskTitle,
          completed: isTaskCompleted,
          completedAt: taskCompletedAt,
          photo: isTaskCompleted ? savedPhoto : null,
          photoUrl: isTaskCompleted ? savedPhotoUrl : null,
          notes: notes || '',
        },
      ]

      updatedDoc = await req.payload.create({
        collection: 'task-completions',
        data: {
          employee: employeeId || undefined,
          user: req.user.id,
          branch: branchId,
          dateString,
          date: dateObj.toISOString(),
          tasks: initialTasks,
        },
      })
    }

    return Response.json({
      success: true,
      completed: isTaskCompleted,
      completedAt: taskCompletedAt,
      photo: isTaskCompleted ? savedPhoto : null,
      photoUrl: isTaskCompleted ? savedPhotoUrl : null,
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
