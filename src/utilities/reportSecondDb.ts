import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { MongoClient } from 'mongodb'
import mongoose, { type Connection } from 'mongoose'
import { defaultBeginTransaction, type Payload, type PayloadHandler, type PayloadRequest } from 'payload'

export const REPORT_DATA_SOURCE_OPTIONS = [
  { label: 'Attendance Report', value: 'attendance' },
  { label: 'Branch Billing Report', value: 'branch-billing' },
  { label: 'Time Wise Report', value: 'time-wise' },
  { label: 'Category Wise Report', value: 'category-wise' },
  { label: 'Product Wise Report', value: 'product-wise' },
  { label: 'Product Time / Preparation Report', value: 'product-time' },
  { label: 'Closing Entry Report', value: 'closing-entry' },
  { label: 'Waiter Wise Billing Report', value: 'waiter-wise' },
  { label: 'Inventory Report', value: 'inventory' },
  { label: 'Stock Order Report', value: 'stock-order' },
  { label: 'Afterstock Customer Report', value: 'afterstock-customer' },
  { label: 'Instock Entry Report', value: 'instock-entry' },
  { label: 'Accounts Bills Report', value: 'accounts-bills' },
  { label: 'Other Products Inventory Report', value: 'other-products-inventory' },
  { label: 'Raw Material Inventory Report', value: 'raw-material-inventory' },
  { label: 'Raw Material Billing Report', value: 'raw-material-billing' },
  { label: 'Review Report', value: 'review' },
  { label: 'Expense Report', value: 'expense' },
  { label: 'Dealer Report', value: 'dealer' },
  { label: 'Return Order Report', value: 'return-order' },
  { label: 'Report Card', value: 'report-card' },
  { label: 'Tally Export', value: 'tally-export' },
  { label: 'Dashboard Stats', value: 'dashboard' },
  { label: 'Checking Report (Live Staff)', value: 'checking' },
] as const

export type ReportDataSourceKey = (typeof REPORT_DATA_SOURCE_OPTIONS)[number]['value']

interface CachedSettings {
  enabled: boolean
  secondDbUri: string
  selectedReports: Set<string>
  fetchedAt: number
}

interface CachedSecondaryInstance {
  uri: string
  connection: Connection
  payload: Payload
}

const SETTINGS_CACHE_TTL_MS = 5000
let settingsCache: CachedSettings | null = null
let secondaryCache: CachedSecondaryInstance | null = null
let pendingSecondaryConnect: { uri: string; promise: Promise<Payload> } | null = null

export function invalidateReportDatabaseSettingsCache(): void {
  settingsCache = null
}

function isValidMongoUri(uri: string): boolean {
  const trimmed = uri.trim()
  return trimmed.startsWith('mongodb://') || trimmed.startsWith('mongodb+srv://')
}

export async function getReportDatabaseSettings(payload: Payload): Promise<CachedSettings> {
  const now = Date.now()
  if (settingsCache && now - settingsCache.fetchedAt < SETTINGS_CACHE_TTL_MS) {
    return settingsCache
  }

  try {
    const doc = (await payload.findGlobal({
      slug: 'report-database-settings' as any,
      depth: 0,
      overrideAccess: true,
    })) as Record<string, any> | null

    const enabled = Boolean(doc?.enabled)
    const secondDbUri = typeof doc?.secondDbUri === 'string' ? doc.secondDbUri.trim() : ''
    const rawReports = Array.isArray(doc?.selectedReports) ? doc.selectedReports : []
    const selectedReports = new Set<string>(
      rawReports.filter((item): item is string => typeof item === 'string' && item.length > 0),
    )

    settingsCache = {
      enabled,
      secondDbUri,
      selectedReports,
      fetchedAt: now,
    }
  } catch {
    settingsCache = {
      enabled: false,
      secondDbUri: '',
      selectedReports: new Set<string>(),
      fetchedAt: now,
    }
  }

  return settingsCache
}

function createReadOnlyError(operation: string): Error {
  return new Error(`Second DB is read-only for reports; "${operation}" is not allowed.`)
}

