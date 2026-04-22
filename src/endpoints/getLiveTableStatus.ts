import type { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const ACTIVE_BILLING_STATUSES = new Set(['ordered', 'prepared', 'delivered'])
const LIVE_TABLE_TIMEZONE = 'Asia/Kolkata'
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

type ScopeResult = {
  branchIds?: string[]
  errorResponse?: Response
}

type MutableTableRow = {
  tableKey: string
  tableNumber: string
  tableLabel: string
  tableState: 'available' | 'active' | 'prepared' | 'delivered'
  occupied: boolean
  billId: string | null
  status: string | null
  kotNumber: string | null
  totalAmount: number | null
  servedBy: string | null
  startedAt: string | null
  elapsedSeconds: number | null
}

type MutableSection = {
  sectionKey: string
  sectionName: string
  tableOrder: string[]
  tablesByKey: Map<string, MutableTableRow>
}

type MutableBranch = {
  branchId: string
  branchName: string
  sectionOrder: string[]
  sectionsByKey: Map<string, MutableSection>
}

const getRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof (value as { id?: unknown }).id === 'string' ||
      typeof (value as { id?: unknown }).id === 'number')
  ) {
    return String((value as { id: string | number }).id)
  }

  if (
    value &&
    typeof value === 'object' &&
    '_id' in value &&
    (typeof (value as { _id?: unknown })._id === 'string' ||
      typeof (value as { _id?: unknown })._id === 'number')
  ) {
    return String((value as { _id: string | number })._id)
  }

  return null
}

const normalizeSectionName = (value: string): string => value.trim().toLowerCase()

const extractNumericTableIndex = (value: string): number | null => {
  const match = value.match(/\d+/)
  if (!match) return null
  const parsed = parseInt(match[0], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeTableIdentifier = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const numericIndex = extractNumericTableIndex(trimmed)
  if (numericIndex !== null) return String(numericIndex)

  return trimmed.toLowerCase().replace(/\s+/g, ' ')
}

const toTableLabel = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return 'Table'

  const numericIndex = extractNumericTableIndex(trimmed)
  if (numericIndex !== null) return `Table ${numericIndex}`

  if (/^table/i.test(trimmed)) return trimmed
  return `Table ${trimmed}`
}

const parseConfiguredTableRange = (value: unknown): { start: number; end: number } | null => {
  if (typeof value !== 'string') return null

  const normalizedValue = value.trim()
  if (!normalizedValue) return null

  const match = normalizedValue.match(/^T?\s*(\d+)(?:\s*-\s*T?\s*(\d+))?$/i)
  if (!match) return null

  const start = Number.parseInt(match[1], 10)
  const end = Number.parseInt(match[2] ?? match[1], 10)

  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) return null
  if (end < start) return null

  return { start, end }
}

const resolveConfiguredTables = (section: any): string[] => {
  const rangeRows = Array.isArray(section?.rangeRows) ? section.rangeRows : []
  const tableNumbers: number[] = []
  const seen = new Set<number>()

  for (const row of rangeRows) {
    const parsedRange = parseConfiguredTableRange(row?.tableRange)
    if (!parsedRange) continue

    for (let tableNumber = parsedRange.start; tableNumber <= parsedRange.end; tableNumber += 1) {
      if (seen.has(tableNumber)) continue
      seen.add(tableNumber)
      tableNumbers.push(tableNumber)
    }
  }

  if (tableNumbers.length > 0) {
    return tableNumbers.map((value) => String(value))
  }

  const configuredCount = Number(section?.tableCount)
  const tableCount =
    Number.isFinite(configuredCount) && configuredCount > 0 ? Math.floor(configuredCount) : 0

  const fallbackTables: string[] = []
  for (let index = 1; index <= tableCount; index += 1) {
    fallbackTables.push(String(index))
  }

  return fallbackTables
}

const toKotLabel = (value: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const kotMatch = trimmed.match(/KOT[-\s]?(\d+)/i)
  if (kotMatch?.[1]) {
    return `KOT-${kotMatch[1].padStart(2, '0')}`
  }

  return trimmed
}

