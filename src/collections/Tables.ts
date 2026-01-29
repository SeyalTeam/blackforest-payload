import type { CollectionConfig } from 'payload'

const Tables: CollectionConfig = {
  slug: 'tables',
  admin: {
    useAsTitle: 'branch',
    defaultColumns: ['branch', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'superadmin',
    update: ({ req }): boolean | import('payload').Where => {
      if (!req.user) return false
      if (req.user.role === 'superadmin') return true
      if (req.user.role === 'branch') {
        if (!req.user.branch) return false
        const userBranchId =
          typeof req.user.branch === 'object' ? req.user.branch.id : req.user.branch
        return { branch: { equals: userBranchId } }
      }
      return false
    },
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      unique: true,
      admin: {
        description: 'Select the branch this table configuration belongs to.',
      },
    },
    {
      name: 'sections',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            placeholder: 'e.g., AC, Non-AC, 1st Floor Dining',
          },
        },
        {
          name: 'tableCount',
          type: 'number',
          required: true,
          min: 1,
          admin: {
            placeholder: 'Number of tables in this section',
          },
        },
      ],
    },
  ],
  timestamps: true,
}

export default Tables
