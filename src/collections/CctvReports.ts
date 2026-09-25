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
          // If manager message is added/changed, tag manager and update status
          if (data.managerMessage && data.managerMessage !== originalDoc?.managerMessage) {
            data.manager = req.user.id
            data.status = 'mng_replied'
          }
          // If staff message is added/changed, tag staff and update status
          if (data.staffMessage && data.staffMessage !== originalDoc?.staffMessage) {
            data.staff = req.user.id
            data.status = 'st_replied'
          }
          // If watcher reply message is added/changed
          if (data.watcherReplyMessage && data.watcherReplyMessage !== originalDoc?.watcherReplyMessage) {
            data.status = 'watcher_replied'
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'watcherReplyMessage',
      label: 'Watcher Reply',
      type: 'textarea',
      admin: {
        description: 'Reply from the watcher to the manager',
      }
    },
    {
      name: 'watcherReplyScreenshot',
      label: 'Watcher Reply Screenshot',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
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
        { label: 'Watcher Replied', value: 'watcher_replied' },
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
      name: 'managerMessage',
      label: 'Manager Reply',
      type: 'textarea',
      admin: {
        description: 'Reply from the manager to the watcher',
      }
    },
    {
      name: 'manager',
      label: 'Replied By (Manager)',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
      }
    },
    {
      name: 'staffMessage',
      label: 'Staff Reply',
      type: 'textarea',
      admin: {
        description: 'Reply from the branch staff to the watcher',
      }
    },
    {
      name: 'staff',
      label: 'Replied By (Staff)',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
      }
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
