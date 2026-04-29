import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDEMPOTENCY_CONFLICT_CODE } from '@/utilities/idempotency'

type RouteArgs = {
  params: Promise<{
    slug?: string[]
  }>
}

type IdempotencyRecord = {
  completedAt?: string | null
  expiresAt?: string
  id: string
  key: string
  requestHash: string
  responsePayload?: unknown
  responseStatus?: number
  scope: string
  status: 'completed' | 'failed' | 'processing'
}

const restHandlers = {
  delete: vi.fn(),
  get: vi.fn(),
  options: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}

const idempotencyByScopeAndKey = new Map<string, IdempotencyRecord>()
const idempotencyByID = new Map<string, IdempotencyRecord>()
let idempotencySeq = 0

const buildStoreKey = (scope: string, key: string): string => `${scope}::${key}`

const findScopeAndKey = (args: unknown): { key: string | null; scope: string | null } => {
  const where = (args as { where?: { and?: unknown[] } } | undefined)?.where
  const andClauses = Array.isArray(where?.and) ? where.and : []

  let key: string | null = null
  let scope: string | null = null

  for (const clause of andClauses) {
    if (!clause || typeof clause !== 'object') continue

    const keyClause = (clause as { key?: { equals?: unknown } }).key
    if (keyClause && typeof keyClause.equals === 'string') {
      key = keyClause.equals
    }

    const scopeClause = (clause as { scope?: { equals?: unknown } }).scope
    if (scopeClause && typeof scopeClause.equals === 'string') {
      scope = scopeClause.equals
    }
  }

  return { key, scope }
}

const mockPayload = {
  create: vi.fn(async (args: unknown) => {
    const data = (args as { data?: Record<string, unknown> }).data || {}
    const key = typeof data.key === 'string' ? data.key : ''
    const scope = typeof data.scope === 'string' ? data.scope : ''
    const storeKey = buildStoreKey(scope, key)

    if (idempotencyByScopeAndKey.has(storeKey)) {
      const duplicate = new Error('E11000 duplicate key error')
      ;(duplicate as { code?: number }).code = 11000
      throw duplicate
    }

    idempotencySeq += 1
    const created: IdempotencyRecord = {
      id: `idem_${idempotencySeq}`,
      key,
      scope,
      requestHash: typeof data.requestHash === 'string' ? data.requestHash : '',
      status:
        data.status === 'completed' || data.status === 'failed' || data.status === 'processing'
          ? data.status
          : 'processing',
      responseStatus: typeof data.responseStatus === 'number' ? data.responseStatus : undefined,
      responsePayload: data.responsePayload,
      completedAt: typeof data.completedAt === 'string' ? data.completedAt : null,
      expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : undefined,
    }

    idempotencyByScopeAndKey.set(storeKey, created)
    idempotencyByID.set(created.id, created)
    return created
  }),
  find: vi.fn(async (args: unknown) => {
    const { key, scope } = findScopeAndKey(args)
    if (!key || !scope) {
      return { docs: [] as IdempotencyRecord[] }
    }
    const existing = idempotencyByScopeAndKey.get(buildStoreKey(scope, key))
    return { docs: existing ? [existing] : [] }
  }),
  update: vi.fn(async (args: unknown) => {
    const input = args as {
      data?: Record<string, unknown>
      id?: string
    }
    const id = typeof input.id === 'string' ? input.id : ''
    const record = idempotencyByID.get(id)
    if (!record) return null

    const previousStoreKey = buildStoreKey(record.scope, record.key)
    const data = input.data || {}

    if (typeof data.key === 'string') record.key = data.key
    if (typeof data.scope === 'string') record.scope = data.scope
    if (typeof data.requestHash === 'string') record.requestHash = data.requestHash
    if (data.status === 'completed' || data.status === 'failed' || data.status === 'processing') {
      record.status = data.status
    }
    if (typeof data.responseStatus === 'number') record.responseStatus = data.responseStatus
    if ('responsePayload' in data) record.responsePayload = data.responsePayload
    if (typeof data.expiresAt === 'string') record.expiresAt = data.expiresAt
    if ('completedAt' in data) {
      record.completedAt = typeof data.completedAt === 'string' ? data.completedAt : null
    }

    const nextStoreKey = buildStoreKey(record.scope, record.key)
    idempotencyByScopeAndKey.delete(previousStoreKey)
    idempotencyByScopeAndKey.set(nextStoreKey, record)

    return record
  }),
}

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('@payloadcms/next/css', () => ({}))

