import { CollectionConfig } from 'payload'

const RawMaterialBillings: CollectionConfig = {
  slug: 'raw-material-billings',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'dealer',
      type: 'relationship',
      relationTo: 'raw-material-dealers',
      required: true,
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
      name: 'bills',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
        {
          name: 'invoiceNumber',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'total',
      type: 'number',
      required: true,
    },
    {
      name: 'billCopyPhoto',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'productsPhoto',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      required: true,
    },
    {
      name: 'deliveryPersonPhoto',
      type: 'relationship',
      relationTo: 'media',
      required: true,
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
          name: 'packageSize',
          type: 'number',
          label: 'Package Size',
          required: false,
        },
        {
          name: 'numberOfPackages',
          type: 'number',
          label: 'Number of Packages',
          required: false,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          admin: {
            description: 'Total quantity (calculated automatically if Package Size and Number of Packages are set)',
          },
        },
        {
          name: 'totalAmount',
          type: 'number',
          required: false,
          defaultValue: 0,
          admin: {
            description: 'Total amount (cost) for this raw material item',
          },
        },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    {
      name: 'paidAmount',
      type: 'number',
      defaultValue: 0,
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'payments',
      type: 'array',
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
        {
          name: 'date',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation === 'create') {
          if (req.user?.role === 'store_keeper' && req.user.storekeeper_companies && req.user.storekeeper_companies.length === 1) {
            const comp = req.user.storekeeper_companies[0]
            data.company = typeof comp === 'string' ? comp : comp.id
          }
        }
        if (data.rawMaterialsList) {
          data.rawMaterialsList = data.rawMaterialsList.map((item: any) => {
            if (item.packageSize && item.numberOfPackages) {
              item.quantity = item.packageSize * item.numberOfPackages
            }
            return item
          })
          data.rawMaterials = data.rawMaterialsList.map(
            (item: { rawMaterial: string | { id: string } }) =>
              typeof item.rawMaterial === 'string' ? item.rawMaterial : item.rawMaterial?.id
          ).filter(Boolean);
        }
        if (data.bills) {
          const calculatedTotal = data.bills.reduce(
            (sum: number, bill: { amount?: number }) => sum + (bill.amount || 0),
            0,
          )
          data.total = calculatedTotal
        }
        if (data.payments) {
          const totalPaid = data.payments.reduce(
            (sum: number, p: { amount?: number }) => sum + (p.amount || 0),
            0,
          )
          data.paidAmount = totalPaid
        }
        if (data.status === 'paid' && (!data.payments || data.payments.length === 0)) {
          data.paidAmount = data.total
          data.payments = [
            {
              amount: data.total,
              date: new Date().toISOString(),
            },
          ]
        } else if (data.status === 'paid' && !data.paidAmount) {
          data.paidAmount = data.total
        } else if (data.paidAmount !== undefined && data.total !== undefined && data.paidAmount >= data.total) {
          data.status = 'paid'
        }
        return data
      },
    ],
  },
}

export default RawMaterialBillings
