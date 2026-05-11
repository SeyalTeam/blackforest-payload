import type { PayloadHandler } from 'payload'

const MIN_PHONE_DIGITS = 10

const toPhoneDigits = (value: string): string => value.replace(/\D/g, '')

const buildPhoneCandidates = (rawPhone: string): string[] => {
  const trimmed = rawPhone.trim()
  const digits = toPhoneDigits(trimmed)
  const values = new Set<string>()

  if (trimmed.length > 0) {
    values.add(trimmed)
  }

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

const toIDString = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (typeof value === 'object') {
    const record = value as { id?: unknown; _id?: unknown; toString?: () => string }
    if (record.id) return toIDString(record.id)
    if (record._id) return toIDString(record._id)
    if (typeof record.toString === 'function') {
      const rendered = record.toString()
      if (rendered && rendered !== '[object Object]') return rendered
    }
  }

  return null
}

export const getBillingCustomerLookupLiteHandler: PayloadHandler = async (
  req,
): Promise<Response> => {
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
          customerName: null,
          phoneNumber: normalizedPhone || null,
          customer: null,
          skipped: true,
          reason: `phoneNumber must contain at least ${MIN_PHONE_DIGITS} digits`,
        },
        { status: 200 },
      )
    }

    const BillingCustomersModel = req.payload.db.collections['billing-customers']
    if (!BillingCustomersModel) {
      req.payload.logger.error({
        msg: 'billing-customers model not found while executing customer-lookup-lite',
      })
      return Response.json({ message: 'Customer directory unavailable' }, { status: 503 })
    }

    const phoneCandidates = buildPhoneCandidates(phoneInput)

    const customerDoc = (await BillingCustomersModel.findOne(
      {
        phoneNumber: { $in: phoneCandidates },
      },
      {
        name: 1,
        phoneNumber: 1,
        lastBill: 1,
        lastSyncedAt: 1,
      },
      {
        sort: { updatedAt: -1 },
      },
    )) as
      | {
          _id?: unknown
          id?: string
          name?: string | null
          phoneNumber?: string | null
          lastBill?: unknown
          lastSyncedAt?: string | Date | null
        }
      | null

    if (!customerDoc) {
      return Response.json(
        {
          exists: false,
          customerName: null,
          phoneNumber: normalizedPhone,
          customer: null,
        },
        { status: 200 },
      )
    }

    const customerName = typeof customerDoc.name === 'string' ? customerDoc.name : null
    const customerPhone =
      typeof customerDoc.phoneNumber === 'string' && customerDoc.phoneNumber.trim().length > 0
        ? customerDoc.phoneNumber
        : normalizedPhone
    const customerId = toIDString(customerDoc.id ?? customerDoc._id)
    const lastBillId = toIDString(customerDoc.lastBill)
    const lastSyncedAt =
      customerDoc.lastSyncedAt instanceof Date
        ? customerDoc.lastSyncedAt.toISOString()
        : typeof customerDoc.lastSyncedAt === 'string'
          ? customerDoc.lastSyncedAt
          : null

    return Response.json(
      {
        exists: true,
        customerName,
        phoneNumber: customerPhone,
        customer: {
          id: customerId,
          name: customerName,
          phoneNumber: customerPhone,
          lastBill: lastBillId,
          lastSyncedAt,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to lookup customer from billing-customers',
    })

    return Response.json({ message: 'Failed to lookup customer' }, { status: 500 })
  }
}
