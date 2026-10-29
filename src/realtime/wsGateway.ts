import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Payload } from 'payload'
import { WebSocket, WebSocketServer, type RawData } from 'ws'

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const WS_ENDPOINT_PATH = process.env.KOT_WS_PATH?.trim() || '/ws/v1'
const KOT_TOPIC = 'kot.item-status'
const HEARTBEAT_PING_MS = parsePositiveInteger(process.env.KOT_WS_HEARTBEAT_PING_MS, 25_000)
const HEARTBEAT_TIMEOUT_MS = parsePositiveInteger(process.env.KOT_WS_HEARTBEAT_TIMEOUT_MS, 75_000)
const REPLAY_RETENTION_MS = parsePositiveInteger(process.env.KOT_WS_REPLAY_RETENTION_MS, 5 * 60 * 1000)
const MAX_CONNECTIONS_PER_USER = parsePositiveInteger(process.env.KOT_WS_MAX_CONNECTIONS_PER_USER, 5)
const MAX_TOTAL_CONNECTIONS = parsePositiveInteger(process.env.KOT_WS_MAX_TOTAL_CONNECTIONS, 1000)
const MAX_PAYLOAD_BYTES = 32 * 1024
const INCLUDE_ITEM_SNAPSHOT = process.env.KOT_WS_INCLUDE_ITEM_SNAPSHOT === 'true'

const BRANCH_SCOPED_ROLES = new Set([
  'branch',
  'kitchen',
  'waiter',
  'cashier',
  'supervisor',
  'delivery',
  'driver',
  'chef',
])

type BillingRealtimeEventType =
  | 'billing_item_status_changed'
  | 'billing_item_preparing_time_changed'
  | 'billing_status_changed'
  | 'waiter_call_received'

export type BillingRealtimePublishInput = {
  billingId: string
  branchId: string
  eventId: string
  eventType: BillingRealtimeEventType
  itemId?: string | null
  itemSnapshot?: Record<string, unknown> | null
  itemUpdatedAt?: string | null
  itemVersion?: number | null
  kitchenId?: string | null
  kotNumber?: string | null
  productId?: string | null
  productName?: string | null
  productNames?: string[] | null
  section?: string | null
  seq: number
  statusAfter?: string | null
  statusBefore?: string | null
  tableName?: string | null
  tableNo?: string | null
  timestamp?: string
}

export type ChatRealtimePublishInput = {
  createdAt?: string
  messageId: string
  messageType?: 'text' | 'image' | 'video'
  recipientAudience: 'admins' | 'staff'
  recipientUserId?: string | null
  senderId: string
  senderName?: string | null
  senderRole?: string | null
  text: string
  threadId: string
}

type BillingRealtimeEvent = {
  billingId: string
  branchId: string
  eventId: string
  eventType: BillingRealtimeEventType
  itemId: string | null
  itemSnapshot?: Record<string, unknown> | null
  itemUpdatedAt: string | null
  itemVersion: number | null
  kitchenId: string | null
  kotNumber?: string | null
  productId: string | null
  productName?: string | null
  productNames?: string[] | null
  section?: string | null
  seq: number
  serverSentAt: string
  statusAfter: string | null
  statusBefore: string | null
  tableName?: string | null
  tableNo?: string | null
  timestamp: string
  topic: typeof KOT_TOPIC
}

type StoredEvent = BillingRealtimeEvent & {
  emittedAtMs: number
}

type ConnectionSubscription = {
  branchId: string
  kitchenId: string | null
  topic: typeof KOT_TOPIC
}

type AuthenticatedUserContext = {
  allowedBranchIDs: Set<string> | null
  allowedKitchenIDs: Set<string> | null
  expiresAtMs: number | null
  role: string
  user: Record<string, unknown>
  userID: string
}

type ConnectionState = {
  allowedBranchIDs: Set<string> | null
  allowedKitchenIDs: Set<string> | null
  expiresAtMs: number | null
  expiryTimer: NodeJS.Timeout | null
  id: string
  lastPongAtMs: number
  role: string
  socket: WebSocket
  subscription: ConnectionSubscription | null
  user: Record<string, unknown>
  userID: string
}

type RealtimeState = {
  connections: Map<string, ConnectionState>
  connectionsByUserID: Map<string, Set<string>>
  evictedEventIDs: Map<string, number>
  events: StoredEvent[]
  heartbeatTimer: NodeJS.Timeout | null
  payload: Payload | null
  wss: WebSocketServer
}

type SubscriptionValidationResult =
  | {
      ok: true
    }
  | {
      errorCode: string
      message: string
      ok: false
    }

type RealtimeGateway = {
  endpointPath: string
  handleUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => Promise<boolean>
}

const realtimeState: RealtimeState = {
  wss: new WebSocketServer({ noServer: true }),
  payload: null,
  connections: new Map(),
  connectionsByUserID: new Map(),
  events: [],
  evictedEventIDs: new Map(),
  heartbeatTimer: null,
}

const WORKER_ID = randomUUID()
const BUS_COLLECTION = 'realtime_bus'
const ACTIVE_CONNS_COLLECTION = 'active_connections'

type RealtimeBusMessage = {
  channel: 'call_signal' | 'chat' | 'billing' | 'session_terminate'
  createdAt: Date
  fromWorkerId: string
  payload: Record<string, unknown>
  recipientAudience?: string | null
  recipientUserId?: string | null
  senderId?: string | null
  targetUserId?: string | null
}

const getMongoDb = (): any => {
  const payload = realtimeState.payload
  if (!payload) return null
  return (
    (payload.db as any)?.connection?.db ||
    (payload.db as any)?.dbs?.[(payload.db as any)?.defaultDB]?.connection?.db ||
    (payload.db as any)?.collections?.['users']?.collection?.conn?.db ||
    null
  )
}

const publishToBus = (msg: Omit<RealtimeBusMessage, 'fromWorkerId' | 'createdAt'>): void => {
  const db = getMongoDb()
  if (!db) return
  db.collection(BUS_COLLECTION)
    .insertOne({
      ...msg,
      fromWorkerId: WORKER_ID,
      createdAt: new Date(),
    })
    .catch((err: any) => {
      console.warn('[wsGateway] Failed to insert bus event:', err?.message || err)
    })
}

let busChangeStream: any = null
let isClusterInitialized = false

const deliverBusCallSignal = (payload: Record<string, unknown>, targetUserId?: string | null): void => {
  if (!targetUserId) return
  const targetConnIDs = realtimeState.connectionsByUserID.get(targetUserId)
  if (!targetConnIDs || targetConnIDs.size === 0) return

  for (const connID of targetConnIDs) {
    const targetConn = realtimeState.connections.get(connID)
    if (targetConn && targetConn.socket.readyState === WebSocket.OPEN) {
      sendServerMessage(targetConn, payload)
    }
  }
}

