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
      ({ operation, data, originalDoc, req }) => {
        if (operation === 'create' && req.user) {
          data.createdBy = req.user.id
        }
        if (operation === 'create') {
          data.status = 'pending'
        }
        if (operation === 'update' && req.user) {
          // When manager replies with message or proof photo, tag manager and close report
          if (
            (data.managerMessage && data.managerMessage !== originalDoc?.managerMessage) ||
            (data.proofPhoto && data.proofPhoto !== originalDoc?.proofPhoto)
          ) {
            data.manager = req.user.id
            data.status = 'closed'
          }
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
        { label: 'Closed', value: 'closed' },
        { label: 'Closed (Legacy)', value: 'mng_replied' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'screenshot',
      label: 'Watcher Issue Photo',
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
      name: 'managerMessage',
      label: 'Manager Reply',
      type: 'textarea',
      admin: {
        description: 'Reply from the manager to the watcher',
      },
    },
    {
      name: 'proofPhoto',
      label: 'Manager Reply Photo / Proof',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Proof photo uploaded by manager when replying',
      },
    },
    {
      name: 'manager',
      label: 'Replied By (Manager)',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'createdBy',
      label: 'Reported By (Watcher)',
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
