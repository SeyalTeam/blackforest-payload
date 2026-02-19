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
    return {
      errorResponse: Response.json(
        { message: 'Company user is not assigned to a company.' },
        { status: 403 },
      ),
    }
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
    const unauthorizedBranch = requestedBranchIds.find((id) => !allowedBranchIds.includes(id))
    if (unauthorizedBranch) {
      return {
        errorResponse: Response.json(
          { message: 'You are not allowed to access reports for this branch.' },
          { status: 403 },
        ),
      }
    }
    return { branchIds: requestedBranchIds }
  }

  // Company user without explicit branch filter: scope to all branches in their company.
  return { branchIds: allowedBranchIds }
}
