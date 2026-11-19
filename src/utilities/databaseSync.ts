import { MongoClient } from 'mongodb'
import type { Payload } from 'payload'

export interface SyncOptions {
  sourceDbUri: string
  targetDbUri?: string
  collections: string[]
  syncMode?: 'insert_only' | 'upsert'
  syncMedia?: boolean
}

export interface CollectionSyncStat {
  sourceCount: number // DB 2 count
  targetCountBefore: number // DB 1 count before sync
  inserted: number // Newly added to DB 1
  skipped: number // Already existed in DB 1 (untouched)
  targetCountAfter: number // DB 1 count after sync
  matchedCollection?: string
  errors?: string
}

export interface SyncResult {
  success: boolean
  message: string
  details: Record<string, CollectionSyncStat>
  timestamp: string
}

export function resolveCollectionName(availableNames: string[], slug: string): string {
  if (availableNames.includes(slug)) return slug

  const lowerSlug = slug.toLowerCase()
  let match = availableNames.find((n) => n.toLowerCase() === lowerSlug)
  if (match) return match

  const normSlug = lowerSlug.replace(/[-_]/g, '')
  match = availableNames.find((n) => n.toLowerCase().replace(/[-_]/g, '') === normSlug)
  if (match) return match

  // Plural checks (e.g. attendance -> attendances, company -> companies)
  const pluralForms = [
    normSlug + 's',
    normSlug + 'es',
    normSlug.replace(/y$/, 'ies'),
    lowerSlug + 's',
    lowerSlug + 'es',
  ]
  match = availableNames.find(
    (n) =>
      pluralForms.includes(n.toLowerCase().replace(/[-_]/g, '')) ||
      pluralForms.includes(n.toLowerCase()),
  )
  if (match) return match

  // Singular checks (e.g. raw-materials -> raw-material, categories -> category)
  const singularForms = [
    normSlug.replace(/s$/, ''),
    normSlug.replace(/es$/, ''),
    normSlug.replace(/ies$/, 'y'),
  ]
  match = availableNames.find(
    (n) =>
      singularForms.includes(n.toLowerCase().replace(/[-_]/g, '')) ||
      singularForms.includes(n.toLowerCase()),
  )
  if (match) return match

  return slug
}

function getDatabaseInstance(client: MongoClient, uri: string) {
  try {
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, '')
    const pathAndQuery = withoutProtocol.split('/')[1]
    if (pathAndQuery) {
      const dbName = pathAndQuery.split('?')[0]
      if (dbName && dbName.trim()) {
        return client.db(dbName.trim())
      }
    }
  } catch {}
  return client.db()
}

