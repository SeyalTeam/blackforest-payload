import type { CollectionConfig, CollectionAfterReadHook } from 'payload'

const canManageStatements = (role?: string): boolean =>
  ['superadmin', 'admin', 'account'].includes(role || '')

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
    const rootPrefix = 'blackforest/uploads/bank-statements'
    const publicFileURL = buildPublicFileURL(publicURL, rootPrefix, doc.filename)
    if (publicFileURL) {
      doc.url = publicFileURL
    }
  }

  return doc
}

const BankStatements: CollectionConfig = {
  slug: 'bank-statements',
  admin: {
    group: 'Account',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'branch', 'dateType', 'updatedAt'],
    hidden: true,
  },
  access: {
    read: ({ req }) => canManageStatements(req.user?.role),
    create: ({ req }) => canManageStatements(req.user?.role),
    update: ({ req }) => canManageStatements(req.user?.role),
    delete: ({ req }) => canManageStatements(req.user?.role),
  },
  upload: {
    staticDir: 'uploads/bank-statements',
  },
  hooks: {
    afterRead: [addPublicURL],
  },
  fields: [
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
    },
    {
      name: 'dateType',
      type: 'select',
      options: [
        { label: 'Single Date', value: 'single' },
        { label: 'Double Date (Range)', value: 'double' },
      ],
      required: true,
      defaultValue: 'single',
    },
    {
      name: 'statementDate',
      type: 'date',
      admin: {
        condition: (data) => data?.dateType === 'single',
      },
    },
    {
      name: 'fromDate',
      type: 'date',
      admin: {
        condition: (data) => data?.dateType === 'double',
      },
    },
    {
      name: 'toDate',
      type: 'date',
      admin: {
        condition: (data) => data?.dateType === 'double',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Verified', value: 'verified' },
        { label: 'Not Verified', value: 'not-verified' },
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}

export default BankStatements
