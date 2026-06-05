import { PayloadHandler } from 'payload'

export const updateFavoriteRuleProductsHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user || (req.user.role !== 'branch' && req.user.role !== 'superadmin')) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: any
    try {
      body = await req.json?.()
    } catch (_e) {}

    if (!body) {
      return Response.json({ message: 'Missing request body' }, { status: 400 })
    }

    const { ruleId, products } = body

    if (!ruleId) {
      return Response.json({ message: 'Missing ruleId parameter' }, { status: 400 })
    }

    if (!Array.isArray(products)) {
      return Response.json({ message: 'products parameter must be an array' }, { status: 400 })
    }

    const widgetSettings = await req.payload.findGlobal({
      slug: 'widget-settings',
      depth: 0,
    })

    const rules: any[] = (widgetSettings.favoriteProductsByBranchRules as any[]) || []
    
    const ruleIndex = rules.findIndex((r: any) => r.id === ruleId)
    if (ruleIndex === -1) {
      return Response.json({ message: 'Rule not found' }, { status: 404 })
    }

    // Update products for the rule
    rules[ruleIndex].products = products

    await req.payload.updateGlobal({
      slug: 'widget-settings',
      data: {
        favoriteProductsByBranchRules: rules,
      },
    })

    return Response.json({ message: 'Favorite rule products updated successfully', rule: rules[ruleIndex] })
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to update favorite rule products',
    })
    return Response.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
