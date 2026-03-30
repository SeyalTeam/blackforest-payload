import type { CollectionConfig } from 'payload'

const normalizeRelationshipID = (value: unknown): string | null => {
  if (!value) return null

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'object') {
    const map = value as Record<string, unknown>
    const candidate = map.id ?? map._id ?? map.value

    if (typeof candidate === 'string' || typeof candidate === 'number') {
      return String(candidate)
    }
  }

  return null
}

const canManageAllAlerts = (role?: string | null) =>
  role != null && ['superadmin', 'admin', 'company'].includes(role)

const branchScopedAccess = ({ req }: { req: any }) => {
  const user = req.user

  if (!user) return false
  if (canManageAllAlerts(user.role)) return true

  const branchID = normalizeRelationshipID(user.branch)
  if (!branchID) return false

  return {
    branch: {
      equals: branchID,
    },
  }
}

const prepareStockAlert = async ({ data, req }: any) => {
  if (!req.user) {
    throw new Error('Unauthorized')
  }

  const user = req.user
  const requestedBranchID =
    normalizeRelationshipID(data?.branch) || normalizeRelationshipID(user.branch)
  const productID = normalizeRelationshipID(data?.product)

  if (!requestedBranchID) {
    throw new Error('Branch is required.')
  }

  if (!productID) {
    throw new Error('Product is required.')
  }

  if (!canManageAllAlerts(user.role)) {
    const userBranchID = normalizeRelationshipID(user.branch)
    if (!userBranchID || userBranchID !== requestedBranchID) {
      throw new Error('You can only create alerts for your own branch.')
    }
  }

  const [branch, product] = await Promise.all([
    req.payload.findByID({
      collection: 'branches',
      id: requestedBranchID,
      depth: 0,
      overrideAccess: true,
    }),
    req.payload.findByID({
      collection: 'products',
      id: productID,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  data.branch = requestedBranchID
  data.branchName =
    typeof branch?.name === 'string' && branch.name.trim().length > 0 ? branch.name.trim() : ''
  data.product = productID
  data.productName =
    typeof product?.name === 'string' && product.name.trim().length > 0
      ? product.name.trim()
      : ''
  data.requestedBy = normalizeRelationshipID(user.id)
  data.requestedByName =
    typeof user.name === 'string' && user.name.trim().length > 0
      ? user.name.trim()
      : typeof user.email === 'string' && user.email.trim().length > 0
        ? user.email.trim()
        : 'Unknown User'
  data.requestedByRole = user.role
  data.status = data?.status === 'acknowledged' ? 'acknowledged' : 'open'

  if (data.status === 'acknowledged') {
    data.acknowledgedAt = data?.acknowledgedAt || new Date().toISOString()
    data.acknowledgedBy = normalizeRelationshipID(data?.acknowledgedBy) || normalizeRelationshipID(user.id)
  } else {
    data.acknowledgedAt = null
    data.acknowledgedBy = null
  }

  return data
}

export const StockAlerts: CollectionConfig = {
  slug: 'stock-alerts',
  admin: {
    useAsTitle: 'productName',
    defaultColumns: ['productName', 'branchName', 'requestedByName', 'status', 'createdAt'],
    group: 'Inventory',
  },
  access: {
    create: ({ req }) => !!req.user,
    read: branchScopedAccess,
    update: branchScopedAccess,
    delete: ({ req }) => canManageAllAlerts(req.user?.role),
  },
  hooks: {
    beforeChange: [prepareStockAlert],
  },
  fields: [
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      index: true,
    },
    {
      name: 'branchName',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      name: 'productName',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'requestedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'requestedByName',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'requestedByRole',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      index: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Acknowledged', value: 'acknowledged' },
      ],
    },
    {
      name: 'acknowledgedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'acknowledgedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
