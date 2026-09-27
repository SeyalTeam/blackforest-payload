import type { CollectionConfig } from 'payload'

export const TaskCompletions: CollectionConfig = {
  slug: 'task-completions',
  admin: {
    useAsTitle: 'title',
    group: 'Work',
    defaultColumns: ['title', 'employeeName', 'dateString', 'completedCount', 'totalCount', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (['superadmin', 'admin', 'company', 'account'].includes(user.role)) return true
      if (user.role === 'branch') {
        return {
          'user.branch': {
            equals: user.branch,
          },
        } as any
      }
      return {
        user: {
          equals: user.id,
        },
      } as any
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) =>
      user?.role ? ['superadmin', 'admin'].includes(user.role) : false,
  },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return data

        // Auto-populate user if missing
        if (!data.user && req.user) {
          data.user = req.user.id
        }

        // Auto-populate employee from user if missing
        let resolvedEmpName = data.employeeName || ''
        if (!data.employee && data.user) {
          try {
            const userId = typeof data.user === 'string' ? data.user : (data.user as any).id
            const userRes = await req.payload.findByID({ collection: 'users', id: userId })
            if (userRes) {
              if ((userRes as any).employee) {
                const emp = (userRes as any).employee
                data.employee = typeof emp === 'string' ? emp : emp.id
              }
              if (!resolvedEmpName) {
                resolvedEmpName = userRes.name || userRes.email || ''
              }
            }
          } catch (e) {
            req.payload.logger.error({ err: e, msg: 'Error auto-populating employee in TaskCompletions' })
          }
        }

        // Auto-populate employee name from employee doc if available
        if (data.employee) {
          try {
            const empId = typeof data.employee === 'string' ? data.employee : (data.employee as any).id
            const empRes = await req.payload.findByID({ collection: 'employees', id: empId })
            if (empRes) {
              resolvedEmpName = empRes.name || resolvedEmpName
              if (!data.branch && (empRes as any).branch) {
                const b = (empRes as any).branch
                data.branch = typeof b === 'string' ? b : b.id
              }
            }
          } catch (_e) {}
        }

        if (!resolvedEmpName && req.user) {
          resolvedEmpName = (req.user as any).name || (req.user as any).email || 'Staff'
        }
        data.employeeName = resolvedEmpName

        // Auto-populate branch if missing
        if (!data.branch && req.user && (req.user as any).branch) {
          const b = (req.user as any).branch
          data.branch = typeof b === 'string' ? b : b.id
        }

        // Auto-populate date / dateString if missing (IST Normalized)
        if (!data.dateString) {
          const d = new Date()
          const utcOffset = d.getTime() + (5.5 * 60 * 60 * 1000)
          const localDate = new Date(utcOffset)
          const year = localDate.getUTCFullYear()
          const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
          const day = String(localDate.getUTCDate()).padStart(2, '0')
          data.dateString = `${year}-${month}-${day}`
        }

        if (!data.date) {
          const d = new Date()
          const utcOffset = d.getTime() + (5.5 * 60 * 60 * 1000)
          const localDate = new Date(utcOffset)
          localDate.setUTCHours(0, 0, 0, 0)
          data.date = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000))
        }

        // Calculate completed count and total count
        const tasksList: any[] = Array.isArray(data.tasks) ? data.tasks : []
        data.completedCount = tasksList.filter((t: any) => t.completed).length
        data.totalCount = tasksList.length

        // Compute title: e.g. "Karthik (Manager) - 2026-09-27"
        const roleLabel = (req.user as any)?.role ? ` (${(req.user as any).role})` : ''
        data.title = `${data.employeeName}${roleLabel} - ${data.dateString}`

        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'employeeName',
      type: 'text',
      label: 'Employee Name',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: false,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'dateString',
      type: 'text',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Format: YYYY-MM-DD. Timezone independent date log.',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'completedCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'totalCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'tasks',
      type: 'array',
      label: 'Completed Tasks Today',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'task',
              type: 'relationship',
              relationTo: 'tasks',
              required: true,
              admin: { width: '28%' },
            },
            {
              name: 'taskTitle',
              type: 'text',
              label: 'Task Title',
              admin: { width: '20%' },
            },
            {
              name: 'frequency',
              type: 'select',
              options: [
                { label: 'Daily', value: 'daily' },
                { label: 'Weekly', value: 'weekly' },
                { label: 'Monthly', value: 'monthly' },
                { label: 'Hourly', value: 'hourly' },
              ],
              defaultValue: 'daily',
              admin: { width: '12%' },
            },
            {
              name: 'completed',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '8%' },
            },
            {
              name: 'completedAt',
              type: 'date',
              admin: {
                width: '16%',
                date: {
                  pickerAppearance: 'dayAndTime',
                },
              },
            },
            {
              name: 'photo',
              type: 'upload',
              relationTo: 'media',
              label: 'Photo Proof',
              admin: {
                width: '16%',
              },
            },
          ],
        },
        {
          name: 'photoUrl',
          type: 'text',
          label: 'Photo URL',
          admin: {
            description: 'Direct public URL to proof image',
          },
        },
        {
          name: 'notes',
          type: 'text',
          label: 'Notes / Remarks',
        },
      ],
    },
  ],
  timestamps: true,
}

export default TaskCompletions
