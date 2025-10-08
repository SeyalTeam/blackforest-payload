import type { CollectionConfig } from 'payload'

export const Branches: CollectionConfig = {
  slug: 'branches',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'address',
      type: 'text',
      required: true,
    },
    {
      name: 'gst',
      type: 'text', // For GST number; add validation hook if needed for format
      required: true,
    },
    {
      name: 'phone',
      type: 'text', // Or 'number' if strict numeric; text allows formats like +1-123
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'superadmin' || req.user.role === 'admin') return true
      if (req.user.role === 'branch') {
        return { id: { equals: req.user.branch } } // Branch users read only their own
      }
      return false // Delivery none
    },
    update: ({ req, id }) => {
      if (!req.user) return false
      if (req.user.role === 'superadmin') return true
      if (req.user.role === 'branch') return { id: { equals: req.user.branch } } // Update own
      return false
    },
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
}
