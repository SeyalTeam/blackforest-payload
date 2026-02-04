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
    // 1. Fetch all products for matching
    const { docs: products } = await req.payload.find({
      collection: 'products',
      pagination: false,
      depth: 0,
      limit: 5000,
    })

    const productMap = new Map()
    products.forEach((p: any) => {
      productMap.set(p.name.toLowerCase().trim(), { id: p.id, name: p.name })
    })

    // 2. Parse Message
    // Split by newlines or comma
    const lines = message.split(/\r?\n|,/)
    const items: any[] = []

    for (const line of lines) {
      if (!line.trim()) continue

      // Try to extract quantity and product name
      // Example: "Veg puff 30" or "30 Veg puff"
      const match = line.match(/^(.*?)\s+(\d+)$/) || line.match(/^(\d+)\s+(.*)$/)

      let searchName = line.trim()
      let qty = 1

      if (match) {
        if (isNaN(Number(match[1]))) {
          searchName = match[1].trim()
          qty = Number(match[2])
        } else {
          qty = Number(match[1])
          searchName = match[2].trim()
        }
      }

      // Fuzzy matching
      let found = productMap.get(searchName.toLowerCase())
      if (!found) {
        for (const [name, data] of productMap.entries()) {
          if (name.includes(searchName.toLowerCase()) || searchName.toLowerCase().includes(name)) {
            found = data
            break
          }
        }
      }

      if (found) {
        items.push({
          product: found.id,
          name: found.name,
          inStock: 0,
          requiredQty: qty,
          status: 'ordered',
        })
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
