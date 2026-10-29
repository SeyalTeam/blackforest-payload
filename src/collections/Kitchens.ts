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
      if (user.role === 'admin') return true
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
      hasMany: true,
      required: true,
      label: 'Departments',
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
      filterOptions: ({ data, siblingData }): Where | boolean => {
        const rawDepartments = data?.department ?? (siblingData as any)?.department
        const selectedDepartmentIds = (Array.isArray(rawDepartments)
          ? rawDepartments
          : rawDepartments
            ? [rawDepartments]
            : []
        )
          .map((department) =>
            typeof department === 'object' && department !== null ? department.id : department,
          )
          .filter(Boolean)

        const rawCategories = data?.categories ?? (siblingData as any)?.categories
        const selectedCategoryIds = (Array.isArray(rawCategories)
          ? rawCategories
          : rawCategories
            ? [rawCategories]
            : []
        )
          .map((category) =>
            typeof category === 'object' && category !== null ? category.id : category,
          )
          .filter(Boolean)

        const conditions: Where[] = []

        if (selectedDepartmentIds.length > 0) {
          conditions.push({
            department: {
              in: selectedDepartmentIds,
            },
          })
        }

        // Always keep currently selected categories valid so updates (e.g. adding branches) don't fail
        if (selectedCategoryIds.length > 0) {
          conditions.push({
            id: {
              in: selectedCategoryIds,
            },
          })
        }

        if (conditions.length > 1) {
          return {
            or: conditions,
          }
        }

        if (conditions.length === 1) {
          return conditions[0]
        }

        return false
      },
    },
  ],
  timestamps: true,
}

export default Kitchens
