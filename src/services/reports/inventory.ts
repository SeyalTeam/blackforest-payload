import type { PayloadRequest } from 'payload'
import { addGranularMatch } from '../../utilities/inventory'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

export type InventoryReportBranch = {
  id: string
  initial: number
  instock: number
  inventory: number
  name: string
  received: number
  returned: number
  sold: number
  value: number
}

export type InventoryReportProduct = {
  branches: InventoryReportBranch[]
  id: string
  name: string
  totalInstock: number
  totalInventory: number
  totalReceived: number
  totalReturned: number
  totalSold: number
  totalValue: number
}

export type InventoryReportResult = {
  products: InventoryReportProduct[]
  timestamp: string
}

type InventoryReportArgs = {
  branch?: null | string
  category?: null | string
  department?: null | string
  product?: null | string
}

type BranchDoc = {
  id: string
  name: string
}

type ProductDoc = {
  branchOverrides?: unknown
  defaultPriceDetails?: {
    rate?: unknown
  }
  id: string
  name: string
}

type InventoryBucket = {
  initial: number
  instock: number
  inventory: number
  received: number
  returned: number
  sold: number
}

type InventoryMapEntry = {
  branches: Record<string, InventoryBucket>
  name: string
  product: ProductDoc
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toId = (value: unknown): null | string => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (typeof value === 'object') {
    const record = value as {
      _id?: unknown
      id?: unknown
      toHexString?: () => string
      toString?: () => string
    }

    if (typeof record.id === 'string' && record.id.trim().length > 0) return record.id
    if (typeof record._id === 'string' && record._id.trim().length > 0) return record._id
    if (typeof record.toHexString === 'function') {
      const hex = record.toHexString()
      if (hex && hex.trim().length > 0) return hex
    }
    if (typeof record.toString === 'function') {
      const text = record.toString()
      if (text && text !== '[object Object]') return text
    }
  }

  return null
}

