import type { CollectionConfig, CollectionAfterReadHook } from 'payload'

const canManageApkFiles = (role?: string): boolean => ['superadmin', 'admin'].includes(role || '')

const normalizeAbsoluteURL = (value?: string | null): string => {
  const input = value?.trim() || ''
  if (!input) return ''

  try {
    return new URL(input).toString().replace(/\/+$/, '')
  } catch (_error) {
    try {
      return new URL(`https://${input}`).toString().replace(/\/+$/, '')
    } catch (_nestedError) {
      return ''
    }
  }
}

const buildPublicFileURL = (baseURL: string, ...pathSegments: string[]): string | null => {
  const normalizedBaseURL = normalizeAbsoluteURL(baseURL)
  if (!normalizedBaseURL) return null

  const normalizedPath = pathSegments
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')

  if (!normalizedPath) return normalizedBaseURL

  const encodedPath = normalizedPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  try {
    return new URL(encodedPath, `${normalizedBaseURL}/`).toString()
  } catch (_error) {
    return null
  }
}

const addPublicURL: CollectionAfterReadHook = ({ doc }) => {
  const publicURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL

  if (publicURL && doc && doc.filename) {
    const rootPrefix = 'blackforest/uploads/apk'
    const publicFileURL = buildPublicFileURL(publicURL, rootPrefix, doc.filename)
    if (publicFileURL) {
      doc.url = publicFileURL
    }
  }

  return doc
}

const APKFiles: CollectionConfig = {
  slug: 'apk-files',
  admin: {
    group: 'Settings',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'updatedAt'],
    hidden: true,
  },
  access: {
    read: () => true,
    create: ({ req }) => canManageApkFiles(req.user?.role),
    update: ({ req }) => canManageApkFiles(req.user?.role),
    delete: ({ req }) => canManageApkFiles(req.user?.role),
  },
  upload: {
    staticDir: 'uploads/apk',
  },
  hooks: {
    afterRead: [addPublicURL],
  },
  fields: [],
}

export default APKFiles
