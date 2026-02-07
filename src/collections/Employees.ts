import { CollectionConfig } from 'payload'

const Employees: CollectionConfig = {
  slug: 'employees',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      return true // Allow all authenticated users to read for relationship expansion
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'superadmin' || user.role === 'company' || user.role === 'branch'
    },
    update: ({ req: { user }, id: _id }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      // For company/branch, check ownership via async if needed, but simplify for now
      return user.role === 'company' || user.role === 'branch'
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'superadmin' || user.role === 'company'
    },
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'employeeId',
          type: 'text',
          unique: true,
          required: true,
        },
      ],
    },
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: false,
    },
    {
      name: 'address',
      type: 'text',
      required: false,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'team',
      label: 'Role',
      type: 'select',
      options: [
        { label: 'Waiter', value: 'waiter' },
        { label: 'Chef', value: 'chef' },
        { label: 'Driver', value: 'driver' },
        { label: 'Cashier', value: 'cashier' },
        { label: 'Manager', value: 'manager' },
        { label: 'Supervisor', value: 'supervisor' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Kitchen', value: 'kitchen' },
      ],
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'aadhaarPhoto',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ operation, data, req: _req }) => {
        if (operation === 'create' || operation === 'update') {
          if (data.name === 'Kitchen') {
            data.team = 'kitchen'
          }
        }
        return data
      },
    ],
  },
  timestamps: true,
}

export default Employees
