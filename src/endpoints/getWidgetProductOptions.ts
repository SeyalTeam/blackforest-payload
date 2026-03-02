import type { PayloadHandler } from 'payload'

type ProductDoc = {
  id?: string | number
  name?: string
  productId?: string
  upc?: string
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

export const getWidgetProductOptionsHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url || 'http://localhost')
    const query = (url.searchParams.get('q') || '').trim()
    const limit = toPositiveInt(url.searchParams.get('limit'), 60, 150)

    const ids = (url.searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 120)

    const where =
      ids.length > 0
        ? { id: { in: ids } }
        : query.length > 0
          ? {
              or: [
                { name: { like: query } },
                { productId: { like: query } },
                { upc: { like: query } },
              ],
            }
          : undefined

    const products = await req.payload.find({
      collection: 'products',
      depth: 0,
      limit,
      sort: 'name',
      ...(where ? { where } : {}),
      overrideAccess: true,
    })

    const docs = Array.isArray(products?.docs) ? (products.docs as ProductDoc[]) : []

    const options = docs
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
