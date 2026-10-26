import type { PayloadHandler } from 'payload'
import { syncFrontendEnv, syncFrontendEnvFromDoc } from '../utilities/syncFrontendEnv'

export const syncFrontendEnvHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    let requestedDomain = ''

    if (req.method === 'POST') {
      try {
        const body = (await req.json?.()) as { activeDomain?: string } | undefined
        if (body?.activeDomain && typeof body.activeDomain === 'string') {
          requestedDomain = body.activeDomain.trim()
        }
      } catch {
        // body could be empty or invalid json
      }
    } else if (req.method === 'GET') {
      const requestURL = new URL(req.url || 'http://localhost')
      requestedDomain = (requestURL.searchParams.get('activeDomain') || '').trim()
    }

    if (requestedDomain) {
      const result = syncFrontendEnv(requestedDomain)
      return Response.json(result, { status: result.success ? 200 : 400 })
    }

    // Otherwise, fetch active domain from widget-settings global
    const settings = await req.payload.findGlobal({
      slug: 'widget-settings',
      depth: 0,
      overrideAccess: true,
    })

    const result = syncFrontendEnvFromDoc(settings)
    return Response.json(result, { status: result.success ? 200 : 404 })
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to sync frontend .env file',
    })
    return Response.json(
      {
        success: false,
        message: 'Internal server error while syncing frontend .env file',
      },
      { status: 500 },
    )
  }
}
