import type { PayloadHandler, Where } from 'payload'

const MIN_PHONE_DIGITS = 10
const DEFAULT_BILL_LIMIT = 15
const MAX_BILL_LIMIT = 50

type RawBillingSummary = {
  totalBills?: number
  totalAmount?: number
  lastBillAt?: Date | string | null
}

type RawBillingRow = {
  _id?: unknown
  invoiceNumber?: string
  kotNumber?: string
  status?: string
  paymentMethod?: string
  totalAmount?: number
  grossAmount?: number
  createdAt?: Date | string
  updatedAt?: Date | string
  branch?: unknown
  customerName?: string
  customerPhone?: string
  itemCount?: number
}

const toPositiveInt = (value: string | null, fallback: number, max: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, parsed)
}

const toNumeric = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const toMoney = (value: unknown): number => {
  const numeric = toNumeric(value, 0)
  return Math.round(Math.max(0, numeric) * 100) / 100
}

const toId = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (typeof value === 'object') {
    const record = value as { id?: unknown; _id?: unknown; toString?: () => string }
    if (record.id) return toId(record.id)
    if (record._id) return toId(record._id)
    if (typeof record.toString === 'function') {
      const rendered = record.toString()
      if (rendered && rendered !== '[object Object]') return rendered
    }
  }

  return null
}

const toPhoneDigits = (value: string): string => value.replace(/\D/g, '')

const buildPhoneCandidates = (rawPhone: string): string[] => {
  const trimmed = rawPhone.trim()
  const digits = toPhoneDigits(trimmed)
  const values = new Set<string>()

  if (trimmed.length > 0) values.add(trimmed)

  if (digits.length > 0) {
    values.add(digits)

    if (digits.length === 10) {
      values.add(`91${digits}`)
    } else if (digits.length > 10) {
      const lastTenDigits = digits.slice(-10)
      values.add(lastTenDigits)
      values.add(`91${lastTenDigits}`)
    }
  }

  return Array.from(values).filter((value) => value.trim().length > 0)
}

const buildPhoneWhere = (fieldPath: string, candidates: string[]): Where => {
  if (candidates.length <= 1) {
    return {
      [fieldPath]: {
        equals: candidates[0],
      },
    } as Where
  }

  return {
    or: candidates.map((candidate) => ({
      [fieldPath]: {
        equals: candidate,
      },
    })),
  } as Where
}

