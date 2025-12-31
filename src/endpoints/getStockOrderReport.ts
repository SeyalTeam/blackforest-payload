import { PayloadHandler } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const getStockOrderReportHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  if (!req.url) {
    return Response.json({ message: 'Invalid URL' }, { status: 400 })
  }

  // Parse query params
  const url = new URL(req.url)
  const startDateStr = url.searchParams.get('startDate')
  const endDateStr = url.searchParams.get('endDate')
  const branchFilter = url.searchParams.get('branch')
  const departmentFilter = url.searchParams.get('department')
  const categoryFilter = url.searchParams.get('category')
  const productFilter = url.searchParams.get('product')
  const statusFilter = url.searchParams.get('status')
  const orderTypeFilter = url.searchParams.get('orderType') // 'stock' | 'live'
  const invoiceFilter = url.searchParams.get('invoice')

  const start = startDateStr ? dayjs(startDateStr).startOf('day') : dayjs().startOf('day')
  const end = endDateStr ? dayjs(endDateStr).endOf('day') : dayjs().endOf('day')

  try {
    // 1. Fetch Products for Lookup (filtering context)
    // We need this to filter items by Department/Category/Product and get Price
    const productsQuery: any = {
      limit: 5000,
      pagination: false,
      depth: 2, // Need Category -> Department
      collection: 'products',
    }

    // Optimization: If product filter is set, only fetch that product
    if (productFilter) {
      productsQuery.where = { id: { equals: productFilter } }
    }

    const { docs: products } = await req.payload.find(productsQuery)

    const productMap = new Map<string, any>()
    products.forEach((p: any) => {
      const cat = typeof p.category === 'object' ? p.category : null
      const dept = cat && typeof cat.department === 'object' ? cat.department : null

      productMap.set(p.id, {
        name: p.name,
        price: p.defaultPriceDetails?.price || 0,
        categoryId: cat?.id,
        categoryName: cat?.name || 'Uncategorized',
        departmentId: dept?.id,
        departmentName: dept?.name || 'No Department',
      })
    })

    // 2. Fetch Stock Orders
    const where: any = {
      deliveryDate: {
        greater_than_equal: start.toISOString(),
        less_than_equal: end.toISOString(),
      },
    }

    if (branchFilter) {
      where.branch = { equals: branchFilter }
    }

    const { docs: orders } = await req.payload.find({
      collection: 'stock-orders',
      where,
      depth: 1,
      limit: 5000,
      pagination: false,
      sort: '-updatedAt',
    })

    // 3. Aggregate Data (Matrix) and Details
    const branchMap = new Map<
      string,
      {
        branchName: string
        stockOrders: number
        liveOrders: number
        totalOrders: number
      }
    >()

    const detailsMap = new Map<string, any>()
    const invoiceNumbers = new Map<string, { isLive: boolean; createdAt: string }>()

    orders.forEach((order) => {
      // --- Matrix Aggregation ---
      const branchId = typeof order.branch === 'object' ? order.branch?.id : order.branch
      const branchName = typeof order.branch === 'object' ? order.branch?.name : 'Unknown'

      const created = dayjs(order.createdAt).tz('Asia/Kolkata').format('YYYY-MM-DD')
      const delivery = dayjs(order.deliveryDate).tz('Asia/Kolkata').format('YYYY-MM-DD')
      const isLive = delivery === created

      // Order Type Filtering
      if (orderTypeFilter) {
        if (orderTypeFilter === 'stock' && isLive) return
        if (orderTypeFilter === 'live' && !isLive) return
      }

      if (order.invoiceNumber) {
        invoiceNumbers.set(order.invoiceNumber, { isLive, createdAt: order.createdAt })
      }

      // Invoice Filtering (Drill-down)
      if (invoiceFilter && order.invoiceNumber !== invoiceFilter) return

      if (branchId) {
        if (!branchMap.has(branchId)) {
          branchMap.set(branchId, {
            branchName: branchName || 'Unknown',
            stockOrders: 0,
            liveOrders: 0,
            totalOrders: 0,
          })
        }
        const stat = branchMap.get(branchId)!

        if (isLive) stat.liveOrders++
        else stat.stockOrders++
        stat.totalOrders++
      }

      // --- Details Extraction ---
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const prodId = typeof item.product === 'object' ? item.product?.id : item.product
          const productData = productMap.get(prodId)

          // Filter Logic
          if (!productData) return // Skip if product not found (or filtered out by productFilter)
          if (categoryFilter && productData.categoryId !== categoryFilter) return
          if (departmentFilter && productData.departmentId !== departmentFilter) return
          if (statusFilter && item.status !== statusFilter) return

          // Helper to get max date
          const getMaxDate = (d1: string | null | undefined, d2: string | null | undefined) => {
            if (!d1) return d2
            if (!d2) return d1
            return dayjs(d1).isAfter(dayjs(d2)) ? d1 : d2
          }

          const branchCode = branchName ? branchName.substring(0, 3).toUpperCase() : ''

          if (detailsMap.has(prodId)) {
            // Aggregate
            const existing = detailsMap.get(prodId)
            existing.ordQty += item.requiredQty || 0
            existing.ordTime = getMaxDate(existing.ordTime, item.requiredDate)

            existing.sntQty += item.sendingQty || 0
            existing.sntTime = getMaxDate(existing.sntTime, item.sendingDate)

            existing.conQty += item.confirmedQty || 0
            existing.conTime = getMaxDate(existing.conTime, item.confirmedDate)

            existing.picQty += item.pickedQty || 0
            existing.picTime = getMaxDate(existing.picTime, item.pickedDate)

            existing.recQty += item.receivedQty || 0
            existing.recTime = getMaxDate(existing.recTime, item.receivedDate)

            existing.difQty += item.differenceQty || 0

            if (branchCode) {
              const currentQty = existing.branchStats.get(branchCode) || 0
              existing.branchStats.set(branchCode, currentQty + (item.requiredQty || 0))
            }
          } else {
            // Add new
            const initialBranchStats = new Map<string, number>()
            if (branchCode) {
              initialBranchStats.set(branchCode, item.requiredQty || 0)
            }

            detailsMap.set(prodId, {
              productName: productData.name,
              categoryName: productData.categoryName,
              departmentName: productData.departmentName,
              price: productData.price,

              // Ordered (Required)
              ordQty: item.requiredQty || 0,
              ordTime: item.requiredDate,

              // Sending
              sntQty: item.sendingQty || 0,
              sntTime: item.sendingDate,

              // Confirmed
              conQty: item.confirmedQty || 0,
              conTime: item.confirmedDate,

              // Picked
              picQty: item.pickedQty || 0,
              picTime: item.pickedDate,

              // Received
              recQty: item.receivedQty || 0,
              recTime: item.receivedDate,

              // Difference
              difQty: item.differenceQty || 0,

              // Context
              branchName: branchName, // Note: In mixed view this will be the first branch found, but not used in UI
              branchStats: initialBranchStats,
            })
          }
        })
      }
    })

    // Convert Map to Array
    const details = Array.from(detailsMap.values())
      .map((item) => ({
        ...item,
        branchDisplay: Array.from(item.branchStats)
          .map((entry: any) => {
            const [code, qty] = entry
            return `${code} - ${qty}`
          })
          .join(','),
      }))
      .sort((a, b) => {
        // Sort by Department Name first
        const deptCompare = (a.departmentName || '').localeCompare(b.departmentName || '')
        if (deptCompare !== 0) return deptCompare
        // Then by Category Name
        const catCompare = (a.categoryName || '').localeCompare(b.categoryName || '')
        if (catCompare !== 0) return catCompare
        // Then by Product Name
        return a.productName.localeCompare(b.productName)
      })

    // If no branch filter selected, branchMap naturally contains only branches with orders.
    // If user wants to see ALL active branches even with 0 orders, we'd need to fetch branches separately.
    // Preserving existing logic: "Fetch All Branches" (removed in previous step optimization but useful for matrix)
    // To restore "All Branches in Matrix" even if 0:
    if (!branchFilter) {
      // Only fetch all branches if we are not filtering by one
      const { docs: allBranches } = await req.payload.find({
        collection: 'branches',
        limit: 1000,
        pagination: false,
      })
      allBranches.forEach((b) => {
        if (!branchMap.has(b.id)) {
          branchMap.set(b.id, {
            branchName: b.name || 'Unknown',
            stockOrders: 0,
            liveOrders: 0,
            totalOrders: 0,
          })
        }
      })
    }

    const stats = Array.from(branchMap.values()).sort((a, b) =>
      a.branchName.localeCompare(b.branchName),
    )

    const totals = stats.reduce(
      (acc, curr) => ({
        stockOrders: acc.stockOrders + curr.stockOrders,
        liveOrders: acc.liveOrders + curr.liveOrders,
        totalOrders: acc.totalOrders + curr.totalOrders,
      }),
      { stockOrders: 0, liveOrders: 0, totalOrders: 0 },
    )

    return Response.json({
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      stats,
      totals,
      details,
      invoiceNumbers: Array.from(invoiceNumbers.entries())
        .map(([invoice, { isLive, createdAt }]) => ({
          invoice,
          isLive,
          createdAt,
        }))
        .sort((a, b) => {
          const t1 = new Date(a.createdAt || 0).getTime()
          const t2 = new Date(b.createdAt || 0).getTime()
          return t1 - t2
        }),
    })
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ message: 'Error generating report' }, { status: 500 })
  }
}
