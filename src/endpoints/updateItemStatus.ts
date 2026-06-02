import { PayloadHandler } from 'payload'
import {
  publishBillingRealtimeEvent,
  type BillingRealtimePublishInput,
} from '@/realtime/wsGateway'

const hasOwnKey = (value: unknown, key: string): boolean =>
  Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key))

const parsePreparingTime = (value: unknown): number | null => {
  if (value == null) return null

  if (typeof value === 'string' && value.trim().length === 0) {
    return null
  }

  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new Error('Preparing time must be a non-negative whole number of minutes.')
  }

  return parsed
}

const parseNonNegativeInteger = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return 0
}

const normalizeStoredPreparingTime = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

const getRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (value && typeof value === 'object') {
    if ('id' in value) {
      const id = (value as { id?: unknown }).id
      if (typeof id === 'string' && id.trim().length > 0) return id.trim()
      if (typeof id === 'number' && Number.isFinite(id)) return String(id)
    }
    if ('_id' in value) {
      const id = (value as { _id?: unknown })._id
      if (typeof id === 'string' && id.trim().length > 0) return id.trim()
      if (typeof id === 'number' && Number.isFinite(id)) return String(id)
    }
  }

  return null
}

const toDisplayTime = (value: Date): string =>
  value.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
  })

export const updateItemStatus: PayloadHandler = async (req): Promise<Response> => {
  const { payload, json } = req
  const { id } = req.routeParams as { id: string }

  try {
    if (!json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }
    const body = await json()
    console.log('[updateItemStatus] Received body:', JSON.stringify(body))

    console.log(
      `[updateItemStatus] req.user: ${req.user ? JSON.stringify({ id: req.user.id, role: req.user.role }) : 'NULL'}`,
    )

    const actingUserID = (() => {
      if (req.user && typeof req.user === 'object' && 'id' in req.user && req.user.id) {
        return String(req.user.id)
      }
      if (body.actorUserId && String(body.actorUserId).trim().length > 0) {
        return String(body.actorUserId).trim()
      }
      return null
    })()

    console.log(`[updateItemStatus] Acting User ID resolved: ${actingUserID || 'NULL'}`)

    const itemId = body.itemId || body.id
    const status = typeof body.status === 'string' ? body.status.trim() : ''
    const hasStatusUpdate = status.length > 0
    const hasPreparingTimeUpdate =
      hasOwnKey(body, 'preparingTime') || hasOwnKey(body, 'preparationTime')
    const rawPreparingTime = hasOwnKey(body, 'preparingTime')
      ? body.preparingTime
      : body.preparationTime

    let parsedPreparingTime: number | null | undefined
    if (hasPreparingTimeUpdate) {
      try {
        parsedPreparingTime = parsePreparingTime(rawPreparingTime)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid preparing time.'
        return Response.json({ error: message }, { status: 400 })
      }
    }

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
    if (!hasStatusUpdate && !hasPreparingTimeUpdate) {
      return Response.json({ error: 'Missing status or preparingTime' }, { status: 400 })
    }

    // 1. Fetch the bill
    const bill = await payload.findByID({
      collection: 'billings',
      id,
      depth: 0,
      overrideAccess: true,
    })

    if (!bill) {
      return Response.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Fetch branch workflow settings
    const branchID = getRelationshipID((bill as { branch?: unknown }).branch)
    let branchWorkflow = { skipSupervisor: false, skipWaiter: false }
    if (branchID) {
      try {
        const branch = await payload.findByID({
          collection: 'branches',
          id: branchID,
          depth: 0,
          overrideAccess: true,
        })
        if (branch?.tableOrderWorkflow) {
          branchWorkflow = {
            skipSupervisor: !!branch.tableOrderWorkflow.skipSupervisor,
            skipWaiter: !!branch.tableOrderWorkflow.skipWaiter,
          }
        }
      } catch (error) {
        console.error('[updateItemStatus] Error fetching branch workflow:', error)
      }
    }

    // Define strict status sequence
    const statusSequence = ['ordered', 'prepared', 'confirmed', 'delivered']
    const normalizeStatus = (input?: string): string => {
      if (!input || input === 'pending') return 'ordered'
      if (input === 'preparing') return 'prepared'
      return input
    }

    const changeDate = new Date()
    const changedAtISO = changeDate.toISOString()
    const changedAtDisplay = toDisplayTime(changeDate)

    // 2. Find and update the item status
    let itemFound = false
    let itemChanged = false
    let transitionError: string | null = null
    let validationError: string | null = null

    let itemStatusBefore: string | null = null
    let itemStatusAfter: string | null = null
    let preparingTimeBefore: number | null = null
    let preparingTimeAfter: number | null = null
    let itemVersionAfter: number | null = null
    let itemUpdatedAt: string | null = null
    let itemProductID: string | null = null
    let itemSnapshotForEvent: Record<string, unknown> | null = null

    const updatedItems = (bill.items || []).map((item: any) => {
      if (item.id !== itemId) return item

      itemFound = true

      const currentStatus = normalizeStatus(item.status || 'ordered')
      const nextStatus = hasStatusUpdate ? normalizeStatus(status) : currentStatus
      const currentPreparingTime = normalizeStoredPreparingTime(item.preparingTime)
      const nextPreparingTime = hasPreparingTimeUpdate ? (parsedPreparingTime ?? null) : currentPreparingTime

      const statusChanged = hasStatusUpdate && nextStatus !== currentStatus
      const preparingTimeChanged = hasPreparingTimeUpdate && nextPreparingTime !== currentPreparingTime

      if (!statusChanged && !preparingTimeChanged) {
        return item
      }

      if (statusChanged && nextStatus !== 'cancelled') {
        const currentIndex = statusSequence.indexOf(currentStatus)
        const nextIndex = statusSequence.indexOf(nextStatus)

        if (currentIndex === -1) {
          transitionError = `Current status "${currentStatus}" is not in the valid sequence.`
        } else if (nextIndex === -1) {
          transitionError = `New status "${nextStatus}" is not in the valid sequence.`
        } else if (nextIndex !== currentIndex + 1) {
          transitionError = `Invalid transition: Cannot go from "${currentStatus}" to "${nextStatus}". Must follow: ${statusSequence.join(' -> ')}`
        }
      }

      const statusOwnerField =
        statusChanged && nextStatus === 'prepared'
          ? 'preparedBy'
          : statusChanged && nextStatus === 'confirmed'
            ? 'confirmedBy'
            : statusChanged && nextStatus === 'delivered'
              ? 'deliveredBy'
              : null

      if (statusOwnerField && !actingUserID) {
        validationError = `Missing user context. Cannot update status to "${nextStatus}" without an authenticated user or 'actorUserId' in request body.`
      }

      const nextItemVersion = parseNonNegativeInteger(item.itemVersion) + 1

      // Compute final status and auto-skipped values
      let finalStatus = nextStatus
      let autoConfirmed = false
      let autoDelivered = false

      if (statusChanged && nextStatus === 'prepared' && branchWorkflow.skipSupervisor) {
        autoConfirmed = true
        finalStatus = 'confirmed'
      }

      if (
        statusChanged &&
        (finalStatus === 'confirmed') &&
        branchWorkflow.skipWaiter
      ) {
        autoDelivered = true
        finalStatus = 'delivered'
      }

      const itemUpdateData: any = {
        ...item,
        status: hasStatusUpdate ? finalStatus : item.status,
        itemVersion: nextItemVersion,
        itemUpdatedAt: changedAtISO,
      }

      if (statusChanged) {
        itemUpdateData[`${nextStatus}At`] = changedAtDisplay
        if (statusOwnerField && actingUserID) {
          itemUpdateData[statusOwnerField] = actingUserID
          console.log(`[updateItemStatus] SETTING OWNER: item.${statusOwnerField} = ${actingUserID}`)
        }

        // Apply skipped status properties
        if (autoConfirmed) {
          itemUpdateData.confirmedAt = changedAtDisplay
          if (actingUserID) {
            itemUpdateData.confirmedBy = actingUserID
          }
          console.log(`[updateItemStatus] AUTO-SKIPPING SUPERVISOR: item.confirmedBy = ${actingUserID}`)
        }
        if (autoDelivered) {
          itemUpdateData.deliveredAt = changedAtDisplay
          if (actingUserID) {
            itemUpdateData.deliveredBy = actingUserID
          }
          console.log(`[updateItemStatus] AUTO-SKIPPING WAITER: item.deliveredBy = ${actingUserID}`)
        }
      }

      if (hasPreparingTimeUpdate) {
        itemUpdateData.preparingTime = nextPreparingTime
      }

      if (statusChanged && nextStatus === 'cancelled') {
        itemUpdateData.cancelledAt = changedAtDisplay
      }

      itemChanged = true
      itemStatusBefore = currentStatus
      itemStatusAfter = hasStatusUpdate ? finalStatus : currentStatus
      preparingTimeBefore = currentPreparingTime
      preparingTimeAfter = nextPreparingTime
      itemVersionAfter = nextItemVersion
      itemUpdatedAt = changedAtISO
      itemProductID = getRelationshipID(item.product)
      itemSnapshotForEvent = itemUpdateData as Record<string, unknown>

      console.log(`[updateItemStatus] SAVING ITEM DATA for ${itemId}:`, JSON.stringify(itemUpdateData))
      return itemUpdateData
    })

    if (!itemFound) {
      return Response.json({ error: 'Item not found in bill' }, { status: 404 })
    }

    if (transitionError) {
      return Response.json({ error: transitionError }, { status: 400 })
    }

    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 })
    }

    if (!itemChanged) {
      return Response.json(bill, { status: 200 })
    }

    const isTableOrderBill =
      hasTableOrderValue((bill as { section?: unknown }).section) ||
      hasTableOrderValue((bill as { tableNumber?: unknown }).tableNumber) ||
      hasTableOrderValue(
        (bill as { tableDetails?: { section?: unknown } | null }).tableDetails?.section,
      ) ||
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
    const allDelivered =
      activeStatuses.length > 0 && activeStatuses.every((itemStatus) => itemStatus === 'delivered')
    const allConfirmedOrDelivered =
      activeStatuses.length > 0 &&
      activeStatuses.every((itemStatus) => itemStatus === 'confirmed' || itemStatus === 'delivered')
    const allPreparedOrConfirmedOrDelivered =
      activeStatuses.length > 0 &&
      activeStatuses.every(
        (itemStatus) =>
          itemStatus === 'prepared' || itemStatus === 'confirmed' || itemStatus === 'delivered',
      )

    let nextBillStatus: 'ordered' | 'prepared' | 'confirmed' | 'delivered' | 'cancelled' | null = null

    if (!isBillFinalized) {
      if (allCancelled) {
        nextBillStatus = 'cancelled'
      } else if (isTableOrderBill) {
        if (allDelivered) {
          nextBillStatus = 'delivered'
        } else if (allConfirmedOrDelivered) {
          nextBillStatus = 'confirmed'
        } else if (allPreparedOrConfirmedOrDelivered) {
          nextBillStatus = 'prepared'
        } else {
          nextBillStatus = 'ordered'
        }
      }
    }

    const kitchenID =
      typeof body.kitchenId === 'string' && body.kitchenId.trim().length > 0
        ? body.kitchenId.trim()
        : null
    const currentRealtimeSeq = parseNonNegativeInteger((bill as { realtimeSeq?: unknown }).realtimeSeq)
    let nextRealtimeSeq = currentRealtimeSeq
    const allocateSeq = (): number => {
      nextRealtimeSeq += 1
      return nextRealtimeSeq
    }

    const currentBillStatus =
      typeof (bill as { status?: unknown }).status === 'string'
        ? normalizeStatus((bill as { status?: string }).status)
        : 'ordered'

    const realtimeEvents: BillingRealtimePublishInput[] = []
    const statusChanged = itemStatusBefore !== null && itemStatusAfter !== null && itemStatusBefore !== itemStatusAfter
    const preparingTimeChanged = preparingTimeBefore !== preparingTimeAfter
    const billStatusChanged = nextBillStatus !== null && nextBillStatus !== currentBillStatus

    if (branchID && itemUpdatedAt && itemVersionAfter !== null) {
      if (statusChanged) {
        realtimeEvents.push({
          eventId: `${id}:${String(itemId)}:v${itemVersionAfter}:status`,
          eventType: 'billing_item_status_changed',
          seq: allocateSeq(),
          branchId: branchID,
          kitchenId: kitchenID,
          billingId: id,
          itemId: String(itemId),
          productId: itemProductID,
          statusBefore: itemStatusBefore,
          statusAfter: itemStatusAfter,
          itemUpdatedAt,
          itemVersion: itemVersionAfter,
          itemSnapshot: itemSnapshotForEvent,
        })
      }

      if (preparingTimeChanged) {
        realtimeEvents.push({
          eventId: `${id}:${String(itemId)}:v${itemVersionAfter}:preparing-time`,
          eventType: 'billing_item_preparing_time_changed',
          seq: allocateSeq(),
          branchId: branchID,
          kitchenId: kitchenID,
          billingId: id,
          itemId: String(itemId),
          productId: itemProductID,
          statusBefore: itemStatusBefore,
          statusAfter: itemStatusAfter,
          itemUpdatedAt,
          itemVersion: itemVersionAfter,
          itemSnapshot: itemSnapshotForEvent,
        })
      }
    }

    if (branchID && billStatusChanged) {
      realtimeEvents.push({
        eventId: `${id}:bill-status:${nextBillStatus}:seq${nextRealtimeSeq + 1}`,
        eventType: 'billing_status_changed',
        seq: allocateSeq(),
        branchId: branchID,
        kitchenId: kitchenID,
        billingId: id,
        itemId: String(itemId),
        productId: itemProductID,
        statusBefore: currentBillStatus,
        statusAfter: nextBillStatus,
        itemUpdatedAt: itemUpdatedAt || changedAtISO,
        itemVersion: itemVersionAfter,
      })
    }

    // 3. Save the updated bill
    const updatedBill = await payload.update({
      collection: 'billings',
      id,
      data: {
        items: updatedItems,
        ...(nextBillStatus ? { status: nextBillStatus } : {}),
        ...(nextRealtimeSeq > currentRealtimeSeq ? { realtimeSeq: nextRealtimeSeq } : {}),
      },
      depth: 0,
      context: {
        actingUserID,
        skipOfferRecalculation: true,
        skipInventoryValidation: true,
        skipCustomerRewardProcessing: true,
        skipOfferCounterProcessing: true,
      },
      overrideAccess: true,
    })

    realtimeEvents.forEach((eventPayload) => {
      publishBillingRealtimeEvent(eventPayload)
    })

    return Response.json(updatedBill, { status: 200 })
  } catch (error) {
    console.error('Error updating item status:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
