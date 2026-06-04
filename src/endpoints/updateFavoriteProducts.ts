import type { PayloadHandler } from 'payload'

export const updateFavoriteProductsHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    const user = req.user
    if (!user || user.role !== 'branch' || !user.branch) {
      return Response.json(
        { error: 'Unauthorized. Only branches can update their favorite products.' },
        { status: 403 }
      )
    }

    let body: any = {}
    try {
      body = await req.json?.() || {}
    } catch (e) {
      // Ignored
    }
    
    const products = body.products
    
    if (!Array.isArray(products)) {
      return Response.json({ error: 'products array is required' }, { status: 400 })
    }

    const branchId = typeof user.branch === 'object' ? user.branch.id : user.branch

    // Fetch current global
    const widgetSettings = await req.payload.findGlobal({
      slug: 'widget-settings',
    })

    const rules = widgetSettings.favoriteProductsByBranchRules || []
    
    // Find if a rule exists for this specific branch ONLY.
    let ruleFound = false
    const updatedRules = rules.map((rule: any) => {
      const ruleBranches = rule.branches || []
      const branchIds = ruleBranches.map((b: any) => (typeof b === 'object' ? b.id : b))
      
      // If the rule applies ONLY to this branch
      if (branchIds.length === 1 && branchIds[0] === branchId) {
        ruleFound = true
        return {
          ...rule,
          products,
        }
      }
      return rule
    })

    if (!ruleFound) {
      updatedRules.push({
        enabled: true,
        ruleName: `App Selection`,
        branches: [branchId],
        products: products,
      })
    }

    // Update the global bypassing access control
    await req.payload.updateGlobal({
      slug: 'widget-settings',
      data: {
        favoriteProductsByBranchRules: updatedRules,
      },
      overrideAccess: true,
    })

    return Response.json({ success: true, message: 'Favorite products updated' }, { status: 200 })
  } catch (error) {
    req.payload.logger.error({ msg: 'Error updating favorite products', error })
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
