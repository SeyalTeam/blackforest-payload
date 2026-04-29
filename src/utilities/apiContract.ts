import crypto from 'crypto'
import type { PayloadRequest } from 'payload'

export const REQUEST_ID_HEADER = 'x-request-id'
export const RESPONSE_ENVELOPE_HEADER = 'x-bf-response-envelope'
export const RESPONSE_ENVELOPE_VERSION = 'v1'

const readHeader = (req: PayloadRequest, name: string): string | null => {
  if (!req?.headers || typeof req.headers.get !== 'function') return null

  const raw = req.headers.get(name)
  if (typeof raw !== 'string') return null

  const value = raw.trim()
  return value.length > 0 ? value : null
}

const sanitizeRequestID = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/[^a-zA-Z0-9._:-]/g, '-')
  return normalized.slice(0, 120)
}

const isTruthyHeaderValue = (value: string | null): boolean => {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return ['1', 'true', 'yes', RESPONSE_ENVELOPE_VERSION].includes(normalized)
}

export const shouldUseResponseEnvelope = (req: PayloadRequest): boolean => {
  const explicit = readHeader(req, RESPONSE_ENVELOPE_HEADER)
  if (explicit !== null) {
    return isTruthyHeaderValue(explicit)
  }

  return false
}

export const resolveRequestID = (req: PayloadRequest): string => {
  const contextRecord = (req as { context?: Record<string, unknown> }).context

  const fromContext =
    contextRecord && typeof contextRecord.requestId === 'string'
      ? sanitizeRequestID(contextRecord.requestId)
      : ''

  if (fromContext) {
    return fromContext
  }

  const fromHeader = sanitizeRequestID(readHeader(req, REQUEST_ID_HEADER) || '')
  const requestID = fromHeader || `req_${crypto.randomUUID().replace(/-/g, '')}`

  if (contextRecord) {
    contextRecord.requestId = requestID
  } else {
    ;(req as { context?: Record<string, unknown> }).context = {
      requestId: requestID,
    }
  }

  return requestID
}

type EnvelopeMeta = {
  pagination?: null | Record<string, unknown>
  [key: string]: unknown
}

type SuccessOptions<TLegacy> = {
  data: unknown
  legacyBody?: TLegacy
  meta?: EnvelopeMeta
  status?: number
}

type ErrorOptions<TLegacy> = {
  code: string
  details?: Record<string, unknown>
  legacyBody?: TLegacy
  message: string
  meta?: EnvelopeMeta
  status: number
}

const attachRequestIDHeader = (requestID: string): Headers => {
  const headers = new Headers()
  headers.set(REQUEST_ID_HEADER, requestID)
  return headers
}

export const successResponse = <TLegacy = unknown>(
  req: PayloadRequest,
  options: SuccessOptions<TLegacy>,
): Response => {
  const requestID = resolveRequestID(req)
  const status = options.status ?? 200

  if (!shouldUseResponseEnvelope(req)) {
    return Response.json((options.legacyBody as unknown) ?? options.data, {
      status,
      headers: attachRequestIDHeader(requestID),
    })
  }

  const meta = {
    requestId: requestID,
    pagination: options.meta?.pagination ?? null,
    ...(options.meta || {}),
  }

  return Response.json(
    {
      data: options.data,
      meta,
      error: null,
    },
    {
      status,
      headers: attachRequestIDHeader(requestID),
    },
  )
}

export const errorResponse = <TLegacy = unknown>(
  req: PayloadRequest,
  options: ErrorOptions<TLegacy>,
): Response => {
  const requestID = resolveRequestID(req)

  if (!shouldUseResponseEnvelope(req)) {
    const legacyFallback = {
      message: options.message,
      code: options.code,
      details: options.details || {},
    }

    return Response.json((options.legacyBody as unknown) ?? legacyFallback, {
      status: options.status,
      headers: attachRequestIDHeader(requestID),
    })
  }

  const meta = {
    requestId: requestID,
    ...(options.meta || {}),
  }

  return Response.json(
    {
      data: null,
      meta,
      error: {
        code: options.code,
        message: options.message,
        details: options.details || {},
      },
    },
    {
      status: options.status,
      headers: attachRequestIDHeader(requestID),
    },
  )
}
