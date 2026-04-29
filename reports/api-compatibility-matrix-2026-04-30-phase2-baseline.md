# API Compatibility Matrix (Phase 2 Baseline)

As of: 2026-04-30
Scope: Compare Flutter "v1 API Contract (Draft)" (Target v1.1/v2) vs current live backend contract.

Phase 1 baseline freeze (request-id, envelope canary, billing idempotency): 2026-04-29.
Phase 2 baseline freeze (`/api/v1` adapter parity + idempotency guardrails + retention): 2026-04-30.

## Legend

- `Ready`: Existing live route is functionally aligned enough for immediate use.
- `Partial`: Function exists, but path/shape/behavior differs and needs adapter/standardization.
- `Missing`: No equivalent live contract yet.

## A) Platform Conventions

| Draft Item | Current Live | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| REST base `https://blackforest.vseyal.com/api/v1` | `/api/v1/*` alias is routed through the same wrapper as `/api/*` | Ready | Keep parity tests in CI for critical routes | Backend | Phase 2 |
| GraphQL base `https://blackforest.vseyal.com/api/graphql` | `/api/graphql` exists | Ready | Needs schema alignment to target read slice | Backend | Phase 3 |
| WebSocket base `wss://.../ws/v1` | No `/ws/v1` server route | Missing | Realtime transport not implemented | Backend + DevOps | Phase 4 |
| Webhook sender ID `blackforest-core-v1` | No webhook framework/sender identity | Missing | Add event dispatcher + signature headers | Backend | Phase 5 |
| `Authorization: Bearer <token>` standard | Payload auth collection (`users`) endpoints available | Partial | Auth format/contract not standardized in shared API doc | Backend | Phase 1 |
| Login metadata headers (`x-device-id`, `x-branch-pin`, `x-private-ip`, `x-latitude`, `x-longitude`) | Headers are consumed in login hooks | Partial | Validation/mandatory rules not uniformly codified in API contract | Backend | Phase 1 |
| `x-request-id` | Route wrapper now echoes/generates `x-request-id` on all API responses | Ready | Roll out log correlation in Flutter clients | Backend + Flutter | Phase 1 |
| `Idempotency-Key` on writes | Implemented for billing writes with persisted replay semantics | Ready | Expand to additional write domains after billing stabilization | Backend | Phase 1 |
| ISO-8601 UTC timestamps | Used widely across docs and hooks | Ready | Ensure consistency in all custom endpoints | Backend | Phase 1 |
| Opaque IDs (`bill_...`, `usr_...`) | Mongo-style IDs are used directly | Missing | Introduce public ID layer or alias fields | Backend | Phase 2+ |
| Standard success envelope (`data/meta/error`) | Opt-in via `x-bf-response-envelope: v1`; legacy shape remains default | Partial | Promote envelope from canary to default after Flutter sign-off | Backend + Flutter | Phase 1 |
| Standard error envelope (`code/message/details`) | Opt-in error envelope available in v1 envelope mode | Partial | Standardize domain error codes across all custom handlers | Backend | Phase 1 |

## B) REST Contract

### B1. Auth

| Draft Endpoint | Current Live Equivalent | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| `POST /auth/login` | `POST /api/users/login` (Payload auth route; branch pin + IP/geo checks in hooks) | Partial | Path + response shape + envelope differ | Backend | Phase 2 |
| `GET /auth/me` | `GET /api/users/me` | Partial | Path + envelope differ | Backend | Phase 2 |
| `POST /auth/logout` | `POST /api/users/logout` | Partial | Path + envelope differ | Backend | Phase 2 |

### B2. Billings / Orders

