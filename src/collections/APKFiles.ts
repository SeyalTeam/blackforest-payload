import type { CollectionConfig } from 'payload'

const canManageApkFiles = (role?: string): boolean => ['superadmin', 'admin'].includes(role || '')

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
  fields: [],
}

export default APKFiles
