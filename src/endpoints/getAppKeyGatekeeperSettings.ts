import type { PayloadHandler } from 'payload'
import { getAppKeyGatekeeperData, syncAppKeyGatekeeperFromDoc } from '../utilities/syncAppKeyGatekeeper'

export const getAppKeyGatekeeperSettingsHandler: PayloadHandler = async (req): Promise<Response> => {
  let data = getAppKeyGatekeeperData()
  if (data.disabledBranchIds.length === 0) {
    try {
      const globalSettings = await req.payload.findGlobal({
        slug: 'widget-settings',
        overrideAccess: true,
      })
      data = await syncAppKeyGatekeeperFromDoc(globalSettings, req.payload)
    } catch (_) {}
  }
  return Response.json(data, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=5',
      'Content-Type': 'application/json',
    },
  })
}