export async function getDatabaseCollectionCounts(
  payload: Payload,
  sourceDbUri?: string,
  targetDbUri?: string,
  customCollections?: string[],
): Promise<{
  success: boolean
  counts: Record<string, { db2Count: number; db1Count: number; matchedCollection?: string }>
  sourceDbName?: string
  targetDbName?: string
  error?: string
}> {
  const settings = await payload.findGlobal({ slug: 'database-sync-settings' as any })
  const srcUri = sourceDbUri || (settings as any)?.sourceDbUri
  const tgtUri =
    targetDbUri ||
    (settings as any)?.targetDbUri ||
    process.env.DATABASE_URI ||
    process.env.MONGODB_URI

  if (!srcUri || !tgtUri) {
    return {
      success: false,
      counts: {},
      error: 'Please enter both DB 2 and DB 1 URLs to inspect collection counts.',
    }
  }

  const collections: string[] =
    (customCollections && customCollections.length > 0 ? customCollections : null) ||
    (settings as any)?.collections || [
      'attendance',
      'raw-materials',
      'raw-material-categories',
      'products',
      'categories',
      'dealers',
      'media',
    ]

  let sourceClient: MongoClient | null = null
  let targetClient: MongoClient | null = null
  const counts: Record<string, { db2Count: number; db1Count: number; matchedCollection?: string }> = {}

  try {
    sourceClient = new MongoClient(srcUri, { connectTimeoutMS: 10000 })
    targetClient = new MongoClient(tgtUri, { connectTimeoutMS: 10000 })

    await Promise.all([sourceClient.connect(), targetClient.connect()])

    const sourceDb = getDatabaseInstance(sourceClient, srcUri)
    const targetDb = getDatabaseInstance(targetClient, tgtUri)

    const [srcList, tgtList] = await Promise.all([
      sourceDb.listCollections().toArray(),
      targetDb.listCollections().toArray(),
    ])

    const srcColls = srcList.map((c) => c.name)
    const tgtColls = tgtList.map((c) => c.name)

    console.log('[db-sync] Source DB collections:', srcColls)
    console.log('[db-sync] Target DB collections:', tgtColls)

    for (const slug of collections) {
      const srcName = resolveCollectionName(srcColls, slug)
      const tgtName = resolveCollectionName(tgtColls, slug)

      const [db2Count, db1Count] = await Promise.all([
        sourceDb.collection(srcName).countDocuments().catch(() => 0),
        targetDb.collection(tgtName).countDocuments().catch(() => 0),
      ])

      counts[slug] = {
        db2Count,
        db1Count,
        matchedCollection: srcName !== slug ? srcName : undefined,
      }
    }

    return {
      success: true,
      counts,
      sourceDbName: sourceDb.databaseName,
      targetDbName: targetDb.databaseName,
    }
  } catch (err: any) {
    return { success: false, counts: {}, error: err?.message || String(err) }
  } finally {
    if (sourceClient) await sourceClient.close().catch(() => {})
    if (targetClient) await targetClient.close().catch(() => {})
  }
}

