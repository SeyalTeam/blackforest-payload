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
  productId?: string | null
  seq: number
  statusAfter?: string | null
  statusBefore?: string | null
  timestamp?: string
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
  productId: string | null
  seq: number
  serverSentAt: string
  statusAfter: string | null
  statusBefore: string | null
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

const parseRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (value && typeof value === 'object') {
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
  if (subscription.kitchenId) return event.kitchenId === subscription.kitchenId
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

    const action = typeof parsed.value.action === 'string' ? parsed.value.action.trim() : ''

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
      message: 'Supported actions: subscribe, unsubscribe, ping.',
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

  return storedEvent
}

export const getRealtimeEndpointPath = (): string => WS_ENDPOINT_PATH
