import { PayloadHandler } from 'payload'

export const toggleFavoriteCategoryRuleHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user || (req.user.role !== 'branch' && req.user.role !== 'superadmin')) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: any
    try {
      body = await req.json?.()
    } catch (_e) {}

    if (!body) {
      const url = new URL(req.url!)
      body = {
        ruleId: url.searchParams.get('ruleId'),
      }
      const enabledParam = url.searchParams.get('enabled')
      if (enabledParam !== null) {
        body.enabled = enabledParam === 'true'
      }
    }

    const { ruleId, enabled } = body

    if (!ruleId) {
      return Response.json({ message: 'Missing ruleId parameter' }, { status: 400 })
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

    // Toggle global enabled state for the rule
    rules[ruleIndex].enabled = enabled === undefined ? !rules[ruleIndex].enabled : Boolean(enabled)

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
      msg: 'Failed to toggle favorite category rule status',
    })
    return Response.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
