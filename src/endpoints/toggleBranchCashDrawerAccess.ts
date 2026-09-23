import { PayloadHandler } from 'payload'

export const toggleBranchCashDrawerAccessHandler: PayloadHandler = async (req): Promise<Response> => {
  const allowedRoles = ['superadmin', 'admin', 'manager', 'company', 'branch']
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: any = {}
    try {
      body = await req.json?.()
    } catch (_e) {}

    if (!body || Object.keys(body).length === 0) {
      if (req.url) {
        const url = new URL(req.url)
        body = {
          branchId: url.searchParams.get('branchId'),
        }
        const enabledParam = url.searchParams.get('enabled')
        if (enabledParam !== null) {
          body.enabled = enabledParam === 'true'
        }
      }
    }

    const branchId = body?.branchId || body?.id
    const enabled = body?.enabled !== undefined ? Boolean(body.enabled) : (body?.isCashDrawerEnabled !== undefined ? Boolean(body.isCashDrawerEnabled) : true)

    if (!branchId) {
      return Response.json({ message: 'Missing branchId parameter' }, { status: 400 })
    }

    // Retrieve branch
    const branch = await req.payload.findByID({
      collection: 'branches',
      id: branchId,
      depth: 0,
      overrideAccess: true,
    })

    if (!branch) {
      return Response.json({ message: 'Branch not found' }, { status: 404 })
    }

    // Role-based authorization check
    if (req.user.role === 'branch') {
      const userBranchId =
        typeof req.user.branch === 'string'
          ? req.user.branch
          : (req.user.branch as any)?.id || (req.user.branch as any)?._id
      if (userBranchId && String(userBranchId) !== String(branchId)) {
        return Response.json({ message: 'Forbidden: You cannot modify other branches' }, { status: 403 })
      }
    } else if (req.user.role === 'manager') {
      const managerCompanies = (req.user.manager_companies || []) as any[]
      const userCompanyIds = managerCompanies
        .map((c: any) => (typeof c === 'string' ? c : (c?.id || c?._id || '')))
        .concat(
          req.user.company
            ? [typeof req.user.company === 'string' ? req.user.company : (req.user.company?.id || (req.user.company as any)?._id || '')]
            : []
        )
        .filter(Boolean)
        .map(String)

      const branchCompanyId = String(
        typeof branch.company === 'string'
          ? branch.company
          : (branch.company as any)?.id || (branch.company as any)?._id || ''
      )

      if (userCompanyIds.length > 0 && branchCompanyId && !userCompanyIds.includes(branchCompanyId)) {
        return Response.json({ message: 'Forbidden: Branch does not belong to your assigned companies' }, { status: 403 })
      }
    } else if (req.user.role === 'company') {
      const comp = req.user.company
      const userCompanyId = String(
        typeof comp === 'string' ? comp : (comp?.id || (comp as any)?._id || '')
      )
      const branchCompanyId = String(
        typeof branch.company === 'string'
          ? branch.company
          : (branch.company as any)?.id || (branch.company as any)?._id || ''
      )
      if (userCompanyId && branchCompanyId && userCompanyId !== branchCompanyId) {
        return Response.json({ message: 'Forbidden: Branch does not belong to your company' }, { status: 403 })
      }
    }

    // Update branch cash drawer access
    const updatedBranch = await req.payload.update({
      collection: 'branches',
      id: branchId,
      data: {
        isCashDrawerEnabled: enabled,
      } as any,
      overrideAccess: true,
    })

    return Response.json({
      success: true,
      message: `Branch cash drawer opening access ${enabled ? 'enabled' : 'locked'} successfully`,
      branchId,
      isCashDrawerEnabled: updatedBranch.isCashDrawerEnabled,
    })
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to toggle branch cash drawer access',
    })
    return Response.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
