import type { CollectionConfig } from 'payload'

export const TaskCompletions: CollectionConfig = {
  slug: 'task-completions',
  admin: {
    useAsTitle: 'dateString',
    group: 'Work',
    defaultColumns: ['task', 'employee', 'dateString', 'completed', 'completedAt'],
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
        if (!data.employee && data.user) {
          try {
            const userId = typeof data.user === 'string' ? data.user : (data.user as any).id
            const userRes = await req.payload.findByID({ collection: 'users', id: userId })
            if (userRes && (userRes as any).employee) {
              const emp = (userRes as any).employee
              data.employee = typeof emp === 'string' ? emp : emp.id
            }
          } catch (e) {
            req.payload.logger.error({ err: e, msg: 'Error auto-populating employee in TaskCompletions' })
          }
        }

        // Auto-populate branch if missing
        if (!data.branch) {
          if (data.employee) {
            try {
              const empId = typeof data.employee === 'string' ? data.employee : (data.employee as any).id
              const empRes = await req.payload.findByID({ collection: 'employees', id: empId })
              if (empRes && (empRes as any).branch) {
                const b = (empRes as any).branch
                data.branch = typeof b === 'string' ? b : b.id
              }
            } catch (_e) {}
          }
          if (!data.branch && req.user && (req.user as any).branch) {
            const b = (req.user as any).branch
            data.branch = typeof b === 'string' ? b : b.id
          }
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

        // Auto timestamp completedAt
        if (data.completed && !data.completedAt) {
          data.completedAt = new Date().toISOString()
        } else if (!data.completed) {
          data.completedAt = null
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'task',
      type: 'relationship',
      relationTo: 'tasks',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
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
        description: 'Format: YYYY-MM-DD. Timezone independent date log.',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'completed',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Remarks / Notes',
    },
  ],
  timestamps: true,
}

export default TaskCompletions
