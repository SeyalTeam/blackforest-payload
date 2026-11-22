import type { CollectionConfig } from 'payload'

export const TaskPhotoAudits: CollectionConfig = {
  slug: 'task-photo-audits',
  admin: {
    useAsTitle: 'taskTitle',
    group: 'Work',
    defaultColumns: ['taskTitle', 'branch', 'employee', 'photoCount', 'status', 'submittedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => user?.role === 'superadmin' || user?.role === 'admin',
  },
  fields: [
    {
      name: 'task',
      type: 'relationship',
      relationTo: 'tasks',
      required: false,
      label: 'Associated Task',
    },
    {
      name: 'taskTitle',
      type: 'text',
      label: 'Task Title',
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      label: 'Branch',
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      label: 'Employee / Chef',
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: 'User Account',
    },
    {
      name: 'role',
      type: 'text',
      label: 'Role',
      defaultValue: 'chef',
    },
    {
      name: 'chefType',
      type: 'select',
      label: 'Chef Sub-Type',
      options: [
        { label: 'Kitchen Chef', value: 'kitchen' },
        { label: 'Stock Chef', value: 'stock' },
        { label: 'Both / Other', value: 'both' },
      ],
      defaultValue: 'kitchen',
    },
    {
      name: 'photos',
      type: 'array',
      label: 'Audit Photos (Multiple)',
      fields: [
        {
          name: 'photo',
          type: 'relationship',
          relationTo: 'media',
          label: 'Media File',
        },
        {
          name: 'photoUrl',
          type: 'text',
          label: 'Direct Photo URL',
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Caption / Section (e.g. Counter, Stove, Sink, Floor)',
        },
        {
          name: 'capturedAt',
          type: 'date',
          label: 'Captured Timestamp',
        },
      ],
    },
    {
      name: 'photoCount',
      type: 'number',
      label: 'Total Photos Count',
      defaultValue: 0,
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Chef Notes / Remarks',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'submitted',
      options: [
        { label: 'Pending / Waiting for Reply', value: 'pending' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Verified / Approved', value: 'verified' },
        { label: 'Flagged / Needs Attention', value: 'flagged' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'submittedAt',
      type: 'date',
      label: 'Submission Timestamp',
      admin: {
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data) {
          if (!data.submittedAt) {
            data.submittedAt = new Date().toISOString()
          }
          if (Array.isArray(data.photos)) {
            data.photoCount = data.photos.length
          }
        }
        return data
      },
    ],
  },
}

export default TaskPhotoAudits
