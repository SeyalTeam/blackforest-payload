# Flutter Canary Rollout Checklist (Phase 2)

Date: 2026-04-30

## Canary request behavior

Enable in canary build only:

1. Send `x-bf-response-envelope: v1` on all calls.
2. Send `Idempotency-Key` on billing writes:
   - `POST /api/billings` and `POST /api/v1/billings`
   - `PATCH /api/billings/:id` and `PATCH /api/v1/billings/:id`
3. Send `x-request-id` on all calls and log echoed `x-request-id` from response.

## Canary guardrail queries

Track (5m/15m windows):

1. Billing success rate (canary vs control).
2. `idempotency_conflict` and conflict rate.
3. `idempotency_wait` rate.
4. Error rate for billing create/update endpoints.

## Canary DoD

Canary is safe to expand only if all are true for at least one business day:

1. No regression in billing success rate compared to control.
2. No unexpected `409 IDEMPOTENCY_CONFLICT` spike.
3. `x-request-id` is present and searchable in client + backend logs.
4. No critical envelope parsing errors in Flutter telemetry.

## Rollback trigger

Rollback canary headers immediately if:

1. Billing success rate drops by >2% vs control for 15 minutes.
2. Conflict rate exceeds 3% for 15 minutes.
3. App-level billing crash/error rate increases materially after canary switch.
