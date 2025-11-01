import { CollectionConfig } from 'payload'
import type { Where } from 'payload'

const ReturnOrders: CollectionConfig = {
  slug: 'return-orders', // ✅ correct slug
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

          // ✅ Fetch branch ID properly
          let branchId: string | undefined
          if (data.branch) {
            if (typeof data.branch === 'string') {
              branchId = data.branch
            } else if (
              typeof data.branch === 'object' &&
              data.branch !== null &&
              'id' in data.branch &&
              typeof data.branch.id === 'string'
            ) {
              branchId = data.branch.id
            }
          }

          // ✅ Get branch details
          let branch: any
          if (branchId) {
            branch = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })
          }

          // ✅ Auto-set company from branch
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

          // ✅ Generate sequential return numbers per branch per day
          const startOfDay = new Date(date)
          startOfDay.setHours(0, 0, 0, 0)
          const endOfDay = new Date(date)
          endOfDay.setHours(23, 59, 59, 999)

          const latest = (await req.payload.find({
            collection: 'return-orders', // ✅ correct slug
            where: {
              branch: { equals: branchId },
              createdAt: {
                greater_than_equal: startOfDay,
                less_than: endOfDay,
              },
            },
            sort: '-createdAt',
            limit: 1,
          })) as any // ✅ Fix TypeScript

          let nextNumber = 1
          if (latest.docs.length > 0) {
            const lastReturn = latest.docs[0]
            const match = lastReturn.returnNumber?.match(/-(\d+)$/)
            if (match) nextNumber = parseInt(match[1], 10) + 1
          }

          // ✅ Generate code like RET-20251101-BRANCHNAME-001
          const branchPart = branch?.name?.replace(/\s+/g, '').toUpperCase().slice(0, 6) || 'BRANCH'
          data.returnNumber = `RET-${formattedDate}-${branchPart}-${nextNumber
            .toString()
            .padStart(3, '0')}`
        }

        // ✅ Recalculate total
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
