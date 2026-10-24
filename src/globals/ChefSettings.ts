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

const enforceOneCategoryOneChef = (
  currentAssignments: any[],
  originalAssignments: any[],
): any[] => {
  // 1. Build map of previous categories for each chef
  const prevKitchenMap = new Map<string, Set<string>>()
  const prevStockMap = new Map<string, Set<string>>()

  for (const orig of originalAssignments) {
    const chefId = getRelationshipID(orig.chef)
    if (chefId) {
      prevKitchenMap.set(chefId, new Set(getRelationshipIDs(orig.kitchenCategories)))
      prevStockMap.set(chefId, new Set(getRelationshipIDs(orig.stockCategories)))
    }
  }

  // 2. Identify newly added categories per chef in the current save
  const newlyAddedKitchen = new Map<string, string[]>()
  const newlyAddedStock = new Map<string, string[]>()

  for (const curr of currentAssignments) {
    const chefId = getRelationshipID(curr.chef)
    if (!chefId) continue

    const currKitchen = getRelationshipIDs(curr.kitchenCategories)
    const currStock = getRelationshipIDs(curr.stockCategories)

    const prevKitchen = prevKitchenMap.get(chefId) || new Set()
    const prevStock = prevStockMap.get(chefId) || new Set()

    const addedK = currKitchen.filter((id) => !prevKitchen.has(id))
    const addedS = currStock.filter((id) => !prevStock.has(id))

    if (addedK.length > 0) newlyAddedKitchen.set(chefId, addedK)
    if (addedS.length > 0) newlyAddedStock.set(chefId, addedS)
  }

  // 3. For any newly added category on a chef, remove it from all other chefs in the list
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

  newlyAddedStock.forEach((addedCategories, ownerChefId) => {
    for (const entry of currentAssignments) {
      const otherChefId = getRelationshipID(entry.chef)
      if (otherChefId && otherChefId !== ownerChefId) {
        const existing = getRelationshipIDs(entry.stockCategories)
        const updated = existing.filter((catId) => !addedCategories.includes(catId))
        if (updated.length !== existing.length) {
          entry.stockCategories = updated
        }
      }
    }
  })

  // 4. Strict deduplication pass:
  // Ensure absolutely no category appears in more than one chef row
  const assignedKitchenChef = new Map<string, string>() // categoryId -> chefId
  const assignedStockChef = new Map<string, string>() // categoryId -> chefId

  // Prioritize chefs who newly added categories
  newlyAddedKitchen.forEach((cats, chefId) => {
    cats.forEach((c) => assignedKitchenChef.set(c, chefId))
  })
  newlyAddedStock.forEach((cats, chefId) => {
    cats.forEach((c) => assignedStockChef.set(c, chefId))
  })

  for (const entry of currentAssignments) {
    const chefId = getRelationshipID(entry.chef)
    if (!chefId) continue

    const kCats = getRelationshipIDs(entry.kitchenCategories)
    const validKCats: string[] = []
    for (const catId of kCats) {
      const existingOwner = assignedKitchenChef.get(catId)
      if (!existingOwner || existingOwner === chefId) {
        assignedKitchenChef.set(catId, chefId)
        validKCats.push(catId)
      }
    }
    entry.kitchenCategories = validKCats

    const sCats = getRelationshipIDs(entry.stockCategories)
    const validSCats: string[] = []
    for (const catId of sCats) {
      const existingOwner = assignedStockChef.get(catId)
      if (!existingOwner || existingOwner === chefId) {
        assignedStockChef.set(catId, chefId)
        validSCats.push(catId)
      }
    }
    entry.stockCategories = validSCats
  }

  return currentAssignments
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
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (!req.payload) return data

        // If chefAssignments array is empty or uninitialized, auto-populate from existing chefs in users
        let assignments = Array.isArray(data?.chefAssignments) ? data.chefAssignments : []
        if (assignments.length === 0) {
          try {
            const chefsResult = await req.payload.find({
              collection: 'users',
              where: { role: { equals: 'chef' } },
              depth: 0,
              limit: 500,
              pagination: false,
              overrideAccess: true,
            })

            if (chefsResult.docs.length > 0) {
              assignments = chefsResult.docs.map((chefDoc: any) => {
                const isKitchen = chefDoc.isKitchen === true
                const isStock = chefDoc.isStock === true
                const assignmentType =
                  isKitchen && isStock ? 'both' : isStock ? 'stock' : 'kitchen'

                return {
                  chef: String(chefDoc.id),
                  assignmentType,
                  status: chefDoc.status === 'inactive' || chefDoc.loginBlocked ? 'inactive' : 'active',
                  branch: getRelationshipID(chefDoc.branch),
                  kitchenBranches: getRelationshipIDs(chefDoc.kitchenBranches),
                  kitchen: getRelationshipIDs(chefDoc.kitchen),
                  kitchenCategories: getRelationshipIDs(chefDoc.categories),
                  stockCategories: getRelationshipIDs(chefDoc.stockCategories),
                }
              })
              data.chefAssignments = assignments
            }
          } catch (err) {
            console.error('[ChefSettings beforeChange] Error fetching chefs for seed:', err)
          }
        }

        // Enforce "one category one chef only" across both kitchen and stock categories
        const originalAssignments = Array.isArray(originalDoc?.chefAssignments)
          ? originalDoc.chefAssignments
          : []
        data.chefAssignments = enforceOneCategoryOneChef(assignments, originalAssignments)

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
          const kitchenBranches = getRelationshipIDs(entry.kitchenBranches)
          const kitchen = getRelationshipIDs(entry.kitchen)
          const kitchenCategories = getRelationshipIDs(entry.kitchenCategories)
          const stockCategories = getRelationshipIDs(entry.stockCategories)

          // 1. Update this chef's user document
          try {
            await req.payload.update({
              collection: 'users',
              id: chefId,
              data: {
                isKitchen,
                isStock,
                branch: isKitchen && kitchenBranches.length > 0 ? null : branch,
                kitchenBranches: isKitchen ? kitchenBranches : [],
                kitchen: isKitchen ? kitchen : [],
                categories: isKitchen ? kitchenCategories : [],
                stockCategories: isStock ? stockCategories : [],
              },
              context: {
                ...(req.context || {}),
                fromChefSettingsSync: true,
                skipChefCategorySync: false,
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

          // 3. Remove newly assigned stock categories from any other chefs in DB
          if (stockCategories.length > 0) {
            try {
              const conflictingChefs = await req.payload.find({
                collection: 'users',
                where: {
                  and: [
                    { id: { not_equals: chefId } },
                    { role: { equals: 'chef' } },
                    { stockCategories: { in: stockCategories } },
                  ],
                },
                depth: 0,
                limit: 100,
                pagination: false,
                overrideAccess: true,
              })

              for (const otherChef of conflictingChefs.docs) {
                const otherStockCatIds = getRelationshipIDs((otherChef as any).stockCategories)
                const updatedOtherStockCatIds = otherStockCatIds.filter(
                  (id) => !stockCategories.includes(id),
                )
                if (updatedOtherStockCatIds.length !== otherStockCatIds.length) {
                  await req.payload.update({
                    collection: 'users',
                    id: otherChef.id,
                    data: {
                      stockCategories: updatedOtherStockCatIds,
                    },
                    context: {
                      ...(req.context || {}),
                      skipChefCategorySync: true,
                    },
                    overrideAccess: true,
                  })
                }
              }
            } catch (err) {
              console.error(
                `[ChefSettings afterChange] Error reassigning stock categories for chef ${chefId}:`,
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
      },
      fields: [
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
