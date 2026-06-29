import { Payload } from 'payload'

let cachedMenu: {
  products: Record<string, any>[]
  categories: Record<string, any>[]
} | null = null

export const getCachedMenu = async (payload: Payload) => {
  if (cachedMenu) {
    return cachedMenu
  }

  console.log('[Cache] Cache miss! Fetching populated products & categories from MongoDB...')

  // Fetch categories with depth: 1 to resolve image relationships
  const { docs: categories } = await payload.find({
    collection: 'categories',
    pagination: false,
    depth: 1,
    limit: 500,
    overrideAccess: true,
  })

  // Fetch products with depth: 2 to resolve category and image relationships
  const { docs: products } = await payload.find({
    collection: 'products',
    pagination: false,
    depth: 2,
    limit: 5000,
    overrideAccess: true,
  })

  cachedMenu = {
    products,
    categories,
  }

  return cachedMenu
}

export const invalidateMenuCache = () => {
  console.log('[Cache] Invalidation hook triggered! Clearing menu cache.')
  cachedMenu = null
}
