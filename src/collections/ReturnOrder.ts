// src/collections/ReturnOrders.ts
import { CollectionConfig } from 'payload'
import type { Where } from 'payload' // Import Where type

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
    update: async ({ req, id }) => {
      if (req.user?.role === 'superadmin') return true
      if (!req.user || !['branch', 'waiter'].includes(req.user.role) || !id) return false
      try {
        const doc = await req.payload.findByID({ collection: 'return-orders', id, depth: 0 })
        if (!doc) return false
        const docBranch =
          typeof doc.branch === 'string'
            ? doc.branch
            : typeof doc.branch === 'object' && doc.branch !== null && 'id' in doc.branch
              ? doc.branch.id
              : null
        const userBranch =
          typeof req.user.branch === 'string'
            ? req.user.branch
            : typeof req.user.branch === 'object' &&
                req.user.branch !== null &&
                'id' in req.user.branch
              ? req.user.branch.id
              : null
        return doc.status === 'pending' && docBranch === userBranch
      } catch (e) {
        return false
      }
    },
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (operation === 'create') {
          // Enforce one pending per branch
          const existingPending = await req.payload.find({
            collection: 'return-orders',
            where: {
              and: [{ branch: { equals: data.branch } }, { status: { equals: 'pending' } }],
            },
            limit: 1,
            pagination: false,
          })
          if (existingPending.docs.length > 0) {
            throw new Error(
              'A pending return order already exists for this branch. Please update the existing one.',
            )
          }
        }

        // Merge duplicate products in items
        if (data.items && data.items.length > 0) {
          const merged = new Map<string, any>()
          for (const item of data.items) {
            let prodId: string | undefined
            if (typeof item.product === 'string') {
              prodId = item.product
            } else if (
              typeof item.product === 'object' &&
              item.product !== null &&
              'id' in item.product &&
              typeof item.product.id === 'string'
            ) {
              prodId = item.product.id
            }
            if (!prodId) continue
            if (merged.has(prodId)) {
              const existing = merged.get(prodId)
              existing.quantity += item.quantity || 0
              existing.subtotal = existing.unitPrice * existing.quantity
            } else {
              merged.set(prodId, {
                ...item,
                product: prodId,
                quantity: item.quantity || 0,
                subtotal: (item.unitPrice || 0) * (item.quantity || 0),
              })
            }
          }
          data.items = Array.from(merged.values())
        }

        // Recalculate total
        if (data.items) {
          data.totalAmount = data.items.reduce(
            (sum: number, item: any) => sum + (item.subtotal || 0),
            0,
          )
        }

        // Auto-set company from branch
        if (data.branch && (operation === 'create' || !data.company)) {
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

        // Generate returnNumber only when status changes to 'returned'
        if (
          operation === 'update' &&
          data.status === 'returned' &&
          (!originalDoc || !originalDoc.returnNumber)
        ) {
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')
          const existingCount = await req.payload.db.collections['return-orders'].countDocuments({
            returnNumber: { $regex: `^RET-${formattedDate}-` },
          })
          const seq = (existingCount + 1).toString().padStart(3, '0')
          data.returnNumber = `RET-${formattedDate}-${seq}`
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
