import type { CollectionConfig } from 'payload'

export const Branches: CollectionConfig = {
  slug: 'branches',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'address',
      type: 'text',
      required: true,
    },
    {
      name: 'gst',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'branchPin',
      type: 'text',
      label: 'Branch Login PIN (Daily, 4 digits)',
      admin: {
        readOnly: true,
        description:
          'Auto-generated every day (IST). Use this PIN only when staff login fails due to WiFi/IP/location issues.',
      },
      validate: (value: unknown) => {
        if (value == null || value === '') return true
        if (typeof value !== 'string') return 'Branch PIN must be exactly 4 digits.'
        if (!/^\d{4}$/.test(value.trim())) {
          return 'Branch PIN must be exactly 4 digits (e.g., 0042).'
        }
        return true
      },
    },
    {
      name: 'ipAddress',
      type: 'text',
      label: 'Branch IP Address (from ISP)',
      admin: {
        description:
          'Public IP for auto-detecting branch on login (e.g., 192.0.2.1). Fetch via whatismyip.com at branch.',
      },
    },
    {
      name: 'printerIp',
      type: 'text',
      label: 'Printer IP Address',
      admin: {
        description:
          'IP address of the network printer for this branch (e.g., 192.168.1.100). Used for printing bills directly over the local network.',
      },
    },
    {
      name: 'inventoryResetDate',
      type: 'date',
      admin: {
        description: 'Inventory counts before this date will be ignored in reports.',
        position: 'sidebar',
      },
    },
    {
      name: 'productResets',
      type: 'array',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'resetDate',
          type: 'date',
          required: true,
        },
      ],
      admin: {
        description: 'Granular reset dates for specific products.',
      },
    },
    {
      name: 'stockOrderWorkflow',
      label: 'Stock Order Workflow',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'skipSupervisor',
              label: 'Skip Supervisor (Confirmation)',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'skipDriver',
              label: 'Skip Driver (Picking)',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
      ],
      admin: {
        description: 'Customize the stock order process for this branch.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc, context }) => {
        const nextData = (data || {}) as Record<string, unknown>
        const rawBranchPin = nextData.branchPin
        const normalizedBranchPin =
          typeof rawBranchPin === 'string' ? rawBranchPin.trim() : undefined

        if (typeof normalizedBranchPin === 'string') {
          nextData.branchPin = normalizedBranchPin
        }

        const resolvedBranchPin =
          normalizedBranchPin ||
          (operation === 'update'
            ? (originalDoc as { branchPin?: string | null } | undefined)?.branchPin?.trim()
            : undefined)

        if (!resolvedBranchPin) {
          return nextData
        }

        const skipUniquenessCheck =
          (context as { skipBranchPinUniquenessCheck?: boolean } | undefined)
            ?.skipBranchPinUniquenessCheck === true
        if (skipUniquenessCheck) {
          return nextData
        }

        const existingBranches = await req.payload.find({
          collection: 'branches',
          where: {
            branchPin: {
              equals: resolvedBranchPin,
            },
          },
          limit: 2,
          depth: 0,
          overrideAccess: true,
        })

        const currentBranchID =
          operation === 'update'
            ? String((originalDoc as { id?: string } | undefined)?.id || '')
            : ''
        const duplicateBranch = existingBranches.docs.find(
          (branch) => String(branch.id) !== currentBranchID,
        )

        if (duplicateBranch) {
          throw new Error(
            `Branch PIN ${resolvedBranchPin} is already assigned to ${duplicateBranch.name}. Use a unique 4-digit PIN.`,
          )
        }

        return nextData
      },
    ],
  },
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: () => true,
    update: ({ req, id: _id }): boolean | import('payload').Where => {
      if (!req.user) return false
      if (req.user.role === 'superadmin') return true
      if (req.user.role === 'branch') {
        if (!req.user.branch) return false
        const userBranchId =
          typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
        return { id: { equals: userBranchId } }
      }
      return false
    },
  },
  indexes: [
    {
      fields: ['company'],
    },
  ],
}
