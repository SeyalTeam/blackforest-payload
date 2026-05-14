#!/usr/bin/env node
import WebSocket from 'ws'

const parseArgs = (argv) => {
  const out = {}
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue
    const value = raw.slice(2)
    const eq = value.indexOf('=')
    if (eq === -1) {
      out[value] = 'true'
      continue
    }
    const key = value.slice(0, eq)
    const parsed = value.slice(eq + 1)
    out[key] = parsed
  }
  return out
}

const toBool = (value, fallback = false) => {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return fallback
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized)
}

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const args = parseArgs(process.argv.slice(2))
const cfg = {
  wsUrl: args['ws-url'] || process.env.WS_URL || '',
  token: args.token || process.env.WS_BEARER_TOKEN || process.env.BEARER_TOKEN || '',
  topic: args.topic || process.env.TOPIC || 'billing.item.status',
  branchId: args['branch-id'] || process.env.BRANCH_ID || '',
  kitchenId: args['kitchen-id'] || process.env.KITCHEN_ID || '',
  lastEventId: args['last-event-id'] || process.env.LAST_EVENT_ID || '',
  expectedEventType:
    args['expected-event-type'] || process.env.EXPECT_EVENT_TYPE || 'billing_item_status_changed',
  expectedStatusAfter: args['expected-status-after'] || process.env.EXPECT_STATUS_AFTER || 'confirmed',
  expectedBillingId: args['expected-billing-id'] || process.env.EXPECT_BILLING_ID || '',
  expectedItemId: args['expected-item-id'] || process.env.EXPECT_ITEM_ID || '',
  timeoutMs: toInt(args['timeout-ms'] || process.env.TIMEOUT_MS, 45000),
  maxDomainDelayMs: toInt(args['max-domain-delay-ms'] || process.env.MAX_DOMAIN_DELAY_MS, 1000),
  unsubscribeAfterMatch: toBool(
    args['unsubscribe-after-match'] || process.env.UNSUBSCRIBE_AFTER_MATCH,
    true,
  ),
  expectFullSyncRequired: toBool(
    args['expect-full-sync-required'] || process.env.EXPECT_FULL_SYNC_REQUIRED,
    false,
  ),
  logRaw: toBool(args['log-raw'] || process.env.LOG_RAW, false),
}

const required = ['wsUrl', 'token', 'branchId']
const missing = required.filter((key) => !cfg[key])
if (missing.length > 0) {
  console.error(`[FAIL] Missing required config: ${missing.join(', ')}`)
  console.error('Required env vars: WS_URL, WS_BEARER_TOKEN, BRANCH_ID')
  process.exit(2)
}