async function buildSecondaryPayload(primaryPayload: Payload, secondDbUri: string): Promise<Payload> {
  if (!isValidMongoUri(secondDbUri)) {
    throw new Error('Invalid Second DB MongoDB URI. Must start with mongodb:// or mongodb+srv://')
  }

  const connection = await mongoose
    .createConnection(secondDbUri, {
      autoIndex: false,
      maxPoolSize: 20,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryReads: true,
    })
    .asPromise()

  const secondaryPayload = Object.assign(
    Object.create(Object.getPrototypeOf(primaryPayload)),
    primaryPayload,
  ) as Payload

  const adapterFactory = mongooseAdapter({
    url: secondDbUri,
    ensureIndexes: false,
  })
  const adapter = adapterFactory.init({ payload: secondaryPayload }) as any
  adapter.connection = connection
  adapter.init()

  try {
    const client = connection.getClient()
    if (!client?.options?.replicaSet) {
      adapter.transactionOptions = false
      adapter.beginTransaction = defaultBeginTransaction()
    }
  } catch {
    adapter.transactionOptions = false
    adapter.beginTransaction = defaultBeginTransaction()
  }

  secondaryPayload.db = adapter

  // Enforce read-only safety so report logic can never mutate the second DB.
  ;(secondaryPayload as any).create = async () => {
    throw createReadOnlyError('create')
  }
  ;(secondaryPayload as any).update = async () => {
    throw createReadOnlyError('update')
  }
  ;(secondaryPayload as any).delete = async () => {
    throw createReadOnlyError('delete')
  }
  ;(secondaryPayload as any).updateGlobal = async () => {
    throw createReadOnlyError('updateGlobal')
  }

  return secondaryPayload
}

export async function getSecondaryPayload(
  primaryPayload: Payload,
  secondDbUri: string,
): Promise<Payload> {
  const normalizedUri = secondDbUri.trim()

  if (
    secondaryCache &&
    secondaryCache.uri === normalizedUri &&
    secondaryCache.connection.readyState === 1
  ) {
    return secondaryCache.payload
  }

  if (pendingSecondaryConnect && pendingSecondaryConnect.uri === normalizedUri) {
    return pendingSecondaryConnect.promise
  }

  const previousCache = secondaryCache
  const connectPromise = (async () => {
    const payload = await buildSecondaryPayload(primaryPayload, normalizedUri)
    const connection = (payload.db as any).connection as Connection

    if (previousCache && previousCache.connection !== connection) {
      previousCache.connection.close().catch(() => {})
    }

    secondaryCache = {
      uri: normalizedUri,
      connection,
      payload,
    }
    return payload
  })()

  pendingSecondaryConnect = { uri: normalizedUri, promise: connectPromise }
  try {
    return await connectPromise
  } finally {
    if (pendingSecondaryConnect?.promise === connectPromise) {
      pendingSecondaryConnect = null
    }
  }
}

export async function getReportRequest(
  req: PayloadRequest,
  reportKey: ReportDataSourceKey,
): Promise<PayloadRequest> {
  const settings = await getReportDatabaseSettings(req.payload)
  if (
    !settings.enabled ||
    !settings.secondDbUri ||
    !settings.selectedReports.has(reportKey)
  ) {
    return req
  }

  const secondaryPayload = await getSecondaryPayload(req.payload, settings.secondDbUri)
  return Object.assign(Object.create(Object.getPrototypeOf(req)), req, {
    payload: secondaryPayload,
  }) as PayloadRequest
}

export function withReportSecondDb(
  reportKey: ReportDataSourceKey,
  handler: PayloadHandler,
): PayloadHandler {
  return async (req: PayloadRequest): Promise<Response> => {
    let effectiveReq: PayloadRequest
    try {
      effectiveReq = await getReportRequest(req, reportKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      req.payload.logger.error({
        msg: `[ReportSecondDb] Failed to connect to Second DB for report "${reportKey}"`,
        error: message,
      } as any)
      return Response.json(
        {
          error: `Failed to connect to Second DB for "${reportKey}": ${message}`,
        },
        { status: 503 },
      )
    }

    return handler(effectiveReq)
  }
}

export async function testSecondDbConnection(secondDbUri: string): Promise<{
  success: boolean
  dbName?: string
  collections?: Array<{ name: string; count: number }>
  error?: string
}> {
  const uri = secondDbUri.trim()
  if (!uri) {
    return { success: false, error: 'Please enter a Second DB MongoDB connection string.' }
  }
  if (!isValidMongoUri(uri)) {
    return {
      success: false,
      error: 'Invalid MongoDB URI. Must start with mongodb:// or mongodb+srv://',
    }
  }

  let client: MongoClient | null = null
  try {
    client = new MongoClient(uri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    })
    await client.connect()

    const db = client.db()
    const collectionInfos = await db.listCollections().toArray()
    const collectionNames = collectionInfos.map((c) => c.name).sort()

    const keyCollections = [
      'attendance',
      'attendances',
      'billings',
      'branches',
      'employees',
      'users',
      'expenses',
      'closing-entries',
      'stock-orders',
      'return-orders',
      'products',
      'categories',
      'dealers',
      'dealer-billings',
      'reviews',
    ]

    const targetList = collectionNames.filter((name) => keyCollections.includes(name))
    const listToCount = targetList.length > 0 ? targetList : collectionNames.slice(0, 15)

    const counts = await Promise.all(
      listToCount.map(async (name) => {
        try {
          const count = await db.collection(name).countDocuments()
          return { name, count }
        } catch {
          return { name, count: 0 }
        }
      }),
    )

    return {
      success: true,
      dbName: db.databaseName,
      collections: counts,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    if (client) {
      await client.close().catch(() => {})
    }
  }
}
