import { PayloadHandler } from 'payload'

export const updateItemStatus: PayloadHandler = async (req): Promise<Response> => {
  const { payload, json } = req
  const { id } = req.routeParams as { id: string }
  const actingUserID =
    req.user && typeof req.user === 'object' && 'id' in req.user && req.user.id
      ? String(req.user.id)
      : null

  try {
    if (!json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }
    const body = await json()
    console.log('[updateItemStatus] Received body:', body)

    const itemId = body.itemId || body.id
    const status = body.status

    const hasTableOrderValue = (value: unknown): boolean => {
      if (value == null) return false
      if (typeof value === 'string') return value.trim().length > 0
      if (typeof value === 'number') return Number.isFinite(value)
      if (typeof value === 'boolean') return value
      return true
    }

    if (!itemId) {
      return Response.json({ error: 'Missing itemId (or id)' }, { status: 400 })
    }
    if (!status) {
      return Response.json({ error: 'Missing status' }, { status: 400 })
    }

    // 1. Fetch the bill
    const bill = await payload.findByID({
      collection: 'billings',
      id,
      depth: 0,
      overrideAccess: true, // 🔓 Bypass access control to get full data publicly
    })

    if (!bill) {
      return Response.json({ error: 'Bill not found' }, { status: 404 })
    }

    // 🚦 Define strict status sequence
    const statusSequence = ['ordered', 'prepared', 'delivered']
    const normalizeStatus = (input?: string) => {
      if (!input || input === 'pending') return 'ordered'
      if (input === 'preparing' || input === 'confirmed') return 'prepared'
      return input
    }

    // 2. Find and update the item status
    let itemFound = false
    let transitionError: string | null = null

    const updatedItems = (bill.items || []).map((item: any) => {
      if (item.id === itemId) {
        itemFound = true

        const currentStatus = normalizeStatus(item.status || 'ordered')
        const newStatus = normalizeStatus(status)
        const now = new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
        })

        // ✅ Allow 'cancelled' at any time
        if (newStatus === 'cancelled') {
          return {
            ...item,
            status: newStatus,
            cancelledAt: now,
          }
        }

        // 🛑 Validate linear transition
        const currentIndex = statusSequence.indexOf(currentStatus)
        const newIndex = statusSequence.indexOf(newStatus)

        if (currentIndex === -1) {
          transitionError = `Current status "${currentStatus}" is not in the valid sequence.`
        } else if (newIndex === -1) {
          transitionError = `New status "${newStatus}" is not in the valid sequence.`
        } else if (newIndex !== currentIndex + 1) {
          transitionError = `Invalid transition: Cannot go from "${currentStatus}" to "${newStatus}". Must follow: ${statusSequence.join(' -> ')}`
        }

        return {
          ...item,
          status: newStatus,
          [`${newStatus}At`]: now,
          ...(newStatus === 'prepared' && actingUserID ? { preparedBy: actingUserID } : {}),
        }
      }
      return item
    })

    if (!itemFound) {
      return Response.json({ error: 'Item not found in bill' }, { status: 404 })
    }

    if (transitionError) {
      return Response.json({ error: transitionError }, { status: 400 })
    }

    const isTableOrderBill =
      hasTableOrderValue((bill as { section?: unknown }).section) ||
      hasTableOrderValue((bill as { tableNumber?: unknown }).tableNumber) ||
      hasTableOrderValue((bill as { tableDetails?: { section?: unknown } | null }).tableDetails?.section) ||
      hasTableOrderValue(
        (bill as { tableDetails?: { tableNumber?: unknown } | null }).tableDetails?.tableNumber,
      )

    const normalizedUpdatedItemStatuses = updatedItems
      .filter((item): item is { status?: string } => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeStatus(item.status))
    const isBillFinalized =
      (bill as { status?: unknown }).status === 'completed' ||
      (bill as { status?: unknown }).status === 'settled'

    const allCancelled =
      normalizedUpdatedItemStatuses.length > 0 &&
      normalizedUpdatedItemStatuses.every((itemStatus) => itemStatus === 'cancelled')

    const activeStatuses = normalizedUpdatedItemStatuses.filter((itemStatus) => itemStatus !== 'cancelled')
    const allDelivered = activeStatuses.length > 0 && activeStatuses.every((itemStatus) => itemStatus === 'delivered')
    const allPreparedOrDelivered =
      activeStatuses.length > 0 &&
      activeStatuses.every((itemStatus) => itemStatus === 'prepared' || itemStatus === 'delivered')

    let nextBillStatus: 'ordered' | 'prepared' | 'delivered' | 'cancelled' | null = null

    if (!isBillFinalized) {
      if (allCancelled) {
        nextBillStatus = 'cancelled'
      } else if (isTableOrderBill) {
        if (allDelivered) {
          nextBillStatus = 'delivered'
        } else if (allPreparedOrDelivered) {
          nextBillStatus = 'prepared'
        } else {
          nextBillStatus = 'ordered'
        }
      }
    }

    // 3. Save the updated bill
    const updatedBill = await payload.update({
      collection: 'billings',
      id,
      data: {
        items: updatedItems,
        ...(nextBillStatus ? { status: nextBillStatus } : {}),
      },
      context: {
        // Status-only updates should not rerun offer/reward/inventory workflows.
        skipOfferRecalculation: true,
        skipInventoryValidation: true,
        skipCustomerRewardProcessing: true,
        skipOfferCounterProcessing: true,
      },
      overrideAccess: true, // 🔓 Bypass access control to preserve all fields publicly
    })

    return Response.json(updatedBill, { status: 200 })
  } catch (error) {
    console.error('Error updating item status:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
