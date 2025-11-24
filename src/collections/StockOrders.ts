// src/collections/StockOrders.ts
import { CollectionConfig } from 'payload'
import type { Where } from 'payload' // Import Where type
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone' // Assume installed: npm i dayjs @types/dayjs

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
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      if (user.role && ['branch', 'waiter'].includes(user.role)) {
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
        return { branch: { equals: branchId } }
      }
      return false
    },
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeOperation: [
      async ({ args, req, operation }) => {
        if (operation === 'create') {
          const data = args.data
          // 1. Get Branch ID
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
            // If no branch, let validation handle it later or return
            return args
          }

          // 2. Get Date and Construct Target Invoice Number (Sequence 01)
          const date = dayjs().tz('Asia/Kolkata')
          const dateStr = date.format('YYMMDD')

          // We need the branch abbreviation to construct the invoice number
          // Fetch branch to get abbr
          const branch = await req.payload.findByID({
            collection: 'branches',
            id: branchId,
            depth: 0,
          })

          if (!branch) return args

          const branchName = branch.name || ''
          const abbr = branchName.trim().substring(0, 3).toUpperCase()
          const targetInvoiceNumber = `${abbr}-STC-${dateStr}-01`

          console.log('--- Debug Stock Order Merge ---')
          console.log('Branch ID:', branchId)
          console.log('Target Invoice:', targetInvoiceNumber)

          // 3. Check if order exists
          const existingOrders = await req.payload.find({
            collection: 'stock-orders',
            where: {
              invoiceNumber: {
                equals: targetInvoiceNumber,
              },
            },
            depth: 1, // Need items
            limit: 1,
            overrideAccess: true, // Ensure we find it regardless of user permissions
          })

          console.log('Existing Orders Found:', existingOrders.totalDocs)

          if (existingOrders.totalDocs > 0) {
            const existingOrder = existingOrders.docs[0]

            // 4. Merge Items
            const existingItems = existingOrder.items || []
            const newItems = data.items || []

            // Combine items
            // Note: You might want to consolidate same products here if needed,
            // but the requirement just says "product need to increment" which likely means append.
            // If exact same product exists, we could sum qty, but simple append is safer for now unless specified.
            const mergedItems = [...existingItems, ...newItems]

            // 5. Switch to Update
            args.operation = 'update'
            args.id = existingOrder.id
            args.data = {
              ...data,
              items: mergedItems,
              invoiceNumber: existingOrder.invoiceNumber,
            }
          }
        }
        return args
      },
    ],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
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

          // Auto-generate invoice number with timezone-aware date
          // Only generate if not already present (to support merges)
          if (!data.invoiceNumber) {
            const date = dayjs().tz('Asia/Kolkata')
            const dateStr = date.format('YYMMDD')

            // Fetch branch to get abbr
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
            const branch = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })
            const branchName = branch.name || ''
            const abbr = branchName.trim().substring(0, 3).toUpperCase()

            // Auto-set company from branch
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

            // Count existing for this branch today using invoiceNumber range
            const prefix = `${abbr}-STC-${dateStr}-`
            const { totalDocs: existingCount } = await req.payload.count({
              collection: 'stock-orders',
              where: {
                invoiceNumber: {
                  greater_than_equal: `${prefix}01`,
                  less_than_equal: `${prefix}99`,
                },
              },
            })
            const seq = (existingCount + 1).toString().padStart(2, '0')
            data.invoiceNumber = `${prefix}${seq}`

            // Set status to 'pending' if not provided
            if (!data.status) {
              data.status = 'pending'
            }
          }
        }

        // Validate and set item names from products
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            if (!item.product) continue

            const productId = typeof item.product === 'string' ? item.product : item.product?.id
            if (!productId) throw new Error('Invalid product')

            const product = await req.payload.findByID({
              collection: 'products',
              id: productId,
              depth: 1,
            })

            if (!product) throw new Error('Product not found')

            // Set name from product
            item.name = product.name

            // Optional: Validate category matches
            // Optional: Validate category matches
            // const productCategory =
            //   typeof product.category === 'string' ? product.category : product.category?.id
            // const dataCategory =
            //   typeof data.category === 'string' ? data.category : data.category?.id
            // if (productCategory !== dataCategory) {
            //   throw new Error(`Product ${item.name} does not belong to the selected category`)
            // }
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
          admin: {
            step: 1,
          },
        },
        {
          name: 'qty',
          type: 'number',
          required: true,
          min: 0,
          admin: {
            step: 1,
          },
        },
      ],
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      access: {
        update: ({ req: { user } }) => user?.role === 'superadmin',
      },
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
      access: {
        update: ({ req: { user } }) => user?.role === 'superadmin',
      },
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
      access: {
        update: ({ req: { user } }) => user?.role === 'superadmin',
      },
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
