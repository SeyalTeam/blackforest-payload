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

    // Fetch completion logs for this employee or user on dateString
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
            { dateString: { equals: dateString } },
            { or: orConditions },
          ],
        },
        limit: 500,
        depth: 0,
      })
      completions = completionsRes.docs
    }

    const completionMap: Record<string, any> = {}
    completions.forEach((c: any) => {
      // 1. New structure: tasks array inside the single daily document
      if (Array.isArray(c.tasks)) {
        c.tasks.forEach((tItem: any) => {
          const tId = typeof tItem.task === 'string' ? tItem.task : tItem.task?.id
          if (tId) {
            completionMap[tId] = tItem
          }
        })
      }
      // 2. Legacy fallback: single task per doc
      const singleTaskId = typeof c.task === 'string' ? c.task : c.task?.id
      if (singleTaskId && !completionMap[singleTaskId]) {
        completionMap[singleTaskId] = c
      }
    })

    const resultTasks = matchedTasks.map((task: any) => {
      const comp = completionMap[task.id]
      return {
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        isDaily: task.isDaily !== false,
        assignmentType: task.assignmentType || 'role',
        assignedRole: task.assignedRole || null,
        dueDate: task.dueDate || null,
        checklist: task.checklist || [],
        completed: Boolean(comp?.completed),
        completedAt: comp?.completedAt || null,
        completionId: comp?.id || null,
        notes: comp?.notes || '',
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