| Draft Endpoint | Current Live Equivalent | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| `POST /billings` | `POST /api/billings` (+ `/api/v1/billings` alias) | Ready | Keep schema freeze and validation tightening tracked separately | Backend | Phase 1 |
| `GET /billings` | `GET /api/billings` (+ `/api/v1/billings` alias) | Partial | Query style today is Payload-style filtering, not frozen draft query params | Backend | Phase 2 |
| `GET /billings/{billId}` | `GET /api/billings/{id}?depth=...` (+ `/api/v1/billings/{id}` alias) | Partial | Envelope default + query contract still not fully frozen | Backend | Phase 2 |
| `PATCH /billings/{billId}` | `PATCH /api/billings/{id}` (+ `/api/v1/billings/{id}` alias) | Ready | Keep patch-schema hardening tracked separately | Backend | Phase 1 |
| `POST /billings/{billId}/status` | Today via `PATCH /api/billings/{id}` (overall) and `PATCH /api/billings/{id}/items/status` (item-level) | Partial | Add explicit status transition endpoint + stable transition errors | Backend | Phase 2 |
| `POST /billings/{billId}/waiter-calls/{callId}/ack` | `POST /api/call-waiter/ack` (+ `/api/v1/call-waiter/ack` alias) | Partial | Draft path/payload model differs; parity for alias path is covered | Backend | Phase 2 |

### B3. Attendance

| Draft Endpoint | Current Live Equivalent | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| `POST /attendance/sessions/punch-in` | Auto session creation inside login hooks; generic `POST /api/attendance` exists | Partial | No dedicated punch-in route with stable contract | Backend | Phase 2 |
| `POST /attendance/sessions/{sessionId}/punch-out` | No dedicated punch-out route found | Missing | Add explicit close-session endpoint semantics | Backend | Phase 2 |
| `GET /attendance/sessions` | `GET /api/attendance` | Partial | Cursor/status contract differs (current uses collection docs + filters) | Backend | Phase 2 |

### B4. Branch / Company / Ops Config

| Draft Endpoint | Current Live Equivalent | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| `GET /branches` | `GET /api/branches` (+ `/api/v1/branches` alias) | Partial | Envelope default + draft query/shape still differ | Backend | Phase 2 |
| `GET /branches/{branchId}` | `GET /api/branches/{id}` (+ `/api/v1/branches/{id}` alias) | Partial | Envelope default + draft shape still differ | Backend | Phase 2 |
| `GET /branches/{branchId}/config` | No single endpoint; data spread across `branches` + globals | Missing | Add consolidated branch config endpoint | Backend | Phase 2 |
| `GET /branches/{branchId}/tables` | Available via `GET /api/tables` with branch filtering | Partial | Add stable nested route + pagination contract | Backend | Phase 2 |
| `GET /branches/{branchId}/kitchens` | Available via `GET /api/kitchens` with branch filtering | Partial | Add stable nested route + pagination contract | Backend | Phase 2 |
| `GET /companies/{companyId}` | `GET /api/companies/{id}` (+ `/api/v1/companies/{id}` alias) | Partial | Envelope default + draft shape still differ | Backend | Phase 2 |

### B5. Chat History

| Draft Endpoint | Current Live Equivalent | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| `GET /chat/threads?staffUserId=...` | `GET /api/message-threads` with where filter | Partial | Path/query shape differs | Backend | Phase 2 |
| `GET /chat/threads/{threadId}/messages?...` | `GET /api/messages` with `where[thread]` filter | Partial | Cursor model differs (current pagination style differs) | Backend | Phase 2 |
| `POST /chat/threads/{threadId}/messages` | `POST /api/messages` | Partial | Path differs; `clientMessageId` not standardized | Backend | Phase 2 |
| `PATCH /chat/receipts/{receiptId}` | `PATCH /api/message-receipts/{id}` | Partial | Path + envelope differences | Backend | Phase 2 |

## C) GraphQL Contract (Read-Heavy)

| Draft Item | Current Live | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| Policy: GraphQL queries-only for read-heavy domains | `/api/graphql` exists; current custom schema is report-focused | Partial | Add/standardize target read slice and freeze naming | Backend | Phase 3 |
| `products(filter, first, after)` | Products currently consumed via REST (`/api/products`) | Partial | Add explicit target GraphQL connection + cursor behavior | Backend | Phase 3 |
| `categories(filter, first, after)` | Categories currently via REST (`/api/categories`) | Partial | Add target GraphQL connection + cursor behavior | Backend | Phase 3 |
| `widgetSettings(branchId)` | Current via REST global (`/api/globals/widget-settings`) | Partial | Add GraphQL field + branch-scoped resolver | Backend | Phase 3 |
| `productOptions(ids)` | Current via REST custom (`/api/widgets/product-options`) | Partial | Add GraphQL resolver with stable output | Backend | Phase 3 |
| `customerLookup(...)` | Current via REST custom (`/api/billing/customer-lookup`) | Partial | Add GraphQL resolver + standardized response | Backend | Phase 3 |
| `reviews(customerPhone, first, after)` | Current via REST (`/api/reviews`) + report endpoint (`/api/reports/review`) | Partial | Add GraphQL connection filtered by phone with cursor pagination | Backend | Phase 3 |

