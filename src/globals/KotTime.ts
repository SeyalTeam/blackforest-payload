import type { GlobalConfig } from 'payload'

export const KotTimeGlobal: GlobalConfig = {
  slug: 'kot-time',
  label: 'KOT Time',
  admin: {
    group: 'Settings',
    description: 'Configure standard KOT timings: Supervisor confirming time and Waiter deliver time per branch.',
  },
  access: {
    read: () => true,
    update: ({ req }) =>
      Boolean(
        req.user &&
          ['superadmin', 'admin', 'manager', 'company'].includes(req.user.role),
      ),
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (!data || !Array.isArray(data.branches)) {
          return data
        }

        const seenBranches = new Set<string>()
        for (const entry of data.branches) {
          if (!entry.branch) {
            throw new Error('Branch is required for each KOT Time row.')
          }

          const branchId =
            typeof entry.branch === 'object' && entry.branch !== null
              ? (entry.branch as { id?: string; _id?: string }).id ||
                (entry.branch as { id?: string; _id?: string })._id ||
                String(entry.branch)
              : String(entry.branch)

          if (seenBranches.has(branchId)) {
            throw new Error('Duplicate branch found in KOT Time settings. Each branch can only be configured once.')
          }
          seenBranches.add(branchId)

          // Auto-populate branchName for clean row labeling
          try {
            const branchDoc = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })
            if (branchDoc?.name) {
              entry.branchName = branchDoc.name
            }
          } catch {
            // Keep existing branchName if lookup fails
          }

          // Normalize and validate time values
          if (entry.supervisorTime == null || isNaN(Number(entry.supervisorTime)) || Number(entry.supervisorTime) < 0) {
            entry.supervisorTime = 0
          } else {
            entry.supervisorTime = Number(entry.supervisorTime)
          }

          if (entry.waiterTime == null || isNaN(Number(entry.waiterTime)) || Number(entry.waiterTime) < 0) {
            entry.waiterTime = 0
          } else {
            entry.waiterTime = Number(entry.waiterTime)
          }

          if (!['minutes', 'seconds'].includes(entry.supervisorUnit)) {
            entry.supervisorUnit = 'minutes'
          }

          if (!['minutes', 'seconds'].includes(entry.waiterUnit)) {
            entry.waiterUnit = 'minutes'
          }
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'branches',
      type: 'array',
      label: 'KOT Time Settings by Branch',
      labels: {
        singular: 'Branch KOT Time',
        plural: 'Branch KOT Times',
      },
      admin: {
        description:
          'Add a branch to configure Supervisor confirming time and Waiter deliver time.',
        components: {
          RowLabel: '/components/KotTimeRowLabel/index.tsx#KotTimeRowLabel',
        },
      },
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
          label: 'Branch',
          admin: {
            description: 'Select branch to configure KOT timings.',
          },
        },
        {
          name: 'branchName',
          type: 'text',
          admin: {
            hidden: true,
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'supervisorUnit',
              type: 'select',
              label: 'Supervisor',
              defaultValue: 'minutes',
              required: true,
              options: [
                { label: 'Minutes', value: 'minutes' },
                { label: 'Seconds', value: 'seconds' },
              ],
              admin: {
                width: '40%',
                description: 'Time unit filter (Minutes or Seconds)',
              },
            },
            {
              name: 'supervisorTime',
              type: 'number',
              label: 'Time',
              min: 0,
              required: true,
              defaultValue: 0,
              admin: {
                width: '60%',
                placeholder: 'Enter confirming time (number)',
                description: 'Supervisor confirming time',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'waiterUnit',
              type: 'select',
              label: 'Waiter',
              defaultValue: 'minutes',
              required: true,
              options: [
                { label: 'Minutes', value: 'minutes' },
                { label: 'Seconds', value: 'seconds' },
              ],
              admin: {
                width: '40%',
                description: 'Time unit filter (Minutes or Seconds)',
              },
            },
            {
              name: 'waiterTime',
              type: 'number',
              label: 'Time',
              min: 0,
              required: true,
              defaultValue: 0,
              admin: {
                width: '60%',
                placeholder: 'Enter deliver time (number)',
                description: 'Waiter deliver time',
              },
            },
          ],
        },
      ],
    },
  ],
}
