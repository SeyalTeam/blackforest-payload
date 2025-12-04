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
    update: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'supervisor', 'driver', 'branch'].includes(user.role),
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

        // Validate and set item names from products and set dates, and calculate totals
        let totalInStockQty = 0
        let totalInStockAmount = 0
        let totalRequiredQty = 0
        let totalRequiredAmount = 0
        let totalSendingQty = 0
        let totalSendingAmount = 0
        let totalConfirmedQty = 0
        let totalConfirmedAmount = 0
        let totalPickedQty = 0
        let totalPickedAmount = 0
        let totalReceivedQty = 0
        let totalReceivedAmount = 0
        let totalDifferenceQty = 0
        let totalDifferenceAmount = 0

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

            // Get price from product (assuming defaultPriceDetails.price exists)
            const price = product?.defaultPriceDetails?.price || 0

            // Set per-item amounts
            item.inStockAmount = (item.inStock || 0) * price
            item.requiredAmount = (item.requiredQty || 0) * price
            item.sendingAmount = (item.sendingQty || 0) * price
            item.confirmedAmount = (item.confirmedQty || 0) * price
            item.pickedAmount = (item.pickedQty || 0) * price
            item.receivedAmount = (item.receivedQty || 0) * price

            // Calculate difference
            item.differenceQty = (item.requiredQty || 0) - (item.receivedQty || 0)
            item.differenceAmount = item.differenceQty * price

            // Accumulate totals
            totalInStockQty += item.inStock || 0
            totalInStockAmount += item.inStockAmount
            totalRequiredQty += item.requiredQty || 0
            totalRequiredAmount += item.requiredAmount
            totalSendingQty += item.sendingQty || 0
            totalSendingAmount += item.sendingAmount
            totalConfirmedQty += item.confirmedQty || 0
            totalConfirmedAmount += item.confirmedAmount
            totalPickedQty += item.pickedQty || 0
            totalPickedAmount += item.pickedAmount
            totalReceivedQty += item.receivedQty || 0
            totalReceivedAmount += item.receivedAmount
            totalDifferenceQty += item.differenceQty
            totalDifferenceAmount += item.differenceAmount

            // Set dates if quantities are set or changed
            const originalItem = originalDoc?.items?.[idx]
            if (operation === 'create') {
              if (item.requiredQty > 0) item.requiredDate = now
              if (item.sendingQty > 0) item.sendingDate = now
              if (item.confirmedQty > 0) item.confirmedDate = now
              if (item.pickedQty > 0) item.pickedDate = now
              if (item.receivedQty > 0) item.receivedDate = now
            } else if (operation === 'update') {
              if (item.requiredQty !== originalItem?.requiredQty && item.requiredQty > 0) {
                item.requiredDate = now
              }
              if (item.sendingQty !== originalItem?.sendingQty && item.sendingQty > 0) {
                item.sendingDate = now
              }
              if (item.confirmedQty !== originalItem?.confirmedQty && item.confirmedQty > 0) {
                item.confirmedDate = now
              }
              if (item.pickedQty !== originalItem?.pickedQty && item.pickedQty > 0) {
                item.pickedDate = now
              }
              if (item.receivedQty !== originalItem?.receivedQty && item.receivedQty > 0) {
                item.receivedDate = now
              }
            }
          }
        }

        // Set total fields
        data.totalInStockQty = totalInStockQty
        data.totalInStockAmount = totalInStockAmount
        data.totalRequiredQty = totalRequiredQty
        data.totalRequiredAmount = totalRequiredAmount
        data.totalSendingQty = totalSendingQty
        data.totalSendingAmount = totalSendingAmount
        data.totalConfirmedQty = totalConfirmedQty
        data.totalConfirmedAmount = totalConfirmedAmount
        data.totalPickedQty = totalPickedQty
        data.totalPickedAmount = totalPickedAmount
        data.totalReceivedQty = totalReceivedQty
        data.totalReceivedAmount = totalReceivedAmount
        data.totalDifferenceQty = totalDifferenceQty
        data.totalDifferenceAmount = totalDifferenceAmount

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
          type: 'row',
          fields: [
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
              name: 'inStockAmount',
              type: 'number',
              admin: { readOnly: true },
            },
          ],
        },
        {
          type: 'row',
          fields: [
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
              name: 'requiredAmount',
              type: 'number',
              admin: { readOnly: true },
            },
          ],
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
          type: 'row',
          fields: [
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
              name: 'sendingAmount',
              type: 'number',
              admin: { readOnly: true },
            },
          ],
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
          type: 'row',
          fields: [
            {
              name: 'confirmedQty',
              label: 'Confirmed Qty',
              type: 'number',
              required: false,
              min: 0,
              admin: {
                step: 1,
              },
            },
            {
              name: 'confirmedAmount',
              type: 'number',
              admin: { readOnly: true },
            },
          ],
        },
        {
          name: 'confirmedDate',
          label: 'Confirmed Date',
          type: 'date',
          admin: {
            readOnly: true,
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          type: 'row',
          fields: [
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
              name: 'pickedAmount',
              type: 'number',
              admin: { readOnly: true },
            },
          ],
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
          type: 'row',
          fields: [
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
              name: 'receivedAmount',
              type: 'number',
              admin: { readOnly: true },
            },
          ],
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
          type: 'row',
          fields: [
            {
              name: 'differenceQty',
              label: 'Difference Qty',
              type: 'number',
              admin: { readOnly: true },
            },
            {
              name: 'differenceAmount',
              type: 'number',
              admin: { readOnly: true },
            },
          ],
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
      type: 'row',
      fields: [
        {
          name: 'totalInStockQty',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'totalInStockAmount',
          type: 'number',
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalRequiredQty',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'totalRequiredAmount',
          type: 'number',
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalSendingQty',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'totalSendingAmount',
          type: 'number',
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalConfirmedQty',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'totalConfirmedAmount',
          type: 'number',
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalPickedQty',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'totalPickedAmount',
          type: 'number',
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalReceivedQty',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'totalReceivedAmount',
          type: 'number',
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalDifferenceQty',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'totalDifferenceAmount',
          type: 'number',
          admin: { readOnly: true },
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