const deliverBusChatEvent = (
  safePayload: Record<string, unknown>,
  recipientAudience?: string | null,
  recipientUserId?: string | null,
  senderId?: string | null,
): void => {
  if (recipientUserId) {
    const connIDs = realtimeState.connectionsByUserID.get(recipientUserId)
    if (connIDs) {
      for (const connID of connIDs) {
        const connection = realtimeState.connections.get(connID)
        if (connection) sendServerMessage(connection, safePayload)
      }
    }
  }

  if (recipientAudience === 'admins') {
    for (const connection of realtimeState.connections.values()) {
      if (connection.role === 'admin' || connection.role === 'superadmin') {
        sendServerMessage(connection, safePayload)
      }
    }
  }

  if (senderId) {
    const connIDs = realtimeState.connectionsByUserID.get(senderId)
    if (connIDs) {
      for (const connID of connIDs) {
        const connection = realtimeState.connections.get(connID)
        if (connection) sendServerMessage(connection, safePayload)
      }
    }
  }
}

const deliverBusBillingEvent = (storedEvent: StoredEvent): void => {
  for (const connection of realtimeState.connections.values()) {
    if (!matchesSubscription(storedEvent, connection.subscription)) continue
    sendServerMessage(connection, storedEvent)
  }
}

const deliverBusSessionTermination = (userId: string, reason: string): void => {
  const connectionIDs = realtimeState.connectionsByUserID.get(userId)
  if (!connectionIDs || connectionIDs.size === 0) return

  for (const connectionID of Array.from(connectionIDs)) {
    const connection = realtimeState.connections.get(connectionID)
    if (connection) {
      sendSystemMessage(connection, {
        eventType: 'session_terminated',
        error_code: 'session_terminated',
        message: reason,
        reason,
      })
      setTimeout(() => {
        closeSocket(connection.socket, 4401, reason)
      }, 100)
    }
  }
}

const startBusListener = (db: any): void => {
  try {
    const busColl = db.collection(BUS_COLLECTION)
    busChangeStream = busColl.watch([{ $match: { operationType: 'insert' } }])

    busChangeStream.on('change', (change: any) => {
      try {
        const doc = change.fullDocument as RealtimeBusMessage | undefined
        if (!doc || doc.fromWorkerId === WORKER_ID) return

        if (doc.channel === 'call_signal') {
          deliverBusCallSignal(doc.payload, doc.targetUserId)
        } else if (doc.channel === 'chat') {
          deliverBusChatEvent(doc.payload, doc.recipientAudience, doc.recipientUserId, doc.senderId)
        } else if (doc.channel === 'billing') {
          deliverBusBillingEvent(doc.payload as unknown as StoredEvent)
        } else if (doc.channel === 'session_terminate') {
          deliverBusSessionTermination(
            doc.targetUserId || (doc.payload?.userId as string),
            (doc.payload?.reason as string) || 'Session terminated',
          )
        }
      } catch (err) {
        console.error('[wsGateway] Error handling bus change event:', err)
      }
    })

    busChangeStream.on('error', (err: any) => {
      console.warn('[wsGateway] Bus change stream error, reconnecting in 2s:', err?.message || err)
      try {
        busChangeStream?.close()
      } catch {}
      setTimeout(() => startBusListener(db), 2000)
    })

    busChangeStream.on('close', () => {
      setTimeout(() => startBusListener(db), 2000)
    })
  } catch (err: any) {
    console.warn('[wsGateway] Change stream watch failed, retrying in 5s:', err?.message || err)
    setTimeout(() => startBusListener(db), 5000)
  }
}

const initCrossWorkerCluster = async (): Promise<void> => {
  if (isClusterInitialized) return
  const db = getMongoDb()
  if (!db) {
    setTimeout(initCrossWorkerCluster, 1000)
    return
  }
  isClusterInitialized = true

  try {
    await db.collection(ACTIVE_CONNS_COLLECTION).createIndex({ userId: 1 }).catch(() => {})
    await db.collection(ACTIVE_CONNS_COLLECTION).createIndex({ connectionId: 1 }, { unique: true }).catch(() => {})
    await db.collection(ACTIVE_CONNS_COLLECTION).createIndex({ workerId: 1 }).catch(() => {})
    await db.collection(BUS_COLLECTION).createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 }).catch(() => {})

    // Clean up stale connections from this worker from previous crash/restart
    await db.collection(ACTIVE_CONNS_COLLECTION).deleteMany({ workerId: WORKER_ID }).catch(() => {})

    startBusListener(db)
  } catch (err: any) {
    console.error('[wsGateway] initCrossWorkerCluster error:', err?.message || err)
  }
}

const parseRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (value && typeof value === 'object') {
    if (typeof (value as any).toHexString === 'function') {
      const hex = (value as any).toHexString()
      if (typeof hex === 'string' && hex.trim().length > 0) return hex.trim()
    }
    if ('id' in value) {
      const id = (value as { id?: unknown }).id
      if (typeof id === 'string' && id.trim().length > 0) return id.trim()
      if (typeof id === 'number' && Number.isFinite(id)) return String(id)
    }
    if ('_id' in value) {
      const id = (value as { _id?: unknown })._id
      if (typeof id === 'string' && id.trim().length > 0) return id.trim()
      if (typeof id === 'number' && Number.isFinite(id)) return String(id)
    }
    if (typeof (value as any).toString === 'function') {
      const str = (value as any).toString()
      if (typeof str === 'string' && str.trim().length > 0 && str !== '[object Object]') {
        return str.trim()
      }
    }
  }

  return null
}

const parseRelationshipIDs = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => parseRelationshipID(entry))
      .filter((entry): entry is string => typeof entry === 'string')
  }

  const single = parseRelationshipID(value)
  return single ? [single] : []
}

const parseJSONMessage = (raw: RawData): { ok: true; value: Record<string, unknown> } | {
  errorCode: string
  message: string
  ok: false
} => {
  const text = (() => {
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8')
    if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8')
    return raw.toString('utf8')
  })()

  if (Buffer.byteLength(text, 'utf8') > MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      errorCode: 'payload_too_large',
      message: `Message exceeds max size of ${MAX_PAYLOAD_BYTES} bytes.`,
    }
  }

  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        errorCode: 'invalid_payload',
        message: 'Message body must be a JSON object.',
      }
    }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch (_error) {
    return {
      ok: false,
      errorCode: 'invalid_json',
      message: 'Unable to parse message as JSON.',
    }
  }
}

const normalizeBearerToken = (value: string | string[] | undefined): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null

  const match = normalized.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const token = match[1]?.trim()
  return token && token.length > 0 ? token : null
}

const decodeJWTExpiryMs = (token: string): number | null => {
  const segments = token.split('.')
  if (segments.length < 2) return null

  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as {
      exp?: unknown
    }
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null
    return payload.exp * 1000
  } catch (_error) {
    return null
  }
}

const readHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(', ')
  return undefined
}

const toHeaderObject = (request: IncomingMessage): Headers => {
  const headers = new Headers()

  for (const [key, value] of Object.entries(request.headers)) {
    const resolved = readHeaderValue(value)
    if (resolved) headers.set(key, resolved)
  }

  return headers
}

const nowISO = (): string => new Date().toISOString()

const closeSocket = (socket: WebSocket, code: number, reason: string): void => {
  const clippedReason = reason.slice(0, 123)
  try {
    socket.close(code, clippedReason)
  } catch (_error) {
    try {
      socket.terminate()
    } catch (_nestedError) {
      // no-op
    }
  }
}

const encodeJSON = (value: unknown): string => JSON.stringify(value)

