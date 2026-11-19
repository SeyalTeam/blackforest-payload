import type { PayloadHandler } from 'payload'
import { executeDatabaseSync } from '../utilities/databaseSync'

export const triggerDatabaseSyncHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (user && user.role !== 'superadmin' && user.role !== 'admin') {
    return Response.json({ error: 'Unauthorized. Only admins can trigger database sync.' }, { status: 403 })
  }

  try {
    let customOptions = {}
    if (req.json) {
      try {
        customOptions = await req.json()
      } catch {
        // empty body ok
      }
    }

    const result = await executeDatabaseSync(payload, customOptions)
    return Response.json(result, { status: result.success ? 200 : 500 })
  } catch (error: any) {
    console.error('[triggerDatabaseSyncHandler] Error:', error)
    return Response.json(
      {
        success: false,
        error: error?.message || 'Internal server error during database sync',
      },
      { status: 500 },
    )
  }
}
