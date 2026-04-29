import crypto from 'crypto'

export const IDEMPOTENCY_CONFLICT_CODE = 'IDEMPOTENCY_CONFLICT'
export const IDEMPOTENCY_SCOPE_SEPARATOR = ':'
export const IDEMPOTENCY_CONFLICT_REASONS = {
  inProgress: 'in_progress',
  reused: 'reused_key',
} as const

export type IdempotencyStatus = 'processing' | 'completed' | 'failed'

export type IdempotencyRecordSnapshot = {
  expiresAt?: Date | null | string
  requestHash?: null | string
  responsePayload?: unknown
  responseStatus?: null | number
  status?: IdempotencyStatus
}

export type IdempotencyEvaluation =
  | { kind: 'process'; reason: 'expired' | 'missing' }
  | { kind: 'replay'; payload: unknown; status: number }
  | { kind: 'conflict'; message: string; reason: keyof typeof IDEMPOTENCY_CONFLICT_REASONS }

type WaitForIdempotencyResolutionInput = {
  intervalMs?: number
  loadLatest: () => Promise<IdempotencyRecordSnapshot | null>
  now?: () => Date
  requestHash: string
  timeoutMs?: number
}

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export const normalizeIdempotencyKey = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const sanitized = trimmed.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 180)
  return sanitized.length > 0 ? sanitized : null
}

export const buildIdempotencyScope = (method: string, path: string): string => {
  const normalizedMethod = method.trim().toUpperCase()
  const normalizedPath = path.trim().replace(/\/+$/, '') || '/'
  return `${normalizedMethod}${IDEMPOTENCY_SCOPE_SEPARATOR}${normalizedPath}`
}

export const buildIdempotencyRequestHash = (params: {
  bodyText: string
  envelopeHeader: string
  method: string
  path: string
  search: string
}): string => {
  const payload = [
    params.method.toUpperCase(),
    params.path,
    params.search,
    params.envelopeHeader.trim().toLowerCase(),
    params.bodyText,
  ].join('|')

  return crypto.createHash('sha256').update(payload).digest('hex')
}

const parseExpiresAt = (value: Date | null | string | undefined): Date | null => {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }

  return null
}

export const isIdempotencyRecordExpired = (
  record: IdempotencyRecordSnapshot,
  now: Date = new Date(),
): boolean => {
  const expiresAt = parseExpiresAt(record.expiresAt)
  if (!expiresAt) return false
  return expiresAt.getTime() <= now.getTime()
}

export const evaluateIdempotencyRecord = (params: {
  now?: Date
  record: IdempotencyRecordSnapshot | null
  requestHash: string
}): IdempotencyEvaluation => {
  const { record, requestHash } = params
  const now = params.now ?? new Date()

  if (!record) {
    return {
      kind: 'process',
      reason: 'missing',
    }
  }

  if (isIdempotencyRecordExpired(record, now)) {
    return {
      kind: 'process',
      reason: 'expired',
    }
  }

  if (record.requestHash !== requestHash) {
    return {
      kind: 'conflict',
      reason: 'reused',
      message: 'Idempotency-Key was already used with a different request payload.',
    }
  }

  if (record.status === 'completed' || record.status === 'failed') {
    return {
      kind: 'replay',
      payload: record.responsePayload ?? null,
      status:
        typeof record.responseStatus === 'number' && Number.isFinite(record.responseStatus)
          ? record.responseStatus
          : 200,
    }
  }

  return {
    kind: 'conflict',
    reason: 'inProgress',
    message: 'A request with this Idempotency-Key is already in progress.',
  }
}

export const waitForIdempotencyResolution = async (
  input: WaitForIdempotencyResolutionInput,
): Promise<IdempotencyEvaluation> => {
  const timeoutMs = Math.max(1, input.timeoutMs ?? 3000)
  const intervalMs = Math.max(1, input.intervalMs ?? 120)
  const now = input.now ?? (() => new Date())
  const startedAt = now().getTime()

  while (now().getTime() - startedAt <= timeoutMs) {
    const latest = await input.loadLatest()
    const evaluation = evaluateIdempotencyRecord({
      record: latest,
      requestHash: input.requestHash,
      now: now(),
    })

    if (evaluation.kind === 'replay' || evaluation.kind === 'process') {
      return evaluation
    }

    if (evaluation.reason === 'reused') {
      return evaluation
    }

    await wait(intervalMs)
  }

  return {
    kind: 'conflict',
    reason: 'inProgress',
    message: 'A request with this Idempotency-Key is already in progress.',
  }
}
