import { CollectionConfig } from 'payload'

const WaiterCalls: CollectionConfig = {
  slug: 'waiter-calls',
  admin: {
    useAsTitle: 'tableNumber',
    defaultColumns: ['tableNumber', 'section', 'branch', 'status', 'createdAt'],
  },
  access: {
    create: () => false, // Disables manual creation from the admin panel
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
        role: { in: ['waiter', 'supervisor', 'cashier'] },
      },
    },
    {
      name: 'billing',
      type: 'relationship',
      relationTo: 'billings',
      required: false,
      admin: {
        description: 'The billing associated with this call.',
      },
    },
    {
      name: 'callTimestamp',
      type: 'text',
      admin: {
        description: 'The unique timestamp associated with this waiter call signal.',
      },
    },
  ],
  timestamps: true,
}

export default WaiterCalls
