import { PayloadHandler, PayloadRequest } from 'payload'

export const resetInventoryHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  try {
    const { branch, department, category, product } = await req.json()

    if (!branch || branch === 'all') {
      return Response.json({ error: 'Branch is required for reset' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // 1. Fetch matching products
    const query: any = {}
    if (department && department !== 'all') query.department = department
    if (category && category !== 'all') query.category = category
    if (product && product !== 'all') query.id = product

    const productsResult = await payload.find({
      collection: 'products',
      where: query,
      limit: 1000,
      pagination: false,
    })

    const productIds = productsResult.docs.map((p) => p.id)

    if (productIds.length === 0) {
      return Response.json({ error: 'No products found matching filters' }, { status: 404 })
    }

    // 2. Fetch the branch
    const branchDoc = await payload.findByID({
      collection: 'branches',
      id: branch,
    })

    if (!branchDoc) {
      return Response.json({ error: 'Branch not found' }, { status: 404 })
    }

    // 3. Update resets
    if (!department && !category && !product) {
      // Global branch reset
      await payload.update({
        collection: 'branches',
        id: branch,
        data: {
          inventoryResetDate: now,
          productResets: [], // Clear granular resets as global overrides all
        },
      })
    } else {
      // Granular reset
      const currentResets = branchDoc.productResets || []
      const newResets = [...currentResets]

      productIds.forEach((pid) => {
        const existingIndex = newResets.findIndex(
          (r) => (typeof r.product === 'string' ? r.product : r.product.id) === pid,
        )
        if (existingIndex > -1) {
          newResets[existingIndex].resetDate = now
        } else {
          newResets.push({
            product: pid,
            resetDate: now,
          })
        }
      })

      await payload.update({
        collection: 'branches',
        id: branch,
        data: {
          productResets: newResets,
        },
      })
    }

    return Response.json({
      success: true,
      message: `Reset successful for ${productIds.length} products in branch ${branchDoc.name}`,
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json(
      {
        error: 'Failed to reset inventory',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