const toElapsedSeconds = (startedAt: string | null): number | null => {
  if (!startedAt) return null
  const timestamp = new Date(startedAt).getTime()
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
}

const toMoneyNumber = (value: unknown): number | null => {
  let parsed: number | null = null

  if (typeof value === 'number') parsed = value
  if (parsed === null && typeof value === 'string' && value.trim().length > 0) {
    const candidate = Number(value)
    if (Number.isFinite(candidate)) parsed = candidate
  }

  if (parsed === null || !Number.isFinite(parsed)) return null
  return Math.max(0, Math.round(parsed * 100) / 100)
}

const getBillingTotalAmount = (billing: any): number | null => {
  const totalAmount = toMoneyNumber(billing?.totalAmount)
  if (totalAmount !== null) return totalAmount

  const grossAmount = toMoneyNumber(billing?.grossAmount)
  if (grossAmount !== null) return grossAmount

  if (Array.isArray(billing?.items)) {
    const subtotal = billing.items.reduce((sum: number, item: any) => {
      const itemSubtotal = toMoneyNumber(item?.subtotal)
      return sum + (itemSubtotal ?? 0)
    }, 0)
    if (Number.isFinite(subtotal) && subtotal > 0) return Math.round(subtotal * 100) / 100
  }

  return null
}

const getBranchNameFromRelation = (branch: unknown, fallback: string): string => {
  if (
    branch &&
    typeof branch === 'object' &&
    'name' in branch &&
    typeof (branch as { name?: unknown }).name === 'string'
  ) {
    return String((branch as { name: string }).name)
  }

  return fallback
}

const getCreatedByName = (createdBy: unknown): string | null => {
  if (
    createdBy &&
    typeof createdBy === 'object' &&
    'name' in createdBy &&
    typeof (createdBy as { name?: unknown }).name === 'string'
  ) {
    const name = (createdBy as { name: string }).name.trim()
    if (name.length > 0) return name
  }

  return null
}

const buildBranchWhere = (branchIds?: string[]): any => {
  if (!branchIds || branchIds.length === 0) return undefined
  if (branchIds.length === 1) return { branch: { equals: branchIds[0] } }
  return { branch: { in: branchIds } }
}

