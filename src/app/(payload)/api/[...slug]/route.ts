/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import crypto from 'crypto'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'
import { getPayload } from 'payload'
import {
  REQUEST_ID_HEADER,
  RESPONSE_ENVELOPE_HEADER,
  RESPONSE_ENVELOPE_VERSION,
} from '@/utilities/apiContract'
import {
  buildIdempotencyRequestHash,
  buildIdempotencyScope,
  evaluateIdempotencyRecord,
  IDEMPOTENCY_CONFLICT_CODE,
  IDEMPOTENCY_CONFLICT_REASONS,
  normalizeIdempotencyKey,
  waitForIdempotencyResolution,
} from '@/utilities/idempotency'
import { incrementIdempotencyMetric } from '@/utilities/idempotencyMetrics'
import { getIdempotencyExpiresAt } from '@/utilities/idempotencyRetention'

const baseGET = REST_GET(config)
const basePOST = REST_POST(config)
const baseDELETE = REST_DELETE(config)
const basePATCH = REST_PATCH(config)
const basePUT = REST_PUT(config)
const baseOPTIONS = REST_OPTIONS(config)

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key'
const IDEMPOTENCY_COLLECTION = 'idempotency-keys'
const BILLING_WRITE_PATH_REGEX = /^\/api(?:\/v1)?\/billings(?:\/[^/]+)?\/?$/i
const BILLING_BASE_PATH_REGEX = /^\/api(?:\/v1)?\/billings\/?$/i
const BILLING_DOC_PATH_REGEX = /^\/api(?:\/v1)?\/billings\/[^/]+\/?$/i

type RouteArgs = {
  params: Promise<{
    slug?: string[]
  }>
}

type RouteHandler = (request: Request, args: RouteArgs) => Promise<Response>

type IdempotencyRecord = {
  expiresAt?: string
  id: string
  key?: string
  scope?: string
  requestHash?: string
  status?: 'processing' | 'completed' | 'failed'
  responseStatus?: number
  responsePayload?: unknown
}

type PreparedIdempotency = {
  key: string
  requestHash: string
  scope: string
}

type UntypedPayloadOps = {
  create: (args: unknown) => Promise<Record<string, unknown>>
  find: (args: unknown) => Promise<{ docs?: unknown[] }>
  update: (args: unknown) => Promise<unknown>
}

const normalizeText = (value: string | null | undefined): string => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const normalizeRequestID = (value: string): string => {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._:-]/g, '-')
  return normalized.slice(0, 120)
}

const resolveRequestID = (request: Request): string => {
  const fromHeader = normalizeRequestID(normalizeText(request.headers.get(REQUEST_ID_HEADER)))
  if (fromHeader) return fromHeader
  return `req_${crypto.randomUUID().replace(/-/g, '')}`
}

const resolveRequestPath = (request: Request): string => {
  try {
    return new URL(request.url).pathname
  } catch (_error) {
    return '/'
  }
}

const resolveRequestMethod = (request: Request): string => {
  const method = normalizeText(request.method || '')
  return method ? method.toUpperCase() : 'GET'
}

const readIdempotencyKey = (request: Request): string | null => {
  return normalizeIdempotencyKey(request.headers.get(IDEMPOTENCY_KEY_HEADER))
}

const shouldUseResponseEnvelope = (request: Request): boolean => {
  const header = normalizeText(request.headers.get(RESPONSE_ENVELOPE_HEADER)).toLowerCase()
  return ['1', 'true', 'yes', RESPONSE_ENVELOPE_VERSION].includes(header)
}

const isBillingsWriteRequest = (request: Request): boolean => {
  const method = resolveRequestMethod(request)
  const path = resolveRequestPath(request)

  if (!BILLING_WRITE_PATH_REGEX.test(path)) return false

  if (method === 'POST' && BILLING_BASE_PATH_REGEX.test(path)) return true
  if (method === 'PATCH' && BILLING_DOC_PATH_REGEX.test(path)) return true

  return false
}

const isBillingOperationSuccessful = (status: number): boolean => status >= 200 && status < 300