vi.mock('@payloadcms/next/routes', () => ({
  REST_DELETE: () => restHandlers.delete,
  REST_GET: () => restHandlers.get,
  REST_OPTIONS: () => restHandlers.options,
  REST_PATCH: () => restHandlers.patch,
  REST_POST: () => restHandlers.post,
  REST_PUT: () => restHandlers.put,
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => mockPayload),
}))

const resetState = (): void => {
  idempotencyByScopeAndKey.clear()
  idempotencyByID.clear()
  idempotencySeq = 0
  restHandlers.get.mockReset()
  restHandlers.post.mockReset()
  restHandlers.patch.mockReset()
  restHandlers.delete.mockReset()
  restHandlers.put.mockReset()
  restHandlers.options.mockReset()
  mockPayload.find.mockClear()
  mockPayload.create.mockClear()
  mockPayload.update.mockClear()
}

const toArgs = (slug: string[]): RouteArgs => ({
  params: Promise.resolve({ slug }),
})

const parseBody = async (response: Response): Promise<unknown> => {
  const raw = await response.text()
  return raw ? JSON.parse(raw) : null
}

let routeHandlers: {
  GET: (request: Request, args: RouteArgs) => Promise<Response>
  PATCH: (request: Request, args: RouteArgs) => Promise<Response>
  POST: (request: Request, args: RouteArgs) => Promise<Response>
}

beforeAll(async () => {
  routeHandlers = await import('@/app/(payload)/api/[...slug]/route')
})

beforeEach(() => {
  resetState()
})

