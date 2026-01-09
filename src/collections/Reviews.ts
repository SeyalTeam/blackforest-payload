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
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (data?.items) {
          data.items = data.items.map((item: any) => {
            if (item.chefReply) {
              // Auto-fill repliedBy if not present
              if (!item.repliedBy && req.user) {
                const name = typeof req.user.name === 'string' ? req.user.name : 'Unknown'
                item.repliedBy = `${name} (${req.user.role})`
              }
              // Auto-fill repliedAt if not present
              if (!item.repliedAt) {
                item.repliedAt = new Date().toISOString()
              }
              // Auto-update status to 'replied' if currently 'waiting'
              if (item.status === 'waiting') {
                item.status = 'replied'
              }
            }
            return item
          })
        }
        return data
      },
    ],
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
        {
          name: 'chefReply',
          type: 'textarea',
          admin: {
            description: 'Reply from the chef regarding this feedback',
          },
        },
        {
          name: 'repliedBy',
          type: 'text',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'repliedAt',
          type: 'date',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'waiting',
          options: [
            { label: 'Waiting (Auto)', value: 'waiting' },
            { label: 'Replied (Auto)', value: 'replied' },
            { label: 'Approved', value: 'approved' },
          ],
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
