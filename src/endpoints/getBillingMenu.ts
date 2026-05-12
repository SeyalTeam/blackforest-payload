import type { PayloadHandler, Where } from 'payload'

type CategoryDoc = {
  id?: string | number
  name?: string
}

type ProductDoc = {
  id?: string | number
  name?: string
  productId?: string
  upc?: string
  category?: unknown
  isAvailable?: boolean
  isOutOfStock?: boolean
  defaultPriceDetails?: {
    price?: number
  }
}

const toText = (value: unknown): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)

const toPositiveInt = (value: string | null, fallback: number, max: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, parsed)
}

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

const resolveMode = (value: string | null): 'categories' | 'products' => {
  const normalized = (value || '').trim().toLowerCase()
  return normalized === 'products' ? 'products' : 'categories'
}

export const getBillingMenuHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    const url = new URL(req.url || 'http://localhost')
    const mode = resolveMode(url.searchParams.get('mode'))
    const branchID =
      (url.searchParams.get('branch') || url.searchParams.get('branchId') || '').trim()

    if (!branchID) {
      return Response.json(
        {
          message: 'branch (or branchId) is required',
          hint: '/api/widgets/billing-menu?mode=categories&branch=<branchId>',
        },
        { status: 400 },
      )
    }

    if (mode === 'categories') {
      const categoriesResult = await req.payload.find({
        collection: 'categories',
        depth: 0,
        pagination: false,
        limit: 300,
        sort: 'name',
        where: {
          isBilling: {
            equals: true,
          },
        },
        overrideAccess: true,
      })

      const categoriesDocs = Array.isArray(categoriesResult?.docs)
        ? (categoriesResult.docs as CategoryDoc[])
        : []

      const categories = categoriesDocs
        .map((doc) => {
          const id = toText(doc.id).trim()
          if (!id) return null
          return {
            id,
            name: toText(doc.name).trim() || id,
          }
        })
        .filter((row): row is { id: string; name: string } => row !== null)

      return Response.json(
        {
          mode,
          branchId: branchID,
          count: categories.length,
          categories,
        },
        { status: 200 },
      )
    }

    const categoryID = (url.searchParams.get('categoryId') || '').trim()
    if (!categoryID) {
      return Response.json(
        {
          message: 'categoryId is required when mode=products',
          hint: '/api/widgets/billing-menu?mode=products&branch=<branchId>&categoryId=<categoryId>',
        },
        { status: 400 },
      )
    }

    const query = (url.searchParams.get('q') || '').trim()
    const limit = toPositiveInt(url.searchParams.get('limit'), 250, 500)

    const whereClauses: Where[] = [
      {
        inactiveBranches: {
          not_equals: branchID,
        },
      } as Where,
      {
        category: {
          equals: categoryID,
        },
      } as Where,
    ]

    if (query.length > 0) {
      whereClauses.push({
        or: [{ name: { like: query } }, { productId: { like: query } }, { upc: { like: query } }],
      } as Where)
    }

    const where: Where =
      whereClauses.length === 1
        ? whereClauses[0]
        : ({
            and: whereClauses,
          } as Where)

    const productsResult = await req.payload.find({
      collection: 'products',
      depth: 0,
      pagination: false,
      sort: 'name',
      limit,
      where,
      overrideAccess: true,
    })

    const productDocs = Array.isArray(productsResult?.docs)
      ? (productsResult.docs as ProductDoc[])
      : []

    const products = productDocs
      .map((doc) => {
        const id = toText(doc.id).trim()
        if (!id) return null

        const price =
          typeof doc.defaultPriceDetails?.price === 'number' &&
          Number.isFinite(doc.defaultPriceDetails.price)
            ? doc.defaultPriceDetails.price
            : null

        return {
          id,
          name: toText(doc.name).trim() || id,
          productId: toText(doc.productId).trim() || null,
          upc: toText(doc.upc).trim() || null,
          categoryId: getRelationshipID(doc.category) || null,
          isAvailable: doc.isAvailable !== false,
          isOutOfStock: doc.isOutOfStock === true,
          price,
        }
      })
      .filter(
        (
          row,
        ): row is {
          id: string
          name: string
          productId: string | null
          upc: string | null
          categoryId: string | null
          isAvailable: boolean
          isOutOfStock: boolean
          price: number | null
        } => row !== null,
      )

    return Response.json(
      {
        mode,
        branchId: branchID,
        categoryId: categoryID,
        count: products.length,
        products,
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to resolve billing menu',
    })

    return Response.json({ message: 'Failed to load billing menu' }, { status: 500 })
  }
}
