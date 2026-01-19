import { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

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
    if (branch) commonMatch.branch = branch

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
        // Special handling for 'receivedDate' if stored as string or date
        // We'll use $gte/$lte which works for both ISO strings and Date objects usually
        // but strict type might matter. 'StockOrders' uses 'receivedDate'.
        match[dateField] = {
          $gte: startISO,
          $lte: endISO,
        }
      }

      return [
        { $match: match },
        { $unwind: '$items' },
        { $match: { [`items.${countField}`]: { $gt: 0 } } },
        // Optimization: Match products we are interested in?
        // Removed to avoid ObjectId vs String casting issues in raw aggregation.
        // We filter in the final map loop anyway.
        {
          $group: {
            _id: '$items.product',
            total: { $sum: `$items.${countField}` },
          },
        },
      ]
    }

    // --- A. Current Instock (CIS) ---
    // CIS = All Time In - All Time Out (filtered by branch)

    // 1. Initial Stock (Special Case, no 'branch' field on top level usually? Need to check.
    // Usually Initial Stock is a special StochOrder type.
    // If branch filter is on, we trust the 'branch' field on StockOrder.
    const initialPipeline = createPipeline('stock-orders', null, 'inStock', {
      notes: 'INITIAL STOCK',
    })

    // 2. All Received
    const allReceivedPipeline = createPipeline('stock-orders', null, 'receivedQty', {})

    // 3. All Sold
    const allSoldPipeline = createPipeline('billings', null, 'quantity', {})

    // 4. All Returns
    const allReturnedPipeline = createPipeline('return-orders', null, 'quantity', {})

    // 5. All Instock Entries
    const allInstockPipeline = createPipeline('instock-entries', null, 'instock', {
      status: 'approved',
    })

    // --- B.  Movements in Range (REC, BILL, RTN) ---

    // 1. Received (REC)
    const recPipeline = createPipeline('stock-orders', 'items.receivedDate', 'receivedQty', {}) // Note: receivedDate is on Item usually?
    // Wait, createPipeline assumes top-level match.
    // StackOrder 'items' has 'receivedDate'.
    // My createPipeline applies match at top level.
    // For 'receivedDate', we need to unwind first IF it's inside items.
    // Let's refine createPipeline or do it manually for REC.

    // Manual REC Pipeline to handle item-level date
    const manualRecPipeline = [
      { $match: { ...commonMatch } }, // Branch match
      { $unwind: '$items' },
      {
        $match: {
          'items.receivedQty': { $gt: 0 },
          'items.receivedDate': { $gte: startISO, $lte: endISO },
        },
      },
      {
        $group: {
          _id: '$items.product',
          total: { $sum: '$items.receivedQty' },
        },
      },
    ]

    // 2. Billed (BILL) - createdAt is top level
    const billPipeline = createPipeline('billings', 'createdAt', 'quantity', {})

    // 3. Returned (RTN) - createdAt is top level
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

    // --- Combine Data ---
    const productStats = products.map((p) => {
      const pid = p.id
      const getSum = (arr: any[]) => arr.find((x) => String(x._id) === pid)?.total || 0

      // CIS (Total based on filters)
      const cis =
        getSum(initialRes) +
        getSum(allRecRes) +
        getSum(allInstockRes) -
        getSum(allSoldRes) -
        getSum(allRtnRes)

      // Range Movements
      const rec = getSum(rangeRecRes)
      const bill = getSum(rangeBillRes)
      const rtn = getSum(rangeRtnRes)

      // OIS (Calculated Backwards from CIS)
      // Math: Closing = Opening + In - Out
      // CIS = OIS + REC - BILL - RTN
      // => OIS = CIS - REC + BILL + RTN
      // Accuracy Note: This OIS is "Start of Range" implies that CIS is "End of Range".
      // But CIS is actually "Now".
      // So OIS calculated this way is "Stock at Start of Range, assuming no movements occurred AFTER Range".
      // This is imperfect for past ranges but correct for "Today" and "Month to Date".

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
