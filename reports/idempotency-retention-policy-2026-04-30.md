# Idempotency Retention Policy (Phase 2)

Date: 2026-04-30

## Policy

- Retention window: `24 hours` from key creation/claim.
- Cleanup cadence: every `30 minutes`.
- DB TTL index: `expiresAt` with `expireAfterSeconds: 0`.

## Implementation

- Retention config + scheduler:
  - [idempotencyRetention.ts](/Users/castromurugan/Documents/Blackforest/blackforest-payload/src/utilities/idempotencyRetention.ts)
- Setup at backend startup (`onInit`):
  - [payload.config.ts](/Users/castromurugan/Documents/Blackforest/blackforest-payload/src/payload.config.ts)

## Storage growth control

- Primary bound: TTL index removes expired keys automatically.
- Secondary bound: scheduled delete removes expired keys proactively.
- Result: bounded storage for `idempotency-keys` under normal write volume.

## Operational notes

1. If cleanup logs show persistent high deletions per cycle, validate client retry behavior and key churn.
2. If storage still grows unexpectedly, verify TTL index presence in Mongo (`idempotency_expires_at_ttl`).
