import { PayloadHandler } from 'payload'

export const updateFavoriteCategoryRuleCategoriesHandler: PayloadHandler = async (req): Promise<Response> => {
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

    const { ruleId, categories } = body

    if (!ruleId) {
      return Response.json({ message: 'Missing ruleId parameter' }, { status: 400 })
    }

    if (!Array.isArray(categories)) {
      return Response.json({ message: 'categories parameter must be an array' }, { status: 400 })
    }

    const widgetSettings = await req.payload.findGlobal({
      slug: 'widget-settings',
      depth: 0,
    })

    const rules: any[] = (widgetSettings.favoriteCategoriesByBranchRules as any[]) || []
    
    const ruleIndex = rules.findIndex((r: any) => r.id === ruleId)
    if (ruleIndex === -1) {
      return Response.json({ message: 'Rule not found' }, { status: 404 })
    }

    // Update categories for the rule
    rules[ruleIndex].categories = categories

    await req.payload.updateGlobal({
      slug: 'widget-settings',
      data: {
        favoriteCategoriesByBranchRules: rules,
      },
    })

    return Response.json({ message: 'Favorite category rule updated successfully', rule: rules[ruleIndex] })
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to update favorite category rule',
    })
    return Response.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
