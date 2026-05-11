import { getPayload } from 'payload'
import config from '../payload.config'

const BULK_BATCH_SIZE = (() => {
  const parsed = Number.parseInt(process.env.BILLING_CUSTOMER_BACKFILL_BATCH_SIZE || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300
})()

const MAX_RETRIES = (() => {
  const parsed = Number.parseInt(process.env.BILLING_CUSTOMER_BACKFILL_MAX_RETRIES || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6
})()

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toIDString = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value

  if (typeof value === 'object' && value !== null) {
    const maybeID = (value as { id?: unknown; _id?: unknown }).id
    if (typeof maybeID === 'string' && maybeID.trim().length > 0) return maybeID.trim()

    const maybeMongoID = (value as { _id?: unknown })._id
    if (typeof maybeMongoID === 'string' && maybeMongoID.trim().length > 0) return maybeMongoID.trim()
  }

  try {
    const stringified = String(value)
    return stringified && stringified !== '[object Object]' ? stringified : null
  } catch (_error) {
    return null
  }
}

const isRetryableMongoError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    name?: unknown
    message?: unknown
    code?: unknown
  }

  const name = typeof candidate.name === 'string' ? candidate.name.toLowerCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  const code = typeof candidate.code === 'string' ? candidate.code.toLowerCase() : ''

  return (
    name.includes('mongowaitqueuetimeout') ||
    message.includes('timed out while checking out a connection from connection pool') ||
    message.includes('connection pool') ||
    message.includes('ecconnreset') ||
    message.includes('timed out') ||
    code.includes('exceededtimelimit')
  )
}

const withRetry = async <T>(label: string, task: () => Promise<T>): Promise<T> => {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt >= MAX_RETRIES || !isRetryableMongoError(error)) {
        throw error
      }

      const backoffMs = Math.min(5000, 500 * attempt)
      console.warn(
        `[retry] ${label} failed on attempt ${attempt}/${MAX_RETRIES}. Retrying in ${backoffMs}ms...`,
      )
      await wait(backoffMs)
    }
  }

  throw lastError
}

const run = async () => {
  const payload = await getPayload({ config })
  const nowISO = new Date().toISOString()

  const db = payload.db as any
  const billingsModel = db?.collections?.['billings']
  const billingCustomersModel = db?.collections?.['billing-customers']

  if (!billingsModel || !billingCustomersModel) {
    throw new Error('Required DB collections were not found: billings / billing-customers')
  }

  const aggregationPipeline = [
    {
      $addFields: {
        normalizedPhone: {
          $trim: { input: { $toString: { $ifNull: ['$customerDetails.phoneNumber', ''] } } },
        },
        normalizedName: {
          $trim: { input: { $toString: { $ifNull: ['$customerDetails.name', ''] } } },
        },
      },
    },
    {
      $match: {
        normalizedPhone: { $ne: '' },
      },
    },
    {
      $sort: { createdAt: -1, _id: -1 },
    },
    {
      $group: {
        _id: '$normalizedPhone',
        name: { $first: '$normalizedName' },
        lastBill: { $first: '$_id' },
      },
    },
  ]

  console.log('Scanning billings and syncing unique customers into billing-customers...')

  const aggregationCursor = await withRetry('open billing aggregation cursor', async () =>
    billingsModel.aggregate(aggregationPipeline).cursor({ batchSize: 500 }).exec(),
  )

  let processedUniquePhones = 0
  let upserted = 0
  let modified = 0
  let matched = 0
  let failed = 0

  const bulkOperations: Array<Record<string, unknown>> = []

  const flushBulk = async () => {
    if (bulkOperations.length === 0) return

    try {
      const result = await withRetry('bulk upsert billing-customers', async () =>
        billingCustomersModel.bulkWrite(bulkOperations, { ordered: false }),
      )

      upserted += Number(result?.upsertedCount ?? result?.nUpserted ?? 0)
      modified += Number(result?.modifiedCount ?? result?.nModified ?? 0)
      matched += Number(result?.matchedCount ?? result?.nMatched ?? 0)
    } catch (error) {
      failed += bulkOperations.length
      console.error('Failed bulk upsert batch:', error)
    } finally {
      bulkOperations.length = 0
    }
  }

  for await (const row of aggregationCursor as AsyncIterable<Record<string, unknown>>) {
    const phoneNumber = normalizeText(row?._id)
    if (!phoneNumber) continue

    const customerName = normalizeText(row?.name) || phoneNumber
    const lastBillID = toIDString(row?.lastBill)

    bulkOperations.push({
      updateOne: {
        filter: { phoneNumber },
        update: {
          $set: {
            name: customerName,
            phoneNumber,
            ...(lastBillID ? { lastBill: lastBillID } : {}),
            lastSyncedAt: nowISO,
          },
        },
        upsert: true,
      },
    })

    processedUniquePhones += 1

    if (processedUniquePhones % 5000 === 0) {
      console.log(`Prepared ${processedUniquePhones} unique customer upserts so far...`)
    }

    if (bulkOperations.length >= BULK_BATCH_SIZE) {
      await flushBulk()
    }
  }

  await flushBulk()

  console.log('Backfill complete.')
  console.log(
    JSON.stringify(
      {
        processedUniquePhones,
        upserted,
        modified,
        matched,
        failed,
      },
      null,
      2,
    ),
  )
}

void run()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Billing customer backfill failed:', error)
    process.exit(1)
  })
