import { CollectionConfig } from 'payload'

const ProductionRequests: CollectionConfig = {
  slug: 'production-requests',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['id', 'company', 'date', 'status', 'createdBy'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
      access: {
        update: () => false,
      },
    },
    {
      name: 'rawMaterials',
      type: 'relationship',
      relationTo: 'raw-materials',
      hasMany: true,
      required: false,
    },
    {
      name: 'rawMaterialsList',
      type: 'array',
      fields: [
        {
          name: 'rawMaterial',
          type: 'relationship',
          relationTo: 'raw-materials',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
        },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Fulfilled', value: 'fulfilled' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pending',
      required: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notes / Remarks',
      required: false,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, operation, data }) => {
        if (operation === 'create' && req.user) {
          if (!data.createdBy) {
            data.createdBy = req.user.id
          }
        }
        if (data.rawMaterialsList) {
          data.rawMaterials = data.rawMaterialsList.map(
            (item: { rawMaterial: string | { id: string } }) =>
              typeof item.rawMaterial === 'string' ? item.rawMaterial : item.rawMaterial?.id
          ).filter(Boolean);
        }
        return data
      },
    ],
  },
}

export default ProductionRequests
