import { PayloadHandler } from 'payload'

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

  if (
    value &&
    typeof value === 'object' &&
    '_id' in value &&
    (typeof (value as { _id?: unknown })._id === 'string' ||
      typeof (value as { _id?: unknown })._id === 'number')
  ) {
    return String((value as { _id: string | number })._id)
  }

  return null
}

export const allocateTableWaiterHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    let body: any
    try {
      body = await req.json?.()
    } catch (_e) {}

    if (!body) {
      const url = new URL(req.url!)
      body = {
        branchId: url.searchParams.get('branchId'),
        sectionName: url.searchParams.get('sectionName'),
        tableNumber: url.searchParams.get('tableNumber'),
        waiterId: url.searchParams.get('waiterId'),
      }
    }

    const { branchId, sectionName, tableNumber, waiterId } = body

    if (!branchId || !sectionName || !tableNumber) {
      return Response.json({ message: 'Missing required fields' }, { status: 400 })
    }

    // Find the table config document for this branch
    const tableConfigResult = await req.payload.find({
      collection: 'tables',
      where: {
        branch: { equals: branchId },
      },
      depth: 0,
      overrideAccess: true,
    })

    if (tableConfigResult.totalDocs === 0) {
      return Response.json({ message: 'Table configuration not found for this branch.' }, { status: 404 })
    }

    const tableConfig = tableConfigResult.docs[0]

    // Clone and update sections
    const updatedSections = (tableConfig.sections || []).map((sec: any) => {
      const isMatch = typeof sec.name === 'string' &&
        sec.name.trim().toLowerCase() === sectionName.trim().toLowerCase()
      if (isMatch) {
        const currentAllocations = Array.isArray(sec.waiterAllocations) ? sec.waiterAllocations : []
        const cleanedAllocations = currentAllocations
          .map((alloc: any) => {
            if (typeof alloc === 'string') {
              const parts = alloc.split('-')
              const tNum = parts[0]?.trim()
              const wId = parts.slice(1).join('-')?.trim()
              return { tableNumber: tNum, waiterId: wId }
            }
            const tNum = typeof alloc?.tableNumber === 'string'
              ? alloc.tableNumber.trim()
              : typeof alloc?.tableNumber === 'number'
                ? String(alloc.tableNumber)
                : ''
            const wId = getRelationshipID(alloc?.waiter)
            return { tableNumber: tNum, waiterId: wId }
          })
          .filter((alloc: any) => alloc.tableNumber && alloc.tableNumber !== tableNumber)

        if (waiterId) {
          cleanedAllocations.push({ tableNumber, waiterId })
        }

        const dbAllocations = cleanedAllocations.map((alloc: any) => ({
          tableNumber: alloc.tableNumber,
          waiter: alloc.waiterId,
        }))

        return {
          ...sec,
          waiterAllocations: dbAllocations,
        }
      }
      return sec
    })

    // Perform local update with overrideAccess: true to bypass restriction
    const result = await req.payload.update({
      collection: 'tables',
      id: tableConfig.id,
      data: {
        sections: updatedSections,
      },
      overrideAccess: true,
    })

    return Response.json({
      message: 'Waiter allocated successfully',
      doc: result,
    })
  } catch (error: any) {
    req.payload.logger.error(error)
    return Response.json({ message: error.message || 'Failed to allocate waiter' }, { status: 500 })
  }
}
