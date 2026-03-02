import type { CollectionConfig, CollectionAfterReadHook } from 'payload'

const canManageApkFiles = (role?: string): boolean => ['superadmin', 'admin'].includes(role || '')

const addPublicURL: CollectionAfterReadHook = ({ doc }) => {
  const publicURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL

  if (publicURL && doc && doc.filename) {
    const rootPrefix = 'blackforest/uploads/apk'
    const cleanURL = publicURL.endsWith('/') ? publicURL.slice(0, -1) : publicURL
    const cleanRoot = rootPrefix.startsWith('/') ? rootPrefix.slice(1) : rootPrefix

    const fullPath = [cleanRoot, doc.filename].filter(Boolean).join('/').replace(/\/+/g, '/')

    doc.url = `${cleanURL}/${fullPath}`
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