const nowISO = () => new Date().toISOString()
const makeRequestId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`
const safeParseTime = (value) => {
  const ms = Date.parse(String(value || ''))
  return Number.isFinite(ms) ? ms : null
}
const scopeKeyFor = (event) => `${String(event.branchId || '')}::${String(event.billingId || '')}`

let done = false
let sawMatch = false
let unsubscribeSent = false
let lastSeqByScope = new Map()
const seenEventIds = new Set()

const wsOptions = {
  headers: {
    Authorization: `Bearer ${cfg.token}`,
  },
}

const ws = new WebSocket(cfg.wsUrl, wsOptions)

const finish = (exitCode, reason) => {
  if (done) return
  done = true
  clearTimeout(timeout)
  console.log(`[RESULT] ${exitCode === 0 ? 'PASS' : 'FAIL'} ${reason}`)
  try {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(exitCode === 0 ? 1000 : 4000, String(reason).slice(0, 120))
    }
  } catch (_error) {
    // no-op
  }
  setTimeout(() => process.exit(exitCode), 150)
}

const timeout = setTimeout(() => {
  finish(1, `Timed out after ${cfg.timeoutMs}ms without matching expected event`)
}, cfg.timeoutMs)

const sendJSON = (payload) => {
  const raw = JSON.stringify(payload)
  ws.send(raw)
  console.log(`[SEND ${nowISO()}] ${raw}`)
}

ws.on('open', () => {
  console.log(`[OPEN ${nowISO()}] Connected to ${cfg.wsUrl}`)

  if (cfg.lastEventId) {
    sendJSON({
      action: 'resume',
      requestId: makeRequestId('resume'),
      lastEventId: cfg.lastEventId,
    })
  }

  const subscribePayload = {
    action: 'subscribe',
    requestId: makeRequestId('sub'),
    topic: cfg.topic,
    branchId: cfg.branchId,
  }

  if (cfg.kitchenId) {
    subscribePayload.kitchenId = cfg.kitchenId
  }

  sendJSON(subscribePayload)
})

ws.on('message', (buffer) => {
  const raw = buffer.toString('utf8')
  if (cfg.logRaw) {
    console.log(`[RECV ${nowISO()}] ${raw}`)
  }

  let msg
  try {
    msg = JSON.parse(raw)
  } catch (_error) {
    console.log(`[INFO] Non-JSON frame received: ${raw}`)
    return
  }

  if (msg?.type === 'subscription_ack') {
    const status = String(msg.status || '')
    if (status === 'error') {
      finish(1, `Subscription error: ${msg.error_code || 'UNKNOWN'} - ${msg.message || 'n/a'}`)
      return
    }

    if (status === 'subscribed') {
      console.log(
        `[ACK] subscribed topic=${msg.topic || '-'} branch=${msg.branchId || '-'} kitchen=${msg.kitchenId || '-'}`,
      )
      return
    }

    if (status === 'unsubscribed') {
      console.log('[ACK] unsubscribed')
      if (unsubscribeSent) {
        finish(0, 'Matched expected event and unsubscribe ACK received')
      }
      return
    }
  }

  if (msg?.type === 'resume_nack') {
    const fullSyncRequired =
      String(msg.status || '') === 'full_sync_required' &&
      String(msg.error_code || '') === 'REPLAY_UNAVAILABLE'
    if (cfg.expectFullSyncRequired && fullSyncRequired) {
      finish(0, 'Received expected resume_nack full_sync_required')
      return
    }

    finish(
      1,
      `Unexpected resume_nack: status=${msg.status || '-'} code=${msg.error_code || '-'} message=${msg.message || '-'}`,
    )
    return
  }

  if (msg?.type !== 'event') return

  const eventId = String(msg.eventId || '')
  if (eventId) {
    if (seenEventIds.has(eventId)) {
      console.log(`[DEDUPE] Duplicate event ignored: ${eventId}`)
      return
    }
    seenEventIds.add(eventId)
  }

  const scopeKey = scopeKeyFor(msg)
  const seq = Number(msg.seq)
  if (Number.isFinite(seq)) {
    const previous = lastSeqByScope.get(scopeKey)
    if (typeof previous === 'number' && seq <= previous) {
      console.log(
        `[WARN] Non-monotonic seq for scope=${scopeKey}. previous=${previous}, current=${seq}`,
      )
    }
    if (typeof previous !== 'number' || seq > previous) {
      lastSeqByScope.set(scopeKey, seq)
    }
  }

  const receiveAt = Date.now()
  const eventAt = safeParseTime(msg.timestamp)
  const serverSentAt = safeParseTime(msg.serverSentAt)
  const domainDelayMs = eventAt == null ? null : receiveAt - eventAt
  const transportDelayMs = serverSentAt == null ? null : receiveAt - serverSentAt

  console.log(
    `[EVENT] id=${msg.eventId || '-'} type=${msg.eventType || '-'} bill=${msg.billingId || '-'} item=${msg.itemId || '-'} ${msg.statusBefore || '-'}->${msg.statusAfter || '-'} seq=${Number.isFinite(seq) ? seq : '-'} domainDelayMs=${domainDelayMs ?? '-'} transportDelayMs=${transportDelayMs ?? '-'}`,
  )

  const matchesExpectation =
    String(msg.eventType || '') === cfg.expectedEventType &&
    String(msg.statusAfter || '') === cfg.expectedStatusAfter &&
    (!cfg.expectedBillingId || String(msg.billingId || '') === cfg.expectedBillingId) &&
    (!cfg.expectedItemId || String(msg.itemId || '') === cfg.expectedItemId) &&
    String(msg.branchId || '') === cfg.branchId &&
    (!cfg.kitchenId || String(msg.kitchenId || '') === cfg.kitchenId)

  if (!matchesExpectation) return

  sawMatch = true
  if (domainDelayMs != null && domainDelayMs > cfg.maxDomainDelayMs) {
    finish(
      1,
      `Matched expected event but exceeded SLO: domainDelayMs=${domainDelayMs}, limit=${cfg.maxDomainDelayMs}`,
    )
    return
  }

  console.log(
    `[MATCH] Expected event received. domainDelayMs=${domainDelayMs ?? 'n/a'} transportDelayMs=${transportDelayMs ?? 'n/a'}`,
  )

  if (!cfg.unsubscribeAfterMatch) {
    finish(0, 'Matched expected event')
    return
  }

  if (!unsubscribeSent) {
    unsubscribeSent = true
    const unsubscribePayload = {
      action: 'unsubscribe',
      requestId: makeRequestId('unsub'),
      topic: cfg.topic,
      branchId: cfg.branchId,
    }
    if (cfg.kitchenId) {
      unsubscribePayload.kitchenId = cfg.kitchenId
    }
    sendJSON(unsubscribePayload)
  }
})

ws.on('error', (error) => {
  finish(1, `WebSocket error: ${error.message}`)
})

ws.on('close', (code, reasonBuffer) => {
  const reason = reasonBuffer ? reasonBuffer.toString('utf8') : ''
  if (done) return

  if (sawMatch && cfg.unsubscribeAfterMatch) {
    finish(0, `Socket closed after expected match (code=${code}, reason=${reason || '-'})`)
    return
  }

  finish(1, `Socket closed before success (code=${code}, reason=${reason || '-'})`)
})
