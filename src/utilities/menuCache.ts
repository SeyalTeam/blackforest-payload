import { Payload } from 'payload'

let cachedMenu: {
  products: Record<string, unknown>[]
  categories: Record<string, unknown>[]
} | null = null

export const getCachedMenu = async (payload: Payload) => {
  if (cachedMenu) {
    return cachedMenu
  }

  console.log('[Cache] Cache miss! Fetching products and categories from MongoDB...')

  const { docs: products } = await payload.find({
    collection: 'products',
    pagination: false,
    depth: 0,
    limit: 5000,
  })

  const { docs: categories } = await payload.find({
    collection: 'categories',
    pagination: false,
    depth: 0,
    limit: 500,
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
