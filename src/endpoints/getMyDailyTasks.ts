import { PayloadHandler } from 'payload'

export const getMyDailyTasksHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url!)
    let dateString = url.searchParams.get('dateString')
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
    let employeeRole: string = req.user.role || ''
    let employeeBranch: string | null = null

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

    let employeeDoc: any = null
    if (employeeId) {
      try {
        employeeDoc = await req.payload.findByID({
          collection: 'employees',
          id: employeeId,
          depth: 0,
        })
        if (employeeDoc) {
          if (employeeDoc.team) {
            employeeRole = employeeDoc.team
          }
          if (employeeDoc.branch) {
            employeeBranch =
              typeof employeeDoc.branch === 'string' ? employeeDoc.branch : employeeDoc.branch.id
          }
        }
      } catch (_e) {}
    }

    if (!employeeBranch && (req.user as any).branch) {
      const ub = (req.user as any).branch
      employeeBranch = typeof ub === 'string' ? ub : ub.id
    }

    const normalizedRole = employeeRole.toLowerCase().trim()
    const userRole = (req.user?.role || '').toLowerCase().trim()
    const requestedRole = (url.searchParams.get('role') || '').toLowerCase().trim()

    // Query tasks (fetch all and filter in JS to avoid database-level null/exists filter issues)
    const taskQuery = await req.payload.find({
      collection: 'tasks',
      limit: 500,
      depth: 1,
    })

    // Filter tasks based on assignment and branch
    const matchedTasks = taskQuery.docs.filter((task: any) => {
      // Respect explicit deactivation
      if (task.isActive === false) return false

      // Branch check: if task has branch, must match employee/user branch
      if (task.branch) {
        const taskBranchId = typeof task.branch === 'string' ? task.branch : task.branch.id
        if (employeeBranch && taskBranchId !== employeeBranch) {
          return false
        }
      }

      const colRole =
        typeof task.column === 'object' && task.column?.role
          ? String(task.column.role).toLowerCase().trim()
          : ''
      const colTitle =
        typeof task.column === 'object' && task.column?.title
          ? String(task.column.title).toLowerCase().trim()
          : ''
      const assignedRole = task.assignedRole ? String(task.assignedRole).toLowerCase().trim() : ''
      const taskRole = assignedRole || colRole || colTitle

      const tEmp = task.assignedEmployee
      const taskEmpId = tEmp ? (typeof tEmp === 'string' ? tEmp : tEmp.id) : null
      const tUser = task.assignedUser
      const taskUserId = tUser ? (typeof tUser === 'string' ? tUser : tUser.id) : null

      const assignmentType = task.assignmentType || 'role'

      // Check if individual match
      const matchesInd =
        (employeeId && taskEmpId === employeeId) ||
        (req.user.id && taskUserId === req.user.id)

      // Check if role match
      const matchesRole =
        taskRole === 'all' ||
        taskRole === normalizedRole ||
        taskRole === userRole ||
        (requestedRole && (taskRole === requestedRole || colRole === requestedRole)) ||
        (userRole === 'manager' && (taskRole === 'manager' || colRole === 'manager' || colTitle === 'manager')) ||
        userRole === 'superadmin' ||
        userRole === 'admin'

      if (assignmentType === 'individual') {
        return matchesInd
      }

      if (assignmentType === 'role') {
        return matchesRole
      }

      if (assignmentType === 'both') {
        return matchesInd || matchesRole
      }

      if (assignmentType === 'unassigned') {
        return true
      }

      return matchesInd || matchesRole
    })

    // Calculate time windows for frequency evaluation (IST normalized)
    const [yStr, mStr, dStr] = dateString.split('-')
    const refYear = parseInt(yStr, 10)
    const refMonth = parseInt(mStr, 10)
    const refDay = parseInt(dStr, 10)

    const nowD = new Date()
    const utcOffset = nowD.getTime() + (5.5 * 60 * 60 * 1000)
    const nowIst = new Date(utcOffset)
    const currentHour = String(nowIst.getUTCHours()).padStart(2, '0')

    const currentMonthStr = `${yStr}-${mStr}`
    const startOfMonthString = `${yStr}-${mStr}-01`

    // Calculate Monday and Sunday of the current week (ISO: Monday = 1, Sunday = 7)
    const refDate = new Date(Date.UTC(refYear, refMonth - 1, refDay, 12, 0, 0))
    const dayOfWeek = refDate.getUTCDay() === 0 ? 7 : refDate.getUTCDay()
    const mondayDate = new Date(refDate.getTime() - ((dayOfWeek - 1) * 24 * 60 * 60 * 1000))
    const mYear = mondayDate.getUTCFullYear()
    const mMonth = String(mondayDate.getUTCMonth() + 1).padStart(2, '0')
    const mDay = String(mondayDate.getUTCDate()).padStart(2, '0')
    const mondayString = `${mYear}-${mMonth}-${mDay}`

    const sundayDate = new Date(refDate.getTime() + ((7 - dayOfWeek) * 24 * 60 * 60 * 1000))
    const sYear = sundayDate.getUTCFullYear()
    const sMonth = String(sundayDate.getUTCMonth() + 1).padStart(2, '0')
    const sDay = String(sundayDate.getUTCDate()).padStart(2, '0')
    const sundayString = `${sYear}-${sMonth}-${sDay}`

    // Earliest date needed to check weekly and monthly completions
    const earliestDateString = mondayString < startOfMonthString ? mondayString : startOfMonthString

    // Fetch completion logs for this employee or user in current period
    let completions: any[] = []
    if (employeeId || req.user.id) {
      const orConditions: any[] = []
      if (employeeId) {
        orConditions.push({ employee: { equals: employeeId } })
      }
      if (req.user.id) {
        orConditions.push({ user: { equals: req.user.id } })
      }

      const completionsRes = await req.payload.find({
        collection: 'task-completions',
        where: {
          and: [
            { dateString: { greater_than_equal: earliestDateString } },
            { dateString: { less_than_equal: dateString } },
            { or: orConditions },
          ],
        },
        limit: 100,
        depth: 1,
      })
      completions = completionsRes.docs
    }

    const resultTasks = matchedTasks.map((task: any) => {
      const taskFreq = (task.frequency || (task.isDaily === false ? 'weekly' : 'daily')).toLowerCase().trim()

      let activeComp: any = null
      let activeDoc: any = null

      // Search through completions to check if completed in current recurrence period
      for (const doc of completions) {
        const docDateStr = doc.dateString || ''
        const tasksList: any[] = Array.isArray(doc.tasks) ? doc.tasks : []

        // 1. Check inside tasks array
        for (const tItem of tasksList) {
          const tId = typeof tItem.task === 'string' ? tItem.task : tItem.task?.id
          if (tId === task.id && tItem.completed === true) {
            let isMatch = false
            if (taskFreq === 'hourly') {
              if (docDateStr === dateString && tItem.completedAt) {
                const compDt = new Date(tItem.completedAt)
                const compIst = new Date(compDt.getTime() + (5.5 * 60 * 60 * 1000))
                const compHour = String(compIst.getUTCHours()).padStart(2, '0')
                isMatch = compHour === currentHour
              }
            } else if (taskFreq === 'daily') {
              isMatch = docDateStr === dateString
            } else if (taskFreq === 'weekly') {
              isMatch = docDateStr >= mondayString && docDateStr <= sundayString
            } else if (taskFreq === 'monthly') {
              isMatch = docDateStr.startsWith(currentMonthStr)
            } else {
              isMatch = docDateStr === dateString
            }

            if (isMatch) {
              activeComp = tItem
              activeDoc = doc
              break
            }
          }
        }
        if (activeComp) break

        // 2. Legacy fallback: doc has single task
        const singleTaskId = typeof doc.task === 'string' ? doc.task : doc.task?.id
        if (singleTaskId === task.id && doc.completed === true) {
          let isMatch = false
          if (taskFreq === 'hourly') {
            if (docDateStr === dateString && doc.completedAt) {
              const compDt = new Date(doc.completedAt)
              const compIst = new Date(compDt.getTime() + (5.5 * 60 * 60 * 1000))
              const compHour = String(compIst.getUTCHours()).padStart(2, '0')
              isMatch = compHour === currentHour
            }
          } else if (taskFreq === 'daily') {
            isMatch = docDateStr === dateString
          } else if (taskFreq === 'weekly') {
            isMatch = docDateStr >= mondayString && docDateStr <= sundayString
          } else if (taskFreq === 'monthly') {
            isMatch = docDateStr.startsWith(currentMonthStr)
          } else {
            isMatch = docDateStr === dateString
          }

          if (isMatch) {
            activeComp = doc
            activeDoc = doc
            break
          }
        }
      }

      const isCompleted = activeComp !== null
      const compPhoto = activeComp?.photo
      const compPhotoUrl =
        activeComp?.photoUrl ||
        (typeof compPhoto === 'object' && compPhoto !== null
          ? compPhoto.url || compPhoto.thumbnailURL
          : null)

      return {
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        frequency: taskFreq,
        isDaily: taskFreq === 'daily',
        requiresPhoto: Boolean(task.requiresPhoto),
        assignmentType: task.assignmentType || 'role',
        assignedRole: task.assignedRole || null,
        dueDate: task.dueDate || null,
        checklist: task.checklist || [],
        completed: isCompleted,
        completedAt: activeComp?.completedAt || null,
        completionId: activeDoc?.id || null,
        photo: compPhoto ? (typeof compPhoto === 'string' ? compPhoto : compPhoto.id) : null,
        photoUrl: compPhotoUrl || null,
        notes: activeComp?.notes || '',
      }
    })

    return Response.json({
      success: true,
      dateString,
      employeeId,
      employeeRole,
      tasks: resultTasks,
    })
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Error in getMyDailyTasksHandler',
    })
    return Response.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
