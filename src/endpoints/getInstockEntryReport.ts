import { PayloadHandler } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export const getInstockEntryReportHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Parse query params
  const url = new URL(req.url || '')
  const startDateStr = url.searchParams.get('startDate')
  const endDateStr = url.searchParams.get('endDate')
  const branchFilter = url.searchParams.get('branch')
  const departmentFilter = url.searchParams.get('department')
  const categoryFilter = url.searchParams.get('category')
  const productFilter = url.searchParams.get('product')
  const dealerFilter = url.searchParams.get('dealer')
  const statusFilter = url.searchParams.get('status')

  const start = startDateStr
    ? dayjs.tz(startDateStr, 'Asia/Kolkata').startOf('day')
    : dayjs().tz('Asia/Kolkata').startOf('day')
  const end = endDateStr
    ? dayjs.tz(endDateStr, 'Asia/Kolkata').endOf('day')
    : dayjs().tz('Asia/Kolkata').endOf('day')

  try {
    // 1. Fetch Instock Entries
    const where: any = {
      date: {
        greater_than_equal: start.toISOString(),
        less_than_equal: end.toISOString(),
      },
    }

    if (branchFilter) {
      where.branch = { equals: branchFilter }
    }
    if (dealerFilter) {
      where['items.dealer'] = { equals: dealerFilter }
    }
    if (statusFilter) {
      where.status = { equals: statusFilter }
    }

    const { docs: entries } = await req.payload.find({
      collection: 'instock-entries',
      where,
      depth: 1,
      limit: 5000,
      pagination: false,
      sort: '-date',
    })

    // 2. Fetch Products for Lookup (Optimized)
    const productIds = new Set<string>()
    entries.forEach((entry) => {
      if (entry.items && Array.isArray(entry.items)) {
        entry.items.forEach((item: any) => {
          const pid = typeof item.product === 'object' ? item.product?.id : item.product
          if (pid) productIds.add(pid)
        })
      }
    })

    const productsQuery: any = {
      limit: 5000,
      pagination: false,
      depth: 2, // Need Category -> Department
      collection: 'products',
      where: {
        id: { in: Array.from(productIds) },
      },
    }

    // Optimization: If product filter is set, override or intersect
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

    // 3. Aggregate Data
    const detailsMap = new Map<string, any>()
    const branchStats = new Map<string, number>() // Total entries by branch
    const invoiceStats = new Map<
      string,
      {
        invoice: string
        date: string
        productCount: number
        totalAmount: number
      }
    >()

    entries.forEach((entry) => {
      const branchId = typeof entry.branch === 'object' ? entry.branch?.id : entry.branch
      const branchName = typeof entry.branch === 'object' ? entry.branch?.name : 'Unknown'

      if (branchId) {
        branchStats.set(branchName, (branchStats.get(branchName) || 0) + 1)
      }

      // Initialize invoice stat if exists
      if (entry.invoiceNumber && !invoiceStats.has(entry.invoiceNumber)) {
        invoiceStats.set(entry.invoiceNumber, {
          invoice: entry.invoiceNumber,
          date: entry.createdAt, // Using createdAt for precise time, or entry.date if preferred
          productCount: 0,
          totalAmount: 0,
        })
      }

      if (entry.items && Array.isArray(entry.items)) {
        entry.items.forEach((item: any) => {
          const prodId = typeof item.product === 'object' ? item.product?.id : item.product
          const productData = productMap.get(prodId)

          // Handle Dealer Filter at Item Level
          const itemDealerId = typeof item.dealer === 'object' ? item.dealer?.id : item.dealer
          if (dealerFilter && itemDealerId !== dealerFilter) return

          // Filter Logic
          if (!productData) return
          if (categoryFilter && productData.categoryId !== categoryFilter) return
          if (departmentFilter && productData.departmentId !== departmentFilter) return

          // Update Invoice Stats
          if (entry.invoiceNumber && invoiceStats.has(entry.invoiceNumber)) {
            const stat = invoiceStats.get(entry.invoiceNumber)!
            stat.productCount += 1
            stat.totalAmount += (item.instock || 0) * (productData.price || 0)
          }

          // Unique Key for aggregation: Product ID
          // (We aggregate ALL entries for this product in the date range)
          const uniqueKey = prodId

          // Handle Dealer Info for Display
          const itemDealerName =
            typeof item.dealer === 'object' ? item.dealer?.companyName : 'Unknown Dealer'

          if (detailsMap.has(uniqueKey)) {
            const existing = detailsMap.get(uniqueKey)
            existing.instockQty += item.instock || 0

            // Append Invoice Numbers if not exists
            if (entry.invoiceNumber && !existing.invoiceNumbers.includes(entry.invoiceNumber)) {
              existing.invoiceNumbers.push(entry.invoiceNumber)
            }

            // count pending
            const isPending = (item.status || entry.status) === 'waiting'
            if (isPending) {
              existing.pendingQty += item.instock || 0
            }

            // Update Invoice Details
            if (entry.invoiceNumber) {
              if (!existing.invoiceDetails) existing.invoiceDetails = {}

              if (existing.invoiceDetails[entry.invoiceNumber]) {
                existing.invoiceDetails[entry.invoiceNumber].qty += item.instock || 0
                // Status priority: approved > waiting
                if (item.status === 'approved' || entry.status === 'approved') {
                  existing.invoiceDetails[entry.invoiceNumber].status = 'approved'
                }
              } else {
                existing.invoiceDetails[entry.invoiceNumber] = {
                  qty: item.instock || 0,
                  status: item.status || entry.status || 'waiting',
                  dealer: itemDealerName,
                  branch: branchName,
                  entryId: entry.id,
                  itemId: item.id,
                }
              }
            }

            // Branch Breakdown (Full Name)
            const bName = branchName || 'Unknown'
            existing.branchStats.set(
              bName,
              (existing.branchStats.get(bName) || 0) + (item.instock || 0),
            )
          } else {
            const bName = branchName || 'Unknown'
            const initialBranchStats = new Map<string, number>()
            initialBranchStats.set(bName, item.instock || 0)

            // Invoice Granular Details
            const currentInvoiceDetail = {
              qty: item.instock || 0,
              status: item.status || entry.status || 'waiting',
              dealer: itemDealerName,
              branch: branchName,
              entryId: entry.id,
              itemId: item.id,
            }

            // Map for invoice details (initialized below or retrieved)
            const newInvoiceDetails: Record<string, any> = {}
            if (entry.invoiceNumber) {
              newInvoiceDetails[entry.invoiceNumber] = currentInvoiceDetail
            }

            const isPending = (item.status || entry.status) === 'waiting'

            detailsMap.set(uniqueKey, {
              productName: productData.name,
              categoryName: productData.categoryName,
              departmentName: productData.departmentName,
              dealerName: itemDealerName, // Default/Last dealer for agg view
              instockQty: item.instock || 0,
              pendingQty: isPending ? item.instock || 0 : 0,
              invoiceNumbers: entry.invoiceNumber ? [entry.invoiceNumber] : [],
              branchStats: initialBranchStats,
              invoiceDetails: newInvoiceDetails,
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
            const [code] = entry
            return code
          })
          .join(', '),
        // invoiceDetails is already an object, no conversion needed if we used Record
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

    const totalInstock = details.reduce((sum, item) => sum + item.instockQty, 0)
    const totalEntries = entries.length

    // Filter out invoices with 0 products (if filter removed all items)
    const invoices = Array.from(invoiceStats.values())
      .filter((inv) => inv.productCount > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return Response.json({
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      totalInstock,
      totalEntries,
      details,
      invoices,
    })
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ message: 'Error generating report' }, { status: 500 })
  }
}