export async function executeDatabaseSync(
  payload: Payload,
  customOptions?: Partial<SyncOptions>,
): Promise<SyncResult> {
  const settings = await payload.findGlobal({
    slug: 'database-sync-settings' as any,
  })

  const sourceDbUri = customOptions?.sourceDbUri || (settings as any)?.sourceDbUri
  const targetDbUri =
    customOptions?.targetDbUri ||
    (settings as any)?.targetDbUri ||
    process.env.DATABASE_URI ||
    process.env.MONGODB_URI

  const collections: string[] =
    customOptions?.collections || (settings as any)?.collections || []
  const syncMode = customOptions?.syncMode || (settings as any)?.syncMode || 'insert_only'
  const syncMedia =
    customOptions?.syncMedia ?? ((settings as any)?.syncMedia !== false)

  if (!sourceDbUri) {
    const errorMsg = 'Source Database URI (DB 2) is not configured in Settings.'
    await updateSyncStatus(payload, 'failed', errorMsg)
    return {
      success: false,
      message: errorMsg,
      details: {},
      timestamp: new Date().toISOString(),
    }
  }

  if (!targetDbUri) {
    const errorMsg = 'Target Database URI (DB 1) is not configured or resolved.'
    await updateSyncStatus(payload, 'failed', errorMsg)
    return {
      success: false,
      message: errorMsg,
      details: {},
      timestamp: new Date().toISOString(),
    }
  }

  if (!collections || collections.length === 0) {
    const errorMsg = 'No collections selected for synchronization.'
    await updateSyncStatus(payload, 'idle', errorMsg)
    return {
      success: true,
      message: errorMsg,
      details: {},
      timestamp: new Date().toISOString(),
    }
  }

  await updateSyncStatus(payload, 'in_progress', 'Syncing in progress...')

  let sourceClient: MongoClient | null = null
  let targetClient: MongoClient | null = null
  const details: SyncResult['details'] = {}

  try {
    sourceClient = new MongoClient(sourceDbUri, { connectTimeoutMS: 15000 })
    targetClient = new MongoClient(targetDbUri, { connectTimeoutMS: 15000 })

    await Promise.all([sourceClient.connect(), targetClient.connect()])

    const sourceDb = getDatabaseInstance(sourceClient, sourceDbUri)
    const targetDb = getDatabaseInstance(targetClient, targetDbUri)

    const [sourceCollsList, targetCollsList] = await Promise.all([
      sourceDb.listCollections().toArray(),
      targetDb.listCollections().toArray(),
    ])

    const sourceCollNames = sourceCollsList.map((c) => c.name)
    const targetCollNames = targetCollsList.map((c) => c.name)

    const collectionsToProcess = [...collections]
    if (syncMedia && !collectionsToProcess.includes('media')) {
      collectionsToProcess.push('media')
    }

    const referencedMediaIds = new Set<string>()

    for (const slug of collectionsToProcess) {
      const sourceColName = resolveCollectionName(sourceCollNames, slug)
      const targetColName = resolveCollectionName(targetCollNames, slug)

      const sourceCollection = sourceDb.collection(sourceColName)
      const targetCollection = targetDb.collection(targetColName)

      try {
        const targetCountBefore = await targetCollection.countDocuments().catch(() => 0)
        const sourceDocs = await sourceCollection.find({}).toArray()
        let inserted = 0
        let skipped = 0

        if (sourceDocs.length > 0) {
          if (syncMode === 'insert_only') {
            // Find which IDs already exist in DB 1 (Target)
            const sourceIds = sourceDocs.map((d) => d._id)
            const existingInTarget = await targetCollection
              .find({ _id: { $in: sourceIds } }, { projection: { _id: 1 } })
              .toArray()

            const existingIdSet = new Set(existingInTarget.map((d) => String(d._id)))

            // Only insert documents that DO NOT exist in DB 1
            const docsToInsert = sourceDocs.filter((d) => !existingIdSet.has(String(d._id)))
            skipped = sourceDocs.length - docsToInsert.length

            if (docsToInsert.length > 0) {
              await targetCollection.insertMany(docsToInsert, { ordered: false })
              inserted = docsToInsert.length
            }
          } else {
            // Upsert mode
            const bulkOps = sourceDocs.map((doc) => ({
              updateOne: {
                filter: { _id: doc._id },
                update: { $set: doc },
                upsert: true,
              },
            }))

            if (bulkOps.length > 0) {
              const res = await targetCollection.bulkWrite(bulkOps, { ordered: false })
              inserted = (res.upsertedCount || 0) + (res.modifiedCount || 0)
              skipped = (res.matchedCount || 0) - (res.modifiedCount || 0)
            }
          }

          // Gather any referenced media if syncMedia is enabled
          if (syncMedia && slug !== 'media') {
            for (const doc of sourceDocs) {
              extractMediaIds(doc, referencedMediaIds)
            }
          }
        }

        const targetCountAfter = await targetCollection
          .countDocuments()
          .catch(() => targetCountBefore + inserted)

        details[slug] = {
          sourceCount: sourceDocs.length,
          targetCountBefore,
          inserted,
          skipped,
          targetCountAfter,
          matchedCollection: sourceColName !== slug ? sourceColName : undefined,
        }
      } catch (colErr: any) {
        console.error(`[db-sync] Error syncing collection ${slug}:`, colErr)
        details[slug] = {
          sourceCount: 0,
          targetCountBefore: 0,
          inserted: 0,
          skipped: 0,
          targetCountAfter: 0,
          errors: colErr?.message || String(colErr),
        }
      }
    }

    // Process referenced media specifically if not already fully synced
    if (syncMedia && referencedMediaIds.size > 0) {
      try {
        const mediaColNameSource = resolveCollectionName(sourceCollNames, 'media')
        const mediaColNameTarget = resolveCollectionName(targetCollNames, 'media')

        const sourceMediaCol = sourceDb.collection(mediaColNameSource)
        const targetMediaCol = targetDb.collection(mediaColNameTarget)

        const mediaIdsArray = Array.from(referencedMediaIds)
        const existingMediaInTarget = await targetMediaCol
          .find({ _id: { $in: mediaIdsArray as any } }, { projection: { _id: 1 } })
          .toArray()

        const existingMediaSet = new Set(existingMediaInTarget.map((m) => String(m._id)))
        const missingMediaIds = mediaIdsArray.filter((id) => !existingMediaSet.has(String(id)))

        if (missingMediaIds.length > 0) {
          const mediaDocsToSync = await sourceMediaCol
            .find({ _id: { $in: missingMediaIds as any } })
            .toArray()

          if (mediaDocsToSync.length > 0) {
            await targetMediaCol.insertMany(mediaDocsToSync, { ordered: false })
            details['media (images & files)'] = {
              sourceCount: mediaDocsToSync.length,
              targetCountBefore: existingMediaInTarget.length,
              inserted: mediaDocsToSync.length,
              skipped: existingMediaInTarget.length,
              targetCountAfter: existingMediaInTarget.length + mediaDocsToSync.length,
            }
          }
        }
      } catch (mediaErr: any) {
        console.error('[db-sync] Error syncing referenced media:', mediaErr)
      }
    }

    const summaryLines = Object.entries(details).map(
      ([k, v]) =>
        `• ${k.toUpperCase()}${v.matchedCollection ? ` (table: ${v.matchedCollection})` : ''}:\n    DB 2 (Source): ${v.sourceCount} items\n    DB 1 (Before): ${v.targetCountBefore} items\n    Newly Added to DB 1: +${v.inserted}\n    Already in DB 1 (Skipped): ${v.skipped}\n    DB 1 Total Now: ${v.targetCountAfter} items${
          v.errors ? `\n    Error: ${v.errors}` : ''
        }`,
    )

    const finalSummary = `=== Sync Finished: ${new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    })} ===\nStrategy: ${
      syncMode === 'insert_only'
        ? 'Insert Only (Existing DB 1 records preserved without overwrite)'
        : 'Upsert (New added + Changed updated)'
    }\n\n${summaryLines.join('\n\n')}`

    await updateSyncStatus(payload, 'success', finalSummary)

    return {
      success: true,
      message: 'Synchronization completed successfully.',
      details,
      timestamp: new Date().toISOString(),
    }
  } catch (err: any) {
    const errorMsg = `Sync failed: ${err?.message || String(err)}`
    console.error('[db-sync] Sync execution failed:', err)
    await updateSyncStatus(payload, 'failed', errorMsg)
    return {
      success: false,
      message: errorMsg,
      details,
      timestamp: new Date().toISOString(),
    }
  } finally {
    if (sourceClient) await sourceClient.close().catch(() => {})
    if (targetClient) await targetClient.close().catch(() => {})
  }
}

function extractMediaIds(obj: any, set: Set<string>) {
  if (!obj || typeof obj !== 'object') return
  for (const [key, val] of Object.entries(obj)) {
    if (
      (key === 'image' ||
        key === 'media' ||
        key === 'photo' ||
        key === 'attachment' ||
        key === 'capturedImage') &&
      val
    ) {
      if (typeof val === 'string' && val.length === 24) {
        set.add(val)
      } else if (typeof val === 'object' && (val as any)._id) {
        set.add(String((val as any)._id))
      } else if (typeof val === 'object' && (val as any).id) {
        set.add(String((val as any).id))
      }
    } else if (typeof val === 'object') {
      extractMediaIds(val, set)
    }
  }
}

async function updateSyncStatus(
  payload: Payload,
  status: 'idle' | 'in_progress' | 'success' | 'failed',
  logText: string,
) {
  try {
    await payload.updateGlobal({
      slug: 'database-sync-settings' as any,
      data: {
        lastSyncStatus: status,
        lastSyncLog: logText,
        ...(status === 'success' || status === 'failed' ? { lastSyncAt: new Date().toISOString() } : {}),
      },
    })
  } catch (err) {
    console.error('[db-sync] Failed to update sync status in global settings:', err)
  }
}
