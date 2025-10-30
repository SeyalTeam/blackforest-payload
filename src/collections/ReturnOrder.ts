import { CollectionConfig } from 'payload'
import type { Where } from 'payload'

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
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')
          let branchId: string | undefined

          // Extract branch ID
          if (data.branch) {
            if (typeof data.branch === 'string') {
              branchId = data.branch
            } else if (typeof data.branch === 'object' && data.branch?.id) {
              branchId = data.branch.id
            }
          }

          if (!branchId) throw new Error('Branch is required')

          // 🔍 Check if a bill already exists for this branch and date
          const existingOrders = await req.payload.find({
            collection: 'return-orders',
            where: {
              and: [
                { branch: { equals: branchId } },
                { returnNumber: { like: `RET-${formattedDate}-${branchId}` } },
              ],
            },
            limit: 1,
          })

          const existingOrder = existingOrders.docs?.[0]

          // 🧩 If an order exists for today, append new items
          if (existingOrder) {
            const mergedItems = [
              ...(existingOrder.items || []),
              ...(data.items || []).map((item: Record<string, any>) => ({
                ...item,
                returnedAt: new Date().toISOString(),
              })),
            ]

            const totalAmount = mergedItems.reduce(
              (sum: number, item: Record<string, any>) => sum + (item.subtotal || 0),
              0,
            )

            await req.payload.update({
              collection: 'return-orders',
              id: existingOrder.id,
              data: {
                items: mergedItems,
                totalAmount,
                updatedAt: new Date().toISOString(),
              },
            })

            // ❌ Prevent new doc creation (we updated existing one)
            return null
          }

          // 🆕 Create a new bill for the day
          const seq = '001'
          data.returnNumber = `RET-${formattedDate}-${branchId}-${seq}`

          // Auto-set company from branch
          const branch = await req.payload.findByID({
            collection: 'branches',
            id: branchId,
            depth: 0,
          })

          if (branch?.company) {
            let companyToSet = branch.company
            if (typeof companyToSet === 'object' && companyToSet?.id) {
              companyToSet = companyToSet.id
            }
            data.company = companyToSet
          }

          // Add timestamp to each returned item
          if (data.items) {
            data.items = data.items.map((item: Record<string, any>) => ({
              ...item,
              returnedAt: new Date().toISOString(),
            }))
          }

          // Calculate total
          data.totalAmount = (data.items || []).reduce(
            (sum: number, item: Record<string, any>) => sum + (item.subtotal || 0),
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
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'subtotal',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'returnedAt',
          type: 'date',
          required: true,
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