const ensurePayloadSize = <T extends Record<string, unknown>>(payload: T): T | null => {
  const raw = encodeJSON(payload)
  if (Buffer.byteLength(raw, 'utf8') <= MAX_PAYLOAD_BYTES) return payload

  if (!Object.prototype.hasOwnProperty.call(payload, 'itemSnapshot')) return null

  const trimmedPayload = { ...payload, itemSnapshot: null }
  const trimmedRaw = encodeJSON(trimmedPayload)
  if (Buffer.byteLength(trimmedRaw, 'utf8') > MAX_PAYLOAD_BYTES) {
    return null
  }
  return trimmedPayload as T
}

const sendServerMessage = (connection: ConnectionState, payload: Record<string, unknown>): void => {
  const safePayload = ensurePayloadSize(payload)
  if (!safePayload) return

  if (connection.socket.readyState !== WebSocket.OPEN) return

  try {
    connection.socket.send(encodeJSON(safePayload))
  } catch (_error) {
    closeSocket(connection.socket, 4408, 'send_failed')
  }
}

const sendSystemMessage = (
  connection: ConnectionState,
  payload: Omit<Record<string, unknown>, 'serverSentAt' | 'timestamp'>,
): void => {
  sendServerMessage(connection, {
    ...payload,
    timestamp: nowISO(),
    serverSentAt: nowISO(),
  })
}

const removeConnection = (connectionID: string): void => {
  const connection = realtimeState.connections.get(connectionID)
  if (!connection) return

  if (connection.expiryTimer) {
    clearTimeout(connection.expiryTimer)
    connection.expiryTimer = null
  }

  realtimeState.connections.delete(connectionID)

  const connectionSet = realtimeState.connectionsByUserID.get(connection.userID)
  if (!connectionSet) return

  connectionSet.delete(connectionID)
  if (connectionSet.size === 0) {
    realtimeState.connectionsByUserID.delete(connection.userID)
  }

  const db = getMongoDb()
  if (db) {
    db.collection(ACTIVE_CONNS_COLLECTION).deleteOne({ connectionId: connectionID }).catch(() => {})
  }
}

const pruneEventBuffers = (nowMs: number): void => {
  const cutoff = nowMs - REPLAY_RETENTION_MS

  while (realtimeState.events.length > 0) {
    const oldest = realtimeState.events[0]
    if (oldest.emittedAtMs >= cutoff) break

    realtimeState.events.shift()
    realtimeState.evictedEventIDs.set(oldest.eventId, nowMs)
  }

  for (const [eventID, evictedAt] of realtimeState.evictedEventIDs.entries()) {
    if (evictedAt < cutoff - REPLAY_RETENTION_MS) {
      realtimeState.evictedEventIDs.delete(eventID)
    }
  }
}

const matchesSubscription = (
  event: StoredEvent,
  subscription: ConnectionSubscription | null,
): boolean => {
  if (!subscription) return false
  if (subscription.topic !== event.topic) return false
  if (subscription.branchId !== event.branchId) return false
  // Branch-wide events (where event.kitchenId is null/undefined) match all subscriptions in the branch.
  // Kitchen-targeted events match subscriptions with the same kitchenId or branch-wide subscriptions.
  if (subscription.kitchenId && event.kitchenId) {
    return event.kitchenId === subscription.kitchenId
  }
  return true
}

const canAccessBranch = (connection: ConnectionState, branchID: string): boolean => {
  const allowedBranches = connection.allowedBranchIDs
  if (allowedBranches === null) return true
  return allowedBranches.has(branchID)
}

const canAccessKitchen = (connection: ConnectionState, kitchenID: string): boolean => {
  const allowedKitchens = connection.allowedKitchenIDs
  if (allowedKitchens === null) return true
  if (allowedKitchens.size === 0) return true
  return allowedKitchens.has(kitchenID)
}

const scheduleTokenExpiry = (connection: ConnectionState): void => {
  if (!connection.expiresAtMs) return

  const MAX_TIMEOUT_MS = 2_147_483_647

  const scheduleNext = (): void => {
    if (!connection.expiresAtMs) return

    const timeUntilExpiry = connection.expiresAtMs - Date.now()
    if (timeUntilExpiry <= 0) {
      sendSystemMessage(connection, {
        eventType: 'auth_expired',
        error_code: 'token_expired',
        message: 'JWT is expired. Reconnect with a fresh token.',
      })
      closeSocket(connection.socket, 4401, 'token_expired')
      return
    }

    const delayMs = Math.min(timeUntilExpiry, MAX_TIMEOUT_MS)
    connection.expiryTimer = setTimeout(() => {
      scheduleNext()
    }, delayMs)
  }

  scheduleNext()
}

const startHeartbeatLoop = (): void => {
  if (realtimeState.heartbeatTimer) return

  realtimeState.heartbeatTimer = setInterval(() => {
    const nowMs = Date.now()
    pruneEventBuffers(nowMs)

    const db = getMongoDb()
    if (db) {
      db.collection(ACTIVE_CONNS_COLLECTION).updateMany(
        { workerId: WORKER_ID },
        { $set: { lastHeartbeat: new Date() } }
      ).catch(() => {})

      db.collection(ACTIVE_CONNS_COLLECTION).deleteMany({
        lastHeartbeat: { $lt: new Date(Date.now() - 120_000) }
      }).catch(() => {})
    }

    for (const connection of realtimeState.connections.values()) {
      if (nowMs - connection.lastPongAtMs > HEARTBEAT_TIMEOUT_MS) {
        sendSystemMessage(connection, {
          eventType: 'heartbeat_timeout',
          error_code: 'heartbeat_timeout',
          message: `No pong within ${HEARTBEAT_TIMEOUT_MS} ms.`,
        })
        closeSocket(connection.socket, 4408, 'heartbeat_timeout')
        continue
      }

      if (connection.socket.readyState !== WebSocket.OPEN) continue

      try {
        connection.socket.ping()
      } catch (_error) {
        closeSocket(connection.socket, 4408, 'heartbeat_ping_failed')
      }
    }
  }, HEARTBEAT_PING_MS)
}

const resolveAllowedBranchIDs = async (
  payload: Payload,
  user: Record<string, unknown>,
): Promise<Set<string> | null> => {
  const role = typeof user.role === 'string' ? user.role : ''

  if (role === 'company') {
    const companyID = parseRelationshipID(user.company)
    if (!companyID) return new Set()

    const result = await payload.find({
      collection: 'branches',
      where: {
        company: {
          equals: companyID,
        },
      },
      depth: 0,
      pagination: false,
      limit: 1000,
      overrideAccess: true,
    })

    return new Set(
      result.docs
        .map((branch) => parseRelationshipID(branch.id))
        .filter((branchID): branchID is string => typeof branchID === 'string'),
    )
  }

  if (BRANCH_SCOPED_ROLES.has(role)) {
    const branchIDs = new Set<string>()
    parseRelationshipIDs(user.branch).forEach((branchID) => branchIDs.add(branchID))
    parseRelationshipIDs(user.lastLoginBranch).forEach((branchID) => branchIDs.add(branchID))
    parseRelationshipIDs(user.kitchenBranches).forEach((branchID) => branchIDs.add(branchID))
    return branchIDs
  }

  return null
}

