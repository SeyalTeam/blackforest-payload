import type {
  GlobalAfterChangeHook,
  GlobalAfterReadHook,
  GlobalBeforeValidateHook,
  GlobalConfig,
  PayloadRequest,
} from 'payload'

export const APP_DOWNLOAD_BASE_PATH = '/api/app-download'
const DEFAULT_APP_DOWNLOAD_DOMAIN = 'http://localhost:3000'

const canUpdateAppDownloadSettings = (role?: string): boolean =>
  ['superadmin', 'admin'].includes(role || '')

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const getFirstCommaSeparatedValue = (value: string | null): string =>
  (value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)[0] || ''

const normalizeAppKey = (value: unknown): string =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const toOrigin = (value: string): string => {
  const input = normalizeText(value)
  if (!input) return ''

  try {
    return new URL(input).origin
  } catch (_error) {
    try {
      return new URL(`https://${input}`).origin
    } catch (_nestedError) {
      return ''
    }
  }
}

const resolveAppDownloadBaseURL = (req?: PayloadRequest): string => {
  if (!req) return DEFAULT_APP_DOWNLOAD_DOMAIN

  const serverURL = toOrigin(normalizeText(req.payload?.config?.serverURL))
  if (serverURL) return serverURL

  const forwardedProto = getFirstCommaSeparatedValue(
    req.headers.get('x-forwarded-proto'),
  ).toLowerCase()
  const forwardedHost = getFirstCommaSeparatedValue(req.headers.get('x-forwarded-host'))
  const host = forwardedHost || getFirstCommaSeparatedValue(req.headers.get('host'))

  if (host) {
    const protocol =
      forwardedProto ||
      (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    const fromHeaders = toOrigin(`${protocol}://${host}`)
    if (fromHeaders) return fromHeaders
  }

  const fromRequestURL = toOrigin(normalizeText(req.url))
  return fromRequestURL || DEFAULT_APP_DOWNLOAD_DOMAIN
}

const buildAbsoluteDownloadURL = (baseURL: string, appKey: string): string => {
  const normalizedBaseURL = toOrigin(baseURL)
  const downloadPath = `${APP_DOWNLOAD_BASE_PATH}/${appKey}.apk`

  if (!normalizedBaseURL) return downloadPath

  return new URL(downloadPath, `${normalizedBaseURL}/`).toString()
}

const buildUniqueKey = (baseSeed: string, usedKeys: Set<string>, fallbackIndex: number): string => {
  const normalizedBase = normalizeAppKey(baseSeed) || `app-${fallbackIndex + 1}`

  let candidate = normalizedBase
  let suffix = 2

  while (usedKeys.has(candidate)) {
    candidate = `${normalizedBase}-${suffix}`
    suffix += 1
  }

  usedKeys.add(candidate)
  return candidate
}

const extractID = (value: unknown): string | null => {
  if (typeof value === 'string') return value

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof (value as { id?: unknown }).id === 'string' ||
      typeof (value as { id?: unknown }).id === 'number')
  ) {
    return String((value as { id: string | number }).id)
  }

  return null
}

const extractAPKIDsFromRows = (rows: unknown): Set<string> => {
  const ids = new Set<string>()

  if (!Array.isArray(rows)) return ids

  for (const row of rows) {
    const apkID = extractID((row as { apkFile?: unknown } | null)?.apkFile)
    if (apkID) ids.add(apkID)
  }

  return ids
}

