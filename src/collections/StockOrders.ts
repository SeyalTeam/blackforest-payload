// src/collections/StockOrders.ts
import { CollectionConfig } from 'payload'
import type { Where } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const StockOrders: CollectionConfig = {
  slug: 'stock-orders',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
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
        } else return false

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
        } else return false

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
          if (!req.user) throw new Error('Unauthorized')

          // Validate branch matches user's branch
          if (['branch', 'waiter'].includes(req.user.role)) {
            const userBranchId =
              typeof req.user.branch === 'string' ? req.user.branch : req.user.branch?.id
            const dataBranchId = typeof data.branch === 'string' ? data.branch : data?.branch?.id

            if (!userBranchId || userBranchId !== dataBranchId) {
              throw new Error('Unauthorized branch')
            }
          }

          // Get today's date in IST
          const date = dayjs().tz('Asia/Kolkata')
          const dateStr = date.format('YYMMDD')

          // Get branch ID
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
            throw new Error('Invalid branch')
          }

          // Fetch branch to get abbr
          const branch = await req.payload.findByID({
            collection: 'branches',
            id: branchId,
            depth: 0,
          })

          const branchName = branch.name || ''
          const abbr = branchName.substring(0, 3).toUpperCase()

          // Auto-set company from branch
          if (branch?.company) {
            let company = branch.company
            if (
              typeof company === 'object' &&
              company !== null &&
              'id' in company &&
              typeof company.id === 'string'
            ) {
              company = company.id
            }
            if (typeof company === 'string') {
              data.company = company
            }
          }

          // ✔ RULE: Only 1 stock order per branch per day
          const existing = await req.payload.count({
            collection: 'stock-orders',
            where: {
              branch: { equals: branchId },
              createdAt: {
                greater_than_equal: date.startOf('day').toISOString(),
                less_than_equal: date.endOf('day').toISOString(),
              },
            },
          })

          if (existing.totalDocs > 0) {
            throw new Error('Stock order already created today for this branch')
          }

          // Invoice number always ends with -01
          data.invoiceNumber = `${abbr}-STC-${dateStr}-01`

          // Default status
          if (!data.status) {
            data.status = 'pending'
          }
        }

        // Item auto-name from product
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            const productId = typeof item.product === 'string' ? item.product : item.product?.id

            if (!productId) throw new Error('Invalid product')

            const product = await req.payload.findByID({
              collection: 'products',
              id: productId,
              depth: 1,
            })

            if (!product) throw new Error('Product not found')

            item.name = product.name
          }
        }

        return data
      },
    ],
  },

  fields: [
    {
      name: 'invoiceNumber',
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
          admin: { readOnly: true },
        },
        {
          name: 'inStock',
          type: 'number',
          required: true,
          min: 0,
          admin: { step: 1 },
        },
        {
          name: 'qty',
          type: 'number',
          required: true,
          min: 0,
          admin: { step: 1 },
        },
      ],
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
        { label: 'Approved', value: 'approved' },
        { label: 'Fulfilled', value: 'fulfilled' },
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

export default StockOrders