const resolveAllowedKitchenIDs = (user: Record<string, unknown>): Set<string> | null => {
  const kitchenIDs = parseRelationshipIDs(user.kitchen)
  if (kitchenIDs.length === 0) return null
  return new Set(kitchenIDs)
}

const authenticateRequest = async (
  payload: Payload,
  request: IncomingMessage,
): Promise<AuthenticatedUserContext> => {
  const token = normalizeBearerToken(request.headers.authorization)
  if (!token) {
    throw new Error('missing_or_invalid_authorization_header')
  }

  const authResult = (await payload.auth({
    headers: toHeaderObject(request),
  } as any)) as {
    user?: unknown
  }

  if (!authResult?.user || typeof authResult.user !== 'object') {
    throw new Error('unauthorized')
  }

  const user = authResult.user as Record<string, unknown>
  const userID = parseRelationshipID(user.id)
  if (!userID) {
    throw new Error('invalid_user_id')
  }

  const role = typeof user.role === 'string' ? user.role : ''
  const allowedBranchIDs = await resolveAllowedBranchIDs(payload, user)
  const allowedKitchenIDs = resolveAllowedKitchenIDs(user)
  const expiresAtMs = decodeJWTExpiryMs(token)

  return {
    user,
    userID,
    role,
    allowedBranchIDs,
    allowedKitchenIDs,
    expiresAtMs,
  }
}

const validateKitchenSubscription = async (
  connection: ConnectionState,
  branchID: string,
  kitchenID: string | null,
): Promise<SubscriptionValidationResult> => {
  if (!kitchenID) return { ok: true }

  if (!canAccessKitchen(connection, kitchenID)) {
    return {
      ok: false,
      errorCode: 'unauthorized_kitchen',
      message: 'You are not allowed to subscribe to this kitchen.',
    }
  }

  const payload = realtimeState.payload
  if (!payload) {
    return {
      ok: false,
      errorCode: 'server_unavailable',
      message: 'Realtime backend is not initialized.',
    }
  }

  try {
    const kitchen = (await payload.findByID({
      collection: 'kitchens',
      id: kitchenID,
      depth: 0,
      overrideAccess: true,
    })) as { branches?: unknown } | null

    if (!kitchen) {
      return {
        ok: false,
        errorCode: 'kitchen_not_found',
        message: 'Kitchen was not found.',
      }
    }

    const kitchenBranchIDs = new Set(parseRelationshipIDs(kitchen.branches))
    if (!kitchenBranchIDs.has(branchID)) {
      return {
        ok: false,
        errorCode: 'kitchen_branch_mismatch',
        message: 'Kitchen does not belong to the requested branch.',
      }
    }
  } catch (_error) {
    return {
      ok: false,
      errorCode: 'kitchen_lookup_failed',
      message: 'Unable to validate kitchen subscription.',
    }
  }

  return { ok: true }
}

const sendSubscriptionNack = (
  connection: ConnectionState,
  payload: {
    branchId?: string | null
    errorCode: string
    kitchenId?: string | null
    message: string
    topic?: string | null
  },
): void => {
  sendSystemMessage(connection, {
    eventType: 'subscription_nack',
    subscribed: false,
    error_code: payload.errorCode,
    message: payload.message,
    topic: payload.topic || null,
    branchId: payload.branchId || null,
    kitchenId: payload.kitchenId || null,
  })
}

const sendUnsubscribeNack = (
  connection: ConnectionState,
  payload: {
    branchId?: string | null
    errorCode: string
    kitchenId?: string | null
    message: string
    topic?: string | null
  },
): void => {
  sendSystemMessage(connection, {
    eventType: 'unsubscribe_nack',
    unsubscribed: false,
    error_code: payload.errorCode,
    message: payload.message,
    topic: payload.topic || null,
    branchId: payload.branchId || null,
    kitchenId: payload.kitchenId || null,
  })
}

const handleReplay = (
  connection: ConnectionState,
  subscription: ConnectionSubscription,
  lastEventID: string,
): void => {
  pruneEventBuffers(Date.now())

  let foundIndex = -1

  for (let index = 0; index < realtimeState.events.length; index += 1) {
    const candidate = realtimeState.events[index]
    if (!matchesSubscription(candidate, subscription)) continue
    if (candidate.eventId !== lastEventID) continue
    foundIndex = index
    break
  }

  if (foundIndex < 0) {
    const errorCode = realtimeState.evictedEventIDs.has(lastEventID)
      ? 'outside_retention'
      : 'last_event_not_found'
    const subscriptionEvents = realtimeState.events.filter((event) =>
      matchesSubscription(event, subscription),
    )
    const oldestEventID = subscriptionEvents[0]?.eventId ?? null
    const newestEventID = subscriptionEvents[subscriptionEvents.length - 1]?.eventId ?? null

    sendSystemMessage(connection, {
      eventType: 'resume_nack',
      error_code: errorCode,
      message:
        errorCode === 'outside_retention'
          ? 'Replay window expired. Run full sync from GET /api/billings and resubscribe.'
          : 'lastEventId was not found for this subscription. Run full sync and resubscribe.',
      topic: subscription.topic,
      branchId: subscription.branchId,
      kitchenId: subscription.kitchenId,
      lastEventId: lastEventID,
      oldestEventId: oldestEventID,
      newestEventId: newestEventID,
      retentionWindowMs: REPLAY_RETENTION_MS,
      fullSyncRequired: true,
    })
    return
  }

  for (let index = foundIndex + 1; index < realtimeState.events.length; index += 1) {
    const event = realtimeState.events[index]
    if (!matchesSubscription(event, subscription)) continue
    sendServerMessage(connection, event)
  }
}

const handleSubscribe = async (
  connection: ConnectionState,
  message: Record<string, unknown>,
): Promise<void> => {
  const topic = typeof message.topic === 'string' ? message.topic.trim() : ''
  const branchID = typeof message.branchId === 'string' ? message.branchId.trim() : ''
  const kitchenIDRaw = typeof message.kitchenId === 'string' ? message.kitchenId.trim() : ''
  const kitchenID = kitchenIDRaw.length > 0 ? kitchenIDRaw : null
  const lastEventID =
    typeof message.lastEventId === 'string' && message.lastEventId.trim().length > 0
      ? message.lastEventId.trim()
      : null

  if (topic !== KOT_TOPIC) {
    sendSubscriptionNack(connection, {
      errorCode: 'unsupported_topic',
      message: `Unsupported topic "${topic}". Use "${KOT_TOPIC}".`,
      topic: topic || null,
      branchId: branchID || null,
      kitchenId: kitchenID,
    })
    return
  }

  if (!branchID) {
    sendSubscriptionNack(connection, {
      errorCode: 'missing_branch_id',
      message: 'branchId is required for subscribe.',
      topic,
      kitchenId: kitchenID,
    })
    return
  }

  if (!canAccessBranch(connection, branchID)) {
    sendSubscriptionNack(connection, {
      errorCode: 'unauthorized_branch',
      message: 'You are not allowed to subscribe to this branch.',
      topic,
      branchId: branchID,
      kitchenId: kitchenID,
    })
    return
  }

  const kitchenValidation = await validateKitchenSubscription(connection, branchID, kitchenID)
  if (!kitchenValidation.ok) {
    sendSubscriptionNack(connection, {
      errorCode: kitchenValidation.errorCode,
      message: kitchenValidation.message,
      topic,
      branchId: branchID,
      kitchenId: kitchenID,
    })
    return
  }

  const subscription: ConnectionSubscription = {
    topic: KOT_TOPIC,
    branchId: branchID,
    kitchenId: kitchenID,
  }

  connection.subscription = subscription

  sendSystemMessage(connection, {
    eventType: 'subscription_ack',
    subscribed: true,
    topic: subscription.topic,
    branchId: subscription.branchId,
    kitchenId: subscription.kitchenId,
    message: 'Subscription active.',
  })

  if (lastEventID) {
    handleReplay(connection, subscription, lastEventID)
  }
}

