// src/collections/Media.ts
import type { CollectionConfig } from 'payload'
import type { CollectionBeforeChangeHook } from 'payload'

const setDynamicPrefix: CollectionBeforeChangeHook = async ({ req, data, operation }) => {
  if (operation === 'create') {
    const referer = req.headers.get('referer')

    if (referer?.includes('/collections/categories/')) {
      return { ...data, prefix: 'categories/' }
    } else if (referer?.includes('/collections/products/')) {
      return { ...data, prefix: 'products/' }
    }
    // Optional: Add more conditions, e.g., for Products
    // else if (referer?.includes('/collections/products/')) {
    //   return { ...data, prefix: 'products/' }
    // }

    // Default for other uploads (e.g., direct to Media)
    return { ...data, prefix: '' }
  }
  return data
}

export const Media: CollectionConfig = {
  slug: 'media',
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
  upload: true,
  hooks: {
    beforeChange: [setDynamicPrefix],
  },
}
