import { CollectionConfig } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const getRelationshipID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'object' && value !== null) {
    if ('id' in value && (value as { id?: unknown }).id != null) {
      const id = (value as { id?: unknown }).id
      if (typeof id === 'string' || typeof id === 'number') return String(id).trim()
      if (typeof id === 'object') {
        const nestedId = getRelationshipID(id)
        if (nestedId) return nestedId
      }
    }
    if ('_id' in value && (value as { _id?: unknown })._id != null) {
      const id = (value as { _id?: unknown })._id
      if (typeof id === 'string' || typeof id === 'number') return String(id).trim()
      if (id && typeof (id as any).toString === 'function') {
        const str = (id as any).toString()
        if (str && str !== '[object Object]') return str
      }
    }
    if ('value' in value && (value as { value?: unknown }).value != null) {
      const resolved = getRelationshipID((value as { value?: unknown }).value)
      if (resolved) return resolved
    }
    if (typeof (value as any).toHexString === 'function') {
      return (value as any).toHexString()
    }
    if (typeof (value as any).toString === 'function') {
      const str = (value as any).toString()
      if (str && str !== '[object Object]') return str
    }
  }
  return null
}

const InstockEntries: CollectionConfig = {
  slug: 'instock-entries',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      Boolean(
        user?.role != null &&
          ['superadmin', 'admin', 'branch', 'waiter', 'cashier', 'supervisor', 'manager', 'company'].includes(
            user.role,
          ),
      ),
    update: ({ req: { user } }) =>
      Boolean(
        user?.role != null &&
          ['superadmin', 'admin', 'supervisor', 'branch', 'cashier', 'manager', 'company'].includes(user.role),
      ),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc: _originalDoc }) => {
        if (!data.cashierId && req.user) {
          const emp = (req.user as any)?.employee
          const empId = getRelationshipID(emp) || req.user.id
          data.cashierId = empId ? String(empId) : String(req.user.id)
        }
        if (!data.cashierName && req.user) {
          const emp = (req.user as any)?.employee
          const empName = typeof emp === 'object' && emp !== null ? emp.name : null
          data.cashierName = empName || req.user.name || (req.user as any).username || ''
        }
        if (!data.createdBy && req.user) {
          data.createdBy = req.user.id
        }
        if (operation === 'create') {
          if (!req.user) throw new Error('Unauthorized')

          // Auto-populate branch if missing
          let branchId =
            getRelationshipID(data.branch) ||
            getRelationshipID((req.user as any)?.lastLoginBranch) ||
            getRelationshipID(req.user?.branch)

          if (!branchId) {
            throw new Error('Branch is required')
          }
          data.branch = branchId

          // Auto-generate invoice number
          const date = dayjs().tz('Asia/Kolkata')
          const dateStr = date.format('YYMMDD')

          let branchDoc = null
          try {
            branchDoc = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })
          } catch (err) {
            console.error('[InstockEntries hook] Error finding branch:', err)
          }

          const abbr = ((branchDoc?.name || 'BRN') as string).substring(0, 3).toUpperCase()

          // Robust company resolution: branch -> user -> existing data -> fallback to any company
          let resolvedCompanyId =
            getRelationshipID(data.company) ||
            getRelationshipID(branchDoc?.company) ||
            getRelationshipID(req.user?.company)

          if (!resolvedCompanyId) {
            try {
              const compRes = await req.payload.find({
                collection: 'companies',
                limit: 1,
                depth: 0,
                overrideAccess: true,
              })
              if (compRes.docs?.[0]?.id) {
                resolvedCompanyId = String(compRes.docs[0].id)
              }
            } catch (_) {}
          }

          if (resolvedCompanyId) {
            data.company = resolvedCompanyId
          }

          const prefix = `${abbr}-INS-${dateStr}-`
          let seq = 1
          try {
            const { totalDocs: existingCount } = await req.payload.count({
              collection: 'instock-entries',
              where: {
                invoiceNumber: {
                  greater_than_equal: `${prefix}01`,
                  less_than_equal: `${prefix}99`,
                },
              },
            })
            seq = existingCount + 1
          } catch (_) {}

          for (let attempt = 0; attempt < 25; attempt++) {
            const candidate = `${prefix}${(seq + attempt).toString().padStart(2, '0')}`
            const exists = await req.payload.find({
              collection: 'instock-entries',
              where: { invoiceNumber: { equals: candidate } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            if (!exists?.docs?.length) {
              data.invoiceNumber = candidate
              break
            }
          }
          if (!data.invoiceNumber) {
            data.invoiceNumber = `${prefix}${seq.toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`
          }
        }

        // Check if skipInstockApproval is enabled for this branch
        let isApprovalSkipped = false
        const branchId =
          getRelationshipID(data.branch) ||
          getRelationshipID(_originalDoc?.branch) ||
          getRelationshipID((req.user as any)?.lastLoginBranch) ||
          getRelationshipID(req.user?.branch)

        if (branchId) {
          try {
            const widgetSettings = await req.payload.findGlobal({
              slug: 'widget-settings',
              depth: 0,
            })
            const skipRows = (widgetSettings as any)?.skipInstockApprovalByBranch
            if (Array.isArray(skipRows)) {
              const branchRow = skipRows.find((r: any) => {
                const rBranchId = getRelationshipID(r.branch)
                return String(rBranchId) === String(branchId)
              })
              if (branchRow && branchRow.skipInstockApproval === true) {
                isApprovalSkipped = true
              }
            }
          } catch (err) {
            req.payload.logger.error(
              `[InstockEntries Hook] Error checking skip approval settings:`,
              err,
            )
          }
        }

        // Process items
        if (data.items && data.items.length > 0) {
          for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i]
            if (!item.product) continue

            const productId = getRelationshipID(item.product)
            if (!productId) continue
            item.product = productId

            let product = null
            try {
              product = await req.payload.findByID({
                collection: 'products',
                id: productId,
                depth: 1,
              })
            } catch (error) {
              console.warn(`[InstockEntries Hook] Product with ID ${productId} not found:`, error)
            }

            // Set item status based on skip approval setting
            if (operation === 'create') {
              item.status = isApprovalSkipped ? 'approved' : 'waiting'
            } else if (operation === 'update' && !item.status) {
              item.status = isApprovalSkipped ? 'approved' : 'waiting'
            }

            // Auto-populate dealer from product if not provided
            if (product && !item.dealer && product.dealer) {
              let productDealerId = ''
              if (Array.isArray(product.dealer) && product.dealer.length > 0) {
                const firstDealer = product.dealer[0]
                productDealerId = getRelationshipID(firstDealer) || ''
              } else {
                productDealerId = getRelationshipID(product.dealer) || ''
              }
              if (productDealerId) {
                item.dealer = productDealerId
              }
            }
          }
        }

        // Set doc status based on skip approval setting
        if (operation === 'create') {
          data.status = isApprovalSkipped ? 'approved' : 'waiting'
        } else if (operation === 'update' && data.items && data.items.length > 0) {
          const allApproved = data.items.every((it: any) => it.status === 'approved')
          data.status = allApproved ? 'approved' : 'waiting'
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
    {
      name: 'cashierId',
      type: 'text',
      index: true,
      admin: { description: 'ID of the cashier who created/submitted the instock entry.' },
    },
    {
      name: 'cashierName',
      type: 'text',
      index: true,
      admin: { description: 'Name of the cashier who created/submitted the instock entry.' },
    },
  ],
  timestamps: true,
}

export default InstockEntries
