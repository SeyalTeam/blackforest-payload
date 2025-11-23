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
      if (user.role === 'superadmin') return true

      if (user.role === 'company') {
        const company = user.company
        if (!company) return false

        const companyId =
          typeof company === 'string'
            ? company
            : typeof company === 'object' && company?.id
              ? company.id
              : null

        return companyId ? ({ company: { equals: companyId } } as Where) : false
      }

      if (user.role === 'branch' || user.role === 'waiter') {
        const branch = user.branch
        if (!branch) return false

        const branchId =
          typeof branch === 'string'
            ? branch
            : typeof branch === 'object' && branch?.id
              ? branch.id
              : null

        return branchId ? ({ branch: { equals: branchId } } as Where) : false
      }

      return false
    },

    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),

    update: ({ req: { user } }) =>
      user?.role != null && ['branch', 'waiter', 'superadmin'].includes(user.role),

    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },

  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (!req.user) throw new Error('Unauthorized')

        // -----------------------------------------------------
        // 1️⃣ VALIDATE USER BRANCH
        // -----------------------------------------------------
        if (['branch', 'waiter'].includes(req.user.role)) {
          const userBranchId =
            typeof req.user.branch === 'string' ? req.user.branch : req.user.branch?.id

          const dataBranchId = typeof data.branch === 'string' ? data.branch : data.branch?.id

          if (!userBranchId || userBranchId !== dataBranchId) {
            throw new Error('Unauthorized branch')
          }
        }

        // -----------------------------------------------------
        // 2️⃣ AUTO-SET DATE PREFIX
        // -----------------------------------------------------
        const date = dayjs().tz('Asia/Kolkata')
        const dateStr = date.format('YYMMDD')

        // Determine branch ID
        let branchId: string
        if (typeof data.branch === 'string') {
          branchId = data.branch
        } else if (data.branch?.id) {
          branchId = data.branch.id
        } else {
          throw new Error('Invalid branch')
        }

        // Fetch branch to get abbreviation + company
        const branch = await req.payload.findByID({
          collection: 'branches',
          id: branchId,
          depth: 0,
        })

        const abbr = branch.name?.substring(0, 3).toUpperCase() || 'BRN'
        const fixedInvoice = `${abbr}-STC-${dateStr}-01`

        // -----------------------------------------------------
        // 3️⃣ AUTO-SET COMPANY
        // -----------------------------------------------------
        if (branch.company) {
          if (typeof branch.company === 'string') {
            data.company = branch.company
          } else if (branch.company.id) {
            data.company = branch.company.id
          }
        }

        // -----------------------------------------------------
        // 4️⃣ CREATE MODE → CHECK IF ORDER EXISTS TODAY
        // -----------------------------------------------------
        if (operation === 'create') {
          const existing = await req.payload.find({
            collection: 'stock-orders',
            where: {
              invoiceNumber: { equals: fixedInvoice },
              branch: { equals: branchId },
            },
            limit: 1,
          })

          if (existing.totalDocs > 0) {
            throw new Error(
              'Stock Order for today already exists. Please UPDATE instead of CREATE.',
            )
          }

          // Assign fixed invoice number
          data.invoiceNumber = fixedInvoice

          // Default status
          if (!data.status) data.status = 'pending'
        }

        // -----------------------------------------------------
        // 5️⃣ UPDATE MODE → KEEP SAME INVOICE NUMBER
        // -----------------------------------------------------
        if (operation === 'update') {
          // No invoice regeneration allowed
          data.invoiceNumber = undefined
        }

        // -----------------------------------------------------
        // 6️⃣ FILL ITEM NAMES & VALIDATE CATEGORY
        // -----------------------------------------------------
        if (data.items?.length > 0) {
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

            // Validate category
            const productCategory =
              typeof product.category === 'string' ? product.category : product.category?.id

            const dataCategory =
              typeof data.category === 'string' ? data.category : data.category?.id

            if (productCategory !== dataCategory) {
              throw new Error(`Product ${product.name} does not belong to the selected category`)
            }
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
        },
        {
          name: 'qty',
          type: 'number',
          required: true,
          min: 0,
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
}

export default StockOrders