const handleUnsubscribe = (connection: ConnectionState, message: Record<string, unknown>): void => {
  const topic = typeof message.topic === 'string' ? message.topic.trim() : ''
  const branchID = typeof message.branchId === 'string' ? message.branchId.trim() : ''
  const kitchenIDRaw = typeof message.kitchenId === 'string' ? message.kitchenId.trim() : ''
  const kitchenID = kitchenIDRaw.length > 0 ? kitchenIDRaw : null

  if (!connection.subscription) {
    sendUnsubscribeNack(connection, {
      errorCode: 'not_subscribed',
      message: 'No active subscription found on this connection.',
      topic: topic || null,
      branchId: branchID || null,
      kitchenId: kitchenID,
    })
    return
  }

  if (topic && topic !== connection.subscription.topic) {
    sendUnsubscribeNack(connection, {
      errorCode: 'topic_mismatch',
      message: 'topic does not match the active subscription.',
      topic,
      branchId: branchID || null,
      kitchenId: kitchenID,
    })
    return
  }

  if (branchID && branchID !== connection.subscription.branchId) {
    sendUnsubscribeNack(connection, {
      errorCode: 'branch_mismatch',
      message: 'branchId does not match the active subscription.',
      topic: topic || connection.subscription.topic,
      branchId: branchID,
      kitchenId: kitchenID,
    })
    return
  }

  if (
    kitchenID &&
    (connection.subscription.kitchenId || null) !== (kitchenID.length > 0 ? kitchenID : null)
  ) {
    sendUnsubscribeNack(connection, {
      errorCode: 'kitchen_mismatch',
      message: 'kitchenId does not match the active subscription.',
      topic: topic || connection.subscription.topic,
      branchId: connection.subscription.branchId,
      kitchenId: kitchenID,
    })
    return
  }

  const previous = connection.subscription
  connection.subscription = null

  sendSystemMessage(connection, {
    eventType: 'unsubscribe_ack',
    unsubscribed: true,
    topic: previous.topic,
    branchId: previous.branchId,
    kitchenId: previous.kitchenId,
    message: 'Subscription removed.',
  })
}

const registerConnection = (socket: WebSocket, context: AuthenticatedUserContext): ConnectionState => {
  const connectionID = randomUUID()
  const connection: ConnectionState = {
    id: connectionID,
    socket,
    userID: context.userID,
    role: context.role,
    allowedBranchIDs: context.allowedBranchIDs,
    allowedKitchenIDs: context.allowedKitchenIDs,
    expiresAtMs: context.expiresAtMs,
    expiryTimer: null,
    lastPongAtMs: Date.now(),
    subscription: null,
    user: context.user,
  }

  realtimeState.connections.set(connectionID, connection)

  const userConnections = realtimeState.connectionsByUserID.get(context.userID) || new Set()
  userConnections.add(connectionID)
  realtimeState.connectionsByUserID.set(context.userID, userConnections)

  const db = getMongoDb()
  if (db) {
    db.collection(ACTIVE_CONNS_COLLECTION)
      .insertOne({
        connectionId: connectionID,
        userId: context.userID,
        role: context.role,
        workerId: WORKER_ID,
        createdAt: new Date(),
        lastHeartbeat: new Date(),
      })
      .catch(() => {})
  }

  return connection
}

const enforceConnectionLimits = (userID: string): { ok: true } | { ok: false; reason: string } => {
  if (realtimeState.connections.size >= MAX_TOTAL_CONNECTIONS) {
    return {
      ok: false,
      reason: 'total_connection_limit_exceeded',
    }
  }

  const userConnections = realtimeState.connectionsByUserID.get(userID)
  if (userConnections && userConnections.size >= MAX_CONNECTIONS_PER_USER) {
    return {
      ok: false,
      reason: 'user_connection_limit_exceeded',
    }
  }

  return { ok: true }
}

const isMongoId = (id?: string): boolean =>
  typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())

const recordCallEventToDb = async (params: {
  callId: string
  signalType: string
  callerUserId: string
  callerName: string
  callerRole: string
  targetUserId: string
  targetUserName?: string
  targetUserRole?: string
  durationSeconds?: number
}): Promise<void> => {
  const payload = realtimeState.payload
  if (!payload || !params.callId) return

  try {
    const existing = await payload.find({
      collection: 'call-logs',
      where: { callId: { equals: params.callId } },
      limit: 1,
      overrideAccess: true,
    })

    const now = nowISO()

    if (existing.docs.length > 0) {
      const doc = existing.docs[0] as Record<string, any>
      const updateData: Record<string, unknown> = {}

      if (params.signalType === 'answer') {
        updateData.status = 'connected'
      } else if (params.signalType === 'rejected' || params.signalType === 'declined') {
        updateData.status = 'declined'
        updateData.endedAt = now
      } else if (params.signalType === 'busy') {
        updateData.status = 'busy'
        updateData.endedAt = now
      } else if (params.signalType === 'user_offline') {
        updateData.status = 'offline'
        updateData.endedAt = now
      } else if (params.signalType === 'end' || params.signalType === 'hangup') {
        if (doc.status === 'connected') {
          updateData.status = 'connected'
        }
        updateData.endedAt = now
        if (typeof params.durationSeconds === 'number' && params.durationSeconds > 0) {
          updateData.durationSeconds = Math.max(doc.durationSeconds || 0, params.durationSeconds)
        }
      }

      if (Object.keys(updateData).length > 0) {
        await payload.update({
          collection: 'call-logs',
          id: doc.id,
          data: updateData,
          overrideAccess: true,
        })
      }
    } else {
      let initialStatus = 'missed'
      if (params.signalType === 'answer') initialStatus = 'connected'
      else if (params.signalType === 'rejected' || params.signalType === 'declined') initialStatus = 'declined'
      else if (params.signalType === 'busy') initialStatus = 'busy'
      else if (params.signalType === 'user_offline') initialStatus = 'offline'

      await payload.create({
        collection: 'call-logs',
        data: {
          callId: params.callId,
          callerUserId: params.callerUserId,
          ...(isMongoId(params.callerUserId) ? { callerUser: params.callerUserId } : {}),
          callerName: params.callerName,
          callerRole: params.callerRole,
          receiverUserId: params.targetUserId,
          ...(isMongoId(params.targetUserId) ? { receiverUser: params.targetUserId } : {}),
          receiverName: params.targetUserName || 'Staff',
          receiverRole: params.targetUserRole || 'staff',
          callType: 'voice',
          direction: 'outgoing',
          status: initialStatus,
          durationSeconds: params.durationSeconds || 0,
          startedAt: now,
        },
        overrideAccess: true,
      })
    }
  } catch (err) {
    payload.logger.error({ msg: 'Failed to record call log in database', err })
  }
}

