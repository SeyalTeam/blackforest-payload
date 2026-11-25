import { CollectionConfig } from 'payload'

function toIdString(val: any): string | undefined {
  if (!val) return undefined
  if (typeof val === 'string') return val
  if (Buffer.isBuffer(val)) return val.toString('hex')
  if (val && typeof val === 'object') {
    if (val._id && val._id !== val) return toIdString(val._id)
    if (val.id && val.id !== val) return toIdString(val.id)
    if (typeof val.toString === 'function') {
      const s = val.toString()
      if (typeof s === 'string' && s.length === 24) return s
    }
  }
  return undefined
}

const DealerBillings: CollectionConfig = {
  slug: 'dealer-billings',
  admin: {
    useAsTitle: 'id',
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
      relationTo: 'dealers',
      required: true,
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
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
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      required: false,
    },
    {
      name: 'productsList',
      type: 'array',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
        },
        {
          name: 'totalAmount',
          type: 'number',
          required: false,
          defaultValue: 0,
        },
        {
          name: 'photo',
          type: 'relationship',
          relationTo: 'media',
          required: false,
          admin: {
            description: 'Photo of the product taken during dealer billing',
          },
        },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
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
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'cashierId',
      type: 'text',
      index: true,
      admin: { description: 'ID of the cashier who submitted the dealer billing.' },
    },
    {
      name: 'cashierName',
      type: 'text',
      index: true,
      admin: { description: 'Name of the cashier who submitted the dealer billing.' },
    },
    {
      name: 'plannedPaymentDate',
      type: 'date',
      required: false,
      index: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notes / Remarks',
      required: false,
      admin: {
        description: 'Notes or remarks for this dealer / other product bill',
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
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data, originalDoc }: any) => {
        if (!data.cashierId && req.user) {
          const emp = (req.user as any)?.employee
          const empId = typeof emp === 'object' && emp !== null ? (emp.id || emp._id) : emp
          data.cashierId = empId ? String(empId) : String(req.user.id)
        }
        if (!data.cashierName && req.user) {
          const emp = (req.user as any)?.employee
          const empName = typeof emp === 'object' && emp !== null ? emp.name : null
          data.cashierName = empName || req.user.name || (req.user as any).username || ''
        }
        if (operation === 'create') {
          if (req.user?.role === 'branch' && req.user.branch) {
            data.branch = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
          } else if (!data.branch && ['waiter', 'cashier'].includes(req.user?.role)) {
            const lastLoginBranch = (req.user as any)?.lastLoginBranch
            const lastLoginBranchId =
              typeof lastLoginBranch === 'string' ? lastLoginBranch : lastLoginBranch?.id
            if (lastLoginBranchId) {
              data.branch = lastLoginBranchId
            } else if (req.user?.branch) {
              data.branch = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
            }
          }
        }
        // Normalize productsPhoto into an array of ID strings
        let photosArray: string[] = []
        const rawPhotos = data.productsPhoto !== undefined ? data.productsPhoto : originalDoc?.productsPhoto
        if (Array.isArray(rawPhotos)) {
          photosArray = rawPhotos
            .map(toIdString)
            .filter((s?: string): s is string => Boolean(s && s.length === 24))
        } else if (rawPhotos) {
          const pId = toIdString(rawPhotos)
          if (pId && pId.length === 24) photosArray = [pId]
        }

        if (data.productsList && Array.isArray(data.productsList)) {
          data.productsList = data.productsList.map((item: any, index: number) => {
            // 1. Extract item photo if provided as string or object
            let photoId = toIdString(item.photo)
            // 2. If missing, fallback to photosArray (which holds data.productsPhoto or originalDoc.productsPhoto)
            if (!photoId && photosArray.length > 0) {
              photoId = photosArray[index] || photosArray[0]
            }
            return {
              ...item,
              photo: photoId || null,
            }
          })

          data.products = data.productsList
            .map((item: { product: any }) => toIdString(item.product))
            .filter((s?: string): s is string => Boolean(s && s.length === 24));

          const listPhotos = data.productsList
            .map((item: any) => toIdString(item.photo))
            .filter((s?: string): s is string => Boolean(s && s.length === 24))
          
          const combinedPhotos = Array.from(new Set([...photosArray, ...listPhotos]))
          if (combinedPhotos.length > 0) {
            data.productsPhoto = combinedPhotos
          }
        } else if (photosArray.length > 0 && !data.productsPhoto) {
          data.productsPhoto = photosArray
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

export default DealerBillings
