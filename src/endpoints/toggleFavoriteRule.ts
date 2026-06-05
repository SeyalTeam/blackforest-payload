import { PayloadHandler } from 'payload'

export const toggleFavoriteRuleHandler: PayloadHandler = async (req): Promise<Response> => {
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

    const rules: any[] = (widgetSettings.favoriteProductsByBranchRules as any[]) || []
    
    const ruleIndex = rules.findIndex((r: any) => r.id === ruleId)
    if (ruleIndex === -1) {
      return Response.json({ message: 'Rule not found' }, { status: 404 })
    }

    if (req.user.role === 'branch') {
       const userBranchId = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch?.id
       if (!userBranchId) {
          return Response.json({ message: 'Branch ID missing from user' }, { status: 400 })
       }

       const ruleBranches = rules[ruleIndex].branches || []
       // Extract just the string IDs
       let ruleBranchIds = ruleBranches.map((b: any) => typeof b === 'string' ? b : b?.id).filter(Boolean)

       const shouldEnable = enabled === undefined ? !ruleBranchIds.includes(userBranchId) : Boolean(enabled)

       if (shouldEnable) {
           if (!ruleBranchIds.includes(userBranchId)) {
               ruleBranchIds.push(userBranchId)
           }
       } else {
           ruleBranchIds = ruleBranchIds.filter((id: string) => id !== userBranchId)
       }

       // Update the array with string IDs
       rules[ruleIndex].branches = ruleBranchIds
    } else {
       // Superadmin toggle global enabled state (fallback)
       rules[ruleIndex].enabled = enabled === undefined ? !rules[ruleIndex].enabled : Boolean(enabled)
    }

    await req.payload.updateGlobal({
      slug: 'widget-settings',
      data: {
        favoriteProductsByBranchRules: rules,
      },
    })

    return Response.json({ message: 'Favorite rule updated successfully', rule: rules[ruleIndex] })
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to toggle favorite rule branch assignment',
    })
    return Response.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
