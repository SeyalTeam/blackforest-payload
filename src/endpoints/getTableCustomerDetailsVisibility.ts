import type { PayloadHandler } from 'payload'

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

  return null
}

export const getTableCustomerDetailsVisibilityHandler: PayloadHandler = async (
  req,
): Promise<Response> => {
  try {
    const url = new URL(req.url || 'http://localhost')
    const queryBranchID = url.searchParams.get('branchId')

    const userBranchID =
      req.user && typeof req.user === 'object' && 'branch' in req.user
        ? getRelationshipID((req.user as { branch?: unknown }).branch)
        : null

    const branchID = queryBranchID || userBranchID

    if (!branchID) {
      return Response.json(
        { message: 'branchId is required when user branch is unavailable' },
        { status: 400 },
      )
    }

    const automateSettings = (await req.payload.findGlobal({
      slug: 'automate-settings',
      depth: 0,
      overrideAccess: true,
    })) as {
      tableOrderCustomerDetailsByBranch?: Array<{
        branch?: unknown
        showCustomerDetailsForTableOrders?: unknown
        allowSkipCustomerDetailsForTableOrders?: unknown
      }>
    }

    const rows = Array.isArray(automateSettings?.tableOrderCustomerDetailsByBranch)
      ? automateSettings.tableOrderCustomerDetailsByBranch
      : []

    const row = rows.find((candidate) => getRelationshipID(candidate?.branch) === branchID)
    const showCustomerDetailsForTableOrders =
      typeof row?.showCustomerDetailsForTableOrders === 'boolean'
        ? row.showCustomerDetailsForTableOrders
        : true
    const allowSkipCustomerDetailsForTableOrders =
      typeof row?.allowSkipCustomerDetailsForTableOrders === 'boolean'
        ? row.allowSkipCustomerDetailsForTableOrders
        : true

    return Response.json({
      branchId: branchID,
      showCustomerDetailsForTableOrders,
      allowSkipCustomerDetailsForTableOrders,
      source: row ? 'branch-specific' : 'default',
    })
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json(
      { message: 'Failed to resolve table customer details visibility' },
      { status: 500 },
    )
  }
}
