import { CollectionConfig } from 'payload'

const RawMaterials: CollectionConfig = {
  slug: 'raw-materials',
  admin: {
    useAsTitle: 'name',
    group: 'Inventory',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role === 'superadmin' ||
      user?.role === 'admin' ||
      user?.role === 'company' ||
      user?.role === 'branch',
    update: ({ req: { user } }) =>
      user?.role === 'superadmin' ||
      user?.role === 'admin' ||
      user?.role === 'company',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'raw-material-categories',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'unit',
      type: 'select',
      options: [
        { label: 'Pieces (pcs)', value: 'pcs' },
        { label: 'Kilograms (kg)', value: 'kg' },
        { label: 'Grams (g)', value: 'g' },
        { label: 'Liters (l)', value: 'l' },
        { label: 'Milliliters (ml)', value: 'ml' },
      ],
      required: true,
      defaultValue: 'kg',
    },
    {
      name: 'minimumStockLevel',
      type: 'number',
      label: 'Minimum Stock Level',
      admin: {
        description: 'Notify when stock falls below this level.',
      },
    },
  ],
  timestamps: true,
}

export default RawMaterials
