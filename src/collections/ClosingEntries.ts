import { CollectionConfig, Where } from 'payload'

const ClosingEntries: CollectionConfig = {
  slug: 'closing-entries',
  admin: {
    useAsTitle: 'date', // Display date as the title in admin UI
  },
  access: {
    // Role-based access: Superadmin full access, branch users can create/read/update their own branch's entries
    create: ({ req: { user } }) => {
      if (user?.role === 'superadmin') return true
      if (user?.role === 'branch') return true // Branch users can create, but hook will assign branch
      return false
    },
    read: ({ req: { user } }) => {
      if (user?.role === 'superadmin') return true
      if (user?.role === 'company') {
        if (!user?.company) return false
        // Company users see entries from branches in their company
        const companyId = typeof user.company === 'object' ? user.company.id : user.company
        return {
          'branch.company': { equals: companyId },
        } as Where
      }
      if (user?.role === 'branch') {
        if (!user?.branch) return false
        // Branch users see only their branch's entries
        const branchId = typeof user.branch === 'object' ? user.branch.id : user.branch
        return { branch: { equals: branchId } } as Where
      }
      return false
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'superadmin') return true
      if (user?.role === 'branch') {
        if (!user?.branch) return false
        // Branch users can update their own branch's entries
        const branchId = typeof user.branch === 'object' ? user.branch.id : user.branch
        return { branch: { equals: branchId } } as Where
      }
      return false
    },
    delete: ({ req: { user } }) => user?.role === 'superadmin', // Only superadmin can delete
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'yyyy-MM-dd',
        },
      },
      defaultValue: () => new Date().toISOString(),
    },
    {
      name: 'systemSales',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'manualSales',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'onlineSales',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'expenses',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'creditCard',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'upi',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'cash',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'denominations',
      type: 'group',
      fields: [
        {
          name: 'count2000',
          type: 'number',
          label: '2000 × Count',
          min: 0,
          defaultValue: 0,
        },
        {
          name: 'count500',
          type: 'number',
          label: '500 × Count',
          min: 0,
          defaultValue: 0,
        },
        {
          name: 'count200',
          type: 'number',
          label: '200 × Count',
          min: 0,
          defaultValue: 0,
        },
        {
          name: 'count100',
          type: 'number',
          label: '100 × Count',
          min: 0,
          defaultValue: 0,
        },
        {
          name: 'count50',
          type: 'number',
          label: '50 × Count',
          min: 0,
          defaultValue: 0,
        },
        {
          name: 'count10',
          type: 'number',
          label: '10 × Count',
          min: 0,
          defaultValue: 0,
        },
        {
          name: 'count5',
          type: 'number',
          label: '5 × Count',
          min: 0,
          defaultValue: 0,
        },
      ],
    },
    {
      name: 'totalSales',
      type: 'number',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'totalPayments',
      type: 'number',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'net',
      type: 'number',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      // Filter to show only branches in user's company (for company/superadmin)
      filterOptions: ({ relationTo, siblingData, user }) => {
        if (user?.role === 'superadmin') return {}
        if (user?.company) {
          const companyId = typeof user.company === 'object' ? user.company.id : user.company
          return { company: { equals: companyId } } as Where
        }
        return false
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        const { user } = req
        if (operation === 'create' && user?.role === 'branch' && user?.branch) {
          // Auto-assign branch for branch users
          data.branch = typeof user.branch === 'object' ? user.branch.id : user.branch
        }
        // Calculate cash from denominations
        const denoms = data.denominations || {}
        data.cash =
          (denoms.count2000 || 0) * 2000 +
          (denoms.count500 || 0) * 500 +
          (denoms.count200 || 0) * 200 +
          (denoms.count100 || 0) * 100 +
          (denoms.count50 || 0) * 50 +
          (denoms.count10 || 0) * 10 +
          (denoms.count5 || 0) * 5
        // Calculate totals
        data.totalSales =
          (data.systemSales || 0) + (data.manualSales || 0) + (data.onlineSales || 0)
        data.totalPayments = (data.creditCard || 0) + (data.upi || 0) + (data.cash || 0)
        data.net = data.totalSales - (data.expenses || 0)
        return data
      },
    ],
  },
}

export default ClosingEntries