## D) WebSocket Contract

| Draft Item | Current Live | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| `wss://.../ws/v1` connect and topic subscriptions | No websocket API route found | Missing | Implement connection auth, topic subscriptions, ack protocol | Backend + DevOps | Phase 4 |
| Event envelope (`eventId/topic/type/ts/seq/data`) | Not present | Missing | Define and enforce server event schema | Backend | Phase 4 |
| Event types (`chat.message.created`, `order.status.changed`, etc.) | Not emitted over WS | Missing | Map domain actions to realtime events | Backend | Phase 4 |
| At-least-once + dedupe by `eventId` | Not implemented | Missing | Add delivery/retry sequencing + client replay guidance | Backend + Flutter | Phase 4 |
| Current stopgap | Polling endpoints used in UI (`/api/widgets/live-table-status`, `/api/widgets/live-logins`) | Partial | Keep polling until WS rollout completes | Flutter + Backend | Ongoing |

## E) Webhook Contract

| Draft Item | Current Live | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| Outbound webhook events (`kot.print.triggered`, etc.) | No outbound webhook pipeline found | Missing | Build subscription, dispatcher, and event producer hooks | Backend | Phase 5 |
| Signature headers (`X-BF-*`, HMAC SHA-256) | Not present | Missing | Implement signing + verification spec | Backend | Phase 5 |
| Retry/backoff policy | Not present | Missing | Queue + retry scheduler + dead-letter handling | Backend + DevOps | Phase 5 |

## F) Non-Functional Rules

| Draft Rule | Current Live | Status | Gap | Owner | ETA |
|---|---|---|---|---|---|
| Billing write timeout target `<=45s` | No explicit API SLA contract exposed | Partial | Define timeout policy and client retry behavior | Backend | Phase 1 |
| GraphQL max page sizes | Not frozen as target policy for draft slice | Missing | Enforce per-query page caps in new GraphQL slice | Backend | Phase 3 |
| WS heartbeat `25s` / disconnect `75s` | WS not implemented | Missing | Add heartbeat policy in WS server | Backend | Phase 4 |
| Audit fields (`createdBy`, `updatedBy`, `source`, `deviceId`, `branchId`) on writes | Partially present by collection/flow | Partial | Standardize required audit fields across write endpoints | Backend | Phase 1 |
| Idempotency operational metrics (`replay`, `conflict`, `wait`, `expired_reclaim`) | Runtime counters + ops endpoint are available | Ready | Wire dashboard alerts in infra monitoring stack | Backend + DevOps | Phase 2 |
| Idempotency key retention and cleanup | TTL index + scheduled cleanup job implemented | Ready | Validate TTL index presence in every environment | Backend + DevOps | Phase 2 |

## Current Live Contract References

- Top-level custom endpoints: `src/payload.config.ts`
- Billing collection + custom item status endpoint: `src/collections/Billings.ts`
- Auth/login hooks and login metadata headers: `src/collections/Users.ts`
- Waiter call endpoints: `src/endpoints/callWaiter.ts`, `src/endpoints/ackWaiterCall.ts`
- Widget product options and customer lookup: `src/endpoints/getWidgetProductOptions.ts`, `src/endpoints/getBillingCustomerLookup.ts`
- Messaging collections (threads/messages/receipts): `src/collections/MessageThreads.ts`, `src/collections/Messages.ts`, `src/collections/MessageReceipts.ts`

## External Reference

- Payload REST API route generation (collections/auth/globals): https://payloadcms.com/docs/rest-api/overview
