import type { GlobalConfig, Where } from 'payload'

const getRelationshipID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'object' && value !== null) {
    if ('id' in value && (value as { id?: unknown }).id != null) {
      const id = (value as { id?: unknown }).id
      if (typeof id === 'string' || typeof id === 'number') return String(id).trim()
      if (typeof id === 'object') {
        const nestedId = getRelationshipID(id)
        if (nestedId) return nestedId
      }
    }
    if ('_id' in value && (value as { _id?: unknown })._id != null) {
      const id = (value as { _id?: unknown })._id
      if (typeof id === 'string' || typeof id === 'number') return String(id).trim()
      if (id && typeof (id as any).toString === 'function') {
        const str = (id as any).toString()
        if (str && str !== '[object Object]') return str
      }
    }
    if ('value' in value && (value as { value?: unknown }).value != null) {
      const resolved = getRelationshipID((value as { value?: unknown }).value)
      if (resolved) return resolved
    }
  }
  return null
}

const getRelationshipIDs = (value: unknown): string[] => {
  if (!value) return []
  if (!Array.isArray(value)) {
    const id = getRelationshipID(value)
    return id ? [id] : []
  }
  return value.map((item) => getRelationshipID(item)).filter((id): id is string => Boolean(id))
}

const enforceOneCategoryOneChef = async (
  currentAssignments: any[],
  originalAssignments: any[],
  payload?: any,
): Promise<any[]> => {
  // 1. Build map of previous kitchen categories for each chef
  const prevKitchenMap = new Map<string, Set<string>>()

  for (const orig of originalAssignments) {
    const chefId = getRelationshipID(orig.chef)
    if (chefId) {
      prevKitchenMap.set(chefId, new Set(getRelationshipIDs(orig.kitchenCategories)))
    }
  }

  // 2. Identify newly added kitchen categories per chef in the current save
  const newlyAddedKitchen = new Map<string, string[]>()

  for (const curr of currentAssignments) {
    const chefId = getRelationshipID(curr.chef)
    if (!chefId) continue

    const currKitchen = getRelationshipIDs(curr.kitchenCategories)
    const prevKitchen = prevKitchenMap.get(chefId) || new Set()
    const addedK = currKitchen.filter((id) => !prevKitchen.has(id))

    if (addedK.length > 0) newlyAddedKitchen.set(chefId, addedK)
  }

  // 3. For any newly added kitchen category on a chef, remove it from all other chefs in the list
  newlyAddedKitchen.forEach((addedCategories, ownerChefId) => {
    for (const entry of currentAssignments) {
      const otherChefId = getRelationshipID(entry.chef)
      if (otherChefId && otherChefId !== ownerChefId) {
        const existing = getRelationshipIDs(entry.kitchenCategories)
        const updated = existing.filter((catId) => !addedCategories.includes(catId))
        if (updated.length !== existing.length) {
          entry.kitchenCategories = updated
        }
      }
    }
  })

  // 4. Check users collection to see which chef actually holds it in DB if conflicts remain
  const userCatOwner = new Map<string, string>() // categoryId -> chefId
  if (payload) {
    try {
      const allChefs = await payload.find({
        collection: 'users',
        where: { role: { equals: 'chef' } },
        depth: 0,
        limit: 200,
        pagination: false,
        overrideAccess: true,
      })
      for (const c of allChefs.docs) {
        const cId = String(c.id)
        getRelationshipIDs(c.categories).forEach((catId) => {
          userCatOwner.set(catId, cId)
        })
      }
    } catch (_) {}
  }

  // 5. Strict deduplication pass for kitchen categories only:
  // Ensure absolutely no kitchen category appears in more than one chef row
  const claimedKitchenChef = new Map<string, string>() // categoryId -> chefId

  // Prioritize chefs who newly added categories
  newlyAddedKitchen.forEach((cats, chefId) => {
    cats.forEach((c) => claimedKitchenChef.set(c, chefId))
  })

  // Next prioritize the actual owner in users collection
  userCatOwner.forEach((chefId, catId) => {
    if (!claimedKitchenChef.has(catId)) {
      claimedKitchenChef.set(catId, chefId)
    }
  })

  // Iterate in reverse (so later rows take priority if neither is claimed)
  for (let i = currentAssignments.length - 1; i >= 0; i--) {
    const entry = currentAssignments[i]
    const chefId = getRelationshipID(entry.chef)
    if (!chefId) continue

    const kCats = getRelationshipIDs(entry.kitchenCategories)
    const validKCats: string[] = []
    for (const catId of kCats) {
      const existingOwner = claimedKitchenChef.get(catId)
      if (!existingOwner || existingOwner === chefId) {
        claimedKitchenChef.set(catId, chefId)
        validKCats.push(catId)
      }
    }
    entry.kitchenCategories = validKCats
    // Stock categories are allowed to be shared across multiple chefs for shared work,
    // so entry.stockCategories is preserved as-is.
  }

  return currentAssignments
}

