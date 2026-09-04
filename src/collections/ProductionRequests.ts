import { CollectionConfig } from 'payload'

const ProductionRequests: CollectionConfig = {
  slug: 'production-requests',
  admin: {
    useAsTitle: 'requestNumber',
    defaultColumns: ['requestNumber', 'company', 'date', 'status', 'createdByName'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'requestNumber',
      type: 'text',
      admin: { readOnly: true },
    },
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
          name: 'requestCount',
          type: 'number',
          required: true,
        },
        {
          name: 'sendingCount',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Sent', value: 'sent' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
          defaultValue: 'pending',
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
    {
      name: 'createdByName',
      type: 'text',
      required: false,
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, operation, data }) => {
        if (operation === 'create') {
          if (!data.requestNumber) {
            data.requestNumber = `PR-${Date.now()}`
          }
          if (req.user) {
            if (!data.createdBy) {
              data.createdBy = req.user.id
            }
            if (!data.createdByName) {
              const u = req.user as any
              data.createdByName = u.name || u.username || u.email || 'Chef'
            }
          }
        }
        if (data.rawMaterialsList) {
          data.rawMaterials = data.rawMaterialsList.map(
            (item: { rawMaterial: string | { id: string } }) =>
              typeof item.rawMaterial === 'string' ? item.rawMaterial : item.rawMaterial?.id
          ).filter(Boolean);
          
          // Auto-update main status based on items if needed
          const allSent = data.rawMaterialsList.length > 0 && data.rawMaterialsList.every((i: any) => i.status === 'sent')
          if (allSent && data.status === 'pending') {
            data.status = 'fulfilled'
          }
        }
        return data
      },
    ],
  },
}

export default ProductionRequests
