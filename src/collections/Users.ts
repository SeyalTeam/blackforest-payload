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
      defaultValue: 'branch', // Default to least privileged
      required: true,
      access: {
        // Only superadmin can change roles
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    // Add more fields as discussed, e.g., name, branchId later
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin', // Only superadmin creates users
    read: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.role === 'admin' || req.user.id === id
    },
    update: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.id === id // Self-update or superadmin
    },
    delete: ({ req }) => req.user?.role === 'superadmin', // Only superadmin deletes
  },
}
