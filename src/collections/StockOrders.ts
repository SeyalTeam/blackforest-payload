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

  // ======================================================
  // ACCESS CONTROL
  // ======================================================
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true

      // Company
      if (user.role === 'company') {
        const company = user.company
        if (!company) return false
        const companyId = typeof company === 'string' ? company : company.id
        return { company: { equals: companyId } } as Where
      }

      // Branch + Waiter
      if (user.role === 'branch' || user.role === 'waiter') {
        const branch = user.branch
        if (!branch) return false
        const branchId = typeof branch === 'string' ? branch : branch.id
        return { branch: { equals: branchId } } as Where
      }

      return false
    },

    // Branch + waiter can CREATE
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),

    // Only superadmin can manually update/delete
    update: ({ req: { user } }) => user?.role === 'superadmin',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },

  // ======================================================
  // HOOKS
  // ======================================================
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        // ======================================================
        // CREATE LOGIC WITH AUTO-MERGE
        // ======================================================
        if (operation === 'create') {
          if (!req.user) throw new Error('Unauthorized')

          // --------------------------------------------
          // 1. Validate Branch Ownership
          // --------------------------------------------
          if (['branch', 'waiter'].includes(req.user.role)) {
            const userBranchId =
              typeof req.user.branch === 'string' ? req.user.branch : req.user.branch?.id

            const dataBranchId = typeof data.branch === 'string' ? data.branch : data?.branch?.id

            if (!userBranchId || userBranchId !== dataBranchId) {
              throw new Error('Unauthorized branch')
            }
          }

          // --------------------------------------------
          // 2. Time / Date
          // --------------------------------------------
          const now = dayjs().tz('Asia/Kolkata')
          const dateStr = now.format('YYMMDD')

          // --------------------------------------------
          // 3. Get Branch + Company
          // --------------------------------------------
          let branchId: string
          if (typeof data.branch === 'string') {
            branchId = data.branch
          } else if (data.branch?.id) {
            branchId = data.branch.id
          } else {
            throw new Error('Invalid branch')
          }

          const branch = await req.payload.findByID({
            collection: 'branches',
            id: branchId,
            depth: 0,
          })

          const branchName = branch.name || ''
          const abbr = branchName.substring(0, 3).toUpperCase()

          // Auto-set company
          let companyToSet = branch.company
          if (companyToSet && typeof companyToSet === 'object') {
            companyToSet = companyToSet.id
          }
          data.company = companyToSet

          // --------------------------------------------
          // 4. CHECK IF TODAY'S ORDER ALREADY EXISTS
          // --------------------------------------------
          const startOfDay = now.startOf('day').toISOString()
          const endOfDay = now.endOf('day').toISOString()

          const existing = await req.payload.find({
            collection: 'stock-orders',
            limit: 1,
            where: {
              and: [
                { branch: { equals: branchId } },
                { createdAt: { greater_than_equal: startOfDay } },
                { createdAt: { less_than_equal: endOfDay } },
              ],
            },
          })

          // --------------------------------------------
          // 5. TODAY'S ORDER EXISTS → MERGE AUTOMATICALLY
          // --------------------------------------------
          if (existing.totalDocs > 0) {
            const existingOrder = existing.docs[0]

            const mergedItems = [...existingOrder.items, ...(data.items || [])]

            // Update existing order
            const updated = await req.payload.update({
              collection: 'stock-orders',
              id: existingOrder.id,
              data: { items: mergedItems },
            })

            // Return updated doc → SKIP CREATE
            return updated
          }

          // --------------------------------------------
          // 6. OTHERWISE → CREATE FIRST ORDER OF THE DAY
          // --------------------------------------------
          const prefix = `${abbr}-STC-${dateStr}-`

          const { totalDocs: countToday } = await req.payload.count({
            collection: 'stock-orders',
            where: {
              invoiceNumber: {
                greater_than_equal: `${prefix}01`,
                less_than_equal: `${prefix}99`,
              },
            },
          })

          const seq = (countToday + 1).toString().padStart(2, '0')
          data.invoiceNumber = `${prefix}${seq}`

          if (!data.status) data.status = 'pending'
        }

        // ======================================================
        // VALIDATE PRODUCT NAMES + CATEGORY MATCH
        // ======================================================
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            if (!item.product) continue

            const productId = typeof item.product === 'string' ? item.product : item.product?.id

            const product = await req.payload.findByID({
              collection: 'products',
              id: productId,
              depth: 1,
            })

            if (!product) throw new Error('Product not found')

            item.name = product.name

            const productCategory =
              typeof product.category === 'string' ? product.category : product.category?.id

            const dataCategory =
              typeof data.category === 'string' ? data.category : data.category?.id

            if (productCategory !== dataCategory) {
              throw new Error(`Product ${item.name} does not belong to the selected category`)
            }
          }
        }

        return data
      },
    ],
  },

  // ======================================================
  // FIELDS
  // ======================================================
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
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
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
