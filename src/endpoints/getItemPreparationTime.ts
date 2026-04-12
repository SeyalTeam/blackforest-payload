import type { PayloadHandler } from 'payload'
import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const BILLING_TIMEZONE = 'Asia/Kolkata'

type BillingItemRecord = {
  id?: unknown
  name?: unknown
  status?: unknown
  orderedAt?: unknown
  preparedAt?: unknown
  preparingTime?: unknown
}

const toId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (value && typeof value === 'object') {
    const record = value as { id?: unknown; _id?: unknown }
    if (record.id != null) return toId(record.id)
    if (record._id != null) return toId(record._id)
  }

  return null
}

const parseTimeLikeValue = (value: unknown, fallbackDate: Dayjs): Dayjs | null => {
  if (value == null) return null

  if (value instanceof Date) {
    const parsed = dayjs(value).tz(BILLING_TIMEZONE)
    return parsed.isValid() ? parsed : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = dayjs(value).tz(BILLING_TIMEZONE)
    return parsed.isValid() ? parsed : null
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const explicitDate = dayjs(trimmed)
  if (explicitDate.isValid()) {
    return explicitDate.tz(BILLING_TIMEZONE)
  }

  const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!timeOnlyMatch) return null

  const hour = Number.parseInt(timeOnlyMatch[1], 10)
  const minute = Number.parseInt(timeOnlyMatch[2], 10)
  const second = Number.parseInt(timeOnlyMatch[3] || '0', 10)

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null
  }

  return fallbackDate
    .tz(BILLING_TIMEZONE)
    .hour(hour)
    .minute(minute)
    .second(second)
    .millisecond(0)
}

const parsePreparingTimeValue = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === 'string' && value.trim().length === 0) return null

  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null

  return parsed
}

export const getItemPreparationTime: PayloadHandler = async (req): Promise<Response> => {
  const { payload } = req
  const { id } = req.routeParams as { id: string }

  try {
    if (!id) {
      return Response.json({ error: 'Missing bill id' }, { status: 400 })
    }

    const url = new URL(req.url || 'http://localhost')
    const itemIdFromQuery = (url.searchParams.get('itemId') || url.searchParams.get('id') || '').trim()

    const bill = await payload.findByID({
      collection: 'billings',
      id,
      depth: 0,
      overrideAccess: true,
    })

    if (!bill) {
      return Response.json({ error: 'Bill not found' }, { status: 404 })
    }

    const items = Array.isArray(bill.items) ? bill.items : []
    if (items.length === 0) {
      return Response.json({ error: 'No items found in bill' }, { status: 404 })
    }

    const resolvedItemId = itemIdFromQuery || (items.length === 1 ? toId(items[0]?.id) || '' : '')
    if (!resolvedItemId) {
      return Response.json(
        {
          error: 'Missing itemId. Pass ?itemId=<item-id> for bills with multiple items.',
        },
        { status: 400 },
      )
    }

    const item = items.find((entry) => {
      const candidate = entry as BillingItemRecord
      return toId(candidate.id) === resolvedItemId
    }) as BillingItemRecord | undefined
    if (!item) {
      return Response.json({ error: 'Item not found in bill' }, { status: 404 })
    }

    const fallbackDate = dayjs(bill.createdAt || undefined).tz(BILLING_TIMEZONE)
    const baseDate = fallbackDate.isValid() ? fallbackDate : dayjs().tz(BILLING_TIMEZONE)

    const orderedAt = parseTimeLikeValue(item.orderedAt, baseDate)
    const preparedAt = parseTimeLikeValue(item.preparedAt, baseDate)
    const preparingTime = parsePreparingTimeValue(item.preparingTime)
    const now = dayjs().tz(BILLING_TIMEZONE)

    let preparedDurationMinutes: number | null = null
    if (orderedAt && preparedAt) {
      const adjustedPreparedAt =
        preparedAt.isBefore(orderedAt) ? preparedAt.add(1, 'day') : preparedAt
      preparedDurationMinutes = Math.max(0, adjustedPreparedAt.diff(orderedAt, 'minute'))
    }

    let currentPreparationMinutes: number | null = null
    if (!preparedAt && orderedAt) {
      currentPreparationMinutes = Math.max(0, now.diff(orderedAt, 'minute'))
    }

    return Response.json(
      {
        billId: bill.id,
        invoiceNumber: bill.invoiceNumber || null,
        kotNumber: bill.kotNumber || null,
        item: {
          id: resolvedItemId,
          name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name : null,
          status:
            typeof item.status === 'string' && item.status.trim().length > 0
              ? item.status
              : 'ordered',
          orderedAt:
            typeof item.orderedAt === 'string' && item.orderedAt.trim().length > 0
              ? item.orderedAt
              : null,
          preparedAt:
            typeof item.preparedAt === 'string' && item.preparedAt.trim().length > 0
              ? item.preparedAt
              : null,
          preparingTime,
          preparedDurationMinutes,
          currentPreparationMinutes,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to fetch item preparation time',
    })

    return Response.json({ error: 'Failed to fetch item preparation time' }, { status: 500 })
  }
}
