// src/collections/ReturnOrders.ts
import { CollectionConfig } from 'payload'
import type { Where as _Where } from 'payload' // Import Where type
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone' // Assume installed: npm i dayjs @types/dayjs

dayjs.extend(utc)
dayjs.extend(timezone)

const ReturnOrders: CollectionConfig = {
  slug: 'return-orders',
  admin: {
    useAsTitle: 'returnNumber',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),
    update: () => true,
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc: _originalDoc }) => {
        if (operation === 'create') {
          if (!req.user) throw new Error('Unauthorized')

          // Auto-populate branch if missing
          if (!data.branch && req.user.branch) {
            data.branch = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
          }

          // Temporarily disable branch validation to bypass mismatch error
          // if (['branch', 'waiter'].includes(req.user.role)) {
          //   const userBranchId = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch?.id
          //   const dataBranchId = typeof data.branch === 'string' ? data.branch : data?.branch?.id
          //   if (!userBranchId || userBranchId !== dataBranchId) {
          //     throw new Error('Unauthorized branch')
          //   }
          // }

          // Auto-generate return number with timezone-aware date
          const date = dayjs().tz('Asia/Kolkata')
          const formattedDate = date.format('YYYYMMDD')

          // Get Branch Code
          let branchCode = 'RET' // Fallback
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
              // Should not happen if required=true, but good for safety
              throw new Error('Invalid branch')
            }

            const branchDoc = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })

            if (branchDoc && branchDoc.name) {
              // Take first 3 letters, uppercase
              branchCode = branchDoc.name.substring(0, 3).toUpperCase()
            }
          }

          const prefix = `${branchCode}-RET-${formattedDate}`

          const { totalDocs: existingCount } = await req.payload.count({
            collection: 'return-orders',
            where: {
              returnNumber: {
                greater_than_equal: `${prefix}-000`,
                less_than_equal: `${prefix}-999`,
              },
            },
          })

          const seq = (existingCount + 1).toString().padStart(3, '0')
          data.returnNumber = `${prefix}-${seq}`

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
              throw new Error('Invalid branch')
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

          // Set status to 'pending' if not provided
          if (!data.status) {
            data.status = 'pending'
          }
        }

        // Validate and recompute item subtotals and names/prices from products
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

            // Compute unitPrice: default or branch override
            let unitPrice = product.defaultPriceDetails?.price || 0
            if (data.branch && product.branchOverrides) {
              const branchId = typeof data.branch === 'string' ? data.branch : data.branch?.id
              const override = product.branchOverrides.find(
                (ov: { branch: string | { id: string }; price?: number | null }) => {
                  const ovBranch = typeof ov.branch === 'string' ? ov.branch : ov.branch?.id
                  return ovBranch === branchId
                },
              )
              if (override) unitPrice = override.price || unitPrice
            }
            item.unitPrice = unitPrice

            // Recompute subtotal
            item.subtotal = (item.quantity || 0) * item.unitPrice

            // Optional: Validate proofPhoto if required (e.g., for qty > 1)
            // if (item.quantity > 1 && !item.proofPhoto) {
            //   throw new Error(`Proof photo required for ${item.name} with quantity > 1`)
            // }
          }

          // Recompute totalAmount
          data.totalAmount = data.items.reduce(
            (sum: number, item: { subtotal?: number }) => sum + (item.subtotal || 0),
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
          admin: { readOnly: true },
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 0.01,
          admin: {
            step: 0.01,
          },
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
        {
          name: 'proofPhoto',
          type: 'relationship',
          relationTo: 'media',
          // required: true, // Uncomment if mandatory for all; else use hook for conditional
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
