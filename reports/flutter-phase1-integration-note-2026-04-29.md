# Flutter Integration Note (Phase 1)

Date: 2026-04-29  
Scope: Live backend contract for request-id, response envelope (opt-in), and billing idempotency.

## 1) Headers to send from Flutter

- Always send `x-request-id` (UUID) on every API call.
- Canary only (first rollout): send `x-bf-response-envelope: v1`.
- Billing writes must send `Idempotency-Key`:
  - `POST /api/billings` (and `/api/v1/billings`)
  - `PATCH /api/billings/:id` (and `/api/v1/billings/:id`)

## 2) Headers to read from backend

- Always log `x-request-id` from the response headers for traceability.
- Persist it into client logs/crash reports.

## 3) Response shape rollout

- Default behavior (no envelope header): existing legacy response bodies are preserved.
- With `x-bf-response-envelope: v1`: response shape becomes:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "pagination": null
  },
  "error": null
}
```

Error shape (envelope mode):

```json
{
  "data": null,
  "meta": {
    "requestId": "req_..."
  },
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "Idempotency-Key was already used with a different request payload.",
    "details": {
      "reason": "reused_key",
      "scope": "POST:/api/billings"
    }
  }
}
```

## 4) Retry + idempotency rules (Flutter)

- Generate one `Idempotency-Key` per user intent (for example, one bill submit tap).
- Reuse the same key only for safe transport retries of the same payload.
- Do not reuse a key for modified payloads.
- If `409 IDEMPOTENCY_CONFLICT` is returned, treat it as non-retriable unless a new key is generated for a new intent.

## 5) Suggested Dart pseudocode

```dart
final requestId = const Uuid().v4();
final idempotencyKey = const Uuid().v4(); // per user intent

final headers = {
  'Authorization': 'Bearer $token',
  'x-request-id': requestId,
  'x-bf-response-envelope': 'v1', // canary only
  'Idempotency-Key': idempotencyKey,
};

final response = await http.post(url, headers: headers, body: jsonEncode(payload));
final responseRequestId = response.headers['x-request-id'];

if (response.statusCode == 409) {
  // IDEMPOTENCY_CONFLICT: do not blind-retry with same request.
  // Create a new key only if this is a fresh user intent.
}
```

## 6) Notes

- `/api/v1/*` alias is supported by adapter routing while legacy `/api/*` remains valid.
- Envelope mode is opt-in to avoid breaking current clients.
