import type { CollectionConfig } from 'payload'
import { isValidBranchPin } from '../utilities/branchPins'

export const Branches: CollectionConfig = {
  slug: 'branches',
  admin: {
    useAsTitle: 'name',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const nextData = (data || {}) as Record<string, unknown>
        const rawBranchPin = nextData.branchPin
        const normalizedBranchPin =
          typeof rawBranchPin === 'string' ? rawBranchPin.trim() : undefined

        if (typeof normalizedBranchPin === 'string') {
          nextData.branchPin = normalizedBranchPin
        }

        // Only validate duplicate PIN if PIN is being created or explicitly updated
        if (operation === 'create' || normalizedBranchPin !== undefined) {
          const resolvedBranchPin =
            normalizedBranchPin ||
            (operation === 'update'
              ? (originalDoc as { branchPin?: string | null } | undefined)?.branchPin?.trim()
              : undefined)

          if (!resolvedBranchPin) {
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
              ? String(
                  (originalDoc as { id?: string; _id?: string } | undefined)?.id ||
                    (originalDoc as any)?._id ||
                    '',
                )
              : ''
          const duplicateBranch = existingBranches.docs.find(
            (branch) => String(branch.id || (branch as any)._id) !== currentBranchID,
          )

          if (duplicateBranch) {
            throw new Error(
              `Branch PIN ${resolvedBranchPin} is already assigned to ${duplicateBranch.name}. Use a unique 4-digit PIN.`,
            )
          }
        }

        return nextData
      },
    ],
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
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Others', value: 'others' },
      ],
      defaultValue: 'active',
      required: true,
    },
    {
      name: 'gst',
      type: 'text',
      required: true,
    },
    {
      name: 'gstMode',
      type: 'select',
      label: 'GST Mode',
      defaultValue: 'inclusive',
      options: [
        { label: 'Inclusive (GST included in price)', value: 'inclusive' },
        { label: 'Exclusive (GST added on top of price)', value: 'exclusive' },
      ],
      required: true,
      admin: {
        description: 'Choose whether GST is inclusive or exclusive for this branch.',
      },
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
      label: 'Branch Login PIN',
      required: true,
      admin: {
        position: 'sidebar',
        description:
          'Manual 4-digit PIN used for branch staff login verification.',
      },
      validate: (value: unknown) => {
        if (value == null || value === '') return true
        if (typeof value !== 'string') return 'Branch PIN must be exactly 4 digits.'
        if (!isValidBranchPin(value.trim())) {
          return 'Branch PIN must be exactly 4 digits (e.g., 0042).'
        }
        return true
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin' || req.user?.role === 'admin',
        read: ({ req }) => req.user?.role === 'superadmin' || req.user?.role === 'admin',
        update: ({ req }) => req.user?.role === 'superadmin' || req.user?.role === 'admin',
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
      name: 'isClosingEntryEnabled',
      label: 'Enable Closing Entry Form',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'When enabled by a manager, allows the branch cashier to submit their closing entry. Automatically resets to false after submission.',
        position: 'sidebar',
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
  access: {
    create: ({ req }) => req.user?.role === 'superadmin' || req.user?.role === 'admin',
    read: () => true,
    update: ({ req, id: _id }): boolean | import('payload').Where => {
      if (!req.user) return false
      if (req.user.role === 'superadmin' || req.user.role === 'admin') return true
      if (req.user.role === 'manager') {
        const userCompanies = (req.user.manager_companies || []) as any[]
        const userCompanyIds = userCompanies
          .map((c: any) => (typeof c === 'string' ? c : (c?.id || c?._id || '')))
          .concat(
            req.user.company
              ? [typeof req.user.company === 'string' ? req.user.company : (req.user.company?.id || (req.user.company as any)?._id || '')]
              : [],
          )
          .filter(Boolean)
          .map(String)

        if (userCompanyIds.length > 0) {
          return { company: { in: userCompanyIds } }
        }
        return false
      }
      if (req.user.role === 'company') {
        const comp = req.user.company
        const compId = typeof comp === 'string' ? comp : (comp?.id || (comp as any)?._id || '')
        if (compId) {
          return { company: { equals: String(compId) } }
        }
        return false
      }
      if (req.user.role === 'branch') {
        if (!req.user.branch) return false
        const userBranchId =
          typeof req.user.branch === 'string'
            ? req.user.branch
            : (req.user.branch.id || (req.user.branch as any)._id)
        return { id: { equals: String(userBranchId) } }
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
