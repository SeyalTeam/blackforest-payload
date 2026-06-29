import type { PayloadHandler, Where } from 'payload'
import { getCachedMenu } from '../utilities/menuCache'

type CategoryDoc = {
  id?: string | number
  name?: string
  image?: unknown
  imageUrl?: unknown
  thumbnail?: unknown
  thumbnailURL?: unknown
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
    enableAC?: boolean
    enableNonAC?: boolean
    acPrice?: number
    nonACPrice?: number
    rate?: number
    offer?: number
    quantity?: number
    unit?: string
    gst?: string
  }
  branchOverrides?: Array<{
    branch?: string | number | { id: string | number }
    price?: number
    enableAC?: boolean
    enableNonAC?: boolean
    acPrice?: number
    nonACPrice?: number
    rate?: number
    offer?: number
    quantity?: number
    unit?: string
    gst?: string
  }>
  image?: unknown
  imageUrl?: unknown
  thumbnail?: unknown
  thumbnailURL?: unknown
  images?: unknown
  media?: unknown
}

const toText = (value: unknown): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)

const looksLikeMediaPath = (value: string): boolean => {
  const normalized = value.toLowerCase()
  return (
    normalized.includes('/api/media/file/') ||
    normalized.includes('/media/') ||
    normalized.includes('/uploads/') ||
    normalized.includes('/files/') ||
    normalized.startsWith('api/media/file/') ||
    normalized.startsWith('api/') ||
    normalized.startsWith('media/') ||
    normalized.startsWith('uploads/') ||
    normalized.startsWith('files/')
  )
}

const looksLikeImagePath = (value: string): boolean =>
  /\.(png|jpe?g|webp|gif|avif|svg|jfif|bmp|heic|heif)(\?.*)?$/i.test(value)

const normalizeImageUrl = (value: unknown): string | null => {
  const input = toText(value).trim()
  if (!input) return null
  if (input.startsWith('data:image/')) return input

  const encoded = input.replace(/ /g, '%20')
  if (encoded.startsWith('//')) return `https:${encoded}`
  if (encoded.startsWith('http://') || encoded.startsWith('https://')) {
    return encoded
  }

  if (encoded.startsWith('/')) {
    if (!looksLikeImagePath(encoded) && !looksLikeMediaPath(encoded)) return null
    return encoded
  }

  if (looksLikeImagePath(encoded) || looksLikeMediaPath(encoded)) {
    return encoded
  }

  return null
}

const extractImageUrl = (node: unknown): string | null => {
  const direct = normalizeImageUrl(node)
  if (direct) return direct

  if (Array.isArray(node)) {
    for (const entry of node) {
      const nested = extractImageUrl(entry)
      if (nested) return nested
    }
    return null
  }

  if (!node || typeof node !== 'object') return null

  const map = node as Record<string, unknown>
  const preferredKeys = [
    'imageUrl',
    'imageURL',
    'thumbnail',
    'thumbnailURL',
    'thumbnailUrl',
    'largeURL',
    'largeUrl',
    'mediumURL',
    'mediumUrl',
    'smallURL',
    'smallUrl',
    'image',
    'images',
    'media',
    'url',
    'src',
    'path',
    'filename',
    'file',
  ]

  for (const key of preferredKeys) {
    if (!(key in map)) continue
    const nested = extractImageUrl(map[key])
    if (nested) return nested
  }

  for (const value of Object.values(map)) {
    const nested = extractImageUrl(value)
    if (nested) return nested
  }

  return null
}

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

    const { products: cachedProducts, categories: cachedCategories } = await getCachedMenu(req.payload)

    if (mode === 'categories') {
      // Resolve company from branch
      const branch = await req.payload.findByID({
        collection: 'branches',
        id: branchID,
        depth: 0,
        overrideAccess: true,
      })

      if (!branch) {
        return Response.json({ message: 'Branch not found' }, { status: 404 })
      }

      const companyID = getRelationshipID(branch.company)

      const categories = cachedCategories
        .filter((doc) => {
          if (doc.isBilling !== true) return false
          
          const companyList = Array.isArray(doc.company) ? doc.company : [doc.company]
          return companyList.some((c: any) => {
            const id = typeof c === 'object' && c !== null ? c.id : c
            return String(id) === String(companyID)
          })
        })
        .map((doc) => {
          const id = toText(doc.id).trim()
          const imageUrl = extractImageUrl(
            doc.imageUrl ?? doc.thumbnailURL ?? doc.thumbnail ?? doc.image,
          )

          return {
            id,
            name: toText(doc.name).trim() || id,
            imageUrl,
            thumbnailURL: imageUrl,
            image: doc.image || imageUrl,
            company: doc.company,
            department: doc.department,
          }
        })
        .filter((row) => row !== null)

      return Response.json(
        {
          mode,
          branchId: branchID,
          companyId: companyID,
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

    const query = (url.searchParams.get('q') || '').trim().toLowerCase()

    const products = cachedProducts
      .filter((doc) => {
        const inactiveBranches = Array.isArray(doc.inactiveBranches) ? doc.inactiveBranches : []
        const isInactive = inactiveBranches.some((b: any) => {
          const id = typeof b === 'object' && b !== null ? b.id : b
          return String(id) === String(branchID)
        })
        if (isInactive) return false

        const categoryVal = getRelationshipID(doc.category)
        if (categoryVal !== categoryID) return false

        if (query.length > 0) {
          const name = String(doc.name || '').toLowerCase()
          const productId = String(doc.productId || '').toLowerCase()
          const upc = String(doc.upc || '').toLowerCase()
          if (!name.includes(query) && !productId.includes(query) && !upc.includes(query)) {
            return false
          }
        }

        return true
      })
      .map((doc) => {
        const id = toText(doc.id).trim()
        const price =
          typeof doc.defaultPriceDetails?.price === 'number' &&
          Number.isFinite(doc.defaultPriceDetails.price)
            ? doc.defaultPriceDetails.price
            : null

        const imageUrl = extractImageUrl(
          doc.imageUrl ??
              doc.thumbnailURL ??
              doc.thumbnail ??
              doc.image ??
              doc.images ??
              doc.media,
        )

        return {
          id,
          name: toText(doc.name).trim() || id,
          productId: toText(doc.productId).trim() || null,
          upc: toText(doc.upc).trim() || null,
          categoryId: getRelationshipID(doc.category) || null,
          isAvailable: doc.isAvailable !== false,
          isOutOfStock: doc.isOutOfStock === true,
          price,
          defaultPriceDetails: doc.defaultPriceDetails,
          branchOverrides: doc.branchOverrides,
          imageUrl,
          thumbnailURL: imageUrl,
          image: doc.image,
          images: doc.images,
          media: doc.media,
        }
      })
      .filter((row) => row !== null)

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
