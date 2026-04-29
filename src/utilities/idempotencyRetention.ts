import type { Payload } from 'payload'

const IDEMPOTENCY_COLLECTION = 'idempotency-keys'
const RETENTION_HOURS = 24
const CLEANUP_INTERVAL_MINUTES = 30
const TTL_INDEX_NAME = 'idempotency_expires_at_ttl'

let cleanupTimer: NodeJS.Timeout | null = null

type IdempotencyModel = {
  collection?: {
    createIndex: (
      spec: Record<string, 1 | -1>,
      options?: Record<string, unknown>,
    ) => Promise<unknown>
  }
  deleteMany: (query: Record<string, unknown>) => Promise<{ deletedCount?: number }>
}

const getModel = (payload: Payload): IdempotencyModel | null => {
  const model = payload.db?.collections?.[IDEMPOTENCY_COLLECTION]
  if (!model || typeof model !== 'object') return null
  return model as unknown as IdempotencyModel
}

const runCleanup = async (payload: Payload): Promise<number> => {
  const model = getModel(payload)
  if (!model) return 0

  const now = new Date()
  const result = await model.deleteMany({
    expiresAt: { $lte: now },
  })

  return typeof result?.deletedCount === 'number' ? result.deletedCount : 0
}

export const getIdempotencyRetentionConfig = () => ({
  retentionHours: RETENTION_HOURS,
  cleanupIntervalMinutes: CLEANUP_INTERVAL_MINUTES,
  ttlIndexName: TTL_INDEX_NAME,
})

export const setupIdempotencyRetention = async (payload: Payload): Promise<void> => {
  const model = getModel(payload)
  if (!model) {
    payload.logger.warn('[IdempotencyRetention] idempotency-keys model not found; retention skipped.')
    return
  }

  try {
    await model.collection?.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: TTL_INDEX_NAME },
    )
  } catch (error) {
    payload.logger.warn({
      msg: '[IdempotencyRetention] Failed to ensure TTL index.',
      err: error,
    })
  }

  const deleted = await runCleanup(payload)
  payload.logger.info(
    `[IdempotencyRetention] Initial cleanup completed. Deleted expired records: ${deleted}.`,
  )

  if (cleanupTimer) {
    clearInterval(cleanupTimer)
  }

  cleanupTimer = setInterval(() => {
    void (async () => {
      try {
        const deletedCount = await runCleanup(payload)
        if (deletedCount > 0) {
          payload.logger.info(
            `[IdempotencyRetention] Scheduled cleanup deleted expired records: ${deletedCount}.`,
          )
        }
      } catch (error) {
        payload.logger.error({
          msg: '[IdempotencyRetention] Scheduled cleanup failed.',
          err: error,
        })
      }
    })()
  }, CLEANUP_INTERVAL_MINUTES * 60 * 1000)

  cleanupTimer.unref?.()
}

export const getIdempotencyExpiresAt = (now: Date = new Date()): string =>
  new Date(now.getTime() + RETENTION_HOURS * 60 * 60 * 1000).toISOString()
