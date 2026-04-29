# Idempotency Operational Guardrails (Phase 2)

Date: 2026-04-30

## Metrics shipped

The API wrapper now emits these runtime counters:

- `idempotency_replay`: replayed response was served from stored key.
- `idempotency_conflict`: conflict returned (`IDEMPOTENCY_CONFLICT`).
- `idempotency_wait`: request entered wait-for-settlement flow.
- `idempotency_expired_reclaim`: expired key was safely reclaimed and reused.

Source:
- [idempotencyMetrics.ts](/Users/castromurugan/Documents/Blackforest/blackforest-payload/src/utilities/idempotencyMetrics.ts)
- [route.ts](/Users/castromurugan/Documents/Blackforest/blackforest-payload/src/app/(payload)/api/[...slug]/route.ts)

## Dashboard data source

- Endpoint: `GET /api/ops/idempotency-metrics`
- Access: `superadmin`, `admin`
- Includes counters + recent event history.

Source:
- [getIdempotencyMetrics.ts](/Users/castromurugan/Documents/Blackforest/blackforest-payload/src/endpoints/getIdempotencyMetrics.ts)

## Suggested dashboard panels

1. `idempotency_replay` count (5m, 1h, 24h).
2. `idempotency_conflict` count and `% conflicts / billing writes`.
3. `idempotency_wait` count and `% waits / billing writes`.
4. `idempotency_expired_reclaim` count (should be low/stable).

## Alert thresholds (initial)

1. Conflict spike:
   - Trigger if `idempotency_conflict` > `40` in `5m`, or conflict rate > `3%` for `15m`.
2. Wait spike:
   - Trigger if `idempotency_wait` > `120` in `5m`, or wait rate > `10%` for `15m`.
3. Replay drop anomaly:
   - Trigger if replay rate falls to near-zero during known retry-heavy hours (indicates key/header loss in clients).
4. Expired reclaim anomaly:
   - Trigger if `idempotency_expired_reclaim` > `20` in `1h` (possible client retry delay, clock drift, or network backlog).

## Action playbook

1. Conflict spike:
   - Validate Flutter is not reusing the same key for modified payloads.
   - Check if canary % changed recently.
2. Wait spike:
   - Inspect billing latency and DB write contention.
   - Verify no network-layer retry storms.
3. Replay drop:
   - Confirm clients still send `Idempotency-Key`.
4. Expired reclaim spike:
   - Review key retention interval vs practical retry windows.
