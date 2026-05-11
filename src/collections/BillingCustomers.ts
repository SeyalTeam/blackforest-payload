import { CollectionConfig } from 'payload'

const BillingCustomers: CollectionConfig = {
  slug: 'billing-customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phoneNumber', 'lastBill', 'updatedAt'],
    group: 'Billing',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'admin', 'branch', 'waiter', 'company'].includes(user.role),
    update: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'admin', 'branch', 'waiter', 'company'].includes(user.role),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'lastBill',
      type: 'relationship',
      relationTo: 'billings',
      required: false,
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
      required: false,
    },
  ],
  timestamps: true,
}

export default BillingCustomers