const getTodayDateStringIST = (): string => {
  const d = new Date()
  const utcOffset = d.getTime() + 5.5 * 60 * 60 * 1000
  const localDate = new Date(utcOffset)
  const year = localDate.getUTCFullYear()
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localDate.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const checkActivitiesPunchedIn = (activities: any): boolean => {
  if (!Array.isArray(activities) || activities.length === 0) return false
  const sessions = activities.filter((a) => !a.type || a.type === 'session')
  if (sessions.length === 0) return false
  const lastSession = sessions[sessions.length - 1]
  const status = String(lastSession.status || '').toLowerCase()
  const punchOut = lastSession.punchOut
  const hasNoPunchOut = punchOut === null || punchOut === undefined || String(punchOut).trim() === ''
  return status !== 'closed' && hasNoPunchOut
}

export const isUserPunchedIn = async (userId: string): Promise<boolean> => {
  if (!realtimeState.payload || !isMongoId(userId)) return false
  try {
    const today = getTodayDateStringIST()
    const attResult = await realtimeState.payload.find({
      collection: 'attendance',
      where: {
        and: [
          { dateString: { equals: today } },
          { user: { equals: userId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (attResult.docs && attResult.docs.length > 0) {
      return checkActivitiesPunchedIn(attResult.docs[0].activities)
    }

    // Also check if user is linked to employee ID
    const userDoc = await realtimeState.payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    const emp = userDoc && typeof userDoc === 'object' ? (userDoc as any).employee : null
    const empId = emp && (typeof emp === 'string' ? emp : emp.id || emp._id)
    if (empId && isMongoId(empId)) {
      const empAtt = await realtimeState.payload.find({
        collection: 'attendance',
        where: {
          and: [
            { dateString: { equals: today } },
            { employee: { equals: empId } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (empAtt.docs && empAtt.docs.length > 0) {
        return checkActivitiesPunchedIn(empAtt.docs[0].activities)
      }
    }

    return false
  } catch (err) {
    realtimeState.payload?.logger?.error?.({ msg: 'Error checking user punch-in status in wsGateway', err })
    return false
  }
}

// Active live calls: callId -> { callerId: string, calleeId: string }
const activeLiveCalls = new Map<string, { callerId: string; calleeId: string }>()

export const terminateActiveCallsForUser = (userId: string, reason = 'User punched out / off duty'): void => {
  const normId = userId?.trim()
  if (!normId) return

  for (const [callId, call] of Array.from(activeLiveCalls.entries())) {
    if (call.callerId === normId || call.calleeId === normId) {
      activeLiveCalls.delete(callId)
      const otherUserId = call.callerId === normId ? call.calleeId : call.callerId

      const terminationPayload = {
        eventType: 'call_signal',
        callId,
        signalType: 'call_ended',
        senderId: 'system',
        targetUserId: otherUserId,
        reason,
        timestamp: nowISO(),
      }

      // Deliver locally to other user
      const otherConns = realtimeState.connectionsByUserID.get(otherUserId)
      if (otherConns && otherConns.size > 0) {
        for (const connID of otherConns) {
          const conn = realtimeState.connections.get(connID)
          if (conn && conn.socket.readyState === WebSocket.OPEN) {
            sendServerMessage(conn, terminationPayload)
          }
        }
      }

      // Deliver locally to the user themselves
      const userConns = realtimeState.connectionsByUserID.get(normId)
      if (userConns && userConns.size > 0) {
        for (const connID of userConns) {
          const conn = realtimeState.connections.get(connID)
          if (conn && conn.socket.readyState === WebSocket.OPEN) {
            sendServerMessage(conn, {
              ...terminationPayload,
              targetUserId: normId,
            })
          }
        }
      }

      // Publish to bus for other cluster workers
      publishToBus({
        channel: 'call_signal',
        targetUserId: otherUserId,
        payload: terminationPayload,
      })
    }
  }
}

const handleCallSignal = async (connection: ConnectionState, value: Record<string, unknown>): Promise<void> => {
  const targetUserId =
    typeof value.targetUserId === 'string'
      ? value.targetUserId.trim()
      : typeof value.recipientUserId === 'string'
        ? value.recipientUserId.trim()
        : ''
  const callId = typeof value.callId === 'string' ? value.callId.trim() : ''
  const signalType = typeof value.signalType === 'string' ? value.signalType.trim() : ''

  if (!targetUserId || !signalType) {
    sendSystemMessage(connection, {
      eventType: 'call_signal_nack',
      error_code: 'invalid_call_signal',
      message: 'targetUserId and signalType are required.',
    })
    return
  }

  if (connection.userID === targetUserId) {
    sendSystemMessage(connection, {
      eventType: 'call_signal_nack',
      error_code: 'cannot_call_self',
      message: 'Cannot place a call to yourself.',
    })
    return
  }

  // 1. STRICT PUNCH-IN CHECK FOR CALLER: Non-admin users MUST be punched in to place calls
  if (signalType === 'offer') {
    const callerRole = (connection.role || '').toLowerCase()
    if (callerRole !== 'admin') {
      const callerPunchedIn = await isUserPunchedIn(connection.userID)
      if (!callerPunchedIn) {
        sendServerMessage(connection, {
          eventType: 'call_signal',
          callId,
          signalType: 'call_blocked_not_punched_in',
          senderId: 'system',
          targetUserId: connection.userID,
          message: 'You cannot place calls because you are currently punched out or not on duty.',
          timestamp: nowISO(),
        })
        sendSystemMessage(connection, {
          eventType: 'call_signal_nack',
          error_code: 'caller_not_punched_in',
          message: 'You must be punched in to make calls. You are currently punched out or off duty.',
        })
        return
      }
    }
  }

  const senderName =
    typeof connection.user?.name === 'string' && connection.user.name.trim().length > 0
      ? connection.user.name.trim()
      : typeof connection.user?.email === 'string'
        ? connection.user.email
        : 'Admin'

  const eventPayload: Record<string, unknown> = {
    eventType: 'call_signal',
    callId,
    signalType,
    senderId: connection.userID,
    senderName,
    senderRole: connection.role,
    targetUserId,
    timestamp: nowISO(),
  }

  if (value.sdp !== undefined) eventPayload.sdp = value.sdp
  if (value.candidate !== undefined) eventPayload.candidate = value.candidate
  if (value.reason !== undefined) eventPayload.reason = value.reason
  if (value.data !== undefined) eventPayload.data = value.data

  const targetConnIDs = realtimeState.connectionsByUserID.get(targetUserId)
  let targetUserName: string | undefined
  let targetUserRole: string | undefined

  if (targetConnIDs && targetConnIDs.size > 0) {
    for (const connID of targetConnIDs) {
      const conn = realtimeState.connections.get(connID)
      if (conn?.user?.name && typeof conn.user.name === 'string') {
        targetUserName = conn.user.name.trim()
      }
      if (conn?.role && typeof conn.role === 'string') {
        targetUserRole = conn.role.trim()
      }
      if (targetUserName) break
    }
  }

  if (!targetUserName && realtimeState.payload && isMongoId(targetUserId)) {
    try {
      const userDoc = await realtimeState.payload.findByID({
        collection: 'users',
        id: targetUserId,
        depth: 0,
        overrideAccess: true,
      })
      if (userDoc && typeof userDoc === 'object') {
        if (typeof (userDoc as any).name === 'string') targetUserName = (userDoc as any).name.trim()
        if (typeof (userDoc as any).role === 'string') targetUserRole = (userDoc as any).role.trim()
      }
    } catch {}
  }

  // 2. STRICT PUNCH-IN CHECK FOR CALLEE: Non-admin recipients MUST be currently punched in
  if (signalType === 'offer') {
    let isTargetAdmin = false
    if (targetConnIDs && targetConnIDs.size > 0) {
      for (const connID of targetConnIDs) {
        const conn = realtimeState.connections.get(connID)
        if (conn?.role && conn.role.toLowerCase() === 'admin') {
          isTargetAdmin = true
          break
        }
      }
    }
    if (!isTargetAdmin && targetUserRole && targetUserRole.toLowerCase() === 'admin') {
      isTargetAdmin = true
    }

    if (!isTargetAdmin) {
      const targetPunchedIn = await isUserPunchedIn(targetUserId)
      if (!targetPunchedIn) {
        void recordCallEventToDb({
          callId,
          signalType: 'user_offline',
          callerUserId: connection.userID,
          callerName: senderName,
          callerRole: connection.role,
          targetUserId,
          targetUserName,
          targetUserRole,
        })
        sendServerMessage(connection, {
          eventType: 'call_signal',
          callId,
          signalType: 'user_offline',
          senderId: 'system',
          targetUserId: connection.userID,
          offlineUserId: targetUserId,
          message: 'The user is currently off-duty or punched out.',
          timestamp: nowISO(),
        })
        return
      }
    }
  }

  // Track active calls in memory
  if (signalType === 'offer') {
    activeLiveCalls.set(callId, { callerId: connection.userID, calleeId: targetUserId })
  } else if (signalType === 'call_ended' || signalType === 'declined' || signalType === 'busy' || signalType === 'user_offline') {
    activeLiveCalls.delete(callId)
  }

  const durationSec =
    typeof value.durationSeconds === 'number'
      ? value.durationSeconds
      : typeof value.duration === 'number'
        ? value.duration
        : undefined

  void recordCallEventToDb({
    callId,
    signalType,
    callerUserId: connection.userID,
    callerName: senderName,
    callerRole: connection.role,
    targetUserId,
    targetUserName,
    targetUserRole,
    durationSeconds: durationSec,
  })

  // 1. Deliver to any locally connected sockets for target user
  let sentLocally = false
  if (targetConnIDs && targetConnIDs.size > 0) {
    for (const connID of targetConnIDs) {
      const targetConn = realtimeState.connections.get(connID)
      if (targetConn && targetConn.socket.readyState === WebSocket.OPEN) {
        sendServerMessage(targetConn, eventPayload)
        sentLocally = true
      }
    }
  }

  // 2. Broadcast to all other cluster workers via realtime_bus
  publishToBus({
    channel: 'call_signal',
    targetUserId,
    payload: eventPayload,
  })

  // 3. If offer could not be delivered locally, check cluster-wide presence
  if (!sentLocally && signalType === 'offer') {
    const db = getMongoDb()
    let isOnlineInCluster = false
    if (db) {
      try {
        const count = await db.collection(ACTIVE_CONNS_COLLECTION).countDocuments({
          userId: targetUserId,
        })
        isOnlineInCluster = count > 0
      } catch {
        isOnlineInCluster = true
      }
    }

    if (!isOnlineInCluster) {
      void recordCallEventToDb({
        callId,
        signalType: 'user_offline',
        callerUserId: connection.userID,
        callerName: senderName,
        callerRole: connection.role,
        targetUserId,
        targetUserName,
        targetUserRole,
      })
      sendServerMessage(connection, {
        eventType: 'call_signal',
        callId,
        signalType: 'user_offline',
        senderId: 'system',
        targetUserId: connection.userID,
        offlineUserId: targetUserId,
        message: 'The user is currently offline or unreachable.',
        timestamp: nowISO(),
      })
    }
  }
}

const bootSocket = (socket: WebSocket, context: AuthenticatedUserContext): void => {
  const connection = registerConnection(socket, context)

  sendSystemMessage(connection, {
    eventType: 'connection_ack',
    message: 'Connection established.',
    protocolVersion: '1.2',
    heartbeatPingMs: HEARTBEAT_PING_MS,
    heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
    maxPayloadBytes: MAX_PAYLOAD_BYTES,
    replayRetentionMs: REPLAY_RETENTION_MS,
    endpoint: WS_ENDPOINT_PATH,
    authHeader: 'Authorization: Bearer <jwt>',
    tokenExpiryBehavior: 'Socket closes with 4401 token_expired when JWT exp is reached.',
  })

  scheduleTokenExpiry(connection)

  socket.on('pong', () => {
    connection.lastPongAtMs = Date.now()
  })

  socket.on('close', () => {
    removeConnection(connection.id)
  })

  socket.on('error', () => {
    closeSocket(socket, 4408, 'socket_error')
  })

  socket.on('message', (raw) => {
    const parsed = parseJSONMessage(raw)
    if (!parsed.ok) {
      sendSystemMessage(connection, {
        eventType: 'message_nack',
        error_code: parsed.errorCode,
        message: parsed.message,
      })
      return
    }

    const rawAction = parsed.value.action ?? parsed.value.type ?? parsed.value.eventType
    const action = typeof rawAction === 'string' ? rawAction.trim() : ''

    if (action === 'call_signal') {
      void handleCallSignal(connection, parsed.value)
      return
    }

    if (action === 'subscribe') {
      void handleSubscribe(connection, parsed.value)
      return
    }

    if (action === 'unsubscribe') {
      handleUnsubscribe(connection, parsed.value)
      return
    }

    if (action === 'ping') {
      sendSystemMessage(connection, {
        eventType: 'pong',
      })
      return
    }

    sendSystemMessage(connection, {
      eventType: 'message_nack',
      error_code: 'unsupported_action',
      message: 'Supported actions: subscribe, unsubscribe, ping, call_signal.',
    })
  })
}

const rejectUpgrade = (socket: Duplex, statusCode: number, errorCode: string, message: string): void => {
  const payload = encodeJSON({
    error: errorCode,
    message,
  })

  const statusText =
    statusCode === 401
      ? 'Unauthorized'
      : statusCode === 403
        ? 'Forbidden'
        : statusCode === 429
          ? 'Too Many Requests'
          : statusCode === 503
            ? 'Service Unavailable'
            : 'Bad Request'

  socket.write(
    [
      `HTTP/1.1 ${statusCode} ${statusText}`,
      'Connection: close',
      'Content-Type: application/json; charset=utf-8',
      `Content-Length: ${Buffer.byteLength(payload, 'utf8')}`,
      '',
      payload,
    ].join('\r\n'),
  )
  socket.destroy()
}

const isRealtimePath = (request: IncomingMessage): boolean => {
  const rawURL = request.url || '/'
  const normalizedPath = rawURL.split('?')[0] || '/'
  return normalizedPath === WS_ENDPOINT_PATH
}

export const createRealtimeGateway = (payload: Payload): RealtimeGateway => {
  realtimeState.payload = payload
  startHeartbeatLoop()
  void initCrossWorkerCluster()

  return {
    endpointPath: WS_ENDPOINT_PATH,
    handleUpgrade: async (request, socket, head) => {
      if (!isRealtimePath(request)) return false

      const limitError = (() => {
        if (realtimeState.connections.size >= MAX_TOTAL_CONNECTIONS) {
          return {
            statusCode: 429,
            errorCode: 'connection_limit_exceeded',
            message: 'Realtime connection limit reached.',
          }
        }
        return null
      })()

      if (limitError) {
        realtimeState.wss.handleUpgrade(request, socket, head, (upgradedSocket) => {
          closeSocket(upgradedSocket, 4429, 'connection_limit_exceeded')
        })
        return true
      }

      let authContext: AuthenticatedUserContext

      try {
        authContext = await authenticateRequest(payload, request)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unauthorized'
        rejectUpgrade(socket, 401, 'unauthorized', message)
        return true
      }

      const limitCheck = enforceConnectionLimits(authContext.userID)
      if (!limitCheck.ok) {
        realtimeState.wss.handleUpgrade(request, socket, head, (upgradedSocket) => {
          closeSocket(upgradedSocket, 4429, 'connection_limit_exceeded')
        })
        return true
      }

      realtimeState.wss.handleUpgrade(request, socket, head, (upgradedSocket) => {
        bootSocket(upgradedSocket, authContext)
      })

      return true
    },
  }
}

export const publishBillingRealtimeEvent = (
  input: BillingRealtimePublishInput,
): BillingRealtimeEvent | null => {
  const branchID = input.branchId?.trim()
  const billingID = input.billingId?.trim()
  const eventID = input.eventId?.trim()

  if (!branchID || !billingID || !eventID) return null
  if (!Number.isFinite(input.seq) || input.seq <= 0) return null

  const timestamp = input.timestamp || input.itemUpdatedAt || nowISO()
  const event: BillingRealtimeEvent = {
    topic: KOT_TOPIC,
    eventId: eventID,
    eventType: input.eventType,
    timestamp,
    serverSentAt: nowISO(),
    seq: input.seq,
    branchId: branchID,
    kitchenId: input.kitchenId?.trim() || null,
    billingId: billingID,
    itemId: input.itemId?.trim() || null,
    productId: input.productId?.trim() || null,
    statusBefore: input.statusBefore ?? null,
    statusAfter: input.statusAfter ?? null,
    tableName: input.tableName?.trim() || null,
    tableNo: input.tableNo?.trim() || input.tableName?.trim() || null,
    section: input.section?.trim() || null,
    kotNumber: input.kotNumber?.trim() || null,
    productName: input.productName?.trim() || null,
    productNames: Array.isArray(input.productNames) && input.productNames.length > 0 ? input.productNames : null,
    itemUpdatedAt: input.itemUpdatedAt ?? null,
    itemVersion:
      typeof input.itemVersion === 'number' && Number.isFinite(input.itemVersion)
        ? input.itemVersion
        : null,
    ...(INCLUDE_ITEM_SNAPSHOT
      ? {
          itemSnapshot: input.itemSnapshot ?? null,
        }
      : {}),
  }

  const safePayload = ensurePayloadSize(event)
  if (!safePayload) return null

  const storedEvent: StoredEvent = {
    ...(safePayload as BillingRealtimeEvent),
    emittedAtMs: Date.now(),
  }

  realtimeState.events.push(storedEvent)
  pruneEventBuffers(storedEvent.emittedAtMs)

  for (const connection of realtimeState.connections.values()) {
    if (!matchesSubscription(storedEvent, connection.subscription)) continue
    sendServerMessage(connection, storedEvent)
  }

  // Broadcast to other cluster workers
  publishToBus({
    channel: 'billing',
    payload: storedEvent as unknown as Record<string, unknown>,
  })

  return storedEvent
}

export const publishChatRealtimeEvent = (input: ChatRealtimePublishInput): void => {
  const event = {
    eventType: 'chat_message_received',
    messageId: input.messageId,
    threadId: input.threadId,
    senderId: input.senderId,
    senderName: input.senderName || null,
    senderRole: input.senderRole || null,
    text: input.text,
    messageType: input.messageType || 'text',
    createdAt: input.createdAt || nowISO(),
    recipientAudience: input.recipientAudience,
    recipientUserId: input.recipientUserId || null,
    timestamp: nowISO(),
  }

  const safePayload = ensurePayloadSize(event)
  if (!safePayload) return

  // 1. Target specific recipient staff user if defined
  if (input.recipientUserId) {
    const connIDs = realtimeState.connectionsByUserID.get(input.recipientUserId)
    if (connIDs) {
      for (const connID of connIDs) {
        const connection = realtimeState.connections.get(connID)
        if (connection) {
          sendServerMessage(connection, safePayload)
        }
      }
    }
  }

  // 2. Target admin connections if recipientAudience is 'admins'
  if (input.recipientAudience === 'admins') {
    for (const connection of realtimeState.connections.values()) {
      if (connection.role === 'admin' || connection.role === 'superadmin') {
        sendServerMessage(connection, safePayload)
      }
    }
  }

  // 3. Also notify sender's other connected devices so their conversation syncs live
  if (input.senderId) {
    const connIDs = realtimeState.connectionsByUserID.get(input.senderId)
    if (connIDs) {
      for (const connID of connIDs) {
        const connection = realtimeState.connections.get(connID)
        if (connection) {
          sendServerMessage(connection, safePayload)
        }
      }
    }
  }

  // Broadcast to other cluster workers
  publishToBus({
    channel: 'chat',
    recipientAudience: input.recipientAudience,
    recipientUserId: input.recipientUserId || null,
    senderId: input.senderId,
    payload: safePayload,
  })
}

export const terminateUserSession = (
  userId: string,
  reason: string,
  eventType = 'session_terminated',
): void => {
  const normalizedUserId = userId?.trim()
  if (!normalizedUserId) return

  terminateActiveCallsForUser(normalizedUserId, reason)

  const connectionIDs = realtimeState.connectionsByUserID.get(normalizedUserId)
  if (connectionIDs && connectionIDs.size > 0) {
    for (const connectionID of Array.from(connectionIDs)) {
      const connection = realtimeState.connections.get(connectionID)
      if (connection) {
        sendSystemMessage(connection, {
          eventType,
          error_code: eventType,
          message: reason,
          reason,
        })
        setTimeout(() => {
          closeSocket(connection.socket, 4401, reason)
        }, 100)
      }
    }
  }

  // Broadcast to other cluster workers
  publishToBus({
    channel: 'session_terminate',
    targetUserId: normalizedUserId,
    payload: { userId: normalizedUserId, reason, eventType },
  })
}

process.on('beforeExit', () => {
  const db = getMongoDb()
  if (db) {
    db.collection(ACTIVE_CONNS_COLLECTION).deleteMany({ workerId: WORKER_ID }).catch(() => {})
  }
})

export const getRealtimeEndpointPath = (): string => WS_ENDPOINT_PATH
