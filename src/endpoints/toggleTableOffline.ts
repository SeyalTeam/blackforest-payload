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

    const { branchId, sectionName, tableNumber, isOffline, tables } = body

    if (!branchId || typeof isOffline !== 'boolean') {
      return Response.json({ message: 'Missing branchId or isOffline parameter' }, { status: 400 })
    }

    // Determine the list of tables to process
    let tablesToProcess: Array<{ sectionName: string, tableNumber: string }> = []
    if (Array.isArray(tables)) {
      for (const t of tables) {
        if (t && typeof t.sectionName === 'string' && typeof t.tableNumber === 'string') {
          tablesToProcess.push({
            sectionName: t.sectionName.trim(),
            tableNumber: t.tableNumber.trim(),
          })
        }
      }
    } else if (sectionName && tableNumber) {
      tablesToProcess.push({
        sectionName: String(sectionName).trim(),
        tableNumber: String(tableNumber).trim(),
      })
    }

    if (tablesToProcess.length === 0) {
      return Response.json({ message: 'No tables specified for update' }, { status: 400 })
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
      const rawOffline = Array.isArray(sec.offlineTables) ? sec.offlineTables : []
      let currentOffline = rawOffline
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

      // Find all update instructions for this specific section
      const updatesForThisSection = tablesToProcess.filter(
        (t) => t.sectionName.trim().toLowerCase() === (sec.name || '').trim().toLowerCase()
      )

      if (updatesForThisSection.length > 0) {
        for (const update of updatesForThisSection) {
          const isCurrentlyOffline = currentOffline.includes(update.tableNumber)
          if (isOffline) {
            if (!isCurrentlyOffline) {
              currentOffline.push(update.tableNumber)
            }
          } else {
            currentOffline = currentOffline.filter((val: any) => val !== update.tableNumber)
          }
        }
        return {
          ...sec,
          offlineTables: currentOffline,
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
