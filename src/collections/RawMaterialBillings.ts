import { CollectionConfig } from 'payload'

const RawMaterialBillings: CollectionConfig = {
  slug: 'raw-material-billings',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['id', 'dealer', 'company', 'total', 'date', 'status', 'notes'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'dealer',
      type: 'relationship',
      relationTo: 'raw-material-dealers',
      required: true,
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
      access: {
        update: () => false,
      },
    },
    {
      name: 'bills',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
        {
          name: 'invoiceNumber',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'total',
      type: 'number',
      required: true,
    },
    {
      name: 'billCopyPhoto',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'productsPhoto',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      required: true,
    },
    {
      name: 'deliveryPersonPhoto',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'rawMaterials',
      type: 'relationship',
      relationTo: 'raw-materials',
      hasMany: true,
      required: false,
    },
    {
      name: 'rawMaterialsList',
      type: 'array',
      fields: [
        {
          name: 'rawMaterial',
          type: 'relationship',
          relationTo: 'raw-materials',
          required: false,
          validate: (value: any, { operation }: any) => {
            if (operation === 'create' && !value) {
              return 'Raw Material is required'
            }
            return true
          },
          filterOptions: ({ data }) => {
            const dealerId = typeof data?.dealer === 'string' ? data?.dealer : data?.dealer?.id
            if (dealerId) {
              return {
                dealer: {
                  equals: dealerId,
                },
              }
            }
            return true
          },
        },
        {
          name: 'packageSize',
          type: 'number',
          label: 'Package Size',
          required: false,
        },
        {
          name: 'numberOfPackages',
          type: 'number',
          label: 'Number of Packages',
          required: false,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          admin: {
            description: 'Total quantity (calculated automatically if Package Size and Number of Packages are set)',
          },
        },
        {
          name: 'totalAmount',
          type: 'number',
          required: false,
          defaultValue: 0,
          admin: {
            description: 'Total amount (cost) for this raw material item',
          },
        },
        {
          name: 'photo',
          type: 'relationship',
          relationTo: 'media',
          required: false,
          admin: {
            description: 'Photo of the product taken during raw material billing',
          },
        },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    {
      name: 'paidAmount',
      type: 'number',
      defaultValue: 0,
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'payments',
      type: 'array',
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
        {
          name: 'date',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'plannedPaymentDate',
      type: 'date',
      required: false,
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notes / Remarks',
      required: false,
      admin: {
        description: 'Notes or remarks for this raw material bill',
      },
    },
    {
      name: 'verification',
      type: 'group',
      label: 'Three-Step Verification',
      fields: [
        {
          name: 'overallStatus',
          type: 'select',
          label: 'Overall Verification Status',
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Partially Verified', value: 'partially_verified' },
            { label: 'Fully Verified', value: 'verified' },
            { label: 'Rejected', value: 'rejected' },
          ],
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'accountant',
          type: 'group',
          label: 'Accountant / Office Admin Verification (Step 1)',
          fields: [
            {
              name: 'status',
              type: 'select',
              defaultValue: 'pending',
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Verified', value: 'verified' },
                { label: 'Rejected', value: 'rejected' },
                { label: 'Skipped', value: 'skipped' },
              ],
            },
            {
              name: 'notes',
              type: 'textarea',
              label: 'Accountant Notes',
            },
            {
              name: 'verifiedBy',
              type: 'relationship',
              relationTo: 'users',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedByName',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedByRole',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedAt',
              type: 'date',
              admin: { readOnly: true },
            },
          ],
        },
        {
          name: 'watcher',
          type: 'group',
          label: 'Watcher Verification (Step 2)',
          fields: [
            {
              name: 'status',
              type: 'select',
              defaultValue: 'pending',
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Verified', value: 'verified' },
                { label: 'Rejected', value: 'rejected' },
                { label: 'Skipped', value: 'skipped' },
              ],
            },
            {
              name: 'notes',
              type: 'textarea',
              label: 'Watcher Notes',
            },
            {
              name: 'verifiedBy',
              type: 'relationship',
              relationTo: 'users',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedByName',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedByRole',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedAt',
              type: 'date',
              admin: { readOnly: true },
            },
          ],
        },
        {
          name: 'manager',
          type: 'group',
          label: 'Manager Verification (Step 3)',
          fields: [
            {
              name: 'status',
              type: 'select',
              defaultValue: 'pending',
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Verified', value: 'verified' },
                { label: 'Rejected', value: 'rejected' },
                { label: 'Skipped', value: 'skipped' },
              ],
            },
            {
              name: 'notes',
              type: 'textarea',
              label: 'Manager Notes',
            },
            {
              name: 'verifiedBy',
              type: 'relationship',
              relationTo: 'users',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedByName',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedByRole',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'verifiedAt',
              type: 'date',
              admin: { readOnly: true },
            },
          ],
        },
      ],
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'createdByName',
      type: 'text',
      required: false,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'createdByRole',
      type: 'text',
      required: false,
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation === 'create') {
          if (req.user?.role === 'store_keeper' && req.user.storekeeper_companies && req.user.storekeeper_companies.length === 1) {
            const comp = req.user.storekeeper_companies[0]
            data.company = typeof comp === 'string' ? comp : comp.id
          }
          if (req.user) {
            if (!data.createdBy) {
              data.createdBy = req.user.id
            }
            if (!data.createdByName) {
              const u = req.user as any
              data.createdByName = u.name || u.username || u.email || 'Unknown'
            }
            if (!data.createdByRole) {
              data.createdByRole = req.user.role || 'Unknown'
            }
          }
        }
        if (data.rawMaterialsList) {
          data.rawMaterialsList = data.rawMaterialsList.map((item: any) => {
            if (item.packageSize && item.numberOfPackages) {
              item.quantity = item.packageSize * item.numberOfPackages
            }
            return item
          })
          data.rawMaterials = data.rawMaterialsList.map(
            (item: { rawMaterial: string | { id: string } }) =>
              typeof item.rawMaterial === 'string' ? item.rawMaterial : item.rawMaterial?.id
          ).filter(Boolean);
        }
        if (data.bills) {
          const calculatedTotal = data.bills.reduce(
            (sum: number, bill: { amount?: number }) => sum + (bill.amount || 0),
            0,
          )
          data.total = calculatedTotal
        }
        if (data.payments) {
          const totalPaid = data.payments.reduce(
            (sum: number, p: { amount?: number }) => sum + (p.amount || 0),
            0,
          )
          data.paidAmount = totalPaid
        }
        if (data.status === 'paid' && (!data.payments || data.payments.length === 0)) {
          data.paidAmount = data.total
          data.payments = [
            {
              amount: data.total,
              date: new Date().toISOString(),
            },
          ]
        } else if (data.status === 'paid' && !data.paidAmount) {
          data.paidAmount = data.total
        } else if (data.paidAmount !== undefined && data.total !== undefined && data.paidAmount >= data.total) {
          data.status = 'paid'
        }
        // Recalculate verification overallStatus if verification object is present
        if (data.verification) {
          const acc = data.verification.accountant?.status || 'pending'
          const wat = data.verification.watcher?.status || 'pending'
          const mgr = data.verification.manager?.status || 'pending'

          if (acc === 'rejected' || wat === 'rejected' || mgr === 'rejected') {
            data.verification.overallStatus = 'rejected'
          } else if (
            (acc === 'verified' || acc === 'skipped') &&
            (wat === 'verified' || wat === 'skipped') &&
            (mgr === 'verified' || mgr === 'skipped')
          ) {
            data.verification.overallStatus = 'verified'
          } else if (
            acc === 'verified' || acc === 'skipped' ||
            wat === 'verified' || wat === 'skipped' ||
            mgr === 'verified' || mgr === 'skipped'
          ) {
            data.verification.overallStatus = 'partially_verified'
          } else {
            data.verification.overallStatus = 'pending'
          }
        }

        // Ensure that payments or status === 'paid' cannot be recorded unless verifications are satisfied,
        // unless overridden by superadmin or admin
        const isTryingToPay = data.status === 'paid' || (data.payments && data.payments.length > 0 && data.paidAmount > 0)
        if (isTryingToPay && operation !== 'create') {
          const userRole = req.user?.role
          const isSuperOrAdmin = userRole === 'superadmin' || userRole === 'admin'
          if (!isSuperOrAdmin && data.verification && data.verification.overallStatus !== 'verified') {
            throw new Error('Payment cannot be processed. All required verification steps (Accountant, Watcher, Manager) must be completed or skipped first.')
          }
        }

        return data
      },
    ],
  },
}

export default RawMaterialBillings
