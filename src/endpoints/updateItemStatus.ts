import { PayloadHandler } from 'payload'

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

export const updateItemStatus: PayloadHandler = async (req): Promise<Response> => {
  const { payload, json } = req
  const { id } = req.routeParams as { id: string }

  try {
    if (!json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }
    const body = await json()
    console.log('[updateItemStatus] Received body:', JSON.stringify(body))

    console.log(`[updateItemStatus] req.user: ${req.user ? JSON.stringify({ id: req.user.id, role: req.user.role }) : 'NULL'}`)

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

    // 🚦 Define strict status sequence
    const statusSequence = ['ordered', 'prepared', 'confirmed', 'delivered']
    const normalizeStatus = (input?: string) => {
      if (!input || input === 'pending') return 'ordered'
      if (input === 'preparing') return 'prepared'
      return input
    }

    // 2. Find and update the item status
    let itemFound = false
    let transitionError: string | null = null
    let validationError: string | null = null

    const updatedItems = (bill.items || []).map((item: any) => {
      if (item.id === itemId) {
        itemFound = true

        const currentStatus = normalizeStatus(item.status || 'ordered')
        const newStatus = hasStatusUpdate ? normalizeStatus(status) : currentStatus
        const now = new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
        })

        // Allow same-status updates when kitchen only updates preparing time.
        if (hasStatusUpdate && newStatus === currentStatus && hasPreparingTimeUpdate) {
          return {
            ...item,
            preparingTime: parsedPreparingTime,
          }
        }

        // ✅ Allow 'cancelled' at any time
        if (hasStatusUpdate && newStatus === 'cancelled') {
          return {
            ...item,
            status: newStatus,
            cancelledAt: now,
            ...(hasPreparingTimeUpdate ? { preparingTime: parsedPreparingTime } : {}),
          }
        }

        if (hasStatusUpdate) {
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
        }

        const statusOwnerField =
          newStatus === 'prepared'
            ? 'preparedBy'
            : newStatus === 'confirmed'
              ? 'confirmedBy'
              : newStatus === 'delivered'
                ? 'deliveredBy'
                : null

        // Strict fix: Reject if missing user context
        if (hasStatusUpdate && statusOwnerField && !actingUserID) {
          validationError = `Missing user context. Cannot update status to "${newStatus}" without an authenticated user or 'actorUserId' in request body.`
        }

        const itemUpdateData: any = {
          ...item,
          status: hasStatusUpdate ? newStatus : item.status,
        }

        if (hasStatusUpdate) {
          itemUpdateData[`${newStatus}At`] = now
          if (statusOwnerField && actingUserID) {
            itemUpdateData[statusOwnerField] = actingUserID
            console.log(
              `[updateItemStatus] SETTING OWNER: item.${statusOwnerField} = ${actingUserID}`,
            )
          }
        }

        if (hasPreparingTimeUpdate) {
          itemUpdateData.preparingTime = parsedPreparingTime
        }

        console.log(`[updateItemStatus] SAVING ITEM DATA for ${itemId}:`, JSON.stringify(itemUpdateData))
        return itemUpdateData
      }
      return item
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

    // 3. Save the updated bill
    const updatedBill = await payload.update({
      collection: 'billings',
      id,
      data: {
        items: updatedItems,
        ...(nextBillStatus ? { status: nextBillStatus } : {}),
      },
      depth: 0, // ⚡️ Use depth 0 to avoid any relationship stripping/bloating
      context: {
        actingUserID,
        skipOfferRecalculation: true,
        skipInventoryValidation: true,
        skipCustomerRewardProcessing: true,
        skipOfferCounterProcessing: true,
      },
      overrideAccess: true,
    })

    return Response.json(updatedBill, { status: 200 })
  } catch (error) {
    console.error('Error updating item status:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
