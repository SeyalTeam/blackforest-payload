import type { PayloadHandler, Where } from 'payload'

const MIN_PHONE_DIGITS = 10

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

    const phoneCandidates = buildPhoneCandidates(phoneInput)
    const phoneWhere = buildPhoneWhere('phoneNumber', phoneCandidates)

    const lookupResult = await req.payload.find({
      collection: 'billing-customers' as any,
      where: phoneWhere,
      depth: 0,
      limit: 1,
      sort: '-updatedAt',
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        lastBill: true,
        lastSyncedAt: true,
      } as any,
      overrideAccess: true,
    })

    const customerDoc = lookupResult.docs[0] as
      | {
          id?: string
          name?: string
          phoneNumber?: string
          lastBill?: unknown
          lastSyncedAt?: string
        }
      | undefined

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
      typeof customerDoc.phoneNumber === 'string' ? customerDoc.phoneNumber : normalizedPhone

    return Response.json(
      {
        exists: true,
        customerName,
        phoneNumber: customerPhone,
        customer: {
          id: customerDoc.id || null,
          name: customerName,
          phoneNumber: customerPhone,
          lastBill: toId(customerDoc.lastBill),
          lastSyncedAt: customerDoc.lastSyncedAt || null,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to lookup billing-customer by phone',
    })

    return Response.json({ message: 'Failed to lookup customer' }, { status: 500 })
  }
}
