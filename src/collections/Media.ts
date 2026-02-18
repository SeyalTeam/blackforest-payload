import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
} from 'payload'

const normalizePrefix = (prefix?: string): string => prefix?.replace(/^\/+|\/+$/g, '') || ''

const setDynamicPrefix: CollectionBeforeChangeHook = async ({ req, data, operation }) => {
  if (operation === 'create') {
    // Check for prefix from query param (for API uploads, e.g., from Flutter)
    const prefixFromQuery = req.query.prefix as string
    if (prefixFromQuery) {
      return { ...data, prefix: `${normalizePrefix(prefixFromQuery)}/` }
    }

    // Fallback to referer-based logic for admin UI uploads
    const referer = req.headers.get('referer')
    if (referer?.includes('/collections/categories/')) {
      return { ...data, prefix: 'categories/' }
    }
    if (referer?.includes('/collections/products/')) {
      return { ...data, prefix: 'products/' }
    }
    if (referer?.includes('/collections/employees/')) {
      return { ...data, prefix: 'employees/' }
    }
    if (referer?.includes('/collections/return-orders/')) {
      return { ...data, prefix: 'returnorder/' }
    }
    if (referer?.includes('/collections/expenses/')) {
      return { ...data, prefix: 'expense/' }
    }

    return { ...data, prefix: '' }
  }
  return data
}

const mirrorToPrefixFolder: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const filename = typeof doc?.filename === 'string' ? doc.filename : ''
  const prefix = normalizePrefix(typeof doc?.prefix === 'string' ? doc.prefix : '')

  if (!filename || !prefix) {
    return doc
  }

  const uploadRoot = path.resolve(process.cwd(), 'uploads')
  const sourcePath = path.join(uploadRoot, filename)
  const targetDir = path.join(uploadRoot, prefix)
  const targetPath = path.join(targetDir, filename)

  try {
    await fs.mkdir(targetDir, { recursive: true })
    await fs.copyFile(sourcePath, targetPath)

    const previousFilename =
      previousDoc && typeof previousDoc.filename === 'string' ? previousDoc.filename : ''
    const previousPrefix =
      previousDoc && typeof previousDoc.prefix === 'string' ? normalizePrefix(previousDoc.prefix) : ''

    if (
      previousFilename &&
      previousPrefix &&
      (previousFilename !== filename || previousPrefix !== prefix)
    ) {
      await fs.rm(path.join(uploadRoot, previousPrefix, previousFilename), { force: true })
    }
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `Failed mirroring media file ${filename} to ${prefix}`,
    })
  }

  return doc
}

const cleanupMirroredFile: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const filename = typeof doc?.filename === 'string' ? doc.filename : ''
  const prefix = normalizePrefix(typeof doc?.prefix === 'string' ? doc.prefix : '')

  if (!filename || !prefix) {
    return
  }

  try {
    await fs.rm(path.join(path.resolve(process.cwd(), 'uploads'), prefix, filename), { force: true })
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `Failed removing mirrored media file ${filename} from ${prefix}`,
    })
  }
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
      required: false,
    },
  ],
  upload: {
    staticDir: 'uploads',
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
    afterChange: [mirrorToPrefixFolder],
    afterDelete: [cleanupMirroredFile],
  },
}
