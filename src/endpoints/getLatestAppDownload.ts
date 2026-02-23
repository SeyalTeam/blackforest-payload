import type { PayloadHandler, PayloadRequest } from 'payload'
import type { Config } from '../payload-types'

type ApkDocument = {
  url?: string | null
}

type AppDownloadSettingsRow = {
  appKey?: string | null
  apkFile?: string | ApkDocument | null
}

const APP_DOWNLOAD_SETTINGS_SLUG = 'app-download-settings' as keyof Config['globals']
const APP_DOWNLOAD_PARAM = 'appKey'
const APP_DOWNLOAD_FALLBACK_ROUTE = 'latest'

const normalizeAppKey = (value: unknown): string =>
  (typeof value === 'string' ? value.trim().toLowerCase() : '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

export const getLatestAppDownloadHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const settings = (await req.payload.findGlobal({
      slug: APP_DOWNLOAD_SETTINGS_SLUG,
      depth: 1,
      overrideAccess: true,
    })) as { apps?: AppDownloadSettingsRow[] }

    const requestedKey = normalizeAppKey(
      (req.routeParams as Record<string, unknown> | undefined)?.[APP_DOWNLOAD_PARAM],
    )
    const apps = Array.isArray(settings?.apps) ? settings.apps : []

    const selectedRow = requestedKey
      ? apps.find((app) => normalizeAppKey(app?.appKey) === requestedKey)
      : apps.find((app) => Boolean(app?.apkFile))

    if (!selectedRow) {
      const errorMessage = requestedKey
        ? `No app found for key: ${requestedKey}`
        : `No APK found. Use /api/app-download/${APP_DOWNLOAD_FALLBACK_ROUTE}.apk only after at least one app is uploaded.`
      return Response.json({ error: errorMessage }, { status: 404 })
    }

    const apkFile =
      selectedRow.apkFile && typeof selectedRow.apkFile === 'object'
        ? (selectedRow.apkFile as ApkDocument)
        : null
    const fileURL = typeof apkFile?.url === 'string' ? apkFile.url.trim() : ''

    if (!fileURL) {
      const errorMessage = requestedKey
        ? `APK is not uploaded for app key: ${requestedKey}`
        : 'No APK is currently uploaded.'
      return Response.json({ error: errorMessage }, { status: 404 })
    }

    const redirectURL =
      fileURL.startsWith('http://') || fileURL.startsWith('https://')
        ? fileURL
        : new URL(fileURL, req.url).toString()

    return Response.redirect(redirectURL, 302)
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to resolve latest APK download link.',
    })

    return Response.json({ error: 'Failed to fetch APK download URL.' }, { status: 500 })
  }
}