const syncActiveChefsAndNames = async (
  currentAssignments: any[],
  payload: any,
): Promise<any[]> => {
  if (!payload) return currentAssignments

  // 1. Fetch all categories to map id -> name
  const categoryMap = new Map<string, string>()
  try {
    const allCategories = await payload.find({
      collection: 'categories',
      depth: 0,
      limit: 1000,
      pagination: false,
      overrideAccess: true,
    })
    for (const cat of allCategories.docs) {
      if (cat?.name) {
        categoryMap.set(String(cat.id), cat.name.trim())
      }
    }
  } catch (err) {
    console.error('[ChefSettings] Error fetching categories for names:', err)
  }

  // 2. Fetch all chefs from users collection
  const allChefsMap = new Map<string, any>()
  try {
    const allChefs = await payload.find({
      collection: 'users',
      where: {
        role: { equals: 'chef' },
      },
      depth: 0,
      limit: 500,
      pagination: false,
      overrideAccess: true,
    })
    for (const chef of allChefs.docs) {
      allChefsMap.set(String(chef.id), chef)
    }
  } catch (err) {
    console.error('[ChefSettings] Error fetching chefs for sync:', err)
  }

  const assignments = Array.isArray(currentAssignments) ? [...currentAssignments] : []
  const existingChefIds = new Set<string>()

  // 3. For each existing assignment, populate chefName, kitchenCategoryNames, stockCategoryNames
  for (const entry of assignments) {
    const chefId = getRelationshipID(entry.chef)
    if (!chefId) continue
    existingChefIds.add(chefId)

    const chefDoc = allChefsMap.get(chefId)
    if (chefDoc) {
      entry.chefName = chefDoc.name || chefDoc.username || 'Chef'
    }

    const kCats = getRelationshipIDs(entry.kitchenCategories)
    entry.kitchenCategoryNames = kCats
      .map((id) => categoryMap.get(id))
      .filter((n): n is string => Boolean(n))
      .join(', ')

    const sCats = getRelationshipIDs(entry.stockCategories)
    entry.stockCategoryNames = sCats
      .map((id) => categoryMap.get(id))
      .filter((n): n is string => Boolean(n))
      .join(', ')
  }

  // 4. Ensure EVERY active chef in the users collection is present in the list
  allChefsMap.forEach((chefDoc, chefId) => {
    const isInactive = chefDoc.status === 'inactive' || chefDoc.loginBlocked === true
    if (!isInactive && !existingChefIds.has(chefId)) {
      const isKitchen = chefDoc.isKitchen === true
      const isStock = chefDoc.isStock === true
      const assignmentType = isKitchen && isStock ? 'both' : isStock ? 'stock' : 'kitchen'

      const kCats = getRelationshipIDs(chefDoc.categories)
      const sCats = getRelationshipIDs(chefDoc.stockCategories)

      const rawKBranches = getRelationshipIDs(chefDoc.kitchenBranches)
      const primaryBranch = getRelationshipID(chefDoc.branch)
      const finalBranches = rawKBranches.length > 0 ? rawKBranches : primaryBranch ? [primaryBranch] : []

      assignments.push({
        chef: chefId,
        chefName: chefDoc.name || chefDoc.username || 'Chef',
        assignmentType,
        status: 'active',
        branch: primaryBranch,
        kitchenBranches: finalBranches,
        kitchen: getRelationshipIDs(chefDoc.kitchen),
        kitchenCategories: kCats,
        kitchenCategoryNames: kCats
          .map((id) => categoryMap.get(id))
          .filter((n): n is string => Boolean(n))
          .join(', '),
        stockCategories: sCats,
        stockCategoryNames: sCats
          .map((id) => categoryMap.get(id))
          .filter((n): n is string => Boolean(n))
          .join(', '),
      })
      existingChefIds.add(chefId)
    }
  })

  return assignments
}

