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
      skipDeliverByBranch?: Array<{
        branch?: unknown
        skipDeliver?: unknown
        waiterSelectionType?: unknown
        waiters?: unknown
      }>
      skipConfirmByBranch?: Array<{
        branch?: unknown
        skipConfirm?: unknown
        waiterSelectionType?: unknown
        waiters?: unknown
      }>
      categoryDelayByBranch?: Array<{
        branch?: unknown
        delayMinutes?: unknown
        applyToBilling?: unknown
        applyToTable?: unknown
        waiterSelectionType?: unknown
        waiters?: unknown
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

    const skipDeliverRows = Array.isArray(widgetSettings?.skipDeliverByBranch)
      ? widgetSettings.skipDeliverByBranch
      : []

    const skipDeliverRow = skipDeliverRows.find(
      (candidate) => getRelationshipID(candidate?.branch) === branchID,
    )
    const skipDeliver =
      typeof skipDeliverRow?.skipDeliver === 'boolean'
        ? skipDeliverRow.skipDeliver
        : false
    const skipDeliverWaiterSelectionType =
      typeof skipDeliverRow?.waiterSelectionType === 'string'
        ? skipDeliverRow.waiterSelectionType
        : 'all'
    const skipDeliverWaiters =
      Array.isArray(skipDeliverRow?.waiters)
        ? skipDeliverRow.waiters.map((w) => getRelationshipID(w)).filter(Boolean)
        : []

    const skipConfirmRows = Array.isArray(widgetSettings?.skipConfirmByBranch)
      ? widgetSettings.skipConfirmByBranch
      : []

    const skipConfirmRow = skipConfirmRows.find(
      (candidate) => getRelationshipID(candidate?.branch) === branchID,
    )
    const skipConfirm =
      typeof skipConfirmRow?.skipConfirm === 'boolean'
        ? skipConfirmRow.skipConfirm
        : false
    const skipConfirmWaiterSelectionType =
      typeof skipConfirmRow?.waiterSelectionType === 'string'
        ? skipConfirmRow.waiterSelectionType
        : 'all'
    const skipConfirmWaiters =
      Array.isArray(skipConfirmRow?.waiters)
        ? skipConfirmRow.waiters.map((w) => getRelationshipID(w)).filter(Boolean)
        : []

    const categoryDelayRows = Array.isArray(widgetSettings?.categoryDelayByBranch)
      ? widgetSettings.categoryDelayByBranch
      : []

    const categoryDelayRow = categoryDelayRows.find(
      (candidate) => getRelationshipID(candidate?.branch) === branchID,
    )
    const delayMinutes =
      typeof categoryDelayRow?.delayMinutes === 'number'
        ? categoryDelayRow.delayMinutes
        : 0
    const applyToBilling =
      typeof categoryDelayRow?.applyToBilling === 'boolean'
        ? categoryDelayRow.applyToBilling
        : true
    const applyToTable =
      typeof categoryDelayRow?.applyToTable === 'boolean'
        ? categoryDelayRow.applyToTable
        : true
    const waiterSelectionType =
      typeof categoryDelayRow?.waiterSelectionType === 'string'
        ? categoryDelayRow.waiterSelectionType
        : 'all'
    const waiters =
      Array.isArray(categoryDelayRow?.waiters)
        ? categoryDelayRow.waiters.map((w) => getRelationshipID(w)).filter(Boolean)
        : []

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
      skipDeliver,
      skipDeliverWaiterSelectionType,
      skipDeliverWaiters,
      skipConfirm,
      skipConfirmWaiterSelectionType,
      skipConfirmWaiters,
      delayMinutes,
      applyToBilling,
      applyToTable,
      waiterSelectionType,
      waiters,
      source: tableRow || billingRow || skipDeliverRow || skipConfirmRow || categoryDelayRow ? 'branch-specific' : 'default',
    })
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json(
      { message: 'Failed to resolve customer details visibility' },
      { status: 500 },
    )
  }
}