const isJSONResponse = (response: Response): boolean => {
  const contentType = normalizeText(response.headers.get('content-type')).toLowerCase()
  return contentType.includes('application/json')
}

const parseJSONBodyFromResponse = async (response: Response): Promise<unknown | undefined> => {
  if (!isJSONResponse(response)) return undefined

  const raw = await response.clone().text()
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch (_error) {
    return undefined
  }
}

const withRequestIDHeader = (response: Response, requestID: string): Response => {
  const headers = new Headers(response.headers)
  headers.set(REQUEST_ID_HEADER, requestID)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const isEnvelopeLike = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const body = value as Record<string, unknown>
  return 'data' in body && 'meta' in body && 'error' in body
}

const buildEnvelopeSuccess = (value: unknown, requestID: string): Record<string, unknown> => {
  if (isEnvelopeLike(value)) {
    const body = value as Record<string, unknown>
    const meta =
      body.meta && typeof body.meta === 'object'
        ? (body.meta as Record<string, unknown>)
        : { pagination: null }

    return {
      ...body,
      meta: {
        ...meta,
        requestId: requestID,
        pagination: meta.pagination ?? null,
      },
      error: null,
    }
  }

  return {
    data: value,
    meta: {
      requestId: requestID,
      pagination: null,
    },
    error: null,
  }
}

