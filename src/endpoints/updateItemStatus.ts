import { PayloadHandler } from 'payload'

export const updateItemStatus: PayloadHandler = async (req): Promise<Response> => {
  const { payload, json } = req
  const { id } = req.routeParams as { id: string }

  try {
    if (!json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }
    const body = await json()
    console.log('[updateItemStatus] Received body:', body)

    const itemId = body.itemId || body.id
    const status = body.status

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
    const statusSequence = ['ordered', 'confirmed', 'prepared', 'delivered']

    // 2. Find and update the item status
    let itemFound = false
    let transitionError: string | null = null

    const updatedItems = (bill.items || []).map((item: any) => {
      if (item.id === itemId) {
        itemFound = true

        const currentStatus = item.status || 'ordered'
        const newStatus = status

        // ✅ Allow 'cancelled' at any time
        if (newStatus === 'cancelled') {
          return { ...item, status: newStatus }
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

    // 3. Save the updated bill
    const updatedBill = await payload.update({
      collection: 'billings',
      id,
      data: {
        items: updatedItems,
      },
      overrideAccess: true, // 🔓 Bypass access control to preserve all fields publicly
    })

    return Response.json(updatedBill, { status: 200 })
  } catch (error) {
    console.error('Error updating item status:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
