import type { CollectionConfig } from 'payload'

export const Companies: CollectionConfig = {
  slug: 'companies',
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
      name: 'hqAddress',
      type: 'text',
      required: false,
    },
    {
      name: 'gst',
      type: 'text',
      required: false,
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: () => true,
    update: ({ req }) => req.user?.role === 'superadmin',
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
}
