import type { CollectionConfig } from 'payload'
import type { CollectionBeforeChangeHook } from 'payload'

const setDynamicPrefix: CollectionBeforeChangeHook = async ({ req, data, operation }) => {
  if (operation === 'create') {
    // Check for prefix from query param (for API uploads, e.g., from Flutter)
    const prefixFromQuery = req.query.prefix as string
    if (prefixFromQuery) {
      return { ...data, prefix: `${prefixFromQuery}/` }
    }

    // Fallback to referer-based logic for admin UI uploads
    const referer = req.headers.get('referer')
    if (referer?.includes('/collections/categories/')) {
      return { ...data, prefix: 'categories/' }
    } else if (referer?.includes('/collections/products/')) {
      return { ...data, prefix: 'products/' }
    } else if (referer?.includes('/collections/employees/')) {
      return { ...data, prefix: 'employees/' }
    } else if (referer?.includes('/collections/return-orders/')) {
      return { ...data, prefix: 'returnorder/' }
    }

    return { ...data, prefix: '' }
  }
  return data
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Inventory',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    disableLocalStorage: true,
    mimeTypes: ['image/*'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
  },
  hooks: {
    beforeChange: [setDynamicPrefix],
  },
}
