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
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
      minRows: 1,
      maxRows: 5,
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
        { label: 'Boxes (box)', value: 'box' },
        { label: 'Cans (can)', value: 'can' },
        { label: 'Drums (drum)', value: 'drum' },
        { label: 'Bottles (bottle)', value: 'bottle' },
        { label: 'Cartons (carton)', value: 'carton' },
        { label: 'Packs (pack)', value: 'pack' },
      ],
      required: true,
      defaultValue: 'kg',
    },
    {
      name: 'packSize',
      type: 'number',
      label: 'Weight / Pack Size per Unit',
      admin: {
        description: 'Weight or size per unit (e.g. 15 for 15 L oil tin, 25 for 25 kg bag, 1 for 1 kg/piece).',
      },
    },
    {
      name: 'purchaseFrequency',
      type: 'select',
      label: 'Purchase Frequency',
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: '3 Months', value: '3month' },
        { label: '6 Months', value: '6month' },
        { label: 'Yearly', value: 'yearly' },
      ],
      admin: {
        description: 'Frequency of purchase (Daily, Weekly, Monthly, 3 Months, 6 Months, Yearly).',
      },
    },
    {
      name: 'standardStockLevel',
      type: 'number',
      label: 'Standard Stock Level',
      admin: {
        description: 'Target or standard stock level to maintain.',
      },
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
      name: 'maximumStockLevel',
      type: 'number',
      label: 'Maximum Stock Level',
      admin: {
        description: 'Notify when stock exceeds this level.',
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
        description: 'Define the packaging options available for this raw material (e.g. 25 kg Bag, 15 L Tin, 50 Pcs Box).',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Variant Name (e.g., 25 kg Bag, 15 L Tin)',
          required: true,
        },
        {
          name: 'weight',
          type: 'number',
          label: 'Weight / Pack Size per Unit (e.g. 25 for 25 kg Bag, 15 for 15 L Tin)',
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
            { label: 'Boxes (box)', value: 'box' },
            { label: 'Cans (can)', value: 'can' },
            { label: 'Drums (drum)', value: 'drum' },
            { label: 'Bottles (bottle)', value: 'bottle' },
            { label: 'Cartons (carton)', value: 'carton' },
            { label: 'Packs (pack)', value: 'pack' },
          ],
          required: true,
          defaultValue: 'kg',
        },
        {
          name: 'standardStockLevel',
          type: 'number',
          label: 'Standard Stock Level',
          admin: {
            description: 'Target or standard stock level to maintain for this variant.',
          },
        },
        {
          name: 'minimumStockLevel',
          type: 'number',
          label: 'Minimum Stock Level',
          admin: {
            description: 'Notify when stock falls below this level for this variant.',
          },
        },
        {
          name: 'maximumStockLevel',
          type: 'number',
          label: 'Maximum Stock Level',
          admin: {
            description: 'Notify when stock exceeds this level for this variant.',
          },
        },
        {
          name: 'purchaseFrequency',
          type: 'select',
          label: 'Purchase Frequency',
          options: [
            { label: 'Daily', value: 'daily' },
            { label: 'Weekly', value: 'weekly' },
            { label: 'Monthly', value: 'monthly' },
            { label: '3 Months', value: '3month' },
            { label: '6 Months', value: '6month' },
            { label: 'Yearly', value: 'yearly' },
          ],
          admin: {
            description: 'Frequency of purchase for this variant (Daily, Weekly, Monthly, 3 Months, 6 Months, Yearly).',
          },
        },
      ],
    },
  ],
  timestamps: true,
}

export default RawMaterials
