import type { PayloadHandler, PayloadRequest } from 'payload'

const BRANCH_SCOPED_ROLES = new Set([
  'branch',
  'kitchen',
  'waiter',
  'cashier',
  'supervisor',
  'delivery',
  'driver',
  'chef',
])

type ScopeResult = {
  branchIds?: string[]
  errorResponse?: Response
}

type SessionLike = {
  id?: unknown
  createdAt?: unknown
  expiresAt?: unknown
}

type UserLike = {
  id?: unknown
  name?: unknown
  email?: unknown
  role?: unknown
  branch?: unknown
  lastLoginBranch?: unknown
  sessions?: unknown
}

type LiveLoginUserResponse = {
  userId: string
  name: string
  role: string
  branchId: string | null
  branchName: string | null
  activeSessionCount: number
  latestLoginAt: string | null
}

const toText = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const getRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof (value as { id?: unknown }).id === 'string' ||
      typeof (value as { id?: unknown }).id === 'number')
  ) {
    return String((value as { id: string | number }).id)
  }

  if (
    value &&
    typeof value === 'object' &&
    '_id' in value &&
    (typeof (value as { _id?: unknown })._id === 'string' ||
      typeof (value as { _id?: unknown })._id === 'number')
  ) {
    return String((value as { _id: string | number })._id)
  }

  return null
}

const getBranchName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null

  const branchName = (value as { name?: unknown }).name
  return typeof branchName === 'string' && branchName.trim().length > 0 ? branchName.trim() : null
}

const buildBranchWhere = (branchIds?: string[]): unknown => {
  if (!branchIds || branchIds.length === 0) return undefined
  if (branchIds.length === 1) {
    return {
      or: [{ branch: { equals: branchIds[0] } }, { lastLoginBranch: { equals: branchIds[0] } }],
    }
  }
  return {
    or: [{ branch: { in: branchIds } }, { lastLoginBranch: { in: branchIds } }],
  }
}

const getRequestURL = (rawURL: unknown): URL => {
  if (rawURL instanceof URL) return rawURL

  if (typeof rawURL !== 'string' || rawURL.trim().length === 0) {
    return new URL('http://localhost')
  }

  try {
    return new URL(rawURL)
  } catch (_error) {
    return new URL(rawURL, 'http://localhost')
  }
}

