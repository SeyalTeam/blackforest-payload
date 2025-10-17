import { CollectionConfig } from 'payload'

const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name', // Displays name in admin UI list
    group: 'Inventory', // Groups under a section in sidebar
  },
  access: {
    // Role-based access: Superadmin full, others filtered by company/branch
    read: async ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      if (user.role === 'admin' || user.role === 'company') {
        // Filter to user's company
        if (!user.company) return false
        return { 'category.company': { equals: user.company } }
      }
      if (user.role === 'branch') {
        // Branch users see products in their company, with pricing filtered implicitly via queries
        if (!user.company) return false
        return { 'category.company': { equals: user.company } }
      }
      return false // Delivery/others no access
    },
    create: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'company',
    update: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'company',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
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
