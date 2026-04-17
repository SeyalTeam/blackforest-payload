import { PreparationStatus, BillItem } from './types'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

export const byNameAsc = <T extends { name: string }>(a: T, b: T): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

export const toLocalDateStr = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const normalizeRelationshipID = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (value && typeof value === 'object') {
    const record = value as { id?: unknown; _id?: unknown }
    if (typeof record.id === 'string' && record.id.trim().length > 0) return record.id
    if (typeof record.id === 'number' && Number.isFinite(record.id)) return String(record.id)
    if (typeof record._id === 'string' && record._id.trim().length > 0) return record._id
    if (typeof record._id === 'number' && Number.isFinite(record._id)) return String(record._id)
  }

  return ''
}

export const relationshipToIDList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(normalizeRelationshipID).filter(Boolean)
  }

  const single = normalizeRelationshipID(value)
  return single ? [single] : []
}

export const formatMinutes = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'

  const fixed = value.toFixed(2)
  const pretty = fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  return `${pretty} min`
}

export const formatCount = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  if (Number.isInteger(value)) return String(value)

  const fixed = value.toFixed(2)
  return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
}

export const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export const getPreparationStatus = (
  actual: number | null | undefined,
  baseline: number | null | undefined,
): PreparationStatus => {
  if (actual == null || baseline == null) return 'neutral'
  if (!Number.isFinite(actual) || !Number.isFinite(baseline)) return 'neutral'
  // A missing or non-positive configured baseline should not be treated as exceeded.
  if (baseline <= 0) return 'neutral'
  if (actual > baseline) return 'exceeded'
  if (actual < baseline) return 'lower'
  return 'neutral'
}

export const formatAmount = (value: unknown): string => {
  const parsed = toFiniteNumber(value)
  if (parsed == null) return '--'
  const fixed = parsed.toFixed(2)
  return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
}

export const resolveLabel = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (isRecord(value)) {
    if (typeof value.name === 'string' && value.name.trim().length > 0) return value.name.trim()
    if (typeof value.email === 'string' && value.email.trim().length > 0) {
      return value.email.trim().split('@')[0]
    }
  }
  return '--'
}

export const resolveCreatedByLabel = (value: unknown): string => {
  if (isRecord(value)) {
    if (typeof value.name === 'string' && value.name.trim().length > 0) return value.name.trim()
    if (isRecord(value.employee) && typeof value.employee.name === 'string' && value.employee.name.trim()) {
      return value.employee.name.trim()
    }
    if (typeof value.email === 'string' && value.email.trim()) return value.email.trim().split('@')[0]
  }

  return '--'
}

export const asText = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

export const readObjectTextByKeys = (value: unknown, keys: string[]): string => {
  if (!isRecord(value)) return ''

  for (const key of keys) {
    const text = asText(value[key])
    if (text) return text
  }

  return ''
}

export const toBillSuffix = (value: string): string => {
  const text = value.trim()
  if (!text) return '--'

  const segments = text.split('-').map((part) => part.trim()).filter(Boolean)
  const last = segments.length > 0 ? segments[segments.length - 1] : text

  if (/^\d+$/.test(last)) return last.padStart(3, '0')
  return last
}

export const formatThermalDateTime = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  let hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, '0')
  const meridiem = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12

  return `${year}-${month}-${day} ${hour}:${minute}${meridiem}`
}

export const parseBillTimeValue = (value: unknown, fallbackDate: Date): Date | null => {
  if (value == null) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const explicit = new Date(trimmed)
  if (!Number.isNaN(explicit.getTime())) return explicit

  const timeOnly = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!timeOnly) return null

  const hour = Number.parseInt(timeOnly[1], 10)
  const minute = Number.parseInt(timeOnly[2], 10)
  const second = Number.parseInt(timeOnly[3] || '0', 10)

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

  const result = new Date(fallbackDate)
  result.setHours(hour, minute, second, 0)
  return result
}

export const diffMinutesWithOvernight = (start: Date, end: Date): number => {
  let diffMs = end.getTime() - start.getTime()
  if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000
  return Math.max(0, diffMs / (60 * 1000))
}

export const resolveItemActualPreparationMinutesForPreview = (
  item: BillItem,
  billCreatedAt: unknown,
): number | null => {
  const baseDate = (() => {
    if (typeof billCreatedAt === 'string' && billCreatedAt.trim()) {
      const parsed = new Date(billCreatedAt)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return new Date()
  })()

  const orderedAt = parseBillTimeValue(item.orderedAt, baseDate)
  const preparedAt = parseBillTimeValue(item.preparedAt, baseDate)
  if (orderedAt && preparedAt) return diffMinutesWithOvernight(orderedAt, preparedAt)

  return null
}

export const getQuarterDates = (date: Date) => {
  const currentQuarter = Math.floor((date.getMonth() + 3) / 3)
  const previousQuarter = currentQuarter - 1
  let startMonth = 0
  let year = date.getFullYear()

  if (previousQuarter === 0) {
    startMonth = 9
    year -= 1
  } else {
    startMonth = (previousQuarter - 1) * 3
  }

  const endMonth = startMonth + 2
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, endMonth + 1, 0),
  }
}