export const getBillingCustomerLookupHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url || 'http://localhost')
    const phoneInput =
      (url.searchParams.get('phoneNumber') || url.searchParams.get('phone') || '').trim()

    if (!phoneInput) {
      return Response.json({ message: 'phoneNumber is required' }, { status: 400 })
    }

    const normalizedPhone = toPhoneDigits(phoneInput)
    if (normalizedPhone.length < MIN_PHONE_DIGITS) {
      return Response.json(
        {
          exists: false,
          isNewCustomer: true,
          customer: null,
          billingSummary: {
            totalBills: 0,
            totalAmount: 0,
            lastBillAt: null,
          },
          recentBills: [],
          skipped: true,
          reason: `phoneNumber must contain at least ${MIN_PHONE_DIGITS} digits`,
        },
        { status: 200 },
      )
    }

    const billLimit = toPositiveInt(
      url.searchParams.get('limit'),
      DEFAULT_BILL_LIMIT,
      MAX_BILL_LIMIT,
    )
    const includeCancelled = url.searchParams.get('includeCancelled') === 'true'
    const branchId =
      (url.searchParams.get('branchId') || url.searchParams.get('branch') || '').trim() || null

    const phoneCandidates = buildPhoneCandidates(phoneInput)
    const phoneWhere = buildPhoneWhere('phoneNumber', phoneCandidates)

    const customerResult = await req.payload.find({
      collection: 'customers',
      where: phoneWhere,
      depth: 0,
      limit: 1,
      sort: '-updatedAt',
      // Keep lookup lightweight; large customers can have thousands of bill relationship IDs.
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        rewardPoints: true,
        rewardProgressAmount: true,
        isOfferEligible: true,
        totalOffersRedeemed: true,
      },
      overrideAccess: true,
    })

    const customerDoc = customerResult.docs[0] as
      | {
          id?: string
          name?: string
          phoneNumber?: string
          rewardPoints?: number
          rewardProgressAmount?: number
          isOfferEligible?: boolean
          totalOffersRedeemed?: number
        }
      | undefined

    const BillingModel = req.payload.db.collections['billings']
    if (!BillingModel) {
      throw new Error('Billings collection not found')
    }

    const billingMatch: Record<string, unknown> = {
      ['customerDetails.phoneNumber']: {
        $in: phoneCandidates,
      },
    }

    if (!includeCancelled) {
      billingMatch.status = { $ne: 'cancelled' }
    }

    if (branchId && branchId !== 'all') {
      billingMatch.$expr = {
        $eq: [{ $toString: '$branch' }, branchId],
      }
    }

    const [summaryRows, recentBillRows] = (await Promise.all([
      BillingModel.aggregate([
        {
          $match: billingMatch,
        },
        {
          $group: {
            _id: null,
            totalBills: { $sum: 1 },
            totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
            lastBillAt: { $max: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            totalBills: 1,
            totalAmount: 1,
            lastBillAt: 1,
          },
        },
      ]),
      BillingModel.aggregate([
        {
          $match: billingMatch,
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $limit: billLimit,
        },
        {
          $project: {
            _id: 1,
            invoiceNumber: 1,
            kotNumber: 1,
            status: 1,
            paymentMethod: 1,
            totalAmount: { $ifNull: ['$totalAmount', 0] },
            grossAmount: { $ifNull: ['$grossAmount', 0] },
            createdAt: 1,
            updatedAt: 1,
            branch: 1,
            customerName: '$customerDetails.name',
            customerPhone: '$customerDetails.phoneNumber',
            itemCount: { $size: { $ifNull: ['$items', []] } },
          },
        },
      ]),
    ])) as [RawBillingSummary[], RawBillingRow[]]

    const summary = summaryRows[0] || {
      totalBills: 0,
      totalAmount: 0,
      lastBillAt: null,
    }

    const recentBills = recentBillRows.map((row) => ({
      id: toId(row._id),
      invoiceNumber: row.invoiceNumber || null,
      kotNumber: row.kotNumber || null,
      status: row.status || null,
      paymentMethod: row.paymentMethod || null,
      totalAmount: toMoney(row.totalAmount),
      grossAmount: toMoney(row.grossAmount),
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
      branchId: toId(row.branch),
      customerName: row.customerName || null,
      customerPhone: row.customerPhone || null,
      itemCount: toNumeric(row.itemCount, 0),
    }))

    return Response.json(
      {
        exists: Boolean(customerDoc),
        isNewCustomer: !customerDoc,
        customer: customerDoc
          ? {
              id: customerDoc.id || null,
              name: customerDoc.name || null,
              phoneNumber: customerDoc.phoneNumber || normalizedPhone,
              rewardPoints: toNumeric(customerDoc.rewardPoints, 0),
              rewardProgressAmount: toMoney(customerDoc.rewardProgressAmount),
              isOfferEligible: Boolean(customerDoc.isOfferEligible),
              totalOffersRedeemed: toNumeric(customerDoc.totalOffersRedeemed, 0),
            }
          : null,
        billingSummary: {
          totalBills: toNumeric(summary.totalBills, 0),
          totalAmount: toMoney(summary.totalAmount),
          lastBillAt: summary.lastBillAt || null,
        },
        recentBills,
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to lookup customer by phone for billing',
    })

    return Response.json({ message: 'Failed to lookup customer' }, { status: 500 })
  }
}