const extractErrorDetails = (value: unknown): {
  code: string
  details: Record<string, unknown>
  message: string
} => {
  if (value && typeof value === 'object' && Array.isArray((value as { errors?: unknown[] }).errors)) {
    const first = (value as { errors: unknown[] }).errors[0]
    if (first && typeof first === 'object') {
      const firstError = first as {
        code?: unknown
        data?: unknown
        message?: unknown
        name?: unknown
      }
      const payloadData = firstError.data
      const payloadDataRecord =
        payloadData && typeof payloadData === 'object'
          ? (payloadData as Record<string, unknown>)
          : undefined
      const details =
        payloadDataRecord && payloadDataRecord.details && typeof payloadDataRecord.details === 'object'
          ? (payloadDataRecord.details as Record<string, unknown>)
          : payloadDataRecord || {}

      const code =
        (typeof firstError.code === 'string' && firstError.code) ||
        (typeof payloadDataRecord?.code === 'string' ? payloadDataRecord.code : '') ||
        (typeof firstError.name === 'string' && firstError.name.toUpperCase()) ||
        'REQUEST_FAILED'

      const message =
        (typeof firstError.message === 'string' && firstError.message) || 'Request failed.'

      return { code, details, message }
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const message =
      (typeof record.message === 'string' && record.message) ||
      (typeof record.error === 'string' && record.error) ||
      'Request failed.'
    const code = typeof record.code === 'string' ? record.code : 'REQUEST_FAILED'
    const details =
      record.details && typeof record.details === 'object'
        ? (record.details as Record<string, unknown>)
        : {}

    return { code, details, message }
  }

  return {
    code: 'REQUEST_FAILED',
    details: {},
    message: 'Request failed.',
  }
}

const buildEnvelopeError = (value: unknown, requestID: string): Record<string, unknown> => {
  if (isEnvelopeLike(value)) {
    const body = value as Record<string, unknown>
    const meta =
      body.meta && typeof body.meta === 'object'
        ? (body.meta as Record<string, unknown>)
        : {}

    return {
      data: null,
      meta: {
        ...meta,
        requestId: requestID,
      },
      error:
        body.error && typeof body.error === 'object'
          ? body.error
          : {
              code: 'REQUEST_FAILED',
              message: 'Request failed.',
              details: {},
            },
    }
  }

  const { code, details, message } = extractErrorDetails(value)
  return {
    data: null,
    meta: { requestId: requestID },
    error: { code, message, details },
  }
}

const wrapJSONResponseAsEnvelope = (
  response: Response,
  requestID: string,
  responseBody: unknown,
): Response => {
  const wrappedBody = response.status >= 200 && response.status < 300
    ? buildEnvelopeSuccess(responseBody, requestID)
    : buildEnvelopeError(responseBody, requestID)

  const headers = new Headers(response.headers)
  headers.set(REQUEST_ID_HEADER, requestID)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.delete('content-length')

  return new Response(JSON.stringify(wrappedBody), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const finalizeResponse = async (
  request: Request,
  response: Response,
  requestID: string,
): Promise<Response> => {
  if (!shouldUseResponseEnvelope(request)) {
    return withRequestIDHeader(response, requestID)
  }

  const parsedBody = await parseJSONBodyFromResponse(response)
  if (parsedBody === undefined) {
    return withRequestIDHeader(response, requestID)
  }

  return wrapJSONResponseAsEnvelope(response, requestID, parsedBody)
}

const toShortJSON = (value: unknown): string => {
  try {
    return JSON.stringify(value)
  } catch (_error) {
    return ''
  }
}

const prepareIdempotency = async (request: Request): Promise<PreparedIdempotency | null> => {
  if (!isBillingsWriteRequest(request)) return null

  const key = readIdempotencyKey(request)
  if (!key) return null

  const method = resolveRequestMethod(request)
  const path = resolveRequestPath(request).replace(/\/+$/, '') || '/'
  const search = (() => {
    try {
      return new URL(request.url).search
    } catch (_error) {
      return ''
    }
  })()
  const bodyText = await request.clone().text()
  const envelopeHeader = normalizeText(request.headers.get(RESPONSE_ENVELOPE_HEADER)).toLowerCase()
  const requestHash = buildIdempotencyRequestHash({
    bodyText,
    envelopeHeader,
    method,
    path,
    search,
  })
  const scope = buildIdempotencyScope(method, path)

  return { key, requestHash, scope }
}

const findIdempotencyRecord = async (
  key: string,
  scope: string,
): Promise<IdempotencyRecord | null> => {
  const payload = await getPayload({ config })
  const payloadAPI = payload as unknown as UntypedPayloadOps
  const result = await payloadAPI.find({
    collection: IDEMPOTENCY_COLLECTION,
    where: {
      and: [
        { key: { equals: key } },
        { scope: { equals: scope } },
      ],
    },
    depth: 0,
    limit: 1,
    sort: '-updatedAt',
    overrideAccess: true,
  })

  const doc = result.docs?.[0]
  if (!doc || typeof doc !== 'object' || typeof (doc as { id?: unknown }).id !== 'string') {
    return null
  }

  return doc as IdempotencyRecord
}

const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  if (candidate.code === 11000) return true
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  return message.includes('E11000')
}

const createIdempotencyRecord = async (
  prepared: PreparedIdempotency,
  request: Request,
  requestID: string,
): Promise<string | null> => {
  const payload = await getPayload({ config })
  const payloadAPI = payload as unknown as UntypedPayloadOps
  const method = resolveRequestMethod(request)
  const path = resolveRequestPath(request)
  const actorID = normalizeText(request.headers.get('x-user-id')) || null

  try {
    const created = await payloadAPI.create({
      collection: IDEMPOTENCY_COLLECTION,
      data: {
        key: prepared.key,
        scope: prepared.scope,
        requestHash: prepared.requestHash,
        status: 'processing',
        requestMethod: method,
        requestPath: path,
        requestId: requestID,
        userId: actorID || undefined,
        expiresAt: getIdempotencyExpiresAt(),
      },
      depth: 0,
      overrideAccess: true,
    })

    return typeof created?.id === 'string' ? created.id : null
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error
    }
    return null
  }
}

const updateIdempotencyRecord = async (
  recordID: string,
  updateData: Record<string, unknown>,
): Promise<void> => {
  const payload = await getPayload({ config })
  const payloadAPI = payload as unknown as UntypedPayloadOps
  try {
    await payloadAPI.update({
      collection: IDEMPOTENCY_COLLECTION,
      id: recordID,
      data: updateData,
      depth: 0,
      overrideAccess: true,
    })
  } catch (_error) {
    // Non-blocking by design: billing request should still return to client.
  }
}

const claimExistingIdempotencyRecord = async (
  recordID: string,
  prepared: PreparedIdempotency,
  request: Request,
  requestID: string,
): Promise<void> => {
  const method = resolveRequestMethod(request)
  const path = resolveRequestPath(request)
  const actorID = normalizeText(request.headers.get('x-user-id')) || null

  await updateIdempotencyRecord(recordID, {
    key: prepared.key,
    scope: prepared.scope,
    requestHash: prepared.requestHash,
    status: 'processing',
    requestMethod: method,
    requestPath: path,
    requestId: requestID,
    userId: actorID || undefined,
    responseStatus: null,
    responsePayload: null,
    completedAt: null,
    expiresAt: getIdempotencyExpiresAt(),
  })
}

const buildRawErrorResponse = (
  requestID: string,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): Response => {
  const headers = new Headers()
  headers.set(REQUEST_ID_HEADER, requestID)
  return Response.json(
    {
      code,
      details,
      message,
    },
    { headers, status },
  )
}

const buildIdempotencyConflictResponse = (
  requestID: string,
  reason: keyof typeof IDEMPOTENCY_CONFLICT_REASONS,
  message: string,
  scope: string,
): Response =>
  buildRawErrorResponse(requestID, 409, IDEMPOTENCY_CONFLICT_CODE, message, {
    reason: IDEMPOTENCY_CONFLICT_REASONS[reason],
    scope,
  })

const buildRawReplayPayloadResponse = (
  payload: unknown,
  requestID: string,
  status: number,
): Response => {
  const headers = new Headers()
  headers.set(REQUEST_ID_HEADER, requestID)

  return Response.json(payload ?? null, {
    headers,
    status,
  })
}

const applyIdempotency = async (
  request: Request,
  requestID: string,
): Promise<{
  earlyResponse?: Response
  prepared: PreparedIdempotency | null
  recordID: string | null
}> => {
  const prepared = await prepareIdempotency(request)
  if (!prepared) {
    return { prepared: null, recordID: null }
  }

  const applyEvaluation = async (
    record: IdempotencyRecord | null,
  ): Promise<{
    earlyResponse?: Response
    recordID: string | null
  }> => {
    const evaluation = evaluateIdempotencyRecord({
      record,
      requestHash: prepared.requestHash,
    })

    if (evaluation.kind === 'process') {
      if (!record?.id) {
        return { recordID: null }
      }

      if (evaluation.reason === 'expired') {
        incrementIdempotencyMetric('idempotency_expired_reclaim', {
          scope: prepared.scope,
        })
      }

      await claimExistingIdempotencyRecord(record.id, prepared, request, requestID)
      return { recordID: record.id }
    }

    if (evaluation.kind === 'replay') {
      incrementIdempotencyMetric('idempotency_replay', {
        scope: prepared.scope,
      })
      return {
        earlyResponse: buildRawReplayPayloadResponse(
          evaluation.payload,
          requestID,
          evaluation.status,
        ),
        recordID: null,
      }
    }

    if (evaluation.reason === 'inProgress') {
      incrementIdempotencyMetric('idempotency_wait', {
        scope: prepared.scope,
      })
      const settled = await waitForIdempotencyResolution({
        requestHash: prepared.requestHash,
        timeoutMs: 3500,
        intervalMs: 120,
        loadLatest: async () => findIdempotencyRecord(prepared.key, prepared.scope),
      })

      if (settled.kind === 'process') {
        if (!record?.id) return { recordID: null }
        await claimExistingIdempotencyRecord(record.id, prepared, request, requestID)
        return { recordID: record.id }
      }

      if (settled.kind === 'replay') {
        incrementIdempotencyMetric('idempotency_replay', {
          scope: prepared.scope,
        })
        return {
          earlyResponse: buildRawReplayPayloadResponse(settled.payload, requestID, settled.status),
          recordID: null,
        }
      }

      incrementIdempotencyMetric('idempotency_conflict', {
        scope: prepared.scope,
      })
      return {
        earlyResponse: buildIdempotencyConflictResponse(
          requestID,
          settled.reason,
          settled.message,
          prepared.scope,
        ),
        recordID: null,
      }
    }

    incrementIdempotencyMetric('idempotency_conflict', {
      scope: prepared.scope,
    })
    return {
      earlyResponse: buildIdempotencyConflictResponse(
        requestID,
        evaluation.reason,
        evaluation.message,
        prepared.scope,
      ),
      recordID: null,
    }
  }

  const existing = await findIdempotencyRecord(prepared.key, prepared.scope)
  if (existing) {
    const resolved = await applyEvaluation(existing)
    return {
      prepared,
      recordID: resolved.recordID,
      earlyResponse: resolved.earlyResponse,
    }
  }

  const recordID = await createIdempotencyRecord(prepared, request, requestID)
  if (recordID) {
    return { prepared, recordID }
  }

  const raced = await findIdempotencyRecord(prepared.key, prepared.scope)
  if (!raced) {
    return { prepared, recordID: null }
  }

  const resolvedRaced = await applyEvaluation(raced)

  return {
    prepared,
    recordID: resolvedRaced.recordID,
    earlyResponse: resolvedRaced.earlyResponse,
  }
}

const persistIdempotencyResult = async (
  recordID: string,
  response: Response,
): Promise<void> => {
  const parsedBody = await parseJSONBodyFromResponse(response)
  const succeeded = isBillingOperationSuccessful(response.status)

  await updateIdempotencyRecord(recordID, {
    status: succeeded ? 'completed' : 'failed',
    responseStatus: response.status,
    responsePayload: parsedBody ?? {
      message: response.statusText || (succeeded ? 'Success' : 'Failed'),
      raw: parsedBody === undefined ? toShortJSON({ note: 'non-json-response' }) : undefined,
    },
    completedAt: new Date().toISOString(),
  })
}

const normalizeRouteArgsForVersionAlias = async (args: RouteArgs): Promise<RouteArgs> => {
  const params = await args.params
  const rawSlug = Array.isArray(params?.slug) ? params.slug : []

  if (rawSlug[0]?.toLowerCase() !== 'v1') {
    return {
      params: Promise.resolve({
        slug: rawSlug,
      }),
    }
  }

  return {
    params: Promise.resolve({
      slug: rawSlug.slice(1),
    }),
  }
}

const handleRoute = async (
  request: Request,
  args: RouteArgs,
  handler: RouteHandler,
): Promise<Response> => {
  const requestID = resolveRequestID(request)
  const idempotency = await applyIdempotency(request, requestID)

  if (idempotency.earlyResponse) {
    return finalizeResponse(request, idempotency.earlyResponse, requestID)
  }

  let response: Response
  try {
    const normalizedArgs = await normalizeRouteArgsForVersionAlias(args)
    response = await handler(request, normalizedArgs)
  } catch (error) {
    if (idempotency.recordID) {
      await updateIdempotencyRecord(idempotency.recordID, {
        status: 'failed',
        responseStatus: 500,
        responsePayload: {
          message: error instanceof Error ? error.message : 'Request failed.',
        },
        completedAt: new Date().toISOString(),
      })
    }
    throw error
  }

  if (idempotency.recordID) {
    await persistIdempotencyResult(idempotency.recordID, response)
  }

  return finalizeResponse(request, response, requestID)
}

export const GET = async (request: Request, args: RouteArgs): Promise<Response> =>
  handleRoute(request, args, baseGET)

export const POST = async (request: Request, args: RouteArgs): Promise<Response> =>
  handleRoute(request, args, basePOST)

export const DELETE = async (request: Request, args: RouteArgs): Promise<Response> =>
  handleRoute(request, args, baseDELETE)

export const PATCH = async (request: Request, args: RouteArgs): Promise<Response> =>
  handleRoute(request, args, basePATCH)

export const PUT = async (request: Request, args: RouteArgs): Promise<Response> =>
  handleRoute(request, args, basePUT)

export const OPTIONS = async (request: Request, args: RouteArgs): Promise<Response> =>
  handleRoute(request, args, baseOPTIONS)
