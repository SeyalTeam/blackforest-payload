import { CollectionConfig } from 'payload'

const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'customerName',
  },
  access: {
    create: () => true, // Allow anyone to create reviews (public submission)
    read: () => true,
    update: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'admin'].includes(user.role),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'bill',
      type: 'relationship',
      relationTo: 'billings',
      required: true,
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'rating',
          type: 'number',
          min: 1,
          max: 5,
        },
        {
          name: 'feedback',
          type: 'textarea',
          required: true,
        },
      ],
    },
    {
      name: 'customerName',
      type: 'text',
    },
    {
      name: 'customerPhone',
      type: 'text',
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
    },
  ],
  timestamps: true,
}

export default Reviews
