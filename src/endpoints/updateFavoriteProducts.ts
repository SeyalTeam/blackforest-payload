import { PayloadHandler } from 'payload/config'

export const updateFavoriteProductsHandler: PayloadHandler = async (req, res) => {
  try {
    const user = req.user
    if (!user || user.role !== 'branch' || !user.branch) {
      return res.status(403).json({ error: 'Unauthorized. Only branches can update their favorite products.' })
    }

    const { products } = req.body
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'products array is required' })
    }

    const branchId = typeof user.branch === 'object' ? user.branch.id : user.branch

    // Fetch current global
    const widgetSettings = await req.payload.findGlobal({
      slug: 'widget-settings',
    })

    const rules = widgetSettings.favoriteProductsByBranchRules || []
    
    // Find if a rule exists for this specific branch ONLY.
    let ruleFound = false
    const updatedRules = rules.map((rule) => {
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

    return res.status(200).json({ success: true, message: 'Favorite products updated' })
  } catch (error) {
    req.payload.logger.error({ msg: 'Error updating favorite products', error })
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
