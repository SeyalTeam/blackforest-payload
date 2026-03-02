import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterReadHook,
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
      previousDoc && typeof previousDoc.prefix === 'string'
        ? normalizePrefix(previousDoc.prefix)
        : ''

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
    await fs.rm(path.join(path.resolve(process.cwd(), 'uploads'), prefix, filename), {
      force: true,
    })
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `Failed removing mirrored media file ${filename} from ${prefix}`,
    })
  }
}

const addPublicURL: CollectionAfterReadHook = ({ doc }) => {
  const publicURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL

  if (publicURL && doc && doc.filename) {
    // Construction: PUBLIC_URL + ROOT_PREFIX + (doc.prefix if exists) + filename
    // We configured s3Storage with prefix: 'blackforest/uploads'
    const rootPrefix = 'blackforest/uploads'
    const docPrefix = typeof doc.prefix === 'string' ? doc.prefix : ''

    const cleanURL = publicURL.endsWith('/') ? publicURL.slice(0, -1) : publicURL
    const cleanRoot = rootPrefix.startsWith('/') ? rootPrefix.slice(1) : rootPrefix
    const cleanDocPrefix = docPrefix.startsWith('/') ? docPrefix.slice(1) : docPrefix

    // Some migrated rows incorrectly saved absolute storage prefix in `doc.prefix`
    // (e.g. "blackforest/uploads"), which would duplicate root segments in URLs.
    const normalizedDocPrefix =
      cleanDocPrefix === cleanRoot
        ? ''
        : cleanDocPrefix.startsWith(`${cleanRoot}/`)
          ? cleanDocPrefix.slice(cleanRoot.length + 1)
          : cleanDocPrefix
    const hasLegacyAbsolutePrefix =
      cleanDocPrefix === cleanRoot || cleanDocPrefix.startsWith(`${cleanRoot}/`)

    // Prevent double prefixes (e.g. 'category/category/image.jpg')
    // This happens because some DB syncing scripts baked the prefix into the filename directly
    const finalDocPrefix = doc.filename.startsWith(`${normalizedDocPrefix}/`)
      ? ''
      : normalizedDocPrefix

    // Some migrated rows have root prefix baked into filename:
    // e.g. "blackforest/uploads/products/example.jpg"
    const filenameWithoutRoot = doc.filename.startsWith(`${cleanRoot}/`)
      ? doc.filename.slice(cleanRoot.length + 1)
      : doc.filename

    const fullPath = [cleanRoot, finalDocPrefix, filenameWithoutRoot]
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/') // Remove double slashes everywhere else

    const originalURL = `${cleanURL}/${fullPath}`
    doc.url = originalURL

    const isLegacyLocalMediaURL = (value?: string | null): boolean =>
      typeof value === 'string' && /^https?:\/\/localhost(?::\d+)?\/api\/media\/file\//.test(value)

    const getNormalizedFilename = (value?: string | null): string | null => {
      if (!value || typeof value !== 'string') return null
      return value.startsWith(`${cleanRoot}/`) ? value.slice(cleanRoot.length + 1) : value
    }

    const thumbFilename = getNormalizedFilename(doc.sizes?.thumbnail?.filename)
    const thumbPath = [cleanRoot, finalDocPrefix, thumbFilename || '']
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/')
    const thumbURL = !hasLegacyAbsolutePrefix && thumbFilename ? `${cleanURL}/${thumbPath}` : originalURL

    // Always prefer R2/public URL for thumbnail in API responses so admin UI
    // does not depend on /api/media/file (which can differ between deployments).
    doc.thumbnailURL = thumbURL

    if (!doc.sizes?.thumbnail) {
      doc.sizes = doc.sizes || {}
      doc.sizes.thumbnail = {
        url: thumbURL,
        width: doc.width || null,
        height: doc.height || null,
        mimeType: doc.mimeType || null,
        filesize: doc.filesize || null,
        filename: !hasLegacyAbsolutePrefix && thumbFilename ? thumbFilename : filenameWithoutRoot || null,
      }
    } else if (!hasLegacyAbsolutePrefix ? thumbFilename : filenameWithoutRoot) {
      doc.sizes.thumbnail.url = thumbURL
    }
  }

  return doc
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
    {
      name: 'prefix',
      type: 'text',
      admin: {
        hidden: true,
      },
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
    afterRead: [addPublicURL],
    // Disable mirroring for cloud storage
    // afterChange: [mirrorToPrefixFolder],
    // afterDelete: [cleanupMirroredFile],
  },
}
