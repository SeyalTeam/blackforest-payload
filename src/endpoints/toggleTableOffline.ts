import { PayloadHandler } from 'payload'

export const toggleTableOfflineHandler: PayloadHandler = async (req): Promise<Response> => {
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
        isOffline: url.searchParams.get('isOffline') === 'true',
      }
    }

    const { branchId, sectionName, tableNumber, isOffline } = body

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
        // Robust conversion of any legacy offlineTables format to a clean string array
        const rawOffline = Array.isArray(sec.offlineTables) ? sec.offlineTables : []
        const currentOffline = rawOffline
          .map((val: any) => {
            if (typeof val === 'string') return val.trim()
            if (typeof val === 'number') return String(val)
            if (val && typeof val === 'object') {
              const num = val.tableNumber ?? val.table ?? val.tableNo
              if (typeof num === 'string') return num.trim()
              if (typeof num === 'number') return String(num)
            }
            return ''
          })
          .filter(Boolean)

        const isCurrentlyOffline = currentOffline.includes(tableNumber)
        let nextOffline: string[]
        
        // If isOffline is provided explicitly as a boolean
        if (typeof isOffline === 'boolean') {
          if (isOffline) {
            nextOffline = isCurrentlyOffline ? currentOffline : [...currentOffline, tableNumber]
          } else {
            nextOffline = currentOffline.filter((val: any) => val !== tableNumber)
          }
        } else {
          // Fallback to simple toggle
          if (isCurrentlyOffline) {
            nextOffline = currentOffline.filter((val: any) => val !== tableNumber)
          } else {
            nextOffline = [...currentOffline, tableNumber]
          }
        }

        return {
          ...sec,
          offlineTables: nextOffline,
        }
      }
      return sec
    })

    await req.payload.update({
      collection: 'tables',
      id: tableConfig.id,
      data: {
        sections: updatedSections,
      },
      overrideAccess: true,
    })

    return Response.json({ message: 'Table offline status updated successfully' })
  } catch (error: any) {
    console.error('Error toggling table offline status:', error)
    return Response.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
