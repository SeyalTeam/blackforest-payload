import type { PayloadHandler } from 'payload'

export const resetOtherProductStockHandler: PayloadHandler = async (req) => {
  try {
    const { branchId, productId } = await req.json()

    if (!branchId || !productId) {
      return Response.json({ error: 'Branch ID and Product ID are required' }, { status: 400 })
    }

    const { payload } = req

    // Fetch the product
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
    })

    if (!product) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    const existingResets = Array.isArray(product.otherProductsResetDates)
      ? product.otherProductsResetDates
      : []

    // Update existing or add new
    const branchIndex = existingResets.findIndex((r: any) => {
      const rBranchId = typeof r.branch === 'string' ? r.branch : r.branch?.id || r.branch
      return rBranchId === branchId
    })

    if (branchIndex >= 0) {
      existingResets[branchIndex].resetDate = new Date().toISOString()
    } else {
      existingResets.push({
        branch: branchId,
        resetDate: new Date().toISOString(),
      })
    }

    // Save product
    await payload.update({
      collection: 'products',
      id: productId,
      data: {
        otherProductsResetDates: existingResets,
      },
    })

    return Response.json({ success: true })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Error resetting other product stock' })
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    )
  }
}
