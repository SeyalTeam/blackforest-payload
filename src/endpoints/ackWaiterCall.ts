import type { PayloadHandler } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const ACTIVE_BILL_STATUSES = new Set(['ordered', 'prepared', 'delivered'])
const CLOSED_BILL_STATUSES = new Set(['completed', 'settled', 'cancelled'])
const BRANCH_SCOPED_ROLES = new Set([
  'branch',
  'kitchen',
  'waiter',
  'cashier',
  'supervisor',
  'delivery',
  'driver',
  'chef',
])
const BILLING_TIMEZONE = 'Asia/Kolkata'
const SOS_PREFIX = 'WAITER_CALL_SOS '
const ACK_PREFIX = 'WAITER_CALL_ACK '
const SOS_NOTE_REGEX = /^WAITER_CALL_SOS\s+([0-9T:\.\+\-Z]+)\s+TABLE-([^\s|]+)\s+SECTION-(.+)$/i

type AckWaiterBody = {
  branchId?: unknown
  branch?: unknown
  selectedBranchId?: unknown
  billId?: unknown
  callTimestamp?: unknown
}

type BillingLike = {
  id?: unknown
  status?: unknown
  notes?: unknown
  branch?: unknown
  tableDetails?: {
    section?: unknown
    tableNumber?: unknown
  } | null
}

type Actor = {
  id: string
  name: string
  role: string
  branchId: string | null
}

const toText = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
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

const toNoteToken = (value: string): string => value.trim().replace(/[\r\n|]+/g, ' ').replace(/\s+/g, '_')

const parseBody = async (req: {
  json?: () => Promise<unknown>
  url?: string
}): Promise<AckWaiterBody> => {
  try {
    const body = await req.json?.()
    if (body && typeof body === 'object') {
      return body as AckWaiterBody
    }
  } catch (_error) {
    // Ignore parse failure and use URL fallback.
  }

  const url = new URL(req.url || 'http://localhost')
  return {
    branchId: url.searchParams.get('branchId'),
    branch: url.searchParams.get('branch'),
    selectedBranchId: url.searchParams.get('selectedBranchId'),
    billId: url.searchParams.get('billId'),
    callTimestamp: url.searchParams.get('callTimestamp'),
  }
}

const getHeaderValue = (headers: unknown, key: string): string | null => {
  if (!headers || typeof headers !== 'object') return null
  if (typeof (headers as { get?: unknown }).get === 'function') {
    const value = (headers as { get: (name: string) => string | null }).get(key)
    return toText(value)
  }

  const record = headers as Record<string, unknown>
  return toText(record[key] ?? record[key.toLowerCase()] ?? record[key.toUpperCase()])
}

const getActorFromUser = (user: unknown): Actor | null => {
  if (!user || typeof user !== 'object') return null
  const userRecord = user as {
    id?: unknown
    name?: unknown
    email?: unknown
    role?: unknown
    branch?: unknown
  }

  const id = toText(userRecord.id)
  if (!id) return null

  const name =
    toText(userRecord.name) ||
    (typeof userRecord.email === 'string' && userRecord.email.includes('@')
      ? userRecord.email.split('@')[0]
      : toText(userRecord.email)) ||
    `user-${id}`

  return {
    id,
    name,
    role: toText(userRecord.role) || 'unknown',
    branchId: getRelationshipId(userRecord.branch),
  }
}

const getSignalLines = (notes: string): string[] =>
  notes
    .split(/\r?\n|\s*\|\s*/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.startsWith(SOS_PREFIX))

const parseSignalLine = (
  line: string,
): { timestamp: string; tableNumber: string; section: string } | null => {
  const match = line.match(SOS_NOTE_REGEX)
  if (!match) return null

  return {
    timestamp: match[1],
    tableNumber: match[2],
    section: match[3].trim(),
  }
}

