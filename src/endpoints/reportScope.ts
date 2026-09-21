import type { PayloadRequest } from 'payload'
import mongoose from 'mongoose'

type BranchScopeResult = {
  branchIds?: string[]
  errorResponse?: Response
}

export const toIndexedIdList = (
  ids?: (string | null | undefined)[] | null,
): (mongoose.Types.ObjectId | string)[] => {
  if (!ids || ids.length === 0) return []
  const result: (mongoose.Types.ObjectId | string)[] = []
  for (const raw of ids) {
    if (!raw) continue
    const id = String(raw).trim()
    if (!id || id === 'all') continue
    result.push(id)
    if (mongoose.Types.ObjectId.isValid(id)) {
      result.push(new mongoose.Types.ObjectId(id))
    }
  }
  return result
}

export const toBranchQueryFilter = (branchIds?: string[] | null, fieldName = 'branch'): Record<string, any> => {
  const targets = toIndexedIdList(branchIds)
  if (targets.length === 0) return {}
  return { [fieldName]: { $in: targets } }
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
        manager_companies?: unknown[]
      }
    | undefined

  if (!user) return {}

  if (user.role === 'manager') {
    const managerCompanies = user.manager_companies || []
    const allowedCompanyIds = managerCompanies
      .map((comp: any) => toId(comp))
      .filter((id: any): id is string => typeof id === 'string')
    
    if (allowedCompanyIds.length === 0) return { branchIds: [] }

    const { docs: companyBranches } = await req.payload.find({
      collection: 'branches',
      where: {
        company: {
          in: allowedCompanyIds,
        },
      },
      depth: 0,
      limit: 1000,
      pagination: false,
    })

    const allowedBranchIds = companyBranches.map((branch) => branch.id)

    if (requestedBranchIds.length > 0) {
      return { branchIds: requestedBranchIds.filter((id) => allowedBranchIds.includes(id)) }
    }
    return { branchIds: allowedBranchIds }
  }

  // For non-company users, preserve existing behavior:
  // if they passed branch filters, use them; otherwise no branch scope.
  if (user.role !== 'company') {
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

type CompanyScopeResult = {
  companyIds?: string[]
}

export const resolveReportCompanyScope = async (
  req: PayloadRequest,
  companyParam?: null | string,
): Promise<CompanyScopeResult> => {
  const requestedCompanyIds = companyParam && companyParam !== 'all'
    ? companyParam.split(',').map((id) => id.trim()).filter((id) => id.length > 0 && id !== 'all')
    : []

  const user = req.user as any

  if (!user) return { companyIds: [] }

  if (user.role === 'superadmin' || user.role === 'admin' || user.role === 'account' || user.role === 'store_keeper') {
    if (requestedCompanyIds.length > 0) {
      return { companyIds: requestedCompanyIds }
    }
    return {}
  }

  // Company role: scope to their company
  if (user.role === 'company') {
    const companyId = toId(user.company)
    if (!companyId) return { companyIds: [] }

    if (requestedCompanyIds.length > 0) {
      return { companyIds: requestedCompanyIds.filter((id) => id === companyId) }
    }
    return { companyIds: [companyId] }
  }

  // Manager role: scope to manager_companies
  if (user.role === 'manager') {
    const managerCompanies = user.manager_companies || []
    const allowedCompanyIds = managerCompanies
      .map((comp: any) => toId(comp))
      .filter((id: any): id is string => typeof id === 'string')

    if (requestedCompanyIds.length > 0) {
      return { companyIds: requestedCompanyIds.filter((id) => allowedCompanyIds.includes(id)) }
    }
    return { companyIds: allowedCompanyIds }
  }

  // Store Keeper role: scope to storekeeper_companies
  if (user.role === 'store_keeper') {
    const storekeeperCompanies = user.storekeeper_companies || []
    const allowedCompanyIds = storekeeperCompanies
      .map((comp: any) => toId(comp))
      .filter((id: any): id is string => typeof id === 'string')

    if (requestedCompanyIds.length > 0) {
      return { companyIds: requestedCompanyIds.filter((id) => allowedCompanyIds.includes(id)) }
    }
    return { companyIds: allowedCompanyIds }
  }

  // Branch role: check branch's company
  if (user.role === 'branch') {
    const branchId = toId(user.branch)
    if (!branchId) return { companyIds: [] }

    const branch = await req.payload.findByID({
      collection: 'branches',
      id: branchId,
      depth: 0,
    })
    const companyId = toId(branch.company)
    if (!companyId) return { companyIds: [] }

    if (requestedCompanyIds.length > 0) {
      return { companyIds: requestedCompanyIds.filter((id) => id === companyId) }
    }
    return { companyIds: [companyId] }
  }

  return { companyIds: [] }
}
