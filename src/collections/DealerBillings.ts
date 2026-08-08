import { CollectionConfig } from 'payload'

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
      async ({ req, operation, data }) => {
        if (operation === 'create') {
          if (req.user?.role === 'branch' && req.user.branch) {
            data.branch = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
          }
        }
        // Get productsPhoto from data or fallback to originalDoc
        const rawPhotos = data.productsPhoto !== undefined ? data.productsPhoto : originalDoc?.productsPhoto

        // Normalize productsPhoto into an array of ID strings
        let photosArray: string[] = []
        if (Array.isArray(rawPhotos)) {
          photosArray = rawPhotos
            .map((p: any) => (typeof p === 'string' ? p : p?.id || p?._id))
            .filter(Boolean)
        } else if (rawPhotos) {
          const pId = typeof rawPhotos === 'string' ? rawPhotos : rawPhotos.id || rawPhotos._id
          if (pId) photosArray = [pId]
        }

        // Fallback: If photosArray is empty, check billCopyPhoto / deliveryPersonPhoto
        if (photosArray.length === 0) {
          const billPhoto = data.billCopyPhoto || originalDoc?.billCopyPhoto
          const delPhoto = data.deliveryPersonPhoto || originalDoc?.deliveryPersonPhoto
          const candidate = billPhoto || delPhoto
          const cId = typeof candidate === 'string' ? candidate : candidate?.id || candidate?._id
          if (cId) photosArray = [cId]
        }

        // Fallback: If still empty, search recently created media
        if (photosArray.length === 0) {
          try {
            const timeLimit = new Date(Date.now() - 10 * 60 * 1000)
            const recentMedia = await req.payload.find({
              collection: 'media',
              where: {
                createdAt: { greater_than: timeLimit },
              },
              sort: '-createdAt',
              limit: 5,
            })
            if (recentMedia.docs.length > 0) {
              photosArray = recentMedia.docs.map((m: any) => m.id)
            }
          } catch (e) {
            // Ignore fallback lookup error
          }
        }

        const productsList = data.productsList || originalDoc?.productsList
        if (productsList && Array.isArray(productsList)) {
          data.productsList = productsList.map((item: any, index: number) => {
            let itemPhotoId = typeof item.photo === 'string' ? item.photo : item.photo?.id || item.photo?._id
            if (!itemPhotoId && photosArray.length > 0) {
              itemPhotoId = photosArray[index] || photosArray[0]
            }
            return {
              ...item,
              photo: itemPhotoId || item.photo || null,
            }
          })

          data.products = data.productsList
            .map((item: { product: string | { id: string } }) =>
              typeof item.product === 'string' ? item.product : item.product?.id
            )
            .filter(Boolean);

          const listPhotos = data.productsList
            .map((item: any) => (typeof item.photo === 'string' ? item.photo : item.photo?.id || item.photo?._id))
            .filter(Boolean)
          
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
