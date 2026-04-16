import type { PayloadRequest } from 'payload'

type BranchScopeResult = {
  branchIds?: string[]
  errorResponse?: Response
}

const toId = (value: unknown): string | null => {
  if (!value) return null

  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    for (const item of value) {
      const id = toId(item)
      if (id) return id
    }
    return null
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as { _id?: unknown; id?: unknown }

    const nestedId = toId(record.id)
    if (nestedId) return nestedId

    const nestedMongoId = toId(record._id)
    if (nestedMongoId) return nestedMongoId

    if (typeof (value as { toString?: () => string }).toString === 'function') {
      const stringified = (value as { toString: () => string }).toString()
      if (stringified && stringified !== '[object Object]') return stringified
    }
  }

  return null
}

const parseBranchIds = (branchParam?: null | string): string[] => {
  if (!branchParam || branchParam === 'all') return []
  return branchParam
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id !== 'all')
}

export const resolveReportBranchScope = async (
  req: PayloadRequest,
  branchParam?: null | string,
): Promise<BranchScopeResult> => {
  const requestedBranchIds = parseBranchIds(branchParam)
  const user = req.user as
    | {
        role?: string
        company?: unknown
      }
    | undefined

  // For non-company users, preserve existing behavior:
  // if they passed branch filters, use them; otherwise no branch scope.
  if (!user || user.role !== 'company') {
    if (requestedBranchIds.length > 0) {
      return { branchIds: requestedBranchIds }
    }
    return {}
  }

  const companyId = toId(user.company)
  if (!companyId) {
    // Graceful fallback: do not hard-fail the report endpoint.
    // Returning an empty branch scope keeps data access restricted while
    // allowing the report UI to render without a generic fetch error.
    return { branchIds: [] }
  }

  const { docs: companyBranches } = await req.payload.find({
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

  const allowedBranchIds = companyBranches.map((branch) => branch.id)

  // Company user with explicit branch filter: enforce branch ownership.
  if (requestedBranchIds.length > 0) {
    // Keep only branches allowed for this company user.
    // If none are allowed, this naturally returns no records instead of 403.
    return { branchIds: requestedBranchIds.filter((id) => allowedBranchIds.includes(id)) }
  }

  // Company user without explicit branch filter: scope to all branches in their company.
  return { branchIds: allowedBranchIds }
}
