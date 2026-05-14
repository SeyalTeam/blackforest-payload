# Realtime v1.2 QA Checklist

Date: 2026-05-14
Scope: Validate KOT realtime contract v1.2 end-to-end (auth, filtering, ordering, replay, fallback, latency).

## Pass Criteria

1. Contract responses match v1.2 shapes for subscribe/ack/event/unsubscribe/resume-nack.
2. Branch and kitchen scoping are enforced server-side.
3. Client handles at-least-once delivery, dedupe (`eventId`), and stale-event rejection (`itemVersion` / `itemUpdatedAt`).
4. Replay behavior is correct for valid and expired `lastEventId`.
5. Acceptance SLO passes:
   KOT UI updates within 1 second after backend moves item to `confirmed`.

## Preconditions

1. A valid test user with branch access.
2. One active test `branchId`.
3. Optional `kitchenId` tied to the same branch.
4. One open billing with at least one item in non-final status.
5. REST and WS endpoints reachable for the same environment.

## Recommended Tools

1. Postman collection:
   [realtime-v1.2-postman-2026-05-14.postman_collection.json](/Users/castromurugan/Documents/Blackforest/blackforest-payload/reports/realtime-v1.2-postman-2026-05-14.postman_collection.json)
2. WS smoke script:
   [ws-realtime-v12-smoke.mjs](/Users/castromurugan/Documents/Blackforest/blackforest-payload/src/scripts/ws-realtime-v12-smoke.mjs)

## Test Cases

### A) Auth and Connection

1. Connect WS with valid bearer token.
2. Expect successful connection and `subscription_ack` with `status: "subscribed"` after subscribe message.
3. Connect with invalid/expired token.
4. Expect close code `4401` and reason `token_expired` or `unauthorized`.

### B) Branch and Kitchen Filtering

1. Subscribe with valid `branchId` only.
2. Trigger item updates in same branch and different branch.
3. Expect events only from subscribed branch.
4. Subscribe with `branchId + kitchenId`.
5. Trigger same-branch events across two kitchens.
6. Expect only matching kitchen events.
7. Subscribe to unauthorized branch.
8. Expect NACK with `error_code: "FORBIDDEN_BRANCH"` (or close `4403` by server policy).

### C) Ordering, Dedupe, and Conflict Handling

1. Trigger rapid sequence on same bill/item (ordered -> prepared -> confirmed).
2. Verify `seq` is strictly increasing for same `branchId + billingId`.
3. Replay or duplicate an already-seen event.
4. Verify client dedupes by `eventId`.
5. Send an older event after a newer one (lower `itemVersion` or older `itemUpdatedAt`).
6. Verify client ignores stale event.

### D) Resume and Replay

1. Disconnect client after receiving at least one event.
2. Reconnect with valid recent `lastEventId`.
3. Expect replay of missed events, then live stream resumes.
4. Reconnect with expired/unknown `lastEventId`.
5. Expect:
   `type: "resume_nack"`, `status: "full_sync_required"`, `error_code: "REPLAY_UNAVAILABLE"`.
6. Verify client performs full REST sync and resumes realtime.

### E) Unsubscribe Lifecycle

1. Send unsubscribe with same topic/filter used in subscribe.
2. Expect `subscription_ack` with `status: "unsubscribed"`.
3. Trigger further matching backend updates.
4. Verify no more events arrive for unsubscribed filter.

### F) Payload Constraints

1. Validate event payload fields:
   `eventId`, `eventType`, `timestamp`, `serverSentAt`, `seq`, `branchId`, `billingId`, `itemId`, `productId`, `statusBefore`, `statusAfter`, `itemUpdatedAt`, `itemVersion`.
2. Validate `itemSnapshot` behavior:
   omitted or `null` for lightweight events is accepted.
3. Validate payload size stays <= 32 KB.

### G) Fallback Behavior

1. Force WS outage (stop WS route or block network).
2. Verify app switches to 30s REST polling automatically.
3. Restore WS.
4. Verify app reconnects and stops fallback polling.

### H) Acceptance SLO

1. Keep a KOT screen open for an item currently not `confirmed`.
2. Perform backend status update to `confirmed`.
3. Measure:
   `UI_confirmed_rendered_at - backend_update_committed_at`.
4. Pass only if <= 1000 ms for normal load.

## Latency Diagnostics

Use these clocks per event:

1. `timestamp`: domain event time.
2. `serverSentAt`: server socket send time.
3. client receive time (`Date.now()` at frame receipt).

Derived metrics:

1. Server queue + transport delay ~= `clientReceiveAt - serverSentAt`.
2. Domain-to-client delay ~= `clientReceiveAt - timestamp`.

## Suggested Exit Evidence

1. Raw WS logs from smoke script for pass runs.
2. Screenshot/video of KOT UI instant confirmed update.
3. Postman run export for REST baseline.
4. One replay success log and one `resume_nack` full-sync log.
