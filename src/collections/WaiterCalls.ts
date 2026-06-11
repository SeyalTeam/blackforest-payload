import { CollectionConfig } from 'payload'

const WaiterCalls: CollectionConfig = {
  slug: 'waiter-calls',
  admin: {
    useAsTitle: 'tableNumber',
    defaultColumns: ['tableNumber', 'section', 'branch', 'status', 'createdAt'],
  },
  access: {
    create: () => true, // You might want to adjust access control later based on requirements
    read: () => true,
    update: () => true,
    delete: ({ req: { user } }) => user?.role === 'superadmin' || user?.role === 'admin',
  },
  fields: [
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      admin: {
        description: 'The branch where this call originated.',
      },
    },
    {
      name: 'tableNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'The table number making the call.',
      },
    },
    {
      name: 'section',
      type: 'text',
      admin: {
        description: 'The section the table belongs to (e.g., AC, Balcony).',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Acknowledged', value: 'acknowledged' },
        { label: 'Resolved', value: 'resolved' },
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        description: 'Current status of the waiter call.',
      },
    },
    {
      name: 'assignedWaiter',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'The waiter assigned or responding to this call.',
      },
      filterOptions: {
        role: { equals: 'waiter' },
      },
    },
  ],
  timestamps: true,
}

export default WaiterCalls
