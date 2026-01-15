import { PayloadHandler } from 'payload'

export const updateInstockStatusHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { entryId, itemId, status, updateAll } = await (req as any).json()

    if (!entryId || (!itemId && !updateAll) || !status) {
      return Response.json({ message: 'Missing required fields' }, { status: 400 })
    }

    // 1. Fetch the entry
    const entry = await req.payload.findByID({
      collection: 'instock-entries',
      id: entryId,
      depth: 0,
    })

    if (!entry) {
      return Response.json({ message: 'Entry not found' }, { status: 404 })
    }

    // 2. Find and update items
    const items = entry.items || []

    if (updateAll) {
      // Bulk Update
      items.forEach((item: any) => {
        item.status = status
      })
    } else {
      // Single Item Update
      const itemIndex = items.findIndex((item: any) => item.id === itemId)

      if (itemIndex === -1) {
        return Response.json({ message: 'Item not found' }, { status: 404 })
      }

      items[itemIndex].status = status
    }

    // 3. Update top-level status
    // If all items are approved, set top-level to approved. Otherwise waiting.
    const allApproved = items.every((item: any) => item.status === 'approved')
    const parentStatus = allApproved ? 'approved' : 'waiting'

    // 4. Save changes
    await req.payload.update({
      collection: 'instock-entries',
      id: entryId,
      data: {
        items,
        status: parentStatus,
      },
      // Note: By default, local API operations have full access.
      // If we wanted to enforce user permissions, we'd pass user: req.user and overrideAccess: false.
      // Here we assume if they can hit this endpoint (authenticated), let's allow it for now,
      // or strictly generally this report is for admins/supervisors anyway.
    })

    return Response.json({ message: 'Status updated', parentStatus })
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ message: 'Error updating status' }, { status: 500 })
  }
}
