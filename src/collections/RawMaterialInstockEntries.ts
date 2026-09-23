import { CollectionConfig } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const RawMaterialInstockEntries: CollectionConfig = {
  slug: 'raw-material-instock-entries',
  admin: {
    useAsTitle: 'invoiceNumber',
    group: 'Raw Material',
    defaultColumns: ['invoiceNumber', 'date', 'company', 'status', 'storeKeeperName'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      Boolean(
        user?.role != null &&
          [
            'superadmin',
            'admin',
            'company',
            'branch',
            'store_keeper',
            'manager',
            'cashier',
            'supervisor',
          ].includes(user.role),
      ),
    update: ({ req: { user } }) =>
      Boolean(
        user?.role != null &&
          [
            'superadmin',
            'admin',
            'supervisor',
            'company',
            'store_keeper',
            'manager',
          ].includes(user.role),
      ),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (!data.storeKeeperId && req.user) {
          const emp = (req.user as any)?.employee
          const empId = typeof emp === 'object' && emp !== null ? emp.id || emp._id : emp
          data.storeKeeperId = empId ? String(empId) : String(req.user.id)
        }
        if (!data.storeKeeperName && req.user) {
          const emp = (req.user as any)?.employee
          const empName = typeof emp === 'object' && emp !== null ? emp.name : null
          data.storeKeeperName = empName || req.user.name || (req.user as any).username || ''
        }
        if (!data.createdBy && req.user) {
          data.createdBy = req.user.id
        }
        if (!data.createdByName && req.user) {
          const u = req.user as any
          data.createdByName = u.name || u.username || u.email || 'Unknown'
        }
        if (!data.createdByRole && req.user) {
          data.createdByRole = req.user.role || 'Unknown'
        }

        if (operation === 'create') {
          // Resolve company if not directly passed
          if (!data.company && req.user) {
            if (
              req.user.role === 'store_keeper' &&
              req.user.storekeeper_companies &&
              req.user.storekeeper_companies.length > 0
            ) {
              const comp = req.user.storekeeper_companies[0]
              data.company = typeof comp === 'string' ? comp : comp.id
            } else if (req.user.company) {
              const comp = req.user.company
              data.company = typeof comp === 'string' ? comp : comp.id
            } else if (req.user.branch) {
              const branchId =
                typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
              if (branchId) {
                try {
                  const branchDoc = await req.payload.findByID({
                    collection: 'branches',
                    id: branchId,
                    depth: 0,
                  })
                  if (branchDoc?.company) {
                    const comp = branchDoc.company
                    data.company = typeof comp === 'string' ? comp : comp.id
                  }
                } catch (_) {}
              }
            }
          }

          // Generate company abbreviation
          let abbr = 'RM'
          let companyId: string | undefined
          if (typeof data.company === 'string') {
            companyId = data.company
          } else if (
            typeof data.company === 'object' &&
            data.company !== null &&
            'id' in data.company
          ) {
            companyId = data.company.id
          }

          if (companyId) {
            try {
              const comp = await req.payload.findByID({
                collection: 'companies',
                id: companyId,
                depth: 0,
              })
              if (comp?.name) {
                abbr = comp.name.substring(0, 3).toUpperCase()
              }
            } catch (_) {}
          }

          // Auto-generate invoice number
          const date = dayjs().tz('Asia/Kolkata')
          const dateStr = date.format('YYMMDD')
          const prefix = `${abbr}-RMINS-${dateStr}-`

          const { totalDocs: existingCount } = await req.payload.count({
            collection: 'raw-material-instock-entries',
            where: {
              invoiceNumber: {
                greater_than_equal: `${prefix}01`,
                less_than_equal: `${prefix}9999`,
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
            if (!item.rawMaterial) continue

            const rawMaterialId =
              typeof item.rawMaterial === 'string' ? item.rawMaterial : item.rawMaterial?.id
            if (!rawMaterialId) continue

            let rawMaterialDoc = null
            try {
              rawMaterialDoc = await req.payload.findByID({
                collection: 'raw-materials',
                id: rawMaterialId,
                depth: 1,
              })
            } catch (error) {
              console.warn(
                `[RawMaterialInstockEntries Hook] Raw Material with ID ${rawMaterialId} not found:`,
                error,
              )
            }

            if (operation === 'create') {
              item.status = 'waiting'
            }

            // Auto-populate unit from raw material if missing
            if (rawMaterialDoc && !item.unit && rawMaterialDoc.unit) {
              item.unit = rawMaterialDoc.unit
            }

            // Auto-populate dealer from raw material if not provided
            if (rawMaterialDoc && !item.dealer && rawMaterialDoc.dealer) {
              let dealerId = ''
              if (Array.isArray(rawMaterialDoc.dealer) && rawMaterialDoc.dealer.length > 0) {
                const firstDealer = rawMaterialDoc.dealer[0]
                dealerId =
                  typeof firstDealer === 'string' ? firstDealer : (firstDealer as any).id
              } else if (typeof rawMaterialDoc.dealer === 'string') {
                dealerId = rawMaterialDoc.dealer
              } else if (
                typeof rawMaterialDoc.dealer === 'object' &&
                (rawMaterialDoc.dealer as any).id
              ) {
                dealerId = (rawMaterialDoc.dealer as any).id
              }
              if (dealerId) {
                item.dealer = dealerId
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
        {
          name: 'rawMaterial',
          type: 'relationship',
          relationTo: 'raw-materials',
          required: true,
        },
        {
          name: 'dealer',
          type: 'relationship',
          relationTo: 'raw-material-dealers',
          required: false,
        },
        {
          name: 'instock',
          label: 'In Stock Qty',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'unit',
          label: 'Unit',
          type: 'text',
          required: false,
        },
        {
          name: 'notes',
          label: 'Item Notes',
          type: 'text',
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
        },
      ],
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false,
      admin: { position: 'sidebar' },
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
        update: ({ req: { user } }) =>
          ['superadmin', 'supervisor', 'admin'].includes(user?.role || ''),
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notes / Remarks',
      required: false,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      defaultValue: ({ user }) => user?.id,
      admin: { readOnly: true },
    },
    {
      name: 'createdByName',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'createdByRole',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'storeKeeperId',
      type: 'text',
      index: true,
      admin: { description: 'ID of the store keeper who created/submitted the entry.' },
    },
    {
      name: 'storeKeeperName',
      type: 'text',
      index: true,
      admin: { description: 'Name of the store keeper who created/submitted the entry.' },
    },
  ],
  timestamps: true,
}

export default RawMaterialInstockEntries