const resolveBranchScope = async (
  req: PayloadRequest,
  requestedBranchId: string | null,
): Promise<ScopeResult> => {
  const user = req.user as
    | {
        role?: string
        branch?: unknown
        company?: unknown
      }
    | undefined

  if (!user) {
    return {
      errorResponse: Response.json({ message: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (requestedBranchId && requestedBranchId !== 'all') {
    if (BRANCH_SCOPED_ROLES.has(user.role || '')) {
      const userBranchId = getRelationshipID(user.branch)
      if (!userBranchId) {
        return {
          errorResponse: Response.json(
            { message: 'Branch user is not assigned to a branch.' },
            { status: 403 },
          ),
        }
      }

      if (userBranchId !== requestedBranchId) {
        return {
          errorResponse: Response.json(
            { message: 'You are not allowed to access another branch.' },
            { status: 403 },
          ),
        }
      }

      return { branchIds: [userBranchId] }
    }

    if (user.role !== 'company') {
      return { branchIds: [requestedBranchId] }
    }
  }

  if (BRANCH_SCOPED_ROLES.has(user.role || '')) {
    const userBranchId = getRelationshipID(user.branch)
    if (!userBranchId) {
      return {
        errorResponse: Response.json(
          { message: 'Branch user is not assigned to a branch.' },
          { status: 403 },
        ),
      }
    }
    return { branchIds: [userBranchId] }
  }

  if (user.role !== 'company') {
    if (requestedBranchId && requestedBranchId !== 'all') {
      return { branchIds: [requestedBranchId] }
    }
    return {}
  }

  const companyId = getRelationshipID(user.company)
  if (!companyId) {
    return {
      errorResponse: Response.json(
        { message: 'Company user is not assigned to a company.' },
        { status: 403 },
      ),
    }
  }

  const companyBranches = await req.payload.find({
    collection: 'branches',
    where: {
      company: {
        equals: companyId,
      },
    },
    depth: 0,
    limit: 1000,
    pagination: false,
  })

  const allowedBranchIds = companyBranches.docs.map((branch) => branch.id)

  if (requestedBranchId && requestedBranchId !== 'all') {
    if (!allowedBranchIds.includes(requestedBranchId)) {
      return {
        errorResponse: Response.json(
          { message: 'You are not allowed to access this branch.' },
          { status: 403 },
        ),
      }
    }
    return { branchIds: [requestedBranchId] }
  }

  return { branchIds: allowedBranchIds }
}

const getDisplayName = (user: UserLike): string => {
  const name = toText(user.name)
  if (name) return name

  const email = toText(user.email)
  if (email && email.includes('@')) return email.split('@')[0]
  if (email) return email

  return 'Unknown User'
}

const getActiveSessions = (sessions: unknown, nowMs: number): SessionLike[] => {
  if (!Array.isArray(sessions)) return []

  return sessions.filter((session): session is SessionLike => {
    if (!session || typeof session !== 'object') return false
    const expiresAt = (session as SessionLike).expiresAt
    if (typeof expiresAt !== 'string' || expiresAt.trim().length === 0) return false

    const expiresMs = new Date(expiresAt).getTime()
    return Number.isFinite(expiresMs) && expiresMs > nowMs
  })
}

export const getLiveLoggedInUsersHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    const requestURL = getRequestURL(req.url)
    const requestedBranchId = requestURL.searchParams.get('branchId')
    const scope = await resolveBranchScope(req as PayloadRequest, requestedBranchId)

    if (scope.errorResponse) return scope.errorResponse

    const branchWhere = buildBranchWhere(scope.branchIds)
    const usersWhere: unknown = branchWhere ? { and: [branchWhere] } : undefined

    const usersQuery: {
      collection: 'users'
      depth: number
      sort: string
      limit: number
      pagination: false
      overrideAccess: boolean
      where?: never
    } = {
      collection: 'users',
      depth: 1,
      sort: 'name',
      limit: 2000,
      pagination: false,
      overrideAccess: false,
    }

    if (usersWhere) {
      usersQuery.where = usersWhere as never
    }

    let usersResult: { docs: unknown[] }
    try {
      usersResult = (await req.payload.find(usersQuery)) as { docs: unknown[] }
    } catch (queryError) {
      req.payload.logger.warn({
        msg: 'Retrying live logged-in users query with overrideAccess=true',
        err: queryError,
      })
      usersResult = (await req.payload.find({
        ...usersQuery,
        overrideAccess: true,
      })) as { docs: unknown[] }
    }

    const nowMs = Date.now()

    const users = (usersResult.docs as UserLike[])
      .map((doc): LiveLoginUserResponse | null => {
        try {
          const activeSessions = getActiveSessions(doc.sessions, nowMs)
          if (activeSessions.length === 0) return null

          const directBranchId = getRelationshipID(doc.branch)
          const fallbackBranchId = getRelationshipID(doc.lastLoginBranch)
          let branchId = directBranchId || fallbackBranchId

          const directBranchName = getBranchName(doc.branch)
          const fallbackBranchName = getBranchName(doc.lastLoginBranch)
          const branchName = directBranchName || fallbackBranchName

          if (!branchId && scope.branchIds && scope.branchIds.length === 1) {
            branchId = scope.branchIds[0]
          }

          if (
            scope.branchIds &&
            scope.branchIds.length > 0 &&
            (!branchId || !scope.branchIds.includes(branchId))
          ) {
            return null
          }

          const latestSession = activeSessions.reduce<SessionLike | null>((latest, current) => {
            if (!latest) return current

            const latestCreatedAtMs =
              typeof latest.createdAt === 'string' ? new Date(latest.createdAt).getTime() : -1
            const currentCreatedAtMs =
              typeof current.createdAt === 'string' ? new Date(current.createdAt).getTime() : -1

            return currentCreatedAtMs > latestCreatedAtMs ? current : latest
          }, null)

          return {
            userId: toText(doc.id) || '',
            name: getDisplayName(doc),
            role: toText(doc.role) || 'unknown',
            branchId: branchId || null,
            branchName,
            activeSessionCount: activeSessions.length,
            latestLoginAt:
              latestSession && typeof latestSession.createdAt === 'string'
                ? latestSession.createdAt
                : null,
          }
        } catch (userMapError) {
          req.payload.logger.warn({
            msg: 'Skipping malformed user while building live logged-in users response',
            err: userMapError,
          })
          return null
        }
      })
      .filter(
        (user): user is LiveLoginUserResponse => Boolean(user && user.userId),
      )
      .sort((left, right) => {
        const leftTime = left.latestLoginAt ? new Date(left.latestLoginAt).getTime() : 0
        const rightTime = right.latestLoginAt ? new Date(right.latestLoginAt).getTime() : 0
        if (leftTime !== rightTime) return rightTime - leftTime
        return left.name.localeCompare(right.name)
      })

    const unresolvedBranchIds = Array.from(
      new Set(
        users
          .filter(
            (user): user is LiveLoginUserResponse & { branchId: string } =>
              Boolean(user.branchId && !user.branchName),
          )
          .map((user) => user.branchId),
      ),
    )

    if (unresolvedBranchIds.length > 0) {
      const branchesResult = await req.payload.find({
        collection: 'branches',
        where:
          unresolvedBranchIds.length === 1
            ? { id: { equals: unresolvedBranchIds[0] } }
            : { id: { in: unresolvedBranchIds } },
        depth: 0,
        limit: unresolvedBranchIds.length,
        pagination: false,
        overrideAccess: true,
      })

      const branchNameById = new Map<string, string>()
      for (const branchDoc of branchesResult.docs) {
        const branchId = toText((branchDoc as { id?: unknown }).id)
        if (!branchId) continue

        const nameValue = (branchDoc as { name?: unknown }).name
        const branchName = toText(nameValue) || branchId
        branchNameById.set(branchId, branchName)
      }

      users.forEach((user) => {
        if (!user.branchId || user.branchName) return
        user.branchName = branchNameById.get(user.branchId) || user.branchId
      })
    }

    return Response.json({
      generatedAt: new Date().toISOString(),
      total: users.length,
      users,
    })
  } catch (error) {
    req.payload.logger.error({
      msg: 'Failed to fetch live logged-in users',
      err: error,
    })
    return Response.json({ message: 'Failed to fetch live logged-in users' }, { status: 500 })
  }
}
