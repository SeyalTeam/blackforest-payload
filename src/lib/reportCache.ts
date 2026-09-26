/**
 * In-memory client-side cache for report metadata (branches, departments, categories, first bill date)
 * and report query results to make dashboard report navigation instantaneous.
 */

type CacheEntry<T> = {
  data: T
  timestamp: number
  ttl: number
}

const memoryCache = new Map<string, CacheEntry<any>>()

// In-flight promise cache to deduplicate simultaneous requests
const inFlightPromises = new Map<string, Promise<any>>()

export function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > entry.ttl) {
    memoryCache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCached<T>(key: string, data: T, ttlMs = 60000): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  })
}

export function clearReportCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear()
    return
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key)
    }
  }
}

/**
 * Executes a fetcher function with caching and simultaneous in-flight deduplication.
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60000,
  bypassCache = false,
): Promise<T> {
  if (!bypassCache) {
    const cached = getCached<T>(key)
    if (cached !== null) {
      return cached
    }
  }

  // Deduplicate identical simultaneous requests
  if (inFlightPromises.has(key)) {
    return inFlightPromises.get(key) as Promise<T>
  }

  const promise = fetcher()
    .then((data) => {
      setCached(key, data, ttlMs)
      inFlightPromises.delete(key)
      return data
    })
    .catch((err) => {
      inFlightPromises.delete(key)
      throw err
    })

  inFlightPromises.set(key, promise)
  return promise
}

// ---------------------------------------------------------------------------
// Reusable Shared Metadata Fetchers (15-Minute Cache TTL)
// ---------------------------------------------------------------------------

const METADATA_TTL = 15 * 60 * 1000 // 15 minutes

export type BranchOption = { id: string; name: string }
export type DepartmentOption = { id: string; name: string }
export type CategoryOption = { id: string; name: string; department?: any }
export type ProductOption = { id: string; name: string; category?: any }

export async function fetchCachedBranches(bypassCache = false): Promise<BranchOption[]> {
  return fetchWithCache<BranchOption[]>(
    'meta:branches',
    async () => {
      const res = await fetch('/api/reports/branches')
      if (!res.ok) throw new Error('Failed to fetch branches')
      const json = await res.json()
      return (json.docs || []).map((b: any) => ({
        id: String(b.id || b._id),
        name: String(b.name || 'Unknown Branch'),
      }))
    },
    METADATA_TTL,
    bypassCache,
  )
}

export async function fetchCachedDepartments(bypassCache = false): Promise<DepartmentOption[]> {
  return fetchWithCache<DepartmentOption[]>(
    'meta:departments',
    async () => {
      const res = await fetch('/api/departments?limit=1000&sort=name&pagination=false')
      if (!res.ok) throw new Error('Failed to fetch departments')
      const json = await res.json()
      return (json.docs || []).map((d: any) => ({
        id: String(d.id || d._id),
        name: String(d.name || ''),
      }))
    },
    METADATA_TTL,
    bypassCache,
  )
}

export async function fetchCachedCategories(bypassCache = false): Promise<CategoryOption[]> {
  return fetchWithCache<CategoryOption[]>(
    'meta:categories',
    async () => {
      const res = await fetch('/api/categories?limit=1000&sort=name&pagination=false')
      if (!res.ok) throw new Error('Failed to fetch categories')
      const json = await res.json()
      return (json.docs || []).map((c: any) => ({
        id: String(c.id || c._id),
        name: String(c.name || ''),
        department: c.department,
      }))
    },
    METADATA_TTL,
    bypassCache,
  )
}

export async function fetchCachedProducts(bypassCache = false): Promise<ProductOption[]> {
  return fetchWithCache<ProductOption[]>(
    'meta:products',
    async () => {
      const res = await fetch('/api/products?limit=1000&sort=name&pagination=false')
      if (!res.ok) throw new Error('Failed to fetch products')
      const json = await res.json()
      return (json.docs || []).map((p: any) => ({
        id: String(p.id || p._id),
        name: String(p.name || ''),
        category: p.category,
      }))
    },
    METADATA_TTL,
    bypassCache,
  )
}

export async function fetchCachedFirstBillDate(bypassCache = false): Promise<Date | null> {
  return fetchWithCache<Date | null>(
    'meta:firstBillDate',
    async () => {
      const res = await fetch('/api/billings?sort=createdAt&limit=1&depth=0')
      if (!res.ok) return null
      const json = await res.json()
      if (json.docs && json.docs.length > 0 && json.docs[0]?.createdAt) {
        return new Date(json.docs[0].createdAt)
      }
      return null
    },
    METADATA_TTL,
    bypassCache,
  )
}
