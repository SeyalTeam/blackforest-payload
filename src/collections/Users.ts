import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // Email added by default
    {
      name: 'phone',
      type: 'text',
      required: false, // Set to true if you want it mandatory during creation
      label: 'Phone Number',
      admin: {
        placeholder: 'Enter phone number (e.g., +1234567890)',
      },
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Superadmin', value: 'superadmin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Branch', value: 'branch' },
        { label: 'Company', value: 'company' },
        { label: 'Kitchen', value: 'kitchen' }, // New
        { label: 'Cashier', value: 'cashier' }, // New
        { label: 'Waiter', value: 'waiter' }, // New
      ],
      defaultValue: 'admin',
      required: true,
      access: {
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false,
      admin: {
        condition: ({ role }) => ['branch', 'kitchen'].includes(role), // Show for branch, kitchen
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: false,
      admin: {
        condition: ({ role }) => role === 'company',
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: false,
      admin: {
        condition: ({ role }) => ['waiter', 'cashier'].includes(role),
      },
      filterOptions: ({ siblingData }) => {
        const role = (siblingData as { role?: string }).role
        if (!role || !['waiter', 'cashier'].includes(role)) {
          return false
        }
        return { team: { equals: role } }
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.role === 'admin' || req.user.id === id
    },
    update: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.id === id
    },
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' || operation === 'update') {
          if (['branch', 'kitchen'].includes(data.role) && !data.branch) {
            throw new Error('Branch is required for branch or kitchen role users')
          }
          if (data.role === 'company' && !data.company) {
            throw new Error('Company is required for company role users')
          }
          if (['waiter', 'cashier'].includes(data.role) && !data.employee) {
            throw new Error('Employee is required for waiter or cashier role users')
          }
        }
        return data
      },
    ],
  },
}
