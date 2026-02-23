import type { GlobalAfterChangeHook, GlobalBeforeValidateHook, GlobalConfig } from 'payload'

export const APP_DOWNLOAD_BASE_PATH = '/api/app-download'

const canUpdateAppDownloadSettings = (role?: string): boolean =>
  ['superadmin', 'admin'].includes(role || '')

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const normalizeAppKey = (value: unknown): string =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

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

const normalizeAppsBeforeSave: GlobalBeforeValidateHook = async ({ data, originalDoc }) => {
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
      downloadURL: `${APP_DOWNLOAD_BASE_PATH}/${appKey}.apk`,
    }
  })

  return {
    ...(data || {}),
    apps: normalizedApps,
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
  },
  access: {
    read: () => true,
    update: ({ req }) => canUpdateAppDownloadSettings(req.user?.role),
  },
  hooks: {
    beforeValidate: [normalizeAppsBeforeSave],
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
