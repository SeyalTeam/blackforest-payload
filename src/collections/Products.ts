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
        // Filter to user's company (async fetch for relations)
        if (!user.company) return false
        return { 'category.company': { equals: user.company } } // Assuming category has company rel
      }
      if (user.role === 'branch') {
        // Branch users see products in their branch/company
        if (!user.company) return false
        return { 'category.company': { equals: user.company } } // Extend if branch-specific
      }
      return false // Delivery/others no access
    },
    create: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'company',
    update: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'company',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
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
      name: 'priceDetails',
      type: 'array', // For multiple variants
      label: 'Price Details',
      minRows: 1, // Require at least one
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
    // Optional: Link to branch if branch-specific (e.g., stock variations)
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false,
      admin: {
        condition: (data) => data.category?.company, // Show if category has company
      },
    },
  ],
}

export default Products