export const getInventoryReportData = async (
  req: PayloadRequest,
  args: InventoryReportArgs = {},
): Promise<InventoryReportResult> => {
  const { payload } = req

  const department = typeof args.department === 'string' ? args.department : ''
  const category = typeof args.category === 'string' ? args.category : ''
  const product = typeof args.product === 'string' ? args.product : ''
  const branch = typeof args.branch === 'string' ? args.branch : ''

  const { branchIds: scopedBranchIds } = await resolveReportBranchScope(req, branch || null)

  // 1. Handle Department / Category / Product filter
  const query: any = { and: [] }

  if (department && department !== 'all') {
    const categoriesInDept = await payload.find({
      collection: 'categories',
      where: { department: { equals: department } },
      limit: 1000,
      pagination: false,
    })
    const categoryIds = categoriesInDept.docs.map((item) => item.id)
    query.and.push({ category: { in: categoryIds } })
  }

  if (category && category !== 'all') {
    query.and.push({ category: { equals: category } })
  }

  if (product && product !== 'all') {
    query.and.push({ id: { equals: product } })
  }

  if (query.and.length === 0) delete query.and

  // 2. Handle Branch filter with scope + legacy non-company restriction
  const branchQuery: any = { and: [] }
  if (scopedBranchIds) {
    branchQuery.and.push({ id: { in: scopedBranchIds } })
  }

  const allowedCompanies = [
    '68fcabc113ce32e6595e46ba',
    '68fcabf913ce32e6595e46cc',
    '68fcac0b13ce32e6595e46cf',
  ]
  if (req.user?.role !== 'company') {
    branchQuery.and.push({ company: { in: allowedCompanies } })
  }

  if (branchQuery.and.length === 0) delete branchQuery.and

  const [productsResult, branchesResult] = await Promise.all([
    payload.find({
      collection: 'products',
      where: query,
      limit: 1000,
      pagination: false,
    }),
    payload.find({
      collection: 'branches',
      where: branchQuery,
      limit: 100,
      pagination: false,
    }),
  ])

  const products = productsResult.docs as ProductDoc[]
  const branches = branchesResult.docs as BranchDoc[]
  const branchIds = branches.map((item) => item.id)

  const StockOrderModel = payload.db.collections['stock-orders']
  const BillingModel = payload.db.collections['billings']
  const ReturnOrderModel = payload.db.collections['return-orders']
  const InstockEntryModel = payload.db.collections['instock-entries']
  if (!StockOrderModel || !BillingModel || !ReturnOrderModel || !InstockEntryModel) {
    throw new Error('Inventory report collections not found')
  }

  const initialStockPipeline: any[] = [
    {
      $match: {
        $and: [
          { $expr: { $in: [{ $toString: '$branch' }, branchIds] } },
          { notes: 'INITIAL STOCK' },
        ],
      },
    },
  ]
  addGranularMatch(initialStockPipeline)
  initialStockPipeline.push(
    { $match: { 'items.inStock': { $gt: 0 } } },
    {
      $group: {
        _id: {
          branch: '$branch',
          product: '$items.product',
        },
        totalInStock: { $sum: '$items.inStock' },
      },
    },
  )
  const initialStockStats = await StockOrderModel.aggregate(initialStockPipeline)

  const stockInPipeline: any[] = [
    {
      $match: {
        $expr: { $in: [{ $toString: '$branch' }, branchIds] },
      },
    },
  ]
  addGranularMatch(stockInPipeline, 'items.receivedDate')
  stockInPipeline.push(
    { $match: { 'items.receivedQty': { $gt: 0 } } },
    {
      $group: {
        _id: {
          branch: '$branch',
          product: '$items.product',
        },
        totalReceived: { $sum: '$items.receivedQty' },
      },
    },
  )
  const stockInStats = await StockOrderModel.aggregate(stockInPipeline)

  const stockOutPipeline: any[] = [
    {
      $match: {
        $and: [
          { $expr: { $in: [{ $toString: '$branch' }, branchIds] } },
          { status: { $ne: 'cancelled' } },
        ],
      },
    },
  ]
  addGranularMatch(stockOutPipeline)
  stockOutPipeline.push({
    $group: {
      _id: {
        branch: '$branch',
        product: '$items.product',
      },
      totalSold: { $sum: '$items.quantity' },
    },
  })
  const stockOutStats = await BillingModel.aggregate(stockOutPipeline)

  const returnPipeline: any[] = [
    {
      $match: {
        $and: [
          { $expr: { $in: [{ $toString: '$branch' }, branchIds] } },
          { status: { $ne: 'cancelled' } },
        ],
      },
    },
  ]
  addGranularMatch(returnPipeline)
  returnPipeline.push({
    $group: {
      _id: {
        branch: '$branch',
        product: '$items.product',
      },
      totalReturned: { $sum: '$items.quantity' },
    },
  })
  const returnStats = await ReturnOrderModel.aggregate(returnPipeline)

  const instockPipeline: any[] = [
    {
      $match: {
        $and: [{ $expr: { $in: [{ $toString: '$branch' }, branchIds] } }],
      },
    },
  ]
  addGranularMatch(instockPipeline)
  instockPipeline.push(
    { $unwind: '$items' },
    {
      $match: {
        'items.status': 'approved',
        'items.instock': { $gt: 0 },
      },
    },
    {
      $group: {
        _id: {
          branch: '$branch',
          product: '$items.product',
        },
        totalInstock: { $sum: '$items.instock' },
      },
    },
  )
  const instockStats = await InstockEntryModel.aggregate(instockPipeline)

  const inventoryMap: Record<string, InventoryMapEntry> = {}
  products.forEach((item) => {
    const branchesMap: Record<string, InventoryBucket> = {}
    branches.forEach((branchDoc) => {
      branchesMap[branchDoc.id] = {
        inventory: 0,
        initial: 0,
        received: 0,
        sold: 0,
        returned: 0,
        instock: 0,
      }
    })

    inventoryMap[item.id] = {
      name: item.name,
      product: item,
      branches: branchesMap,
    }
  })

  const processMetric = (
    rows: any[],
    metricKey: keyof InventoryBucket,
    totalField: string,
    sign: 1 | -1,
  ) => {
    rows.forEach((stat) => {
      const branchId = toId(stat?._id?.branch)
      const productId = toId(stat?._id?.product)
      const amount = toNumber(stat?.[totalField])

      if (
        branchId &&
        productId &&
        inventoryMap[productId] &&
        inventoryMap[productId].branches[branchId]
      ) {
        inventoryMap[productId].branches[branchId][metricKey] += amount
        inventoryMap[productId].branches[branchId].inventory += sign * amount
      }
    })
  }

  processMetric(initialStockStats, 'initial', 'totalInStock', 1)
  processMetric(stockInStats, 'received', 'totalReceived', 1)
  processMetric(stockOutStats, 'sold', 'totalSold', -1)
  processMetric(returnStats, 'returned', 'totalReturned', -1)
  processMetric(instockStats, 'instock', 'totalInstock', 1)

  const reportData = Object.entries(inventoryMap).map(([productId, item]) => {
    const totalInventory = Object.values(item.branches).reduce((sum, branchData) => {
      return sum + branchData.inventory
    }, 0)
    const totalSold = Object.values(item.branches).reduce((sum, branchData) => {
      return sum + branchData.sold
    }, 0)
    const totalReturned = Object.values(item.branches).reduce((sum, branchData) => {
      return sum + branchData.returned
    }, 0)
    const totalReceived = Object.values(item.branches).reduce((sum, branchData) => {
      return sum + branchData.received
    }, 0)
    const totalInstock = Object.values(item.branches).reduce((sum, branchData) => {
      return sum + branchData.instock
    }, 0)

    const branchDetails = branches.map((branchDoc) => {
      const stats = item.branches[branchDoc.id] || {
        inventory: 0,
        initial: 0,
        received: 0,
        sold: 0,
        returned: 0,
        instock: 0,
      }
      const inventory = stats.inventory

      let rate = toNumber(item.product.defaultPriceDetails?.rate)
      if (Array.isArray(item.product.branchOverrides)) {
        const override = item.product.branchOverrides.find((branchOverride: any) => {
          const overrideBranchId =
            typeof branchOverride?.branch === 'string'
              ? branchOverride.branch
              : branchOverride?.branch?.id
          return overrideBranchId === branchDoc.id
        })
        if (override && override.rate !== undefined && override.rate !== null) {
          rate = toNumber(override.rate)
        }
      }

      const value = inventory * rate

      return {
        id: branchDoc.id,
        name: branchDoc.name,
        inventory,
        value,
        sold: stats.sold,
        returned: stats.returned,
        received: stats.received,
        instock: stats.instock,
        initial: stats.initial,
      }
    })

    const totalValue = branchDetails.reduce((sum, branchData) => sum + branchData.value, 0)

    return {
      id: productId,
      name: item.name,
      totalInventory,
      totalValue,
      totalSold,
      totalReturned,
      totalReceived,
      totalInstock,
      branches: branchDetails,
    }
  })

  reportData.sort((a, b) => a.name.localeCompare(b.name))

  return {
    timestamp: new Date().toISOString(),
    products: reportData,
  }
}
