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

    const widgetSettings = (await req.payload.findGlobal({
      slug: 'widget-settings',
      depth: 0,
      overrideAccess: true,
    })) as {
      tableOrderCustomerDetailsByBranch?: Array<{
        branch?: unknown
        showCustomerDetailsForTableOrders?: unknown
        allowSkipCustomerDetailsForTableOrders?: unknown
        showCustomerHistoryForTableOrders?: unknown
        autoSubmitCustomerDetailsForTableOrders?: unknown
      }>
      billingOrderCustomerDetailsByBranch?: Array<{
        branch?: unknown
        showCustomerDetailsForBillingOrders?: unknown
        allowSkipCustomerDetailsForBillingOrders?: unknown
        showCustomerHistoryForBillingOrders?: unknown
        autoSubmitCustomerDetailsForBillingOrders?: unknown
      }>
    }

    const tableRows = Array.isArray(widgetSettings?.tableOrderCustomerDetailsByBranch)
      ? widgetSettings.tableOrderCustomerDetailsByBranch
      : []

    const tableRow = tableRows.find(
      (candidate) => getRelationshipID(candidate?.branch) === branchID,
    )
    const showCustomerDetailsForTableOrders =
      typeof tableRow?.showCustomerDetailsForTableOrders === 'boolean'
        ? tableRow.showCustomerDetailsForTableOrders
        : true
    const allowSkipCustomerDetailsForTableOrders =
      typeof tableRow?.allowSkipCustomerDetailsForTableOrders === 'boolean'
        ? tableRow.allowSkipCustomerDetailsForTableOrders
        : true
    const showCustomerHistoryForTableOrders =
      typeof tableRow?.showCustomerHistoryForTableOrders === 'boolean'
        ? tableRow.showCustomerHistoryForTableOrders
        : true
    const autoSubmitCustomerDetailsForTableOrders =
      typeof tableRow?.autoSubmitCustomerDetailsForTableOrders === 'boolean'
        ? tableRow.autoSubmitCustomerDetailsForTableOrders
        : true

    const billingRows = Array.isArray(widgetSettings?.billingOrderCustomerDetailsByBranch)
      ? widgetSettings.billingOrderCustomerDetailsByBranch
      : []

    const billingRow = billingRows.find(
      (candidate) => getRelationshipID(candidate?.branch) === branchID,
    )
    const showCustomerDetailsForBillingOrders =
      typeof billingRow?.showCustomerDetailsForBillingOrders === 'boolean'
        ? billingRow.showCustomerDetailsForBillingOrders
        : true
    const allowSkipCustomerDetailsForBillingOrders =
      typeof billingRow?.allowSkipCustomerDetailsForBillingOrders === 'boolean'
        ? billingRow.allowSkipCustomerDetailsForBillingOrders
        : true
    const showCustomerHistoryForBillingOrders =
      typeof billingRow?.showCustomerHistoryForBillingOrders === 'boolean'
        ? billingRow.showCustomerHistoryForBillingOrders
        : true
    const autoSubmitCustomerDetailsForBillingOrders =
      typeof billingRow?.autoSubmitCustomerDetailsForBillingOrders === 'boolean'
        ? billingRow.autoSubmitCustomerDetailsForBillingOrders
        : true

    return Response.json({
      branchId: branchID,
      showCustomerDetailsForTableOrders,
      allowSkipCustomerDetailsForTableOrders,
      showCustomerHistoryForTableOrders,
      autoSubmitCustomerDetailsForTableOrders,
      showCustomerDetailsForBillingOrders,
      allowSkipCustomerDetailsForBillingOrders,
      showCustomerHistoryForBillingOrders,
      autoSubmitCustomerDetailsForBillingOrders,
      source: tableRow || billingRow ? 'branch-specific' : 'default',
    })
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json(
      { message: 'Failed to resolve customer details visibility' },
      { status: 500 },
    )
  }
}
