import type { Payload } from 'payload'

export const requestedCategoryReportDate = '2026-03-19'

export const requestedToActualCategories = [
  ['PIZZA', 'PIZZA'],
  ['SANDWICH', 'SANDWICHES'],
  ['FRIED', 'FRIED ITEMS'],
  ['FRESH JUICE', 'FRESH JUICE'],
  ['PREMIUM DESSERT', 'Premium Dessert'],
  ['TEA CAFE', 'TEA CAFE'],
  ['DESSERT', 'DESSERTS'],
] as const

export type RequestedCategoryName = (typeof requestedToActualCategories)[number][0]
export type ActualCategoryName = (typeof requestedToActualCategories)[number][1]

export interface RequestedCategoryProductRecord {
  requestedCategory: RequestedCategoryName
  actualCategory: string
  productName: string
  price: number | null
}

export interface RequestedCategoryProductGroup {
  requestedCategory: RequestedCategoryName
  actualCategory: ActualCategoryName
  items: RequestedCategoryProductRecord[]
}

export const getRequestedCategoryProductPrices = async (
  payload: Payload,
): Promise<RequestedCategoryProductGroup[]> => {
  const categories = await payload.find({
    collection: 'categories',
    limit: 200,
    depth: 0,
  })

  const categoryIdByName = new Map(categories.docs.map((category) => [category.name, category.id]))
  const groups = requestedToActualCategories.map(([requestedCategory, actualCategory]) => ({
    requestedCategory,
    actualCategory,
    items: [] as RequestedCategoryProductRecord[],
  }))

  const targetCategoryIds = groups
    .map((group) => categoryIdByName.get(group.actualCategory))
    .filter((categoryId): categoryId is string => Boolean(categoryId))

  const actualToRequested = new Map(
    requestedToActualCategories.map(([requestedCategory, actualCategory]) => [
      actualCategory,
      requestedCategory,
    ]),
  )

  const products = await payload.find({
    collection: 'products',
    limit: 1000,
    depth: 1,
    sort: 'name',
    where: {
      category: {
        in: targetCategoryIds,
      },
    },
  })

  const itemsByRequestedCategory = new Map<RequestedCategoryName, RequestedCategoryProductRecord[]>(
    groups.map((group) => [group.requestedCategory, []]),
  )

  for (const product of products.docs) {
    const actualCategory =
      typeof product.category === 'object' && product.category
        ? product.category.name
        : categories.docs.find((category) => category.id === product.category)?.name || ''

    const requestedCategory = actualToRequested.get(actualCategory as ActualCategoryName)
    if (!requestedCategory) continue

    itemsByRequestedCategory.get(requestedCategory)?.push({
      requestedCategory,
      actualCategory,
      productName: product.name,
      price: product.defaultPriceDetails?.price ?? null,
    })
  }

  return groups.map((group) => ({
    ...group,
    items: itemsByRequestedCategory.get(group.requestedCategory) || [],
  }))
}
