import type { PayloadHandler } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const ACTIVE_BILL_STATUSES = ['ordered', 'prepared', 'confirmed', 'delivered'] as const
const CLOSED_BILL_STATUSES = new Set(['completed', 'settled', 'cancelled'])
const BILLING_TIMEZONE = 'Asia/Kolkata'

type CallWaiterBody = {
  branchId?: unknown
  billId?: unknown
  tableNumber?: unknown
  section?: unknown
  waiterId?: unknown
  callerName?: unknown
}

type BillingLike = {
  id?: unknown
  status?: unknown
  notes?: unknown
  branch?: unknown
  createdAt?: unknown
  tableDetails?: {
    section?: unknown
    tableNumber?: unknown
  } | null
}

const toText = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
}

const getRelationshipId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (value && typeof value === 'object' && 'id' in value) {
    return getRelationshipId((value as { id?: unknown }).id)
  }

  if (value && typeof value === 'object' && '_id' in value) {
    return getRelationshipId((value as { _id?: unknown })._id)
  }

  return null
}

const extractNumericTableIndex = (value: string): number | null => {
  const match = value.match(/\d+/)
  if (!match) return null
  const parsed = Number.parseInt(match[0], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeSectionName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const normalizeTableNumber = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const numericIndex = extractNumericTableIndex(trimmed)
  if (numericIndex !== null) return String(numericIndex)

  return trimmed
    .replace(/^table\s*/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

const isActiveStatus = (value: unknown): boolean =>
  typeof value === 'string' && ACTIVE_BILL_STATUSES.includes(value as (typeof ACTIVE_BILL_STATUSES)[number])

const isClosedStatus = (value: unknown): boolean =>
  typeof value === 'string' && CLOSED_BILL_STATUSES.has(value)

const parseBody = async (req: {
  json?: () => Promise<unknown>
  url?: string
}): Promise<CallWaiterBody> => {
  try {
    const body = await req.json?.()
    if (body && typeof body === 'object') {
      return body as CallWaiterBody
    }
  } catch (_error) {
    // Ignore parse failure and use URL fallback.
  }

  const url = new URL(req.url || 'http://localhost')
  return {
    branchId: url.searchParams.get('branchId'),
    billId: url.searchParams.get('billId'),
    tableNumber: url.searchParams.get('tableNumber') || url.searchParams.get('table'),
    section: url.searchParams.get('section'),
    waiterId: url.searchParams.get('waiterId'),
    callerName: url.searchParams.get('callerName'),
  }
}

const getLatestActiveBillByTable = async (
  req: Parameters<PayloadHandler>[0],
  branchId: string,
  section: string,
  tableNumber: string,
): Promise<BillingLike | null> => {
  const exactMatch = await req.payload.find({
    collection: 'billings',
    where: {
      and: [
        {
          branch: {
            equals: branchId,
          },
        },
        {
          status: {
            in: [...ACTIVE_BILL_STATUSES],
          },
        },
        {
          'tableDetails.section': {
            equals: section,
          },
        },
        {
          'tableDetails.tableNumber': {
            equals: tableNumber,
          },
        },
      ],
    },
    depth: 0,
    limit: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  if (exactMatch.docs.length > 0) {
    return exactMatch.docs[0] as BillingLike
  }

  // Fallback for legacy data that may differ only by casing or formatting.
  const broadMatch = await req.payload.find({
    collection: 'billings',
    where: {
      and: [
        {
          branch: {
            equals: branchId,
          },
        },
        {
          status: {
            in: [...ACTIVE_BILL_STATUSES],
          },
        },
      ],
    },
    depth: 0,
    pagination: false,
    limit: 2000,
    sort: '-createdAt',
    overrideAccess: true,
  })

  const expectedSection = normalizeSectionName(section)
  const expectedTable = normalizeTableNumber(tableNumber)

  for (const doc of broadMatch.docs as BillingLike[]) {
    const docSection = toText(doc?.tableDetails?.section)
    const docTable = toText(doc?.tableDetails?.tableNumber)
    if (!docSection || !docTable) continue

    if (normalizeSectionName(docSection) === expectedSection && normalizeTableNumber(docTable) === expectedTable) {
      return doc
    }
  }

  return null
}

export const callWaiterHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    const body = await parseBody(req as { json?: () => Promise<unknown>; url?: string })

    const branchId = toText(body.branchId)
    const billId = toText(body.billId)
    const requestedTableNumber = toText(body.tableNumber)
    const requestedSection = toText(body.section)
    const waiterId = toText(body.waiterId)
    const callerName = toText(body.callerName)

    if (!branchId) {
      return Response.json({ ok: false, message: 'branchId is required' }, { status: 400 })
    }

    if (!billId && (!requestedTableNumber || !requestedSection)) {
      return Response.json(
        {
          ok: false,
          message: 'Provide billId, or tableNumber + section for active table lookup',
        },
        { status: 400 },
      )
    }

    let matchedBill: BillingLike | null = null

    if (billId) {
      try {
        matchedBill = (await req.payload.findByID({
          collection: 'billings',
          id: billId,
          depth: 0,
          overrideAccess: true,
        })) as BillingLike
      } catch (_error) {
        matchedBill = null
      }

      if (!matchedBill) {
        return Response.json(
          { ok: false, message: 'No active bill found for this table' },
          { status: 404 },
        )
      }

      const billBranchId = getRelationshipId(matchedBill.branch)
      if (billBranchId !== branchId) {
        return Response.json({ ok: false, message: 'Branch mismatch' }, { status: 409 })
      }

      if (isClosedStatus(matchedBill.status)) {
        return Response.json({ ok: false, message: 'Bill already closed' }, { status: 409 })
      }

      if (!isActiveStatus(matchedBill.status)) {
        return Response.json(
          { ok: false, message: 'No active bill found for this table' },
          { status: 404 },
        )
      }
    } else if (requestedTableNumber && requestedSection) {
      matchedBill = await getLatestActiveBillByTable(req, branchId, requestedSection, requestedTableNumber)
    }

    if (!matchedBill || !matchedBill.id) {
      try {
        matchedBill = await req.payload.create({
          collection: 'billings',
          data: {
            branch: branchId,
            status: 'pending' as any,
            tableDetails: {
              tableNumber: requestedTableNumber || '0',
              section: requestedSection || 'General',
            },
            items: [],
            subTotal: 0,
            grandTotal: 0,
          } as any,
          overrideAccess: true,
        }) as BillingLike
      } catch (createError: any) {
        req.payload.logger.error({
          msg: 'Failed to auto-create billing document in callWaiter endpoint',
          err: createError,
        })
        return Response.json(
          {
            ok: false,
            message: `No active bill found and auto-creation failed: ${createError?.message || createError || 'Unknown Error'}`,
          },
          { status: 500 },
        )
      }
    }

    const resolvedTableNumber =
      toText(matchedBill.tableDetails?.tableNumber) || requestedTableNumber || 'UNKNOWN'
    const resolvedSection = toText(matchedBill.tableDetails?.section) || requestedSection || 'UNKNOWN'

    const timestampIST = dayjs().tz(BILLING_TIMEZONE).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    
    // Format matching the Waiter App SOS regex parser:
    // WAITER_CALL_SOS <timestamp> TABLE-<tableNumber> SECTION-<sectionName> | BY-<callerRole> FOR-<waiterId>
    let signalLine = `WAITER_CALL_SOS ${timestampIST} TABLE-${resolvedTableNumber} SECTION-${resolvedSection}`
    if (callerName || waiterId) {
      signalLine += ` | BY-${callerName || 'Kitchen'} FOR-${waiterId || ''}`
    }

    const existingNotes = toText(matchedBill.notes)
    const notes = existingNotes ? `${existingNotes}\n${signalLine}` : signalLine

    await req.payload.update({
      collection: 'billings',
      id: String(matchedBill.id),
      data: {
        notes,
      },
      depth: 0,
      overrideAccess: true,
      context: {
        skipOfferRecalculation: true,
        skipPricingRecalculation: true,
        skipInventoryValidation: true,
        skipCustomerRewardProcessing: true,
        skipOfferCounterProcessing: true,
      },
    })

    await req.payload.create({
      collection: 'waiter-calls',
      data: {
        branch: branchId,
        tableNumber: resolvedTableNumber,
        section: resolvedSection,
        status: 'pending',
        billing: String(matchedBill.id),
        callTimestamp: timestampIST,
        ...(waiterId ? { assignedWaiter: waiterId } : {}),
      },
      overrideAccess: true,
    })

    return Response.json({
      ok: true,
      billId: String(matchedBill.id),
      tableNumber: resolvedTableNumber,
      section: resolvedSection,
      message: 'Waiter call sent to this branch only',
    })
  } catch (error) {
    req.payload.logger.error({
      msg: 'Failed to process waiter call',
      err: error,
    })

    return Response.json({ ok: false, message: 'Failed to process waiter call' }, { status: 500 })
  }
}
