// src/collections/StockOrders.ts
import { CollectionConfig } from 'payload'
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
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role != null && ['branch', 'waiter', 'superadmin'].includes(user.role),
    update: ({ req: { user } }) =>
      user?.role != null &&
      ['superadmin', 'supervisor', 'driver', 'branch', 'factory', 'chef'].includes(user.role),
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

          // Auto-generate invoice number
          const date = dayjs().tz('Asia/Kolkata')
          const dateStr = date.format('YYMMDD')

          let branchId: string
          if (typeof data.branch === 'string') {
            branchId = data.branch
          } else if (
            typeof data.branch === 'object' &&
            data.branch !== null &&
            'id' in data.branch
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
          const abbr = (branch.name || '').substring(0, 3).toUpperCase()

          if (branch?.company) {
            let companyToSet = branch.company
            if (typeof companyToSet === 'object' && companyToSet !== null && 'id' in companyToSet) {
              companyToSet = companyToSet.id
            }
            if (typeof companyToSet === 'string') {
              data.company = companyToSet
            }
          }

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

          // Status forced to 'ordered' at end of hook
        }

        // Process items: calculate amounts, set dates, calculate difference
        if (data.items && data.items.length > 0) {
          const now = new Date().toISOString()

          for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i]
            if (!item.product) continue

            const productId = typeof item.product === 'string' ? item.product : item.product?.id
            if (!productId) throw new Error('Invalid product')

            const product = await req.payload.findByID({
              collection: 'products',
              id: productId,
              depth: 1,
            })

            if (!product) throw new Error('Product not found')

            item.name = product.name
            const price = product?.defaultPriceDetails?.price || 0

            // Calculate amounts
            item.inStockAmount = (item.inStock || 0) * price
            item.requiredAmount = (item.requiredQty || 0) * price
            item.sendingAmount = (item.sendingQty || 0) * price
            item.confirmedAmount = (item.confirmedQty || 0) * price
            item.pickedAmount = (item.pickedQty || 0) * price
            item.receivedAmount = (item.receivedQty || 0) * price

            // Difference (Required - Received)
            item.differenceQty = (item.requiredQty || 0) - (item.receivedQty || 0)
            item.differenceAmount = item.differenceQty * price

            // Set timestamps
            const originalItem = originalDoc?.items?.[i]
            if (operation === 'create') {
              if (item.requiredQty > 0) item.requiredDate = now
              if (item.sendingQty > 0) item.sendingDate = now
              if (item.confirmedQty > 0) item.confirmedDate = now
              if (item.pickedQty > 0) item.pickedDate = now
              if (item.receivedQty > 0) item.receivedDate = now

              // FORCE status to ordered
              item.status = 'ordered'
            } else if (operation === 'update') {
              if (item.requiredQty !== originalItem?.requiredQty && item.requiredQty > 0)
                item.requiredDate = now
              if (item.sendingQty !== originalItem?.sendingQty) {
                if (item.sendingQty > 0) item.sendingDate = now
                if (req.user) item.sendingUpdatedBy = req.user.id
              }
              if (item.confirmedQty !== originalItem?.confirmedQty) {
                if (item.confirmedQty > 0) item.confirmedDate = now
                if (req.user) item.confirmedUpdatedBy = req.user.id
              }
              if (item.pickedQty !== originalItem?.pickedQty) {
                if (item.pickedQty > 0) item.pickedDate = now
                if (req.user) item.pickedUpdatedBy = req.user.id
              }
              if (item.receivedQty !== originalItem?.receivedQty && item.receivedQty > 0)
                item.receivedDate = now
            }
          }
        }

        // FORCE status to ordered on create, ignoring input
        if (operation === 'create') {
          data.status = 'ordered'
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
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'name', type: 'text', required: true, admin: { readOnly: true } },

        // In Stock
        {
          type: 'row',
          fields: [
            { name: 'inStock', type: 'number', required: true, min: 0, admin: { step: 1 } },
            { name: 'inStockAmount', type: 'number', admin: { readOnly: true } },
          ],
        },

        // Required
        {
          type: 'row',
          fields: [
            {
              name: 'requiredQty',
              label: 'Required Qty',
              type: 'number',
              required: true,
              min: 0,
              admin: { step: 1 },
            },
            { name: 'requiredAmount', type: 'number', admin: { readOnly: true } },
          ],
        },
        {
          name: 'requiredDate',
          label: 'Required Date',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },

        // Sending
        {
          type: 'row',
          fields: [
            {
              name: 'sendingQty',
              label: 'Sending Qty',
              type: 'number',
              min: 0,
              admin: { step: 1 },
            },
            { name: 'sendingAmount', type: 'number', admin: { readOnly: true } },
          ],
        },
        {
          name: 'sendingDate',
          label: 'Sending Date',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'sendingUpdatedBy',
          label: 'Updated By',
          type: 'relationship',
          relationTo: 'users',
          admin: { readOnly: true },
        },

        // Confirmed (NEW)
        {
          type: 'row',
          fields: [
            {
              name: 'confirmedQty',
              label: 'Confirmed Qty',
              type: 'number',
              min: 0,
              admin: { step: 1 },
            },
            { name: 'confirmedAmount', type: 'number', admin: { readOnly: true } },
          ],
        },
        {
          name: 'confirmedDate',
          label: 'Confirmed Date',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'confirmedUpdatedBy',
          label: 'Updated By',
          type: 'relationship',
          relationTo: 'users',
          admin: { readOnly: true },
        },

        // Picked
        {
          type: 'row',
          fields: [
            { name: 'pickedQty', label: 'Picked Qty', type: 'number', min: 0, admin: { step: 1 } },
            { name: 'pickedAmount', type: 'number', admin: { readOnly: true } },
          ],
        },
        {
          name: 'pickedDate',
          label: 'Picked Date',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'pickedUpdatedBy',
          label: 'Updated By',
          type: 'relationship',
          relationTo: 'users',
          admin: { readOnly: true },
        },

        // Received
        {
          type: 'row',
          fields: [
            {
              name: 'receivedQty',
              label: 'Received Qty',
              type: 'number',
              min: 0,
              admin: { step: 1 },
            },
            { name: 'receivedAmount', type: 'number', admin: { readOnly: true } },
          ],
        },
        {
          name: 'receivedDate',
          label: 'Received Date',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },

        // Difference
        {
          type: 'row',
          fields: [
            {
              name: 'differenceQty',
              label: 'Difference Qty',
              type: 'number',
              admin: { readOnly: true },
            },
            { name: 'differenceAmount', type: 'number', admin: { readOnly: true } },
          ],
        },

        {
          name: 'status',
          type: 'select',
          defaultValue: 'ordered',
          options: [
            { label: 'Ordered', value: 'ordered' },
            { label: 'Sending', value: 'sending' },
            { label: 'Confirmed', value: 'confirmed' },
            { label: 'picked', value: 'picked' },
            { label: 'Received', value: 'received' },
          ],
        },
      ],
    },

    // REMOVED ALL total* fields — you said you calculate them in your script
    { name: 'branch', type: 'relationship', relationTo: 'branches', required: true },
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
      defaultValue: 'ordered',
      options: [
        { label: 'Ordered', value: 'ordered' },
        { label: 'Sending', value: 'sending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'picked', value: 'picked' },
        { label: 'Received', value: 'received' },
      ],
    },
    { name: 'notes', type: 'textarea' },
  ],
  timestamps: true,
}

export default StockOrders
