import { CollectionConfig } from 'payload'

const calculateEAN13CheckDigit = (eanWithoutCheckDigit: string): number => {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(eanWithoutCheckDigit[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name', // Displays name in admin UI list
    group: 'Inventory', // Groups under a section in sidebar
  },
  access: {
    // Make read public (anyone can access without login)
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'company',
    update: () => true, // Made public to allow updates without authentication
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc: _originalDoc }) => {
        if (operation === 'create') {
          // Generate sequential productId
          const lastProduct = await req.payload.find({
            collection: 'products',
            limit: 1,
            sort: '-productId',
          })
          const lastProductId = lastProduct.docs[0]?.productId || '00000'
          const nextProductIdNum = parseInt(lastProductId, 10) + 1
          const nextProductId = nextProductIdNum.toString().padStart(5, '0')
          data.productId = nextProductId

          // Generate UPC if not provided (for branded products, allow manual entry)
          if (!data.upc) {
            const companyPrefix = '8901234' // Hardcoded as per previous code
            const eanWithoutCheckDigit = companyPrefix + nextProductId
            const checkDigit = calculateEAN13CheckDigit(eanWithoutCheckDigit)
            data.upc = eanWithoutCheckDigit + checkDigit.toString()
          } else {
            // Validate provided UPC (optional: add length/check digit validation)
            if (data.upc.length !== 13 || isNaN(parseInt(data.upc))) {
              throw new Error('Invalid UPC: Must be 13 digits')
            }
          }
        } else if (operation === 'update') {
          // Allow updating UPC on edit if needed
        }

        // Existing duplicate branch check
        if (data.branchOverrides && data.branchOverrides.length > 0) {
          const seenBranches = new Set()
          for (const override of data.branchOverrides) {
            if (!override.branch) {
              throw new Error('Branch is required for overrides')
            }
            if (seenBranches.has(override.branch)) {
              throw new Error('Duplicate branch in overrides not allowed')
            }
            seenBranches.add(override.branch)
          }
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true, // Prevent duplicate product names
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories', // Link to existing Categories collection
      required: true,
      admin: {
        position: 'sidebar', // Place in sidebar for easy selection
      },
    },
    {
      name: 'dealer',
      type: 'relationship',
      relationTo: 'dealers', // Link to Dealers collection
      required: false, // Optional, as not all products may have dealers
      admin: {
        position: 'sidebar', // After category in sidebar
      },
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media', // Assume Media collection exists for uploads
          required: true,
        },
      ],
      minRows: 1,
      maxRows: 5, // Limit to a few images
      admin: {
        position: 'sidebar', // Moved to right side (sidebar), after category
      },
    },
    {
      name: 'hsnCode',
      type: 'text',
      required: false, // Manual input, optional
      label: 'HSN Code',
      admin: {
        position: 'sidebar', // Before productId in sidebar
      },
    },
    {
      name: 'productId',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true, // Auto-generated
        position: 'sidebar', // Moved to sidebar, after images
      },
    },
    {
      name: 'upc',
      type: 'text',
      unique: true,
      required: false, // Made optional for manual entry
      admin: {
        position: 'sidebar', // Moved to sidebar, after images
      },
    },
    {
      type: 'row', // Groups the next fields horizontally in the same row
      fields: [
        {
          name: 'isVeg',
          type: 'checkbox',
          defaultValue: false,
          label: 'Is Vegetarian',
        },
        {
          name: 'isAvailable',
          type: 'checkbox',
          defaultValue: true,
          label: 'Is Available',
        },
      ],
    },
    {
      name: 'defaultPriceDetails',
      type: 'group', // Default pricing applied to all branches unless overridden
      label: 'Default Price Details',
      fields: [
        {
          name: 'price',
          type: 'number',
          required: true,
          min: 0,
          label: 'Price (MRP)',
        },
        {
          name: 'rate',
          type: 'number',
          required: true,
          min: 0,
          label: 'Rate',
        },
        {
          name: 'offer',
          type: 'number',
          required: false,
          min: 0,
          max: 100,
          label: 'Offer %',
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 0,
          label: 'Quantity',
        },
        {
          name: 'unit',
          type: 'select',
          options: [
            { label: 'Pieces (pcs)', value: 'pcs' },
            { label: 'Kilograms (kg)', value: 'kg' },
            { label: 'Grams (g)', value: 'g' },
          ],
          required: true,
        },
        {
          name: 'gst',
          type: 'select',
          options: [
            { label: '0%', value: '0' },
            { label: '5%', value: '5' },
            { label: '12%', value: '12' },
            { label: '18%', value: '18' },
            { label: '22%', value: '22' }, // As specified
          ],
          required: true,
          defaultValue: '0',
          label: 'GST',
        },
      ],
    },
    {
      name: 'inactiveBranches',
      type: 'relationship',
      relationTo: 'branches',
      hasMany: true,
      label: 'Inactive in Branches',
      admin: {
        description: 'Select branches where this product should be inactive.',
      },
    },
    {
      name: 'branchOverrides',
      type: 'array', // Overrides for specific branches (e.g., the one at ₹12)
      label: 'Branch Overrides',
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
          label: 'Branch',
        },
        {
          name: 'price',
          type: 'number',
          min: 0,
          label: 'Override Price (MRP)', // Optional override
        },
        {
          name: 'rate',
          type: 'number',
          min: 0,
          label: 'Override Rate',
        },
        {
          name: 'offer',
          type: 'number',
          min: 0,
          max: 100,
          label: 'Override Offer %',
        },
        {
          name: 'quantity',
          type: 'number',
          min: 0,
          label: 'Override Quantity',
        },
        {
          name: 'unit',
          type: 'select',
          options: [
            { label: 'Pieces (pcs)', value: 'pcs' },
            { label: 'Kilograms (kg)', value: 'kg' },
            { label: 'Grams (g)', value: 'g' },
          ],
          label: 'Override Unit',
        },
        {
          name: 'gst',
          type: 'select',
          options: [
            { label: '0%', value: '0' },
            { label: '5%', value: '5' },
            { label: '12%', value: '12' },
            { label: '18%', value: '18' },
            { label: '22%', value: '22' },
          ],
          defaultValue: '0',
          label: 'Override GST',
        },
      ],
    },
  ],
}

export default Products
