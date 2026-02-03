import { CollectionConfig } from 'payload'
import { getProductStock } from '../utilities/inventory'
import { updateItemStatus } from '../endpoints/updateItemStatus'

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
  endpoints: [
    {
      path: '/:id/items/status',
      method: 'patch',
      handler: updateItemStatus,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return

        // 🪑 Map table details from Flutter app (top-level section/tableNumber) to nested group
        const rawData = data as any
        const hasTableDetails =
          rawData.section ||
          rawData.tableNumber ||
          data.tableDetails?.section ||
          data.tableDetails?.tableNumber

        if (rawData.section || rawData.tableNumber) {
          data.tableDetails = {
            ...data.tableDetails,
            section: rawData.section || data.tableDetails?.section,
            tableNumber: rawData.tableNumber || data.tableDetails?.tableNumber,
          }
        }

        // 🎯 Ensure default status for table/KOT orders
        if (hasTableDetails && (!data.status || data.status === 'pending')) {
          data.status = 'ordered'
        }

        // 🔄 Backward compatibility: Map legacy statuses
        if (data.status === 'pending') {
          data.status = 'ordered'
        }
        if (data.status === 'preparing') {
          data.status = 'prepared'
        }

        // 🍱 Map item statuses for backward compatibility
        if (data.items && Array.isArray(data.items)) {
          data.items = data.items.map((item: any) => {
            if (item.status === 'preparing') {
              return { ...item, status: 'prepared' }
            }
            return item
          })
        }

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

              // 🚫 Skip inventory check for cancelled items
              if (item.status === 'cancelled') continue

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
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return

        // 🍱 Ensure each item has a status (Ordered by default) and timestamps
        if (data.items && Array.isArray(data.items)) {
          const now = new Date().toISOString()
          data.items = data.items.map((item: any) => {
            const status = item.status || 'ordered'
            const updatedItem = {
              ...item,
              status,
            }

            // Automatically set the timestamp for the current status if not already set
            const timestampField = `${status}At`
            if (!updatedItem[timestampField]) {
              updatedItem[timestampField] = now
            }

            return updatedItem
          })
        }

        if (
          operation === 'create' ||
          (operation === 'update' &&
            data.status === 'completed' &&
            ['ordered', 'confirmed', 'prepared', 'delivered', 'pending'].includes(
              originalDoc?.status || '',
            ))
        ) {
          // 🧾 Invoice Number generation
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')

          const status = data.status || originalDoc?.status || 'ordered'
          const isKOT = ['ordered', 'confirmed', 'prepared', 'delivered'].includes(status)

          // Only generate a new number if it's a creation OR if we're moving out of a KOT status
          // and currently have a KOT number (or no number yet).
          const currentInvoiceNumber = data.invoiceNumber || originalDoc?.invoiceNumber
          const wasKOT = ['ordered', 'confirmed', 'prepared', 'delivered', 'pending'].includes(
            originalDoc?.status || '',
          )

          const needsNewNumber =
            operation === 'create' ||
            (data.status === 'completed' && wasKOT && currentInvoiceNumber?.includes('-KOT')) ||
            !currentInvoiceNumber

          if (needsNewNumber && (data.branch || originalDoc?.branch)) {
            let branchId: string
            const branchRef = data.branch || originalDoc.branch
            if (typeof branchRef === 'string') {
              branchId = branchRef
            } else if (typeof branchRef === 'object' && branchRef !== null) {
              branchId = branchRef.id
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

              if (isKOT) {
                // KOT Numbering: PREFIX-YYYYMMDD-KOTxx
                // We find the latest KOT number to avoid collisions if documents were deleted
                const lastKOT = await req.payload.find({
                  collection: 'billings',
                  where: {
                    kotNumber: {
                      like: `${prefix}-${formattedDate}-KOT`,
                    },
                  },
                  sort: '-kotNumber',
                  limit: 1,
                  depth: 0,
                })

                let seq = 1
                if (lastKOT.docs.length > 0) {
                  const lastNumStr = lastKOT.docs[0].kotNumber?.split('KOT')[1]
                  if (lastNumStr) {
                    seq = parseInt(lastNumStr, 10) + 1
                  }
                }

                const kotNum = `${prefix}-${formattedDate}-KOT${seq.toString().padStart(2, '0')}`
                data.invoiceNumber = kotNum
                data.kotNumber = kotNum
              } else {
                // Regular Numbering: PREFIX-YYYYMMDD-xxx (independent of KOT)
                const lastInvoice = await req.payload.find({
                  collection: 'billings',
                  where: {
                    and: [
                      {
                        invoiceNumber: {
                          like: `${prefix}-${formattedDate}-`,
                        },
                      },
                      {
                        invoiceNumber: {
                          not_like: '-KOT',
                        },
                      },
                    ],
                  },
                  sort: '-invoiceNumber',
                  limit: 1,
                  depth: 0,
                })

                let seq = 1
                if (lastInvoice.docs.length > 0) {
                  const lastInvoiceNumber = lastInvoice.docs[0].invoiceNumber
                  if (lastInvoiceNumber) {
                    const parts = lastInvoiceNumber.split('-')
                    const lastSeq = parts[parts.length - 1]
                    if (lastSeq && !isNaN(parseInt(lastSeq, 10))) {
                      seq = parseInt(lastSeq, 10) + 1
                    }
                  }
                }
                data.invoiceNumber = `${prefix}-${formattedDate}-${seq.toString().padStart(3, '0')}`
              }
            }
          }
        }

        // 📝 Distribute root notes to items if applicable (e.g. "Product: Note")
        if (data.notes && data.items && Array.isArray(data.items)) {
          data.items = data.items.map((item: any) => {
            if (!item.notes && data.notes.startsWith(item.name + ':')) {
              const parts = data.notes.split(':')
              if (parts.length > 1) {
                item.notes = parts[1].trim()
              }
            } else if (!item.notes && data.items.length === 1 && !data.notes.includes(':')) {
              // If only one item and no colon, assume it's for that item
              item.notes = data.notes
            }
            return item
          })
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
    afterChange: [
      async ({ doc, req, operation }) => {
        if (!doc) return
        // Sync Customer Data
        if (operation === 'create' || operation === 'update') {
          const phoneNumber = doc.customerDetails?.phoneNumber
          const customerName = doc.customerDetails?.name
          // const address = doc.customerDetails?.address

          if (phoneNumber) {
            const finalCustomerName = customerName || phoneNumber
            try {
              // 1. Check if customer exists
              const existingCustomers = await req.payload.find({
                collection: 'customers',
                where: {
                  phoneNumber: {
                    equals: phoneNumber,
                  },
                },
                depth: 0,
              })

              if (existingCustomers.totalDocs > 0) {
                // 2. Update existing customer
                const customer = existingCustomers.docs[0]
                const currentBills =
                  customer.bills?.map((b) => (typeof b === 'object' ? b.id : b)) || []

                // Add current bill if not already present
                if (!currentBills.includes(doc.id)) {
                  await req.payload.update({
                    collection: 'customers',
                    id: customer.id,
                    data: {
                      bills: [...currentBills, doc.id],
                      // Update name/address if changed? Optional. Keeping latest for now.
                      // name: customerName,
                    },
                  })
                }
              } else {
                // 3. Create new customer
                await req.payload.create({
                  collection: 'customers',
                  data: {
                    name: finalCustomerName,
                    phoneNumber: phoneNumber,
                    bills: [doc.id],
                  },
                })
              }
            } catch (error) {
              console.error('Error syncing customer data:', error)
            }
          }
        }
        return doc
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
      name: 'kotNumber',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      label: 'KOT Invoice Number',
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
          name: 'status',
          type: 'select',
          defaultValue: 'ordered',
          options: [
            { label: 'Ordered', value: 'ordered' },
            { label: 'Confirmed', value: 'confirmed' },
            { label: 'Prepared', value: 'prepared' },
            { label: 'Delivered', value: 'delivered' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
          admin: {
            condition: (data) =>
              ['ordered', 'confirmed', 'prepared', 'delivered'].includes(data.status),
          },
        },

        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'notes',
          type: 'text',
          label: 'Instructions',
          admin: {
            placeholder: 'e.g., More sugar, Less spicy',
          },
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
          name: 'orderedAt',
          type: 'date',
          admin: { readOnly: true, position: 'sidebar' },
        },
        {
          name: 'confirmedAt',
          type: 'date',
          admin: { readOnly: true, position: 'sidebar' },
        },
        {
          name: 'preparedAt',
          type: 'date',
          admin: { readOnly: true, position: 'sidebar' },
        },
        {
          name: 'deliveredAt',
          type: 'date',
          admin: { readOnly: true, position: 'sidebar' },
        },
        {
          name: 'cancelledAt',
          type: 'date',
          admin: { readOnly: true, position: 'sidebar' },
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
      type: 'row',
      fields: [
        {
          name: 'createdBy',
          type: 'relationship',
          relationTo: 'users',
          required: true,
          defaultValue: ({ user }) => user?.id,
          admin: { readOnly: true },
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
      ],
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
        { name: 'phoneNumber', type: 'text' },
        { name: 'address', type: 'text' },
      ],
    },

    {
      name: 'status',
      type: 'select',
      defaultValue: 'ordered',
      options: [
        { label: 'Ordered', value: 'ordered' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Prepared', value: 'prepared' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },

    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'tableDetails',
      type: 'group',
      fields: [
        {
          name: 'section',
          type: 'text',
          admin: {
            placeholder: 'e.g., AC, Non-AC',
          },
        },
        {
          name: 'tableNumber',
          type: 'text',
          admin: {
            placeholder: 'e.g., 01, 10',
          },
        },
      ],
      admin: {
        position: 'sidebar',
      },
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
