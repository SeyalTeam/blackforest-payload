import { CollectionConfig } from 'payload'

const Employees: CollectionConfig = {
  slug: 'employees',
  auth: true, // Enable authentication
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: async ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin' || user.role === 'company' || user.role === 'branch')
        return true
      // Add more role-based logic as needed, e.g., for manager viewing staff
      return false
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'superadmin' || user.role === 'company' || user.role === 'branch'
    },
    update: ({ req: { user }, id }) => {
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
      unique: true, // Ensure unique for auth
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
      async ({ operation, data, req }) => {
        return data
      },
    ],
  },
  timestamps: true,
}

export default Employees
