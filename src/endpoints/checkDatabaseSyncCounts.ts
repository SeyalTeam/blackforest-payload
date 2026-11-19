import type { PayloadHandler } from 'payload'
import { getDatabaseCollectionCounts } from '../utilities/databaseSync'

export const checkDatabaseSyncCountsHandler: PayloadHandler = async (req) => {
  const { payload } = req

  try {
    let sourceDbUri: string | undefined
    let targetDbUri: string | undefined
    let collections: string[] | undefined

    if (req.json) {
      try {
        const body = await req.json()
        sourceDbUri = body?.sourceDbUri
        targetDbUri = body?.targetDbUri
        collections = body?.collections
      } catch {
        // ok if no body
      }
    }

    const result = await getDatabaseCollectionCounts(payload, sourceDbUri, targetDbUri, collections)
    return Response.json(result, { status: result.success ? 200 : 400 })
  } catch (error: any) {
    console.error('[checkDatabaseSyncCountsHandler] Error:', error)
    return Response.json(
      {
        success: false,
        error: error?.message || 'Failed to inspect database collection counts',
      },
      { status: 500 },
    )
  }
}
