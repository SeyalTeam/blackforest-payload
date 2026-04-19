import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type StockOrderReportStat = {
  branchName: string
  stockOrders: number
  liveOrders: number
  totalOrders: number
}

export type StockOrderReportInvoice = {
  invoice: string
  isLive: boolean
  createdAt: string
  deliveryDate?: string
}

export type StockOrderReportDetail = {
  productName: string
  categoryName: string
  departmentName: string
  price: number
  invoiceNumber: string
  ordQty: number
  ordTime: string
  sntQty: number
  sntTime: string
  conQty: number
  conTime: string
  picQty: number
  picTime: string
  recQty: number
  recTime: string
  difQty: number
  branchName: string
  branchDisplay: string
}

export type StockOrderReportResult = {
  startDate: string
  endDate: string
  stats: StockOrderReportStat[]
  totals: {
    stockOrders: number
    liveOrders: number
    totalOrders: number
  }
  details: StockOrderReportDetail[]
  invoiceNumbers: StockOrderReportInvoice[]
}

export type StockOrderReportArgs = {
  startDate?: string | null
  endDate?: string | null
  branch?: string | null
  department?: string | null
  category?: string | null
  product?: string | null
  status?: string | null
  orderType?: string | null
  invoice?: string | null
}

export const getStockOrderReportData = async (
  req: PayloadRequest,
  args: StockOrderReportArgs = {},
): Promise<StockOrderReportResult> => {
  const { payload } = req

  const startDateStr = args.startDate
  const endDateStr = args.endDate
  const branchFilter = args.branch
  const departmentFilter = args.department
  const categoryFilter = args.category
  const productFilter = args.product
  const statusFilter = args.status
  const orderTypeFilter = args.orderType
  const hasExplicitBranchFilter = !!(branchFilter && branchFilter !== 'all')

  const start = startDateStr
    ? dayjs.tz(startDateStr, 'Asia/Kolkata').startOf('day')
    : dayjs().tz('Asia/Kolkata').startOf('day')
  const end = endDateStr
    ? dayjs.tz(endDateStr, 'Asia/Kolkata').endOf('day')
    : dayjs().tz('Asia/Kolkata').endOf('day')

  const { branchIds } = await resolveReportBranchScope(req, branchFilter || undefined)

  // 1. Fetch Stock Orders
  const where: any = {
    deliveryDate: {
      greater_than_equal: start.toISOString(),
      less_than_equal: end.toISOString(),
    },
  }

  if (branchIds) {
    where.branch = { in: branchIds }
  }

  const { docs: orders } = await req.payload.find({
    collection: 'stock-orders',
    where,
    depth: 1,
    limit: 5000,
    pagination: false,
    sort: '-updatedAt',
  })

  // 2. Fetch Products for Lookup
  const productIds = new Set<string>()
  orders.forEach((o) => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach((i: any) => {
        const pid = typeof i.product === 'object' ? i.product?.id : i.product
        if (pid) productIds.add(pid)
      })
    }
  })

  const productsQuery: any = {
    limit: 5000,
    pagination: false,
    depth: 2, 
    collection: 'products',
    where: {
      id: { in: Array.from(productIds) },
    },
  }

  if (productFilter && productFilter !== 'all') {
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
  const invoiceNumbersMap = new Map<
    string,
    { isLive: boolean; createdAt: string; deliveryDate?: string }
  >()

  orders.forEach((order) => {
    const branchId = typeof order.branch === 'object' ? order.branch?.id : order.branch
    const branchName = typeof order.branch === 'object' ? order.branch?.name : 'Unknown'

    const created = dayjs(order.createdAt).tz('Asia/Kolkata').format('YYYY-MM-DD')
    const delivery = dayjs(order.deliveryDate).tz('Asia/Kolkata').format('YYYY-MM-DD')
    const isLive = delivery === created

    if (orderTypeFilter && orderTypeFilter !== 'all') {
      if (orderTypeFilter === 'stock' && isLive) return
      if (orderTypeFilter === 'live' && !isLive) return
    }

    if (order.invoiceNumber) {
      invoiceNumbersMap.set(order.invoiceNumber, {
        isLive,
        createdAt: order.createdAt,
        deliveryDate: order.deliveryDate,
      })
    }

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

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const prodId = typeof item.product === 'object' ? item.product?.id : item.product
        const productData = productMap.get(prodId)

        if (!productData) return
        if (categoryFilter && categoryFilter !== 'all' && productData.categoryId !== categoryFilter) return
        if (departmentFilter && departmentFilter !== 'all' && productData.departmentId !== departmentFilter) return
        if (statusFilter && statusFilter !== 'all' && item.status !== statusFilter) return

        const getMaxDate = (d1: string | null | undefined, d2: string | null | undefined) => {
          if (!d1) return d2
          if (!d2) return d1
          return dayjs(d1).isAfter(dayjs(d2)) ? d1 : d2
        }

        const branchCode = branchName ? branchName.substring(0, 3).toUpperCase() : ''
        const invoiceKey = order.invoiceNumber || 'NO_INVOICE'
        const uniqueKey = `${prodId}__${invoiceKey}`

        if (detailsMap.has(uniqueKey)) {
          const existing = detailsMap.get(uniqueKey)
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
          const initialBranchStats = new Map<string, number>()
          if (branchCode) {
            initialBranchStats.set(branchCode, item.requiredQty || 0)
          }

          detailsMap.set(uniqueKey, {
            productName: productData.name,
            categoryName: productData.categoryName,
            departmentName: productData.departmentName,
            price: productData.price,
            invoiceNumber: order.invoiceNumber,
            ordQty: item.requiredQty || 0,
            ordTime: item.requiredDate,
            sntQty: item.sendingQty || 0,
            sntTime: item.sendingDate,
            conQty: item.confirmedQty || 0,
            conTime: item.confirmedDate,
            picQty: item.pickedQty || 0,
            picTime: item.pickedDate,
            recQty: item.receivedQty || 0,
            recTime: item.receivedDate,
            difQty: item.differenceQty || 0,
            branchName: branchName,
            branchStats: initialBranchStats,
          })
        }
      })
    }
  })

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
      const deptCompare = (a.departmentName || '').localeCompare(b.departmentName || '')
      if (deptCompare !== 0) return deptCompare
      const catCompare = (a.categoryName || '').localeCompare(b.categoryName || '')
      if (catCompare !== 0) return catCompare
      return a.productName.localeCompare(b.productName)
    })

  if (!hasExplicitBranchFilter) {
    const { docs: allBranches } = await req.payload.find({
      collection: 'branches',
      where: branchIds ? { id: { in: branchIds } } : undefined,
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

  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
    stats,
    totals,
    details,
    invoiceNumbers: Array.from(invoiceNumbersMap.entries())
      .map(([invoice, { isLive, createdAt, deliveryDate }]) => ({
        invoice,
        isLive,
        createdAt,
        deliveryDate,
      }))
      .sort((a, b) => {
        const t1 = new Date(a.createdAt || 0).getTime()
        const t2 = new Date(b.createdAt || 0).getTime()
        return t1 - t2
      }),
  }
}
