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
  sessions?: unknown
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
  if (branchIds.length === 1) return { branch: { equals: branchIds[0] } }
  return { branch: { in: branchIds } }
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
    const requestURL = new URL(req.url || 'http://localhost')
    const requestedBranchId = requestURL.searchParams.get('branchId')
    const scope = await resolveBranchScope(req as PayloadRequest, requestedBranchId)

    if (scope.errorResponse) return scope.errorResponse

    const branchWhere = buildBranchWhere(scope.branchIds)
    const usersWhere: unknown = branchWhere ? { and: [branchWhere] } : undefined

    const usersResult = await req.payload.find({
      collection: 'users',
      where: usersWhere as never,
      depth: 1,
      sort: 'name',
      limit: 2000,
      pagination: false,
      overrideAccess: false,
    })

    const nowMs = Date.now()

    const users = (usersResult.docs as UserLike[])
      .map((doc) => {
        const activeSessions = getActiveSessions(doc.sessions, nowMs)
        if (activeSessions.length === 0) return null

        const branchId = getRelationshipID(doc.branch)
        if (scope.branchIds && scope.branchIds.length > 0 && (!branchId || !scope.branchIds.includes(branchId))) {
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
          branchName: getBranchName(doc.branch),
          activeSessionCount: activeSessions.length,
          latestLoginAt:
            latestSession && typeof latestSession.createdAt === 'string' ? latestSession.createdAt : null,
        }
      })
      .filter(
        (
          user,
        ): user is {
          userId: string
          name: string
          role: string
          branchId: string | null
          branchName: string | null
          activeSessionCount: number
          latestLoginAt: string | null
        } => Boolean(user && user.userId),
      )
      .sort((left, right) => {
        const leftTime = left.latestLoginAt ? new Date(left.latestLoginAt).getTime() : 0
        const rightTime = right.latestLoginAt ? new Date(right.latestLoginAt).getTime() : 0
        if (leftTime !== rightTime) return rightTime - leftTime
        return left.name.localeCompare(right.name)
      })

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
