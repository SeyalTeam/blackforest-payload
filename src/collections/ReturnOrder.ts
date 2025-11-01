// src/collections/ReturnOrders.ts
import { CollectionConfig } from 'payload'
import type { Where } from 'payload' // Import Where type
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc' // Required for timezone
import timezone from 'dayjs/plugin/timezone' // For IST support

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata') // Set default to IST

const ReturnOrders: CollectionConfig = {
  slug: 'return-orders',
  admin: {
    useAsTitle: 'returnNumber',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'superadmin') return true

      if (user?.role === 'company') {
        const company = user.company
        if (!company) return false
        let companyId: string
        if (typeof company === 'string') {
          companyId = company
        } else if (
          typeof company === 'object' &&
          company !== null &&
          'id' in company &&
          typeof company.id === 'string'
        ) {
          companyId = company.id
        } else {
          return false
        }
        return { company: { equals: companyId } } as Where
      }

      if (user?.role === 'branch' || user?.role === 'waiter') {
        const branch = user.branch
        if (!branch) return false
        let branchId: string
        if (typeof branch === 'string') {
          branchId = branch
        } else if (
          typeof branch === 'object' &&
          branch !== null &&
          'id' in branch &&
          typeof branch.id === 'string'
        ) {
          branchId = branch.id
        } else {
          return false
        }
        return { branch: { equals: branchId } } as Where
      }

      return false
    },
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) => user?.role === 'superadmin',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create') {
          try {
            // Auto-generate return number, e.g., RET-YYYYMMDD-SEQ in IST
            const date = dayjs()
            const formattedDate = date.format('YYYYMMDD')
            const existingCount = await req.payload.db.collections['return-orders'].countDocuments({
              returnNumber: { $regex: `^RET-${formattedDate}-` },
            })
            const seq = (existingCount + 1).toString().padStart(3, '0')
            data.returnNumber = `RET-${formattedDate}-${seq}`

            // Auto-set company from branch
            if (data.branch) {
              let branchId: string
              if (typeof data.branch === 'string') {
                branchId = data.branch
              } else if (
                typeof data.branch === 'object' &&
                data.branch !== null &&
                'id' in data.branch &&
                typeof data.branch.id === 'string'
              ) {
                branchId = data.branch.id
              } else {
                return data // Skip if invalid
              }
              const branch = await req.payload.findByID({
                collection: 'branches',
                id: branchId,
                depth: 0,
              })
              if (branch?.company) {
                let companyToSet = branch.company
                if (
                  typeof companyToSet === 'object' &&
                  companyToSet !== null &&
                  'id' in companyToSet &&
                  typeof companyToSet.id === 'string'
                ) {
                  companyToSet = companyToSet.id
                }
                if (typeof companyToSet === 'string') {
                  data.company = companyToSet
                }
              }
            }
          } catch (err: unknown) {
            // Fix: Catch as unknown, then type-guard
            const error = err as Error // Cast to Error for .message access
            req.payload.logger.error(`Error in return order hook: ${error.message}`)
            throw error // This will cause 400 with message
          }
        }
        // Recalculate total if items change
        if (data.items) {
          data.totalAmount = data.items.reduce(
            (sum: number, item: any) => sum + (item.subtotal || 0),
            0,
          )
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'returnNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { readOnly: true },
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
          admin: { readOnly: true },
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { readOnly: true },
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
          admin: { readOnly: true },
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true },
        },
        {
          name: 'subtotal',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      min: 0,
      admin: { readOnly: true },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      defaultValue: ({ user }) => user?.id,
      admin: { readOnly: true },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Returned', value: 'returned' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
  timestamps: true,
}

export default ReturnOrders