export const ackWaiterCallHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    const actor = getActorFromUser(req.user)
    if (!actor) {
      return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await parseBody(req as { json?: () => Promise<unknown>; url?: string })
    const billId = toText(body.billId)
    const callTimestamp = toText(body.callTimestamp)
    const requestedBranchCandidates = [
      {
        source: 'body.branchId',
        value: toText(body.branchId),
      },
      {
        source: 'body.selectedBranchId',
        value: toText(body.selectedBranchId),
      },
      {
        source: 'body.branch',
        value: toText(body.branch),
      },
      {
        source: 'header.x-branch-id',
        value: getHeaderValue(req.headers, 'x-branch-id'),
      },
      {
        source: 'header.x-branch',
        value: getHeaderValue(req.headers, 'x-branch'),
      },
    ].filter(
      (item): item is { source: string; value: string } =>
        typeof item.value === 'string' && item.value.length > 0,
    )

    if (!billId) {
      return Response.json({ ok: false, message: 'billId is required' }, { status: 400 })
    }

    const effectiveBranchId = actor.branchId || requestedBranchCandidates[0]?.value || null

    if (!effectiveBranchId) {
      return Response.json({ ok: false, message: 'Branch context missing' }, { status: 400 })
    }

    if (actor.branchId) {
      const mismatchedSource = requestedBranchCandidates.find(
        (candidate) => candidate.value !== actor.branchId,
      )
      if (mismatchedSource) {
        return Response.json(
          {
            ok: false,
            message: `You are not allowed to acknowledge another branch (${mismatchedSource.source})`,
          },
          { status: 403 },
        )
      }
    } else if (BRANCH_SCOPED_ROLES.has(actor.role)) {
      const hasConflictingRequestBranch = requestedBranchCandidates.some(
        (candidate) => candidate.value !== effectiveBranchId,
      )
      if (hasConflictingRequestBranch) {
        return Response.json({ ok: false, message: 'Branch context mismatch in request' }, { status: 409 })
      }
    }

    let bill: BillingLike | null = null
    try {
      bill = (await req.payload.findByID({
        collection: 'billings',
        id: billId,
        depth: 0,
        overrideAccess: true,
      })) as BillingLike
    } catch (_error) {
      bill = null
    }

    if (!bill || !bill.id) {
      return Response.json({ ok: false, message: 'Bill not found' }, { status: 404 })
    }

    const billBranchId = getRelationshipId(bill.branch)
    if (billBranchId !== effectiveBranchId) {
      return Response.json({ ok: false, message: 'Branch mismatch' }, { status: 409 })
    }

    const billStatus = toText(bill.status)
    if (billStatus && CLOSED_BILL_STATUSES.has(billStatus)) {
      return Response.json({ ok: false, message: 'Bill already closed' }, { status: 409 })
    }
    if (!billStatus || !ACTIVE_BILL_STATUSES.has(billStatus)) {
      return Response.json({ ok: false, message: 'Bill is not active' }, { status: 409 })
    }

    const notes = toText(bill.notes) || ''
    const signalLines = getSignalLines(notes)
    if (signalLines.length === 0) {
      return Response.json({ ok: false, message: 'No waiter call signal found on this bill' }, { status: 409 })
    }

    const targetLine = callTimestamp
      ? signalLines.find((line) => line.includes(`WAITER_CALL_SOS ${callTimestamp}`)) || null
      : signalLines[signalLines.length - 1]

    if (!targetLine) {
      return Response.json({ ok: false, message: 'Requested waiter call signal not found' }, { status: 404 })
    }

    const parsedSignal = parseSignalLine(targetLine)
    if (!parsedSignal) {
      return Response.json({ ok: false, message: 'Invalid waiter call signal format' }, { status: 409 })
    }

    const ackKey = `FOR-${parsedSignal.timestamp}`
    const userKey = `USER-${actor.id}`
    const existingAckLine = notes
      .split(/\r?\n|\s*\|\s*/g)
      .map((line) => line.trim())
      .find((line) => line.startsWith(ACK_PREFIX) && line.includes(ackKey) && line.includes(userKey))

    if (existingAckLine) {
      return Response.json({
        ok: true,
        alreadyAcknowledged: true,
        billId: String(bill.id),
        callTimestamp: parsedSignal.timestamp,
        acknowledgedBy: actor.name,
        tableNumber: parsedSignal.tableNumber,
        section: parsedSignal.section,
        message: 'Waiter call was already acknowledged by this user',
      })
    }

    const ackTimestamp = dayjs().tz(BILLING_TIMEZONE).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    const ackLine = [
      'WAITER_CALL_ACK',
      ackTimestamp,
      `FOR-${parsedSignal.timestamp}`,
      `TABLE-${toNoteToken(parsedSignal.tableNumber)}`,
      `SECTION-${toNoteToken(parsedSignal.section)}`,
      `BY-${toNoteToken(actor.name)}`,
      `USER-${toNoteToken(actor.id)}`,
      `ROLE-${toNoteToken(actor.role)}`,
    ].join(' ')

    const updatedNotes = notes ? `${notes}\n${ackLine}` : ackLine

    await req.payload.update({
      collection: 'billings',
      id: String(bill.id),
      data: {
        notes: updatedNotes,
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
      billId: String(bill.id),
      callTimestamp: parsedSignal.timestamp,
      acknowledgedBy: actor.name,
      acknowledgedByUserId: actor.id,
      tableNumber: parsedSignal.tableNumber,
      section: parsedSignal.section,
      message: 'Waiter call acknowledged',
    })
  } catch (error) {
    req.payload.logger.error({
      msg: 'Failed to acknowledge waiter call',
      err: error,
    })
    return Response.json({ ok: false, message: 'Failed to acknowledge waiter call' }, { status: 500 })
  }
}
