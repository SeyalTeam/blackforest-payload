import { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import mongoose from 'mongoose'
import { Product } from '../payload-types'
import { resolveReportBranchScope, toBranchQueryFilter } from './reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export const getDashboardStatsHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  // 0. Parse Query Parameters
  const { startDate, endDate, branch, department, category, product } = req.query as {
    startDate?: string
    endDate?: string
    branch?: string
    department?: string
    category?: string
    product?: string
  }

  try {
    const { branchIds, errorResponse } = await resolveReportBranchScope(req, branch || null)
    if (errorResponse) return errorResponse

    // 1. Define Range
    // If no dates provided, default to Today
    const start = startDate
      ? dayjs(startDate).startOf('day')
      : dayjs().tz('Asia/Kolkata').startOf('day')
    const end = endDate ? dayjs(endDate).endOf('day') : dayjs().tz('Asia/Kolkata').endOf('day')

    const startISO = start.toDate()
    const endISO = end.toDate()

    // 2. Fetch Products with Filters
    const productQuery: any = {
      collection: 'products',
      limit: 5000,
      pagination: false,
      where: {},
    }

    if (department) productQuery.where.department = { equals: department }
    if (category) productQuery.where.category = { equals: category }
    if (product) productQuery.where.id = { equals: product }

    const { docs: products } = await payload.find(productQuery)

    // Optimization: If no products found, return empty early
    if (products.length === 0) return Response.json([])

    // 3. Helper for Aggregation Matches
    // Common match: branch (if selected), status (not cancelled)
    const commonMatch: any = { status: { $ne: 'cancelled' } }
    if (branchIds && branchIds.length > 0) {
      Object.assign(commonMatch, toBranchQueryFilter(branchIds, 'branch'))
    }

    const targetProductIds = (department || category || product)
      ? products.map((p) => p.id).filter(Boolean)
      : []
    const productMatchStage = targetProductIds.length > 0 && targetProductIds.length < 2000
      ? [
          {
            $match: {
              'items.product': {
                $in: targetProductIds.map((id) =>
                  mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
                ),
              },
            },
          },
        ]
      : []

    // Helper to generate pipelines
    const createPipeline = (
      collection: string,
      dateField: string | null, // Field to filter by date (for Movements), pass null for All Time (CIS)
      countField: string,
      extraMatch: any = {},
    ) => {
      const match: any = { ...commonMatch, ...extraMatch }

      // If dateField is provided, we filter by range
      if (dateField) {
        match[dateField] = {
          $gte: startISO,
          $lte: endISO,
        }
      }

      return [
        { $match: match },
        { $unwind: '$items' },
        { $match: { [`items.${countField}`]: { $gt: 0 } } },
        ...productMatchStage,
        {
          $group: {
            _id: '$items.product',
            total: { $sum: `$items.${countField}` },
          },
        },
      ]
    }

    // --- A. Current Instock (CIS) ---
    const initialPipeline = createPipeline('stock-orders', null, 'inStock', {
      notes: 'INITIAL STOCK',
    })

    const allReceivedPipeline = createPipeline('stock-orders', null, 'receivedQty', {})
    const allSoldPipeline = createPipeline('billings', null, 'quantity', {})
    const allReturnedPipeline = createPipeline('return-orders', null, 'quantity', {})
    const allInstockPipeline = createPipeline('instock-entries', null, 'instock', {
      status: 'approved',
    })

    // --- B.  Movements in Range (REC, BILL, RTN) ---
    const manualRecPipeline = [
      { $match: { ...commonMatch } },
      { $unwind: '$items' },
      {
        $match: {
          'items.receivedQty': { $gt: 0 },
          'items.receivedDate': { $gte: startISO, $lte: endISO },
        },
      },
      ...productMatchStage,
      {
        $group: {
          _id: '$items.product',
          total: { $sum: '$items.receivedQty' },
        },
      },
    ]

    const billPipeline = createPipeline('billings', 'createdAt', 'quantity', {})
    const rtnPipeline = createPipeline('return-orders', 'createdAt', 'quantity', {})

    // Execute Aggregations
    const [
      initialRes,
      allRecRes,
      allSoldRes,
      allRtnRes,
      allInstockRes,
      rangeRecRes,
      rangeBillRes,
      rangeRtnRes,
    ] = await Promise.all([
      payload.db.collections['stock-orders'].aggregate(initialPipeline),
      payload.db.collections['stock-orders'].aggregate(allReceivedPipeline),
      payload.db.collections['billings'].aggregate(allSoldPipeline),
      payload.db.collections['return-orders'].aggregate(allReturnedPipeline),
      payload.db.collections['instock-entries'].aggregate(allInstockPipeline),
      payload.db.collections['stock-orders'].aggregate(manualRecPipeline),
      payload.db.collections['billings'].aggregate(billPipeline),
      payload.db.collections['return-orders'].aggregate(rtnPipeline),
    ])

    // Convert to Maps for O(1) hash lookups instead of 8 * O(N) array finds
    const createSumMap = (arr: any[]) => {
      const map = new Map<string, number>()
      for (const item of arr) {
        if (item?._id != null) {
          map.set(String(item._id), Number(item.total) || 0)
        }
      }
      return map
    }

    const initialMap = createSumMap(initialRes)
    const allRecMap = createSumMap(allRecRes)
    const allSoldMap = createSumMap(allSoldRes)
    const allRtnMap = createSumMap(allRtnRes)
    const allInstockMap = createSumMap(allInstockRes)
    const rangeRecMap = createSumMap(rangeRecRes)
    const rangeBillMap = createSumMap(rangeBillRes)
    const rangeRtnMap = createSumMap(rangeRtnRes)

    // --- Combine Data ---
    const productStats = products.map((pDoc) => {
      const p = pDoc as Product
      const pid = String(p.id)

      // CIS (Total based on filters)
      const cis =
        (initialMap.get(pid) || 0) +
        (allRecMap.get(pid) || 0) +
        (allInstockMap.get(pid) || 0) -
        (allSoldMap.get(pid) || 0) -
        (allRtnMap.get(pid) || 0)

      // Range Movements
      const rec = rangeRecMap.get(pid) || 0
      const bill = rangeBillMap.get(pid) || 0
      const rtn = rangeRtnMap.get(pid) || 0

      // OIS (Calculated Backwards from CIS)
      const ois = cis - rec + bill + rtn

      return {
        name: p.name,
        ois: Number(ois.toFixed(2)),
        rec: Number(rec.toFixed(2)),
        rtn: Number(rtn.toFixed(2)),
        tot: Number((ois + rec).toFixed(2)),
        bill: Number(bill.toFixed(2)),
        cis: Number(cis.toFixed(2)),
      }
    })

    return Response.json(productStats)
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