export const ChefSettingsGlobal: GlobalConfig = {
  slug: 'chef-settings',
  label: 'Chef Settings',
  admin: {
    group: 'Settings',
    description:
      'Manage chef assignments for Kitchen (branch, kitchen, categories) and Stock Order (categories).',
  },
  access: {
    read: () => true,
    update: ({ req }) =>
      Boolean(
        req.user &&
          ['superadmin', 'admin', 'manager', 'company', 'branch'].includes(req.user.role),
      ),
  },
  hooks: {
    afterRead: [
      async ({ doc, req }) => {
        if (!req.payload) return doc
        try {
          const assignments = Array.isArray(doc?.chefAssignments) ? doc.chefAssignments : []
          doc.chefAssignments = await syncActiveChefsAndNames(assignments, req.payload)
        } catch (err) {
          console.error('[ChefSettings afterRead] Error syncing active chefs:', err)
        }
        return doc
      },
    ],
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (!req.payload) return data

        let assignments = Array.isArray(data?.chefAssignments) ? data.chefAssignments : []

        // 1. Ensure all active chefs are present and display names are populated
        assignments = await syncActiveChefsAndNames(assignments, req.payload)

        // 2. Enforce "one category one chef only" across both kitchen and stock categories
        const originalAssignments = Array.isArray(originalDoc?.chefAssignments)
          ? originalDoc.chefAssignments
          : []
        assignments = await enforceOneCategoryOneChef(
          assignments,
          originalAssignments,
          req.payload,
        )

        // 3. Re-calculate category names after deduplication
        try {
          const allCategories = await req.payload.find({
            collection: 'categories',
            depth: 0,
            limit: 1000,
            pagination: false,
            overrideAccess: true,
          })
          const catMap = new Map<string, string>()
          allCategories.docs.forEach((cat: any) => {
            if (cat?.name) catMap.set(String(cat.id), cat.name.trim())
          })

          for (const entry of assignments) {
            const kCats = getRelationshipIDs(entry.kitchenCategories)
            entry.kitchenCategoryNames = kCats
              .map((id) => catMap.get(id))
              .filter(Boolean)
              .join(', ')
            const sCats = getRelationshipIDs(entry.stockCategories)
            entry.stockCategoryNames = sCats
              .map((id) => catMap.get(id))
              .filter(Boolean)
              .join(', ')
          }
        } catch (_) {}

        data.chefAssignments = assignments
        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        if (!req.payload || req.context?.fromChefUserSync) return doc

        const assignments = Array.isArray(doc?.chefAssignments) ? doc.chefAssignments : []
        for (const entry of assignments) {
          const chefId = getRelationshipID(entry.chef)
          if (!chefId) continue

          const assignmentType = entry.assignmentType || 'both'
          const isKitchen = assignmentType === 'kitchen' || assignmentType === 'both'
          const isStock = assignmentType === 'stock' || assignmentType === 'both'

          const branch = getRelationshipID(entry.branch)
          const rawKitchenBranches = getRelationshipIDs(entry.kitchenBranches)
          const kitchenBranches = rawKitchenBranches.length > 0 ? rawKitchenBranches : branch ? [branch] : []
          const safeIsKitchen = isKitchen && kitchenBranches.length > 0
          const kitchen = getRelationshipIDs(entry.kitchen)
          const kitchenCategories = getRelationshipIDs(entry.kitchenCategories)
          const stockCategories = getRelationshipIDs(entry.stockCategories)

          // 1. Update this chef's user document only if values actually changed
          try {
            const currentChef = await req.payload.findByID({
              collection: 'users',
              id: chefId,
              depth: 0,
              overrideAccess: true,
            })

            const curIsKitchen = Boolean(currentChef?.isKitchen)
            const curIsStock = Boolean((currentChef as any)?.isStock)
            const curBranches = getRelationshipIDs((currentChef as any)?.kitchenBranches)
            const curBranch = getRelationshipID(currentChef?.branch)
            const curKitchen = getRelationshipIDs((currentChef as any)?.kitchen)
            const curCats = getRelationshipIDs(currentChef?.categories)
            const curStockCats = getRelationshipIDs((currentChef as any)?.stockCategories)

            const targetBranch = safeIsKitchen && kitchenBranches.length > 0 ? null : branch
            const targetBranches = safeIsKitchen ? kitchenBranches : []
            const targetKitchen = safeIsKitchen ? kitchen : []
            const targetCats = safeIsKitchen ? kitchenCategories : []
            const targetStockCats = isStock ? stockCategories : []

            const isSame =
              curIsKitchen === safeIsKitchen &&
              curIsStock === isStock &&
              targetBranch === curBranch &&
              curBranches.length === targetBranches.length &&
              curBranches.every((b) => targetBranches.includes(b)) &&
              curKitchen.length === targetKitchen.length &&
              curKitchen.every((k) => targetKitchen.includes(k)) &&
              curCats.length === targetCats.length &&
              curCats.every((c) => targetCats.includes(c)) &&
              curStockCats.length === targetStockCats.length &&
              curStockCats.every((s) => targetStockCats.includes(s))

            if (isSame) {
              continue
            }

            await req.payload.update({
              collection: 'users',
              id: chefId,
              data: {
                isKitchen: safeIsKitchen,
                isStock,
                branch: targetBranch,
                kitchenBranches: targetBranches,
                kitchen: targetKitchen,
                categories: targetCats,
                stockCategories: targetStockCats,
              },
              context: {
                ...(req.context || {}),
                fromChefSettingsSync: true,
                skipChefCategorySync: true,
              },
              overrideAccess: true,
            })
          } catch (err) {
            console.error(`[ChefSettings afterChange] Error syncing chef ${chefId}:`, err)
          }

          // 2. Enforce exclusive category assignment in users collection:
          // Remove newly assigned kitchen categories from any other chefs in DB
          if (kitchenCategories.length > 0) {
            try {
              const conflictingChefs = await req.payload.find({
                collection: 'users',
                where: {
                  and: [
                    { id: { not_equals: chefId } },
                    { role: { equals: 'chef' } },
                    { categories: { in: kitchenCategories } },
                  ],
                },
                depth: 0,
                limit: 100,
                pagination: false,
                overrideAccess: true,
              })

              for (const otherChef of conflictingChefs.docs) {
                const otherCatIds = getRelationshipIDs(otherChef.categories)
                const updatedOtherCatIds = otherCatIds.filter(
                  (id) => !kitchenCategories.includes(id),
                )
                if (updatedOtherCatIds.length !== otherCatIds.length) {
                  await req.payload.update({
                    collection: 'users',
                    id: otherChef.id,
                    data: {
                      categories: updatedOtherCatIds,
                    },
                    context: {
                      ...(req.context || {}),
                      fromChefSettingsSync: true,
                      skipChefCategorySync: true,
                    },
                    overrideAccess: true,
                  })
                }
              }
            } catch (err) {
              console.error(
                `[ChefSettings afterChange] Error reassigning kitchen categories for chef ${chefId}:`,
                err,
              )
            }
          }
        }

        return doc
      },
    ],
  },
  fields: [
    {
      name: 'chefAssignments',
      type: 'array',
      label: 'Chef Assignments',
      labels: {
        singular: 'Chef Assignment',
        plural: 'Chef Assignments',
      },
      admin: {
        description:
          'Assign each chef for Stock Order, Kitchen, or Both. For Kitchen, assign branch, kitchen, and categories. For Stock Order, assign stock categories.',
        components: {
          RowLabel: '/components/ChefRowLabel/index.tsx#ChefRowLabel',
        },
      },
      fields: [
        {
          name: 'chefName',
          type: 'text',
          admin: {
            hidden: true,
          },
        },
        {
          name: 'kitchenCategoryNames',
          type: 'text',
          admin: {
            hidden: true,
          },
        },
        {
          name: 'stockCategoryNames',
          type: 'text',
          admin: {
            hidden: true,
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'chef',
              type: 'relationship',
              relationTo: 'users',
              required: true,
              label: 'Chef',
              filterOptions: {
                role: { equals: 'chef' },
              },
              admin: {
                width: '40%',
              },
            },
            {
              name: 'assignmentType',
              type: 'select',
              label: 'Assign For',
              required: true,
              defaultValue: 'both',
              options: [
                { label: '🍳 Kitchen Only', value: 'kitchen' },
                { label: '📦 Stock Order Only', value: 'stock' },
                { label: '🍳 Kitchen & 📦 Stock Order (Both)', value: 'both' },
              ],
              admin: {
                width: '35%',
              },
            },
            {
              name: 'status',
              type: 'select',
              label: 'Status',
              defaultValue: 'active',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ],
              admin: {
                width: '25%',
              },
            },
          ],
        },
        // Kitchen Configuration Section
        {
          type: 'collapsible',
          label: '🍳 Kitchen Configuration (Branch -> Kitchen -> Category)',
          admin: {
            condition: (_data, siblingData) =>
              siblingData?.assignmentType === 'kitchen' || siblingData?.assignmentType === 'both',
            initCollapsed: false,
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'branch',
                  type: 'relationship',
                  relationTo: 'branches',
                  label: 'Branch',
                  required: false,
                  admin: {
                    width: '50%',
                    description: 'Primary branch for this kitchen chef',
                  },
                },
                {
                  name: 'kitchenBranches',
                  label: 'Kitchen Branches (Multi-Branch)',
                  type: 'relationship',
                  relationTo: 'branches',
                  hasMany: true,
                  required: false,
                  admin: {
                    width: '50%',
                    description: 'Select branches if kitchen serves multiple branches',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'kitchen',
                  label: 'Kitchens',
                  type: 'relationship',
                  relationTo: 'kitchens',
                  hasMany: true,
                  required: false,
                  admin: {
                    width: '50%',
                    description: 'Select kitchen(s) for this chef',
                  },
                  filterOptions: ({ siblingData }: any) => {
                    const branches = (siblingData as any)?.kitchenBranches
                    if (Array.isArray(branches) && branches.length > 0) {
                      return {
                        branches: {
                          in: branches.map((b: any) =>
                            typeof b === 'object' && b !== null ? b.id : b,
                          ),
                        },
                      }
                    } else if ((siblingData as any)?.branch) {
                      const branch = (siblingData as any).branch
                      const branchId =
                        typeof branch === 'object' && branch !== null
                          ? branch.id
                          : branch
                      return {
                        branches: {
                          contains: branchId,
                        },
                      }
                    }
                    return true
                  },
                },
                {
                  name: 'kitchenCategories',
                  label: 'Kitchen Categories',
                  type: 'relationship',
                  relationTo: 'categories',
                  hasMany: true,
                  required: false,
                  admin: {
                    width: '50%',
                    description: 'Categories belonging to selected kitchen(s)',
                  },
                  filterOptions: async ({ siblingData, req }: any): Promise<Where | boolean> => {
                    if (!req?.payload) return true

                    const rawKitchens = (siblingData as any)?.kitchen
                    const kitchenIds = getRelationshipIDs(rawKitchens)

                    if (kitchenIds.length === 0) {
                      return { isKitchen: { equals: true } }
                    }

                    try {
                      const kitchensResult = await req.payload.find({
                        collection: 'kitchens',
                        where: { id: { in: kitchenIds } },
                        depth: 0,
                        limit: 100,
                        pagination: false,
                        overrideAccess: true,
                      })

                      const categoryIds: string[] = []
                      for (const k of kitchensResult.docs) {
                        const ids = getRelationshipIDs((k as any).categories)
                        categoryIds.push(...ids)
                      }

                      const uniqueCategoryIds = Array.from(new Set(categoryIds))
                      if (uniqueCategoryIds.length > 0) {
                        return { id: { in: uniqueCategoryIds } }
                      }
                      return { isKitchen: { equals: true } }
                    } catch (e) {
                      console.error('[ChefSettings] Error fetching kitchen categories:', e)
                      return { isKitchen: { equals: true } }
                    }
                  },
                },
              ],
            },
          ],
        },
        // Stock Order Configuration Section
        {
          type: 'collapsible',
          label: '📦 Stock Order Configuration (Category Assignment)',
          admin: {
            condition: (_data, siblingData) =>
              siblingData?.assignmentType === 'stock' || siblingData?.assignmentType === 'both',
            initCollapsed: false,
          },
          fields: [
            {
              name: 'stockCategories',
              label: 'Stock Order Categories',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
              required: false,
              admin: {
                description:
                  'Categories assigned to this chef for stock order production & fulfillment',
              },
              filterOptions: (): Where | boolean => {
                return {
                  isStock: {
                    equals: true,
                  },
                }
              },
            },
          ],
        },
      ],
    },
  ],
}
