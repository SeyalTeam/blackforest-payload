import { CollectionConfig } from 'payload'

const CctvReports: CollectionConfig = {
  slug: 'cctv-reports',
  admin: {
    useAsTitle: 'message',
    defaultColumns: ['branch', 'status', 'createdBy', 'createdAt'],
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => {
      if (!user) return false
      return ['superadmin', 'admin', 'manager', 'watcher'].includes(user.role)
    },
    delete: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      ({ operation, data, req }) => {
        if (operation === 'create' && req.user) {
          data.createdBy = req.user.id
        }
        if (operation === 'create') {
          data.status = 'pending'
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Mng Replied', value: 'mng_replied' },
        { label: 'ST Replied', value: 'st_replied' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'screenshot',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'message',
      label: 'Issue Description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}

export default CctvReports