const normalizeAppsBeforeSave: GlobalBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const rawApps = Array.isArray((data as { apps?: unknown[] } | null)?.apps)
    ? (((data as { apps?: unknown[] }).apps || []) as unknown[])
    : []

  const originalApps = Array.isArray((originalDoc as { apps?: unknown[] } | null)?.apps)
    ? (((originalDoc as { apps?: unknown[] }).apps || []) as unknown[])
    : []

  const originalKeyByRowID = new Map<string, string>()

  for (const row of originalApps) {
    const rowID = normalizeText((row as { id?: unknown } | null)?.id)
    const appKey = normalizeAppKey((row as { appKey?: unknown } | null)?.appKey)
    if (rowID && appKey) {
      originalKeyByRowID.set(rowID, appKey)
    }
  }

  const usedKeys = new Set<string>()

  const baseURL = resolveAppDownloadBaseURL(req)

  const normalizedApps = rawApps.map((rawRow, index) => {
    const row = (rawRow || {}) as Record<string, unknown>
    const appName = normalizeText(row.appName)
    const rowID = normalizeText(row.id)
    const preservedKey = rowID ? originalKeyByRowID.get(rowID) || '' : ''
    const existingKey = normalizeAppKey(row.appKey) || preservedKey

    const appKey = existingKey
      ? buildUniqueKey(existingKey, usedKeys, index)
      : buildUniqueKey(appName, usedKeys, index)

    return {
      ...row,
      appName,
      appKey,
      downloadURL: buildAbsoluteDownloadURL(baseURL, appKey),
    }
  })

  return {
    ...(data || {}),
    apps: normalizedApps,
  }
}

const hydrateAbsoluteDownloadURLsAfterRead: GlobalAfterReadHook = async ({ doc, req }) => {
  const rawApps = Array.isArray((doc as { apps?: unknown[] } | null)?.apps)
    ? (((doc as { apps?: unknown[] }).apps || []) as unknown[])
    : []

  if (!rawApps.length) return doc

  const baseURL = resolveAppDownloadBaseURL(req)
  const appsWithAbsoluteURL = rawApps.map((rawRow, index) => {
    const row = (rawRow || {}) as Record<string, unknown>
    const appKey = normalizeAppKey(row.appKey) || normalizeAppKey(row.appName) || `app-${index + 1}`

    return {
      ...row,
      downloadURL: buildAbsoluteDownloadURL(baseURL, appKey),
    }
  })

  return {
    ...(doc as Record<string, unknown>),
    apps: appsWithAbsoluteURL,
  }
}

const cleanupOldAPKFiles: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const currentIDs = extractAPKIDsFromRows((doc as { apps?: unknown[] } | null)?.apps)
  const previousIDs = extractAPKIDsFromRows((previousDoc as { apps?: unknown[] } | null)?.apps)

  const removedIDs = [...previousIDs].filter((id) => !currentIDs.has(id))
  if (!removedIDs.length) return doc

  for (const id of removedIDs) {
    try {
      await req.payload.delete({
        collection: 'apk-files',
        id,
        overrideAccess: true,
      })
    } catch (error) {
      req.payload.logger.error({
        err: error,
        msg: `Failed removing old APK file with id ${id}`,
      })
    }
  }

  return doc
}

export const AppDownloadSettings: GlobalConfig = {
  slug: 'app-download-settings',
  label: 'App Downloads',
  admin: {
    group: 'Settings',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/WidgetSettings/index.tsx#default',
          },
        },
      },
    },
  },
  access: {
    read: () => true,
    update: ({ req }) => canUpdateAppDownloadSettings(req.user?.role),
  },
  hooks: {
    beforeValidate: [normalizeAppsBeforeSave],
    afterRead: [hydrateAbsoluteDownloadURLsAfterRead],
    afterChange: [cleanupOldAPKFiles],
  },
  fields: [
    {
      name: 'apps',
      label: 'Apps',
      type: 'array',
      labels: {
        singular: 'App',
        plural: 'Apps',
      },
      admin: {
        description:
          'Add each app with name + APK upload. Every app gets a stable download URL you can share with teammates.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'appName',
          label: 'App Name',
          type: 'text',
          required: true,
        },
        {
          name: 'apkFile',
          label: 'Upload APK',
          type: 'upload',
          relationTo: 'apk-files',
          required: false,
        },
        {
          name: 'downloadURL',
          label: 'Download Link',
          type: 'text',
          required: true,
          admin: {
            readOnly: true,
            description: 'Share this link with teammates for this app.',
          },
        },
        {
          name: 'appKey',
          type: 'text',
          required: true,
          admin: {
            readOnly: true,
            hidden: true,
          },
        },
      ],
    },
  ],
}
