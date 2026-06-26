import type { PayloadRequest } from 'payload'

const APP_VERSION_HEADER = 'x-app-version'
const APP_VERSION_SETTINGS_SLUG = 'app-version-settings'

/**
 * Parses a semver string like "2.1.3" into an array of numbers [2, 1, 3].
 * Non-numeric parts are treated as 0.
 */
const parseSemver = (version: string): number[] => {
  return version
    .trim()
    .split('.')
    .map((part) => {
      const num = parseInt(part, 10)
      return isNaN(num) ? 0 : num
    })
}

/**
 * Returns true if `version` is >= `minVersion`.
 * Both are semver strings like "2.0.0".
 */
export const isVersionAllowed = (version: string, minVersion: string): boolean => {
  const v = parseSemver(version)
  const min = parseSemver(minVersion)
  const length = Math.max(v.length, min.length)

  for (let i = 0; i < length; i++) {
    const vPart = v[i] ?? 0
    const minPart = min[i] ?? 0
    if (vPart > minPart) return true
    if (vPart < minPart) return false
  }
  return true // equal
}

/**
 * Reads the minimum app version from the database (AppVersionSettings global).
 * Falls back to '1.0.0' on any error.
 */
const fetchMinAppVersion = async (
  req: PayloadRequest,
): Promise<{ minVersion: string; updateMessage: string }> => {
  try {
    const settings = (await req.payload.findGlobal({
      slug: APP_VERSION_SETTINGS_SLUG as Parameters<typeof req.payload.findGlobal>[0]['slug'],
      overrideAccess: true,
    })) as { minAppVersion?: string | null; updateMessage?: string | null }

    return {
      minVersion: settings?.minAppVersion?.trim() || '1.0.0',
      updateMessage:
        settings?.updateMessage?.trim() ||
        'This version of the app is no longer supported. Please update to continue.',
    }
  } catch {
    return {
      minVersion: '1.0.0',
      updateMessage: 'This version of the app is no longer supported. Please update to continue.',
    }
  }
}

/**
 * Checks the X-App-Version header against the configured minimum.
 *
 * - If the header is MISSING → allowed (browser/Postman/web calls pass through)
 * - If the header is PRESENT and too low → returns 426 Upgrade Required
 * - If the header is PRESENT and OK → returns null (proceed normally)
 */
export const enforceMinAppVersion = async (req: PayloadRequest): Promise<Response | null> => {
  const clientVersion = req.headers.get(APP_VERSION_HEADER)?.trim()

  // No header = not a Flutter app request, allow it through
  if (!clientVersion) return null

  const { minVersion, updateMessage } = await fetchMinAppVersion(req)

  if (isVersionAllowed(clientVersion, minVersion)) return null

  return Response.json(
    {
      error: 'app_version_outdated',
      message: updateMessage,
      clientVersion,
      minVersion,
    },
    { status: 426 },
  )
}
