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
    read: () => true,
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) => user?.role === 'superadmin',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
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
          const abbr = branchName.substring(0, 3).toUpperCase()

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

        // Validate and set item names from products and set dates
        if (data.items && data.items.length > 0) {
          const now = new Date().toISOString()
          for (let idx = 0; idx < data.items.length; idx++) {
            const item = data.items[idx]
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

            // Set dates if quantities are set or changed
            const originalItem = originalDoc?.items?.[idx]
            if (operation === 'create') {
              if (item.requiredQty > 0) item.requiredDate = now
              if (item.sendingQty > 0) item.sendingDate = now
              if (item.receivedQty > 0) item.receivedDate = now
              if (item.pickedQty > 0) item.pickedDate = now
            } else if (operation === 'update') {
              if (item.requiredQty !== originalItem?.requiredQty && item.requiredQty > 0) {
                item.requiredDate = now
              }
              if (item.sendingQty !== originalItem?.sendingQty && item.sendingQty > 0) {
                item.sendingDate = now
              }
              if (item.receivedQty !== originalItem?.receivedQty && item.receivedQty > 0) {
                item.receivedDate = now
              }
              if (item.pickedQty !== originalItem?.pickedQty && item.pickedQty > 0) {
                item.pickedDate = now
              }
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
      name: 'deliveryDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
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
          name: 'requiredQty',
          label: 'Required Qty',
          type: 'number',
          required: true,
          min: 0,
          admin: {
            step: 1,
          },
        },
        {
          name: 'requiredDate',
          label: 'Required Date',
          type: 'date',
          admin: {
            readOnly: true,
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'sendingQty',
          label: 'Sending Qty',
          type: 'number',
          required: false,
          min: 0,
          admin: {
            step: 1,
          },
        },
        {
          name: 'sendingDate',
          label: 'Sending Date',
          type: 'date',
          admin: {
            readOnly: true,
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'pickedQty',
          label: 'Picked Qty',
          type: 'number',
          required: false,
          min: 0,
          admin: {
            step: 1,
          },
        },
        {
          name: 'pickedDate',
          label: 'Picked Date',
          type: 'date',
          admin: {
            readOnly: true,
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'receivedQty',
          label: 'Received Qty',
          type: 'number',
          required: false,
          min: 0,
          admin: {
            step: 1,
          },
        },
        {
          name: 'receivedDate',
          label: 'Received Date',
          type: 'date',
          admin: {
            readOnly: true,
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Approved', value: 'approved' },
          ],
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
