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
      name: 'role',
      type: 'select',
      options: [
        { label: 'Superadmin', value: 'superadmin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Branch', value: 'branch' },
      ],
      defaultValue: 'admin', // Default to admin
      required: true,
      access: {
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false, // Overall false, but conditional below
      admin: {
        condition: ({ role }) => role === 'branch', // Show only if role is branch
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    // Add hook for validation if needed
  ],
  access: {
    // Existing access from before...
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
          if (data.role === 'branch' && !data.branch) {
            throw new Error('Branch is required for branch role users')
          }
        }
        return data
      },
    ],
  },
}
