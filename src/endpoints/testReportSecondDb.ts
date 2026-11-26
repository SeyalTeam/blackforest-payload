import type { PayloadHandler, PayloadRequest } from 'payload'
import { testSecondDbConnection } from '../utilities/reportSecondDb'

export const testReportSecondDbHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    let secondDbUri = ''
    try {
      const body = req.json ? await req.json() : {}
      if (typeof body?.secondDbUri === 'string') {
        secondDbUri = body.secondDbUri.trim()
      }
    } catch {
      // ignore invalid/empty JSON body
    }

    if (!secondDbUri) {
      const settings = (await req.payload.findGlobal({
        slug: 'report-database-settings' as any,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, any> | null
      secondDbUri = typeof settings?.secondDbUri === 'string' ? settings.secondDbUri.trim() : ''
    }

    const result = await testSecondDbConnection(secondDbUri)
    return Response.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