const resolveBranchScope = async (
  req: PayloadRequest,
  requestedBranchId: string | null,
): Promise<ScopeResult> => {
  const user = req.user as
    | {
        role?: string
        branch?: unknown
        company?: unknown
      }
    | undefined

  if (!user) {
    return {
      errorResponse: Response.json({ message: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (requestedBranchId && requestedBranchId !== 'all') {
    if (BRANCH_SCOPED_ROLES.has(user.role || '')) {
      const userBranchId = getRelationshipID(user.branch)
      if (!userBranchId) {
        return {
          errorResponse: Response.json(
            { message: 'Branch user is not assigned to a branch.' },
            { status: 403 },
          ),
        }
      }

      if (userBranchId !== requestedBranchId) {
        return {
          errorResponse: Response.json(
            { message: 'You are not allowed to access another branch.' },
            { status: 403 },
          ),
        }
      }

      return { branchIds: [userBranchId] }
    }

    if (user.role !== 'company') {
      return { branchIds: [requestedBranchId] }
    }
  }

  if (BRANCH_SCOPED_ROLES.has(user.role || '')) {
    const userBranchId = getRelationshipID(user.branch)
    if (!userBranchId) {
      return {
        errorResponse: Response.json(
          { message: 'Branch user is not assigned to a branch.' },
          { status: 403 },
        ),
      }
    }
    return { branchIds: [userBranchId] }
  }

  if (user.role !== 'company') {
    if (requestedBranchId && requestedBranchId !== 'all') {
      return { branchIds: [requestedBranchId] }
    }
    return {}
  }

  const companyId = getRelationshipID(user.company)
  if (!companyId) {
    return {
      errorResponse: Response.json(
        { message: 'Company user is not assigned to a company.' },
        { status: 403 },
      ),
    }
  }

  const companyBranches = await req.payload.find({
    collection: 'branches',
    where: {
      company: {
        equals: companyId,
      },
    },
    depth: 0,
    limit: 1000,
    pagination: false,
  })

  const allowedBranchIds = companyBranches.docs.map((branch) => branch.id)

  if (requestedBranchId && requestedBranchId !== 'all') {
    if (!allowedBranchIds.includes(requestedBranchId)) {
      return {
        errorResponse: Response.json(
          { message: 'You are not allowed to access this branch.' },
          { status: 403 },
        ),
      }
    }
    return { branchIds: [requestedBranchId] }
  }

  return { branchIds: allowedBranchIds }
}

const ensureBranch = (
  branchMap: Map<string, MutableBranch>,
  branchId: string,
  branchName: string,
): MutableBranch => {
  const existing = branchMap.get(branchId)
  if (existing) {
    if (!existing.branchName || existing.branchName === branchId) {
      existing.branchName = branchName
    }
    return existing
  }

  const created: MutableBranch = {
    branchId,
    branchName,
    sectionOrder: [],
    sectionsByKey: new Map(),
  }
  branchMap.set(branchId, created)
  return created
}

const ensureSection = (branch: MutableBranch, sectionName: string): MutableSection => {
  const normalizedSection = normalizeSectionName(sectionName)
  const sectionKey = normalizedSection || 'unknown'
  const existing = branch.sectionsByKey.get(sectionKey)
  if (existing) return existing

  const created: MutableSection = {
    sectionKey,
    sectionName: sectionName.trim() || 'Unknown',
    tableOrder: [],
    tablesByKey: new Map(),
  }

  branch.sectionsByKey.set(sectionKey, created)
  branch.sectionOrder.push(sectionKey)
  return created
}

const ensureTable = (
  section: MutableSection,
  tableNumber: string,
  preferredLabel?: string,
): MutableTableRow | null => {
  const normalizedTable = normalizeTableIdentifier(tableNumber)
  if (!normalizedTable) return null

  const existing = section.tablesByKey.get(normalizedTable)
  if (existing) return existing

  const tableLabel = preferredLabel || toTableLabel(tableNumber)
  const created: MutableTableRow = {
    tableKey: normalizedTable,
    tableNumber: tableNumber.trim() || normalizedTable,
    tableLabel,
    tableState: 'available',
    occupied: false,
    billId: null,
    status: null,
    kotNumber: null,
    totalAmount: null,
    servedBy: null,
    startedAt: null,
    elapsedSeconds: null,
  }

  section.tablesByKey.set(normalizedTable, created)
  section.tableOrder.push(normalizedTable)
  return created
}

const compareTables = (left: MutableTableRow, right: MutableTableRow): number => {
  const leftIndex = extractNumericTableIndex(left.tableNumber)
  const rightIndex = extractNumericTableIndex(right.tableNumber)

  if (leftIndex !== null && rightIndex !== null) {
    return leftIndex - rightIndex
  }

  if (leftIndex !== null) return -1
  if (rightIndex !== null) return 1

  return left.tableLabel.localeCompare(right.tableLabel)
}

const areAllItemsCancelled = (items: unknown): boolean => {
  if (!Array.isArray(items) || items.length === 0) return false
  return items.every((item) => {
    const status =
      item && typeof item === 'object' && 'status' in item
        ? (item as { status?: unknown }).status
        : null
    return normalizeItemStatus(status) === 'cancelled'
  })
}

const normalizeItemStatus = (value: unknown): 'ordered' | 'prepared' | 'delivered' | 'cancelled' => {
  if (typeof value !== 'string') return 'ordered'

  if (value === 'pending') return 'ordered'
  if (value === 'preparing' || value === 'confirmed') return 'prepared'
  if (value === 'prepared' || value === 'delivered' || value === 'cancelled' || value === 'ordered') {
    return value
  }

  return 'ordered'
}

const getNonCancelledStatuses = (items: unknown): Array<'ordered' | 'prepared' | 'delivered'> => {
  if (!Array.isArray(items)) return []

  return items
    .map((item) =>
      item && typeof item === 'object' && 'status' in item
        ? normalizeItemStatus((item as { status?: unknown }).status)
        : 'ordered',
    )
    .filter(
      (status): status is 'ordered' | 'prepared' | 'delivered' => status !== 'cancelled',
    )
}

const deriveLiveTableState = (items: unknown): 'active' | 'prepared' | 'delivered' => {
  const statuses = getNonCancelledStatuses(items)
  if (statuses.length === 0) return 'active'

  const hasOrdered = statuses.some((status) => status === 'ordered')
  if (hasOrdered) return 'active'

  const allDelivered = statuses.every((status) => status === 'delivered')
  return allDelivered ? 'delivered' : 'prepared'
}

const getActiveTimerStart = (
  billing: any,
  minMs: number,
  maxMs: number,
): string | null => {
  // Keep running time anchored to when the table bill started, not latest re-order.
  const createdAt = typeof billing?.createdAt === 'string' ? billing.createdAt : null
  if (!createdAt) return null
  const createdAtMs = new Date(createdAt).getTime()
  if (!Number.isFinite(createdAtMs) || createdAtMs < minMs || createdAtMs >= maxMs) return null
  return createdAt
}

export const getLiveTableStatusHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const requestURL = new URL(req.url || 'http://localhost')
    const requestedBranchId = requestURL.searchParams.get('branchId')
    const scope = await resolveBranchScope(req, requestedBranchId)
    if (scope.errorResponse) return scope.errorResponse

    const branchWhere = buildBranchWhere(scope.branchIds)
    const startOfToday = dayjs().tz(LIVE_TABLE_TIMEZONE).startOf('day')
    const endOfToday = startOfToday.add(1, 'day')
    const startOfTodayISO = startOfToday.toISOString()
    const endOfTodayISO = endOfToday.toISOString()
    const startOfTodayMs = startOfToday.valueOf()
    const endOfTodayMs = endOfToday.valueOf()
    const billingWhereConditions: any[] = [
      {
        status: {
          in: Array.from(ACTIVE_BILLING_STATUSES),
        },
      },
      {
        createdAt: {
          greater_than_equal: startOfTodayISO,
        },
      },
      {
        createdAt: {
          less_than: endOfTodayISO,
        },
      },
    ]

    if (branchWhere) {
      billingWhereConditions.unshift(branchWhere)
    }

    const [tableConfigResult, activeBillingResult] = await Promise.all([
      req.payload.find({
        collection: 'tables',
        where: branchWhere as any,
        depth: 1,
        sort: 'updatedAt',
        limit: 1000,
        pagination: false,
      }),
      req.payload.find({
        collection: 'billings',
        where: {
          and: billingWhereConditions,
        },
        depth: 1,
        sort: '-createdAt',
        limit: 5000,
        pagination: false,
      }),
    ])

    const branchMap = new Map<string, MutableBranch>()

    for (const tableConfig of tableConfigResult.docs as any[]) {
      const branchId = getRelationshipID(tableConfig?.branch)
      if (!branchId) continue

      const branchName = getBranchNameFromRelation(tableConfig.branch, branchId)
      const branch = ensureBranch(branchMap, branchId, branchName)
      const sections = Array.isArray(tableConfig?.sections) ? tableConfig.sections : []

      for (const section of sections) {
        const sectionName =
          typeof section?.name === 'string' && section.name.trim().length > 0
            ? section.name.trim()
            : 'Unknown'
        const sectionState = ensureSection(branch, sectionName)

        const configuredTables = resolveConfiguredTables(section)

        for (const tableNumber of configuredTables) {
          ensureTable(sectionState, tableNumber, `Table ${tableNumber}`)
        }
      }
    }

    for (const billing of activeBillingResult.docs as any[]) {
      const status = typeof billing?.status === 'string' ? billing.status : null
      if (!status || !ACTIVE_BILLING_STATUSES.has(status)) continue
      if (areAllItemsCancelled(billing?.items)) continue

      const sectionValue = billing?.tableDetails?.section
      const tableNumberValue = billing?.tableDetails?.tableNumber
      if (typeof sectionValue !== 'string' || typeof tableNumberValue !== 'string') continue
      if (!sectionValue.trim() || !tableNumberValue.trim()) continue

      const branchId = getRelationshipID(billing?.branch)
      if (!branchId) continue

      const branchName = getBranchNameFromRelation(billing.branch, branchId)
      const branch = ensureBranch(branchMap, branchId, branchName)
      const sectionState = ensureSection(branch, sectionValue)
      const tableState = ensureTable(sectionState, tableNumberValue, toTableLabel(tableNumberValue))
      if (!tableState) continue

      // Billing list is sorted newest first. Keep the latest active bill for each table.
      if (tableState.occupied) continue

      const createdAt = typeof billing?.createdAt === 'string' ? billing.createdAt : null
      if (!createdAt) continue
      const createdAtMs = new Date(createdAt).getTime()
      if (!Number.isFinite(createdAtMs)) continue
      if (createdAtMs < startOfTodayMs || createdAtMs >= endOfTodayMs) continue

      const kotCandidate =
        typeof billing?.kotNumber === 'string'
          ? billing.kotNumber
          : typeof billing?.invoiceNumber === 'string'
            ? billing.invoiceNumber
            : null

      const liveTableState = deriveLiveTableState(billing?.items)
      const activeTimerStart =
        liveTableState === 'active'
          ? getActiveTimerStart(billing, startOfTodayMs, endOfTodayMs)
          : null

      tableState.occupied = true
      tableState.tableState = liveTableState
      tableState.billId = typeof billing?.id === 'string' ? billing.id : null
      tableState.status = status
      tableState.kotNumber = toKotLabel(kotCandidate)
      tableState.totalAmount = getBillingTotalAmount(billing)
      tableState.servedBy = getCreatedByName(billing?.createdBy)
      tableState.startedAt = activeTimerStart
      tableState.elapsedSeconds = toElapsedSeconds(activeTimerStart)
      tableState.tableLabel = toTableLabel(tableNumberValue)
      tableState.tableNumber = tableNumberValue.trim()
    }

    if (scope.branchIds && scope.branchIds.length > 0) {
      const missingBranchIds = scope.branchIds.filter((branchId) => !branchMap.has(branchId))
      if (missingBranchIds.length > 0) {
        const missingBranches = await req.payload.find({
          collection: 'branches',
          where:
            missingBranchIds.length === 1
              ? { id: { equals: missingBranchIds[0] } }
              : { id: { in: missingBranchIds } },
          depth: 0,
          limit: 1000,
          pagination: false,
        })

        for (const branch of missingBranches.docs) {
          ensureBranch(branchMap, branch.id, branch.name)
        }
      }
    }

    const branches = Array.from(branchMap.values())
      .sort((left, right) => left.branchName.localeCompare(right.branchName))
      .map((branch) => {
        const sections = branch.sectionOrder
          .map((sectionKey) => branch.sectionsByKey.get(sectionKey))
          .filter((section): section is MutableSection => Boolean(section))
          .map((section) => {
            const tables = section.tableOrder
              .map((tableKey) => section.tablesByKey.get(tableKey))
              .filter((table): table is MutableTableRow => Boolean(table))
              .sort(compareTables)

            return {
              sectionName: section.sectionName,
              tables,
            }
          })

        return {
          branchId: branch.branchId,
          branchName: branch.branchName,
          sections,
        }
      })

    return Response.json({
      generatedAt: new Date().toISOString(),
      branches,
    })
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ message: 'Failed to fetch live table status' }, { status: 500 })
  }
}
