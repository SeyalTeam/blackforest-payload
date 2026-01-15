import { CollectionConfig } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const InstockEntries: CollectionConfig = {
  slug: 'instock-entries',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role != null && ['branch', 'waiter', 'superadmin'].includes(user.role),
    update: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'supervisor', 'branch'].includes(user.role),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc: _originalDoc }) => {
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

          const prefix = `${abbr}-INS-${dateStr}-`
          const { totalDocs: existingCount } = await req.payload.count({
            collection: 'instock-entries',
            where: {
              invoiceNumber: {
                greater_than_equal: `${prefix}01`,
                less_than_equal: `${prefix}99`,
              },
            },
          })
          const seq = (existingCount + 1).toString().padStart(2, '0')
          data.invoiceNumber = `${prefix}${seq}`
        }

        // Process items
        if (data.items && data.items.length > 0) {
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

            // Force status to 'waiting' on create
            if (operation === 'create') {
              item.status = 'waiting'
            }

            // Auto-populate dealer from product if not provided
            if (!item.dealer && product.dealer) {
              const productDealerId =
                typeof product.dealer === 'string' ? product.dealer : product.dealer.id
              if (productDealerId) {
                item.dealer = productDealerId
              }
            }
          }
        }

        // Force status to 'waiting' on create
        if (operation === 'create') {
          data.status = 'waiting'
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
      name: 'date',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        {
          name: 'dealer',
          type: 'relationship',
          relationTo: 'dealers',
          required: false,
        },
        {
          name: 'instock',
          label: 'In Stock Qty',
          type: 'number',
          required: true,
          min: 0,
          admin: { step: 1 },
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'waiting',
          options: [
            { label: 'Waiting', value: 'waiting' },
            { label: 'Approved', value: 'approved' },
          ],
        },
      ],
    },
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
      name: 'dealer',
      type: 'relationship',
      relationTo: 'dealers',
      required: false,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'waiting',
      options: [
        { label: 'Waiting', value: 'waiting' },
        { label: 'Approved', value: 'approved' },
      ],
      access: {
        update: ({ req: { user } }) => ['superadmin', 'supervisor'].includes(user?.role || ''),
      },
    },
  ],
  timestamps: true,
}

export default InstockEntries
