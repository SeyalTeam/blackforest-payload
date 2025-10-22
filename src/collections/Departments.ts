import { CollectionConfig } from 'payload' // Consistent import

const Departments: CollectionConfig = {
  slug: 'departments',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      if (user.role === 'company') return true
      return false
    },
    read: () => true,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      if (user.role === 'company') return true
      return false
    },
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      hasMany: true,
      required: true,
      label: 'Associated Companies',
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Department Name',
    },
  ],
}

export default Departments
