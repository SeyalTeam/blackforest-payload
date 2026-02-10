import { CollectionConfig, Where } from 'payload'

const Kitchens: CollectionConfig = {
  slug: 'kitchens',
  admin: {
    useAsTitle: 'name',
    group: 'Organization',
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
      name: 'name',
      type: 'text',
      required: true,
      label: 'Kitchen Name',
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      required: true,
      label: 'Department',
    },
    {
      name: 'branches',
      type: 'relationship',
      relationTo: 'branches',
      hasMany: true,
      required: true,
      label: 'Branches',
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      required: true,
      label: 'Categories',
      filterOptions: ({ data }): Where | boolean => {
        if (data?.department) {
          return {
            department: {
              equals: typeof data.department === 'object' ? data.department.id : data.department,
            },
          }
        }
        return false
      },
    },
  ],
  timestamps: true,
}

export default Kitchens
