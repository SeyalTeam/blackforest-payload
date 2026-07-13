import { CollectionConfig } from 'payload'

const RawMaterials: CollectionConfig = {
  slug: 'raw-materials',
  admin: {
    useAsTitle: 'name',
    group: 'Raw Material',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role === 'superadmin' ||
      user?.role === 'admin' ||
      user?.role === 'company' ||
      user?.role === 'branch' ||
      user?.role === 'store_keeper',
    update: ({ req: { user } }) =>
      user?.role === 'superadmin' ||
      user?.role === 'admin' ||
      user?.role === 'company' ||
      user?.role === 'store_keeper',
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
        { label: 'Bags (bag)', value: 'bag' },
        { label: 'Tins (tin)', value: 'tin' },
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
    {
      name: 'dealer',
      type: 'relationship',
      relationTo: 'raw-material-dealers',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'variants',
      type: 'array',
      label: 'Packaging Variants',
      admin: {
        description: 'Define the packaging options available for this raw material (e.g. 25 kg Bag, 50 kg Bag).',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Variant Name (e.g., 25 kg Bag)',
          required: true,
        },
        {
          name: 'weight',
          type: 'number',
          label: 'Weight/Size per Unit',
          required: true,
        },
        {
          name: 'unit',
          type: 'select',
          label: 'Unit',
          options: [
            { label: 'Pieces (pcs)', value: 'pcs' },
            { label: 'Kilograms (kg)', value: 'kg' },
            { label: 'Grams (g)', value: 'g' },
            { label: 'Liters (l)', value: 'l' },
            { label: 'Milliliters (ml)', value: 'ml' },
            { label: 'Bags (bag)', value: 'bag' },
            { label: 'Tins (tin)', value: 'tin' },
          ],
          required: true,
          defaultValue: 'kg',
        },
      ],
    },
  ],
  timestamps: true,
}

export default RawMaterials
