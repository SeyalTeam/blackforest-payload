import type { PayloadHandler, PayloadRequest } from 'payload'
import { enforceMinAppVersion } from '../utilities/appVersionGuard'

/**
 * GET /api/check-app-version
 *
 * The Flutter app calls this endpoint on startup and in the heartbeat to
 * check whether its version is still supported.
 *
 * - No X-App-Version header  → 200 { allowed: true }  (non-app clients always pass)
 * - Version >= minVersion     → 200 { allowed: true }
 * - Version <  minVersion     → 426 { error, message, clientVersion, minVersion }
 */
export const checkAppVersionHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const blocked = await enforceMinAppVersion(req)
  if (blocked) return blocked

  const clientVersion = req.headers.get('x-app-version')?.trim() ?? null

  return Response.json({
    allowed: true,
    clientVersion,
  })
}
