import type { PayloadHandler, Where } from 'payload'

type ProductDoc = {
  id?: string | number
  name?: string
  productId?: string
  upc?: string
  category?: unknown
  defaultPriceDetails?: {
    price?: number
  }
}

const toPositiveInt = (value: string | null, fallback: number, max: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, parsed)
}

const toText = (value: unknown): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)

const getRelationshipID = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return toText(value).trim()
  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof (value as { id?: unknown }).id === 'string' ||
      typeof (value as { id?: unknown }).id === 'number')
  ) {
    return toText((value as { id?: unknown }).id).trim()
  }
  return ''
}

export const getWidgetProductOptionsHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url || 'http://localhost')
    const query = (url.searchParams.get('q') || '').trim()
    const categoryID = (url.searchParams.get('categoryId') || '').trim()
    const categoryIDs = (url.searchParams.get('categoryIds') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    const normalizedCategoryIDs = Array.from(
      new Set(
        categoryID.length > 0 ? [...categoryIDs, categoryID] : categoryIDs,
      ),
    )
    const limit = toPositiveInt(url.searchParams.get('limit'), 60, 150)

    const ids = (url.searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 120)

    let where: Where | undefined
    const whereClauses: Where[] = []

    if (ids.length > 0) {
      whereClauses.push({ id: { in: ids } } as Where)
    } else if (query.length > 0) {
      whereClauses.push({
        or: [{ name: { like: query } }, { productId: { like: query } }, { upc: { like: query } }],
      } as Where)
    }

    if (normalizedCategoryIDs.length > 0) {
      whereClauses.push({
        category: {
          in: normalizedCategoryIDs,
        },
      } as Where)
    }

    if (whereClauses.length === 1) {
      where = whereClauses[0]
    } else if (whereClauses.length > 1) {
      where = {
        and: whereClauses,
      } as Where
    }

    const effectiveLimit =
      ids.length > 0
        ? Math.max(limit, 220)
        : normalizedCategoryIDs.length > 0 && query.length === 0
          ? 1000
          : normalizedCategoryIDs.length > 0
            ? Math.max(limit, 220)
            : limit

    const products = await req.payload.find({
      collection: 'products',
      depth: 0,
      limit: effectiveLimit,
      sort: 'name',
      where,
      overrideAccess: true,
    })

    const docs = Array.isArray(products?.docs) ? (products.docs as ProductDoc[]) : []
    const categoryIDSet = new Set(normalizedCategoryIDs)
    const categoryFilteredDocs =
      categoryIDSet.size > 0
        ? docs.filter((doc) => categoryIDSet.has(getRelationshipID(doc.category)))
        : docs

    const options = categoryFilteredDocs
      .map((doc) => {
        const id = toText(doc.id).trim()
        if (!id) return null
        const name = toText(doc.name).trim() || id
        const price =
          typeof doc.defaultPriceDetails?.price === 'number' &&
          Number.isFinite(doc.defaultPriceDetails.price)
            ? doc.defaultPriceDetails.price
            : null

        return {
          value: id,
          label: price !== null ? `${name} (Rs ${price.toFixed(2)})` : name,
        }
      })
      .filter((option): option is { value: string; label: string } => option !== null)

    return Response.json({ options }, { status: 200 })
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to fetch widget product options',
    })
    return Response.json({ message: 'Failed to load product options' }, { status: 500 })
  }
}
