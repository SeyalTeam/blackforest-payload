import { CollectionConfig } from 'payload'
import { getProductStock } from '../utilities/inventory'

const Billings: CollectionConfig = {
  slug: 'billings',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) =>
      user?.role != null && ['branch', 'waiter', 'superadmin'].includes(user.role),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return
        // 1️⃣ Fix missing data for validation (Auto-set fields early)
        if (operation === 'create') {
          // 🏢 Auto-set company from branch early to pass validation
          const branchId = data.branch
          if (branchId) {
            const branch = await req.payload.findByID({
              collection: 'branches',
              id: typeof branchId === 'object' ? branchId.id : branchId,
              depth: 0,
            })
            if (branch?.company) {
              data.company = typeof branch.company === 'object' ? branch.company.id : branch.company
            }
          }

          // 🧾 Placeholder for invoice number to pass validation
          if (!data.invoiceNumber) {
            data.invoiceNumber = 'TEMP-' + Date.now()
          }

          // 💰 Total amount placeholder
          if (data.totalAmount === undefined) {
            data.totalAmount = 0
          }
        }

        // 🛑 Inventory Validation
        if ((operation === 'create' || operation === 'update') && data.status !== 'cancelled') {
          const items = data.items || []
          const branchId = data.branch || originalDoc?.branch

          if (branchId && items.length > 0) {
            for (const item of items) {
              const productId = typeof item.product === 'object' ? item.product.id : item.product
              if (!productId) continue

              const currentStock = await getProductStock(req.payload, productId, branchId)

              // If it's an update, we need to account for the quantity already in this document
              let existingQty = 0
              if (operation === 'update' && originalDoc?.items) {
                const originalItem = (
                  originalDoc.items as Array<{ product: any; quantity: number }>
                ).find((oi) => {
                  const oiId = typeof oi.product === 'object' ? oi.product.id : oi.product
                  return oiId === productId
                })
                if (originalItem) {
                  existingQty = originalItem.quantity || 0
                }
              }

              const requestedQty = item.quantity || 0
              const additionalQtyNeeded = requestedQty - existingQty

              if (additionalQtyNeeded > currentStock) {
                console.log(
                  `[Inventory] WARNING: ${item.name} (${requestedQty} needed, ${currentStock} available). Proceeding due to override.`,
                )
                // throw new APIError(
                //   `Insufficient stock for ${item.name}. Current stock: ${currentStock}, Requested: ${requestedQty}${operation === 'update' ? ` (Additional: ${additionalQtyNeeded})` : ''}`,
                //   400,
                // )
              }
            }
          }
        }

        return data
      },
    ],
    beforeChange: [
      async ({ data, req, operation }) => {
        if (!data) return
        if (operation === 'create') {
          // 🧾 Final Invoice Number generation
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')

          if (data.branch) {
            let branchId: string
            if (typeof data.branch === 'string') {
              branchId = data.branch
            } else if (typeof data.branch === 'object' && data.branch !== null) {
              branchId = data.branch.id
            } else {
              return data
            }

            const branch = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })

            if (branch?.name) {
              const prefix = branch.name.substring(0, 3).toUpperCase()
              const existingCount = await req.payload.db.collections.billings.countDocuments({
                invoiceNumber: { $regex: `^${prefix}-${formattedDate}-` },
              })
              const seq = (existingCount + 1).toString().padStart(3, '0')
              data.invoiceNumber = `${prefix}-${formattedDate}-${seq}`
            }
          }
        }

        // 🧮 Final subtotal & total calculation
        if (data.items && Array.isArray(data.items)) {
          data.items = data.items.map(
            (item: {
              quantity: number | string
              unitPrice: number | string
              subtotal?: number
            }) => {
              const qty =
                typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity
              const unitPrice =
                typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : item.unitPrice
              return {
                ...item,
                subtotal: parseFloat(((qty || 0) * (unitPrice || 0)).toFixed(2)),
              }
            },
          )

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
        },
        {
          // ✅ Fractional quantities (e.g. 0.5 kg)
          name: 'quantity',
          type: 'number',
          required: true,
          min: 0.01,
          validate: (val?: number | null) => {
            if (typeof val !== 'number' || val <= 0) {
              return 'Quantity must be greater than 0'
            }
            return true
          },
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          // ✅ Calculated automatically
          name: 'subtotal',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true },
        },
        {
          name: 'branchOverride',
          type: 'checkbox',
          label: 'Branch-Specific Override Applied',
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
      name: 'customerDetails',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'address', type: 'text' },
      ],
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Card', value: 'card' },
        { label: 'UPI', value: 'upi' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'billDetailView',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/BillDetailView/index.tsx#default',
        },
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}

export default Billings
