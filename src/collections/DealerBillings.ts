import { CollectionConfig } from 'payload'

function toIdString(val: any): string | undefined {
  if (!val) return undefined
  if (typeof val === 'string') return val
  if (Buffer.isBuffer(val)) return val.toString('hex')
  if (val && typeof val === 'object') {
    if (val._id && val._id !== val) return toIdString(val._id)
    if (val.id && val.id !== val) return toIdString(val.id)
    if (typeof val.toString === 'function') {
      const s = val.toString()
      if (typeof s === 'string' && s.length === 24) return s
    }
  }
  return undefined
}

const DealerBillings: CollectionConfig = {
  slug: 'dealer-billings',
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
      relationTo: 'dealers',
      required: true,
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
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
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      required: false,
    },
    {
      name: 'productsList',
      type: 'array',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
        },
        {
          name: 'totalAmount',
          type: 'number',
          required: false,
          defaultValue: 0,
        },
        {
          name: 'photo',
          type: 'relationship',
          relationTo: 'media',
          required: false,
          admin: {
            description: 'Photo of the product taken during dealer billing',
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
      async ({ req, operation, data, originalDoc }: any) => {
        if (operation === 'create') {
          if (req.user?.role === 'branch' && req.user.branch) {
            data.branch = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
          }
        }
        // Normalize productsPhoto into an array of ID strings
        let photosArray: string[] = []
        const rawPhotos = data.productsPhoto !== undefined ? data.productsPhoto : originalDoc?.productsPhoto
        if (Array.isArray(rawPhotos)) {
          photosArray = rawPhotos
            .map(toIdString)
            .filter((s?: string): s is string => Boolean(s && s.length === 24))
        } else if (rawPhotos) {
          const pId = toIdString(rawPhotos)
          if (pId && pId.length === 24) photosArray = [pId]
        }

        if (data.productsList && Array.isArray(data.productsList)) {
          data.productsList = data.productsList.map((item: any, index: number) => {
            // 1. Extract item photo if provided as string or object
            let photoId = toIdString(item.photo)
            // 2. If missing, fallback to photosArray (which holds data.productsPhoto or originalDoc.productsPhoto)
            if (!photoId && photosArray.length > 0) {
              photoId = photosArray[index] || photosArray[0]
            }
            return {
              ...item,
              photo: photoId || null,
            }
          })

          data.products = data.productsList
            .map((item: { product: any }) => toIdString(item.product))
            .filter((s?: string): s is string => Boolean(s && s.length === 24));

          const listPhotos = data.productsList
            .map((item: any) => toIdString(item.photo))
            .filter((s?: string): s is string => Boolean(s && s.length === 24))
          
          const combinedPhotos = Array.from(new Set([...photosArray, ...listPhotos]))
          if (combinedPhotos.length > 0) {
            data.productsPhoto = combinedPhotos
          }
        } else if (photosArray.length > 0 && !data.productsPhoto) {
          data.productsPhoto = photosArray
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

export default DealerBillings
