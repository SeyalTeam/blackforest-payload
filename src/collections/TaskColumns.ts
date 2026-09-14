import type { CollectionConfig } from 'payload'

export const TaskColumns: CollectionConfig = {
  slug: 'task-columns',
  admin: {
    useAsTitle: 'title',
    group: 'Work',
    defaultColumns: ['title', 'order', 'createdAt'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'superadmin' || user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'superadmin' || user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'superadmin' || user?.role === 'admin',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Column / List Title',
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      label: 'Display Order',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'role',
      type: 'select',
      label: 'Associated Role (Optional)',
      options: [
        { label: 'Superadmin', value: 'superadmin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Manager', value: 'manager' },
        { label: 'Account', value: 'account' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Branch', value: 'branch' },
        { label: 'Company', value: 'company' },
        { label: 'Factory', value: 'factory' },
        { label: 'Kitchen', value: 'kitchen' },
        { label: 'Chef', value: 'chef' },
        { label: 'Cashier', value: 'cashier' },
        { label: 'Waiter', value: 'waiter' },
        { label: 'Supervisor', value: 'supervisor' },
        { label: 'Driver', value: 'driver' },
        { label: 'Store Keeper', value: 'store_keeper' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'color',
      type: 'text',
      label: 'Column Accent (Optional)',
      admin: {
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}

export default TaskColumns
