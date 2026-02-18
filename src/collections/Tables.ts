import type { CollectionConfig } from 'payload'

const Tables: CollectionConfig = {
  slug: 'tables',
  admin: {
    useAsTitle: 'branch',
    defaultColumns: ['branch', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => user?.role != null,
    create: ({ req: { user } }) => user?.role != null,
    update: ({ req: { user } }) => user?.role != null,
    delete: ({ req: { user } }) => user?.role != null,
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
