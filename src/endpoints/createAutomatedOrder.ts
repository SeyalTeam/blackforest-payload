import { PayloadHandler } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const createAutomatedOrderHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Expecting JSON body
  let body: any
  try {
    body = await req.json?.()
  } catch (_e) {
    // If req.json() is not available or fails
  }

  if (!body) {
    // Fallback to URL search params if needed, but JSON is preferred for POST
    const url = new URL(req.url!)
    body = {
      branchId: url.searchParams.get('branchId'),
      deliveryDate: url.searchParams.get('deliveryDate'),
      orderType: url.searchParams.get('orderType'),
      message: url.searchParams.get('message'),
    }
  }

  const { branchId, deliveryDate, orderType, message } = body

  if (!branchId || !deliveryDate || !message) {
    return Response.json({ message: 'Missing required fields' }, { status: 400 })
  }

  try {
    // 1. Fetch all products and categories for matching
    const { docs: products } = await req.payload.find({
      collection: 'products',
      pagination: false,
      depth: 0,
      limit: 5000,
    })

    const { docs: categories } = await req.payload.find({
      collection: 'categories',
      pagination: false,
      depth: 0,
      limit: 500,
    })

    const productMap = new Map()
    products.forEach((p: any) => {
      productMap.set(p.name.toLowerCase().trim(), { id: p.id, name: p.name })
    })

    const categoryNames = new Set(categories.map((c: any) => c.name.toLowerCase().trim()))

    const wordMatches = (w1: string, w2: string) => {
      w1 = w1.toLowerCase().replace(/[^a-z0-9]/g, '')
      w2 = w2.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!w1 || !w2) return false
      if (w1 === w2) return true
      const vany = ['vanila', 'vanilla', 'vennila']
      if (vany.includes(w1) && vany.includes(w2)) return true
      if (w1.endsWith('s') && w1.slice(0, -1) === w2) return true
      if (w2.endsWith('s') && w2.slice(0, -1) === w1) return true
      return false
    }

    const matchesCategory = (text: string) => {
      const lower = text.toLowerCase().trim()
      if (categoryNames.has(lower)) return true
      if (lower.endsWith('s') && categoryNames.has(lower.slice(0, -1))) return true
      if (!lower.endsWith('s') && categoryNames.has(lower + 's')) return true
      return false
    }

    // 2. Parse Message
    const lines = message.split(/\r?\n/)
    const items: any[] = []
    let contextStack: string[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        contextStack = [] // Reset context on empty lines between groups
        continue
      }

      const leafMatch = trimmedLine.match(/^(.*?)\s*[-:]\s*(\d+)$/)

      if (leafMatch) {
        const productNamePart = leafMatch[1].trim()
        const qty = Number(leafMatch[2])

        const candidates = []
        for (let i = 0; i < contextStack.length; i++) {
          candidates.push([...contextStack.slice(i), productNamePart].join(' ').trim())
        }
        candidates.push(productNamePart)

        let foundProduct = null

        // Pass 1: Direct matches and Word-based matches
        for (const candidate of candidates) {
          const lowerCandidate = candidate.toLowerCase()
          const candidateWords = lowerCandidate.split(/\s+/)

          for (const [name, data] of productMap.entries()) {
            const productWords = name
              .replace(/rs\.\d+/gi, '')
              .split(/[\s-]+/)
              .filter((w: string) => w.length > 0)

            const matchScore = productWords.filter((pw: string) =>
              candidateWords.some((cw: string) => wordMatches(pw, cw)),
            ).length

            if (matchScore === productWords.length && productWords.length > 0) {
              foundProduct = data
              break
            }
          }
          if (foundProduct) break
        }

        if (foundProduct) {
          items.push({
            product: foundProduct.id,
            name: foundProduct.name,
            inStock: 0,
            requiredQty: qty,
            status: 'ordered',
          })
        }
      } else {
        if (matchesCategory(trimmedLine)) {
          contextStack = [trimmedLine]
        } else {
          if (contextStack.length >= 2) {
            contextStack.pop()
          }
          contextStack.push(trimmedLine)
        }
      }
    }

    if (items.length === 0) {
      return Response.json({ message: 'No products matched in the message' }, { status: 400 })
    }

    // 3. Determine if it's Live or Stock
    // Use the provided orderType if available, else logic
    // But user request requested "order filter(stock ,live)"
    // If deliveryDate is same as today (in branch time), it's live?
    // Actually the user said "order filter(stock ,live)" so we trust it.

    // 4. Resolve Branch's Company
    const branch = await req.payload.findByID({
      collection: 'branches',
      id: branchId,
      depth: 0,
    })

    if (!branch) {
      return Response.json({ message: 'Branch not found' }, { status: 404 })
    }

    // 5. Create Stock Order
    const finalDeliveryDate =
      orderType === 'live'
        ? dayjs().tz('Asia/Kolkata').toISOString()
        : dayjs(deliveryDate).toISOString()

    const order = await req.payload.create({
      collection: 'stock-orders',
      user: req.user,
      data: {
        branch: branchId,
        deliveryDate: finalDeliveryDate,
        items,
        status: 'ordered',
        company: typeof branch.company === 'object' ? branch.company.id : branch.company,
        createdBy: req.user.id,
      } as any, // Cast to any because invoiceNumber is required in types but generated in hook
    })

    return Response.json({
      message: 'Order created successfully',
      invoiceNumber: order.invoiceNumber,
      id: order.id,
      matchedItemsCount: items.length,
    })
  } catch (error: any) {
    req.payload.logger.error(error)
    return Response.json({ message: error.message || 'Error creating order' }, { status: 500 })
  }
}