describe('Phase 2 /api/v1 parity', () => {
  it('keeps GET /users/me behavior identical between /api and /api/v1', async () => {
    restHandlers.get.mockImplementation(async (_request: Request, args: RouteArgs) => {
      const params = await args.params
      return Response.json(
        {
          route: params.slug || [],
          ok: true,
        },
        { status: 200 },
      )
    })

    const headers = new Headers()
    headers.set('x-request-id', 'req_parity_users_me')
    headers.set('x-bf-response-envelope', 'v1')

    const baseResponse = await routeHandlers.GET(
      new Request('https://example.com/api/users/me', { method: 'GET', headers }),
      toArgs(['users', 'me']),
    )
    const v1Response = await routeHandlers.GET(
      new Request('https://example.com/api/v1/users/me', { method: 'GET', headers }),
      toArgs(['v1', 'users', 'me']),
    )

    expect(baseResponse.status).toBe(200)
    expect(v1Response.status).toBe(200)
    expect(v1Response.headers.get('x-request-id')).toBe('req_parity_users_me')
    expect(baseResponse.headers.get('x-request-id')).toBe('req_parity_users_me')
    expect(await parseBody(baseResponse)).toEqual(await parseBody(v1Response))
  })

  it('keeps POST /users/login semantics identical between /api and /api/v1', async () => {
    restHandlers.post.mockImplementation(async (request: Request, args: RouteArgs) => {
      const body = JSON.parse((await request.text()) || '{}') as { password?: string }
      const params = await args.params
      const path = (params.slug || []).join('/')

      if (path !== 'users/login') {
        return Response.json({ message: 'not-implemented' }, { status: 501 })
      }

      if (body.password !== 'secret') {
        return Response.json({ message: 'Invalid credentials' }, { status: 401 })
      }

      return Response.json({ accessToken: 'jwt' }, { status: 200 })
    })

    const headers = new Headers()
    headers.set('x-bf-response-envelope', 'v1')
    headers.set('x-request-id', 'req_parity_users_login')

    const payload = JSON.stringify({ email: 'a@b.com', password: 'wrong' })
    const baseResponse = await routeHandlers.POST(
      new Request('https://example.com/api/users/login', {
        method: 'POST',
        headers,
        body: payload,
      }),
      toArgs(['users', 'login']),
    )
    const v1Response = await routeHandlers.POST(
      new Request('https://example.com/api/v1/users/login', {
        method: 'POST',
        headers,
        body: payload,
      }),
      toArgs(['v1', 'users', 'login']),
    )

    expect(baseResponse.status).toBe(401)
    expect(v1Response.status).toBe(401)
    expect(await parseBody(baseResponse)).toEqual(await parseBody(v1Response))
  })

  it('keeps POST /call-waiter/ack behavior identical between /api and /api/v1', async () => {
    restHandlers.post.mockImplementation(async (_request: Request, args: RouteArgs) => {
      const params = await args.params
      const path = (params.slug || []).join('/')

      if (path === 'call-waiter/ack') {
        return Response.json({ ok: true, acknowledged: true }, { status: 200 })
      }

      return Response.json({ message: 'not-implemented' }, { status: 501 })
    })

    const headers = new Headers()
    headers.set('x-bf-response-envelope', 'v1')
    headers.set('x-request-id', 'req_parity_waiter_ack')

    const baseResponse = await routeHandlers.POST(
      new Request('https://example.com/api/call-waiter/ack', { method: 'POST', headers }),
      toArgs(['call-waiter', 'ack']),
    )
    const v1Response = await routeHandlers.POST(
      new Request('https://example.com/api/v1/call-waiter/ack', { method: 'POST', headers }),
      toArgs(['v1', 'call-waiter', 'ack']),
    )

    expect(baseResponse.status).toBe(200)
    expect(v1Response.status).toBe(200)
    expect(await parseBody(baseResponse)).toEqual(await parseBody(v1Response))
  })

  it('applies identical idempotency replay behavior for POST /billings on /api and /api/v1', async () => {
    restHandlers.post.mockImplementation(async (_request: Request, args: RouteArgs) => {
      const params = await args.params
      const path = (params.slug || []).join('/')

      if (path === 'billings') {
        return Response.json({ id: 'bill_1', invoiceNumber: 'INV-001' }, { status: 201 })
      }

      return Response.json({ message: 'not-implemented' }, { status: 501 })
    })

    for (const variant of ['api', 'api/v1']) {
      idempotencyByScopeAndKey.clear()
      idempotencyByID.clear()
      idempotencySeq = 0
      restHandlers.post.mockClear()

      const headers = new Headers()
      headers.set('x-bf-response-envelope', 'v1')
      headers.set('Idempotency-Key', 'idem_billings_1')
      headers.set('x-request-id', `req_parity_billings_${variant.replace('/', '_')}`)

      const slug = variant === 'api' ? ['billings'] : ['v1', 'billings']
      const url = `https://example.com/${variant}/billings`
      const body = JSON.stringify({ items: [{ product: 'prd_1', qty: 1 }] })

      const first = await routeHandlers.POST(
        new Request(url, { method: 'POST', headers, body }),
        toArgs(slug),
      )
      const second = await routeHandlers.POST(
        new Request(url, { method: 'POST', headers, body }),
        toArgs(slug),
      )

      expect(first.status).toBe(201)
      expect(second.status).toBe(201)
      expect(restHandlers.post).toHaveBeenCalledTimes(1)
      const firstBody = (await parseBody(first)) as {
        data?: unknown
        error?: unknown
      }
      const secondBody = (await parseBody(second)) as {
        data?: unknown
        error?: unknown
      }
      expect(secondBody.data).toEqual(firstBody.data)
      expect(secondBody.error).toEqual(firstBody.error)
      expect(typeof second.headers.get('x-request-id')).toBe('string')
    }
  })

  it('applies identical idempotency conflict behavior for PATCH /billings/:id on /api and /api/v1', async () => {
    restHandlers.patch.mockImplementation(async (_request: Request, args: RouteArgs) => {
      const params = await args.params
      const path = (params.slug || []).join('/')

      if (path.startsWith('billings/')) {
        return Response.json({ ok: true }, { status: 200 })
      }

      return Response.json({ message: 'not-implemented' }, { status: 501 })
    })

    for (const variant of ['api', 'api/v1']) {
      idempotencyByScopeAndKey.clear()
      idempotencyByID.clear()
      idempotencySeq = 0
      restHandlers.patch.mockClear()

      const headers = new Headers()
      headers.set('x-bf-response-envelope', 'v1')
      headers.set('Idempotency-Key', 'idem_patch_1')

      const slug = variant === 'api' ? ['billings', 'bill_1'] : ['v1', 'billings', 'bill_1']
      const url = `https://example.com/${variant}/billings/bill_1`

      const first = await routeHandlers.PATCH(
        new Request(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ notes: 'same key payload A' }),
        }),
        toArgs(slug),
      )
      const second = await routeHandlers.PATCH(
        new Request(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ notes: 'same key payload B' }),
        }),
        toArgs(slug),
      )

      expect(first.status).toBe(200)
      expect(second.status).toBe(409)
      expect(restHandlers.patch).toHaveBeenCalledTimes(1)

      const secondBody = (await parseBody(second)) as {
        error?: {
          code?: string
        }
      }
      expect(secondBody.error?.code).toBe(IDEMPOTENCY_CONFLICT_CODE)
    }
  })
})
