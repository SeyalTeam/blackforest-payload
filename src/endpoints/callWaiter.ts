import type { PayloadHandler } from 'payload'

const ACTIVE_BILL_STATUSES = ['ordered', 'prepared', 'delivered'] as const
const CLOSED_BILL_STATUSES = new Set(['completed', 'settled', 'cancelled'])

type CallWaiterBody = {
  branchId?: unknown
  billId?: unknown
  tableNumber?: unknown
  section?: unknown
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

      if (!matchedBill) {
        return Response.json(
          { ok: false, message: 'No active bill found for this table' },
          { status: 404 },
        )
      }
    }

    if (!matchedBill || !matchedBill.id) {
      return Response.json(
        { ok: false, message: 'No active bill found for this table' },
        { status: 404 },
      )
    }

    const resolvedTableNumber =
      toText(matchedBill.tableDetails?.tableNumber) || requestedTableNumber || 'UNKNOWN'
    const resolvedSection = toText(matchedBill.tableDetails?.section) || requestedSection || 'UNKNOWN'

    const signalLine = `WAITER_CALL_SOS ${new Date().toISOString()} TABLE-${resolvedTableNumber} SECTION-${resolvedSection}`
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
