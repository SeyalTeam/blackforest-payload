import { CollectionConfig } from 'payload'

const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phoneNumber', 'id'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'admin', 'branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'admin', 'branch', 'waiter'].includes(user.role),
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
      unique: true,
      required: true,
    },
    {
      name: 'bills',
      type: 'relationship',
      relationTo: 'billings',
      hasMany: true,
    },
  ],
  timestamps: true,
}

export default Customers
