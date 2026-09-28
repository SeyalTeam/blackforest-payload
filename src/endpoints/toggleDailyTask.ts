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

    // Fetch task details for title, frequency, and photo requirement
    let taskTitle = 'Task'
    let requiresPhoto = false
    let taskFrequency = 'daily'
    try {
      const taskDoc = await req.payload.findByID({
        collection: 'tasks',
        id: taskId,
        depth: 0,
      })
      if (taskDoc) {
        if ((taskDoc as any).title) taskTitle = (taskDoc as any).title
        if ((taskDoc as any).requiresPhoto) requiresPhoto = true
        if ((taskDoc as any).frequency) taskFrequency = (taskDoc as any).frequency
        else if ((taskDoc as any).isDaily === false) taskFrequency = 'weekly'
      }
    } catch (_e) {}

    const userConditions: any[] = [{ user: { equals: req.user.id } }]
    if (employeeId) {
      userConditions.push({ employee: { equals: employeeId } })
    }

    // Time window calculation for current period (IST)
    const [yStr, mStr, dStr] = dateString.split('-')
    const refYear = parseInt(yStr, 10)
    const refMonth = parseInt(mStr, 10)
    const refDay = parseInt(dStr, 10)
    const refDate = new Date(Date.UTC(refYear, refMonth - 1, refDay, 12, 0, 0))
    const dayOfWeek = refDate.getUTCDay() === 0 ? 7 : refDate.getUTCDay()
    const mondayDate = new Date(refDate.getTime() - ((dayOfWeek - 1) * 24 * 60 * 60 * 1000))
    const mondayString = `${mondayDate.getUTCFullYear()}-${String(mondayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(mondayDate.getUTCDate()).padStart(2, '0')}`
    const startOfMonthString = `${yStr}-${mStr}-01`
    const earliestDateString = mondayString < startOfMonthString ? mondayString : startOfMonthString

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
        // Check if an existing completion is from an older hour (for hourly frequency)
        const prevCompletedAt = currentTasks[taskIndex].completedAt
        let isDifferentHour = false
        if (taskFrequency === 'hourly' && prevCompletedAt) {
          const prevDt = new Date(prevCompletedAt)
          const prevIst = new Date(prevDt.getTime() + (5.5 * 60 * 60 * 1000))
          const currIst = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000))
          isDifferentHour =
            prevIst.getUTCHours() !== currIst.getUTCHours() ||
            prevIst.getUTCDate() !== currIst.getUTCDate()
        }

        isTaskCompleted = completed !== undefined ? Boolean(completed) : !currentTasks[taskIndex].completed
        taskCompletedAt = isTaskCompleted
          ? (taskFrequency === 'hourly' || !currentTasks[taskIndex].completed || isDifferentHour
              ? new Date().toISOString()
              : (currentTasks[taskIndex].completedAt || new Date().toISOString()))
          : null

        // If completing and requires photo, ensure a photo is present or provided
        const existingPhoto = isDifferentHour ? null : currentTasks[taskIndex].photo
        const existingPhotoUrl = isDifferentHour ? null : currentTasks[taskIndex].photoUrl
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
          frequency: taskFrequency,
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
          frequency: taskFrequency,
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
          frequency: taskFrequency,
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
          tasks: initialTasks as any,
        },
      })
    }

    // If unmarking (isTaskCompleted === false), also unmark in any earlier document within the current recurrence window
    if (!isTaskCompleted && (taskFrequency === 'weekly' || taskFrequency === 'monthly')) {
      try {
        const periodDocs = await req.payload.find({
          collection: 'task-completions',
          where: {
            and: [
              { dateString: { greater_than_equal: earliestDateString } },
              { dateString: { not_equals: dateString } },
              { or: userConditions },
            ],
          },
          limit: 35,
        })

        for (const pDoc of periodDocs.docs) {
          const pTasks: any[] = Array.isArray((pDoc as any).tasks) ? [...(pDoc as any).tasks] : []
          let changed = false
          for (let i = 0; i < pTasks.length; i++) {
            const tId = typeof pTasks[i].task === 'string' ? pTasks[i].task : pTasks[i].task?.id
            if (tId === taskId && pTasks[i].completed) {
              pTasks[i].completed = false
              pTasks[i].completedAt = null
              changed = true
            }
          }
          if (changed) {
            await req.payload.update({
              collection: 'task-completions',
              id: pDoc.id,
              data: { tasks: pTasks },
            })
          }
        }
      } catch (_e) {}
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
