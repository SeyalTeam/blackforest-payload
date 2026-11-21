import { PayloadHandler } from 'payload'

export const submitTaskAuditHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: any = {}
    try {
      body = await req.json?.()
    } catch (_e) {}

    const {
      taskId,
      photos = [],
      notes,
      branchId: explicitBranchId,
      chefType: explicitChefType,
      status: explicitStatus,
    } = body || {}

    if (!taskId) {
      return Response.json({ success: false, message: 'Missing required field: taskId' }, { status: 400 })
    }

    // 1. Fetch Task Details
    let taskDoc: any = null
    try {
      taskDoc = await req.payload.findByID({
        collection: 'tasks',
        id: taskId,
        depth: 0,
      })
    } catch (e) {
      return Response.json({ success: false, message: 'Task not found' }, { status: 404 })
    }

    const taskTitle = taskDoc?.title || 'Task'
    const taskFrequency = taskDoc?.frequency || 'random'

    // 2. Resolve employee and branch
    let employeeId: string | null = null
    let branchId: string | null = explicitBranchId || null
    let chefType: string = explicitChefType || taskDoc?.chefType || 'kitchen'

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
        employeeId = String(empSearch.docs[0].id)
      }
    }

    if (!branchId && (req.user as any).branch) {
      const ub = (req.user as any).branch
      branchId = typeof ub === 'string' ? ub : ub.id
    }

    if (!branchId && employeeId) {
      try {
        const emp: any = await req.payload.findByID({
          collection: 'employees',
          id: employeeId,
          depth: 0,
        })
        if (emp?.branch) {
          branchId = typeof emp.branch === 'string' ? emp.branch : emp.branch.id
        }
      } catch (_e) {}
    }

    // Format photos array
    const normalizedPhotos = (Array.isArray(photos) ? photos : []).map((item: any) => {
      if (typeof item === 'string') {
        return {
          photoUrl: item,
          capturedAt: new Date().toISOString(),
        }
      }
      return {
        photo: item.photo || item.photoId || item.id || undefined,
        photoUrl: item.photoUrl || item.url || '',
        caption: item.caption || '',
        capturedAt: item.capturedAt || new Date().toISOString(),
      }
    })

    // 3. Create TaskPhotoAudit record
    const auditData: any = {
      task: taskId,
      taskTitle: taskTitle,
      branch: branchId || undefined,
      employee: employeeId || undefined,
      user: req.user.id,
      role: (req.user.role || 'chef').toLowerCase(),
      chefType: chefType,
      photos: normalizedPhotos,
      photoCount: normalizedPhotos.length,
      notes: notes || '',
      status: explicitStatus || 'submitted',
      submittedAt: new Date().toISOString(),
    }

    const createdAudit = await (req.payload.create as any)({
      collection: 'task-photo-audits',
      data: auditData,
    })

    // 4. Also mark completion in TaskCompletions so daily tasks dashboard & tracker reflect it
    const primaryPhotoId = normalizedPhotos[0]?.photo || null
    const primaryPhotoUrl = normalizedPhotos[0]?.photoUrl || ''

    // Compute IST date
    const d = new Date()
    const utcOffset = d.getTime() + (5.5 * 60 * 60 * 1000)
    const localDate = new Date(utcOffset)
    const year = localDate.getUTCFullYear()
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(localDate.getUTCDate()).padStart(2, '0')
    const dateString = `${year}-${month}-${day}`

    try {
      const existingQuery = await req.payload.find({
        collection: 'task-completions',
        where: {
          and: [
            { dateString: { equals: dateString } },
            ...(branchId ? [{ branch: { equals: branchId } }] : []),
          ],
        },
        limit: 1,
      })

      const nowIso = new Date().toISOString()
      const taskEntry: any = {
        task: taskId,
        taskTitle: taskTitle,
        frequency: taskFrequency,
        status: 'yes',
        completed: true,
        completedAt: nowIso,
        photo: primaryPhotoId || undefined,
        photoUrl: primaryPhotoUrl || undefined,
        notes: notes || `Audit photos submitted (${normalizedPhotos.length} photos)`,
      }

      if (existingQuery.docs.length > 0) {
        const doc: any = existingQuery.docs[0]
        const currentTasks = Array.isArray(doc.tasks) ? [...doc.tasks] : []
        const existingIdx = currentTasks.findIndex((t: any) => {
          const tId = typeof t.task === 'string' ? t.task : t.task?.id
          return tId === taskId
        })

        if (existingIdx !== -1) {
          currentTasks[existingIdx] = {
            ...currentTasks[existingIdx],
            ...taskEntry,
          }
        } else {
          currentTasks.push(taskEntry)
        }

        await (req.payload.update as any)({
          collection: 'task-completions',
          id: doc.id,
          data: {
            tasks: currentTasks,
          },
        })
      } else {
        await (req.payload.create as any)({
          collection: 'task-completions',
          data: {
            dateString,
            branch: branchId || undefined,
            user: req.user.id,
            completed: true,
            tasks: [taskEntry],
          },
        })
      }
    } catch (completionErr) {
      console.error('Error synchronizing task completion record:', completionErr)
    }

    return Response.json({
      success: true,
      message: 'Cleaning audit photos submitted and task completed successfully',
      audit: createdAudit,
    })
  } catch (error: any) {
    console.error('Error in submitTaskAuditHandler:', error)
    return Response.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 },
    )
  }
}
