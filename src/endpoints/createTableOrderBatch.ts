import type { PayloadHandler, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

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

type BatchSelection = {
  section: string
  tableNumber: string
  normalizedSection: string
  normalizedTable: string
}

const toText = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const getRelationshipID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (typeof value === 'object' && value !== null) {
    const record = value as { id?: unknown; _id?: unknown }
    const id = getRelationshipID(record.id)
    if (id) return id
    return getRelationshipID(record._id)
  }

  return null
}

const normalizeSectionName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const parseSimpleTableNumber = (value: string): number | null => {
  const normalizedValue = value.trim()
  if (!normalizedValue) return null

  const match = normalizedValue.match(/^(?:table|t)?\s*(\d+)$/i)
  if (!match) return null

  const parsed = Number.parseInt(match[1], 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

const normalizeTableNumber = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const numericValue = parseSimpleTableNumber(trimmed)
  if (numericValue !== null) return String(numericValue)

  return trimmed.toLowerCase().replace(/\s+/g, ' ')
}

const parseConfiguredTableRange = (value: unknown): { start: number; end: number } | null => {
  if (typeof value !== 'string') return null

  const normalizedValue = value.trim()
  if (!normalizedValue) return null

  const match = normalizedValue.match(/^T?\s*(\d+)(?:\s*-\s*T?\s*(\d+))?$/i)
  if (!match) return null

  const start = Number.parseInt(match[1], 10)
  const end = Number.parseInt(match[2] ?? match[1], 10)

  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || end < start) {
    return null
  }

  return { start, end }
}

const resolveConfiguredTables = (section: unknown): string[] => {
  const sectionRecord = section && typeof section === 'object' ? (section as Record<string, unknown>) : {}

  const rangeRows = Array.isArray(sectionRecord.rangeRows) ? sectionRecord.rangeRows : []
  const rangeValues: string[] = []
  const rangeSeen = new Set<string>()

  for (const row of rangeRows) {
    const rowRecord = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const parsedRange = parseConfiguredTableRange(rowRecord.tableRange)
    if (!parsedRange) continue

    for (let table = parsedRange.start; table <= parsedRange.end; table += 1) {
      const value = String(table)
      if (rangeSeen.has(value)) continue
      rangeSeen.add(value)
      rangeValues.push(value)
    }
  }

  if (rangeValues.length > 0) return rangeValues

  const rawTableCount = sectionRecord.tableCount
  const tableCount =
    typeof rawTableCount === 'number'
      ? rawTableCount
      : typeof rawTableCount === 'string'
        ? Number(rawTableCount)
        : 0

  if (!Number.isFinite(tableCount) || tableCount <= 0) return []

  const fallback: string[] = []
  for (let index = 1; index <= Math.floor(tableCount); index += 1) {
    fallback.push(String(index))
  }
  return fallback
}

const parseOfflineTablesToArrayOfStrings = (offlineTables: unknown): string[] => {
  if (!Array.isArray(offlineTables)) return []
  return offlineTables
    .map((val) => {
      if (typeof val === 'string') return val.trim()
      if (typeof val === 'number') return String(val)
      if (val && typeof val === 'object') {
        const num = (val as { tableNumber?: unknown; table?: unknown; tableNo?: unknown }).tableNumber ?? 
                    (val as { tableNumber?: unknown; table?: unknown; tableNo?: unknown }).table ?? 
                    (val as { tableNumber?: unknown; table?: unknown; tableNo?: unknown }).tableNo
        if (typeof num === 'string') return num.trim()
        if (typeof num === 'number') return String(num)
      }
      return ''
    })
    .filter(Boolean)
}

const parseBody = async (req: { json?: () => Promise<unknown>; url?: string }): Promise<Record<string, unknown>> => {
  try {
    const payload = await req.json?.()
    if (payload && typeof payload === 'object') return payload as Record<string, unknown>
  } catch (_error) {
    // Ignore and fallback to URL params.
  }

  const url = new URL(req.url || 'http://localhost')
  return {
    branchId: url.searchParams.get('branchId'),
    section: url.searchParams.get('section'),
    tableNumber: url.searchParams.get('tableNumber'),
  }
}

const parseSelections = (body: Record<string, unknown>): BatchSelection[] => {
  const selections: BatchSelection[] = []
  const commonSection = toText(body.section)

  const selectedTables = Array.isArray(body.selectedTables) ? body.selectedTables : []
  for (const row of selectedTables) {
    const rowRecord = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const section = toText(rowRecord.section) || commonSection
    const tableNumber = toText(rowRecord.tableNumber ?? rowRecord.table)
    if (!section || !tableNumber) continue

    const normalizedSection = normalizeSectionName(section)
    const normalizedTable = normalizeTableNumber(tableNumber)
    if (!normalizedSection || !normalizedTable) continue

    selections.push({ section, tableNumber, normalizedSection, normalizedTable })
  }

  if (selections.length === 0) {
    const tableNumbers = Array.isArray(body.tableNumbers) ? body.tableNumbers : []
    for (const value of tableNumbers) {
      const section = commonSection
      const tableNumber = toText(value)
      if (!section || !tableNumber) continue

      const normalizedSection = normalizeSectionName(section)
      const normalizedTable = normalizeTableNumber(tableNumber)
      if (!normalizedSection || !normalizedTable) continue

      selections.push({ section, tableNumber, normalizedSection, normalizedTable })
    }
  }

  if (selections.length === 0) {
    const section = commonSection
    const tableNumber = toText(body.tableNumber ?? body.table)
    if (section && tableNumber) {
      const normalizedSection = normalizeSectionName(section)
      const normalizedTable = normalizeTableNumber(tableNumber)
      if (normalizedSection && normalizedTable) {
        selections.push({ section, tableNumber, normalizedSection, normalizedTable })
      }
    }
  }

  const unique = new Map<string, BatchSelection>()
  for (const selection of selections) {
    unique.set(`${selection.normalizedSection}::${selection.normalizedTable}`, selection)
  }

  return Array.from(unique.values())
}

const buildBillingBaseData = (body: Record<string, unknown>): Record<string, unknown> => {
  const billingData =
    body.billingData && typeof body.billingData === 'object'
      ? ({ ...(body.billingData as Record<string, unknown>) } as Record<string, unknown>)
      : ({ ...body } as Record<string, unknown>)

  delete billingData.branchId
  delete billingData.branch
  delete billingData.selectedBranchId
  delete billingData.section
  delete billingData.table
  delete billingData.tableNumber
  delete billingData.tableNumbers
  delete billingData.selectedTables
  delete billingData.billingData

  return billingData
}

type AllowedTableConfig = {
  allowed: Map<string, Set<string>>
  offline: Map<string, Set<string>>
}

const resolveAllowedTablesBySection = async (
  req: PayloadRequest,
  branchId: string,
): Promise<AllowedTableConfig> => {
  const tableConfigResult = await req.payload.find({
    collection: 'tables',
    where: {
      branch: {
        equals: branchId,
      },
    },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })

  const tableConfig = tableConfigResult.docs[0] as { sections?: unknown } | undefined
  const sections = Array.isArray(tableConfig?.sections) ? tableConfig.sections : []
  const allowed = new Map<string, Set<string>>()
  const offline = new Map<string, Set<string>>()

  for (const section of sections) {
    const sectionRecord =
      section && typeof section === 'object' ? (section as Record<string, unknown>) : {}
    const sectionName = toText(sectionRecord.name)
    if (!sectionName) continue

    const normalizedSection = normalizeSectionName(sectionName)
    if (!normalizedSection) continue

    const configuredTables = resolveConfiguredTables(sectionRecord)
    const normalizedTables = new Set<string>()
    for (const table of configuredTables) {
      const normalized = normalizeTableNumber(table)
      if (normalized) normalizedTables.add(normalized)
    }

    const offlineTables = parseOfflineTablesToArrayOfStrings(sectionRecord.offlineTables)
    const offlineSet = new Set<string>()
    for (const val of offlineTables) {
      const normalized = normalizeTableNumber(val)
      if (normalized) offlineSet.add(normalized)
    }

    allowed.set(normalizedSection, normalizedTables)
    offline.set(normalizedSection, offlineSet)
  }

  return { allowed, offline }
}

const getErrorStatus = (error: unknown): number => {
  if (error && typeof error === 'object' && 'status' in error) {
    const value = (error as { status?: unknown }).status
    if (typeof value === 'number' && Number.isFinite(value) && value >= 100 && value < 600) {
      return value
    }
  }
  return 500
}

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return 'Failed to create table orders'
}

export const createTableOrderBatchHandler: PayloadHandler = async (
  req,
): Promise<Response> => {
  try {
    if (!req.user) {
      return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await parseBody(req as { json?: () => Promise<unknown>; url?: string })
    const branchId =
      toText(body.branchId) || toText(body.branch) || toText(body.selectedBranchId)

    if (!branchId) {
      return Response.json({ ok: false, message: 'branchId is required' }, { status: 400 })
    }

    const currentUser = req.user as { role?: unknown; branch?: unknown } | undefined
    const userRole = typeof currentUser?.role === 'string' ? currentUser.role : ''
    const userBranchId = getRelationshipID(currentUser?.branch)

    if (BRANCH_SCOPED_ROLES.has(userRole)) {
      if (!userBranchId) {
        return Response.json(
          { ok: false, message: 'Branch-scoped user is not assigned to a branch.' },
          { status: 403 },
        )
      }

      if (userBranchId !== branchId) {
        return Response.json(
          { ok: false, message: 'You are not allowed to create orders for another branch.' },
          { status: 403 },
        )
      }
    }

    const selections = parseSelections(body)
    if (selections.length === 0) {
      return Response.json(
        {
          ok: false,
          message:
            'Provide selectedTables [{ section, tableNumber }] or section + tableNumbers[]',
        },
        { status: 400 },
      )
    }

    const { allowed: allowedTablesBySection, offline: offlineTablesBySection } =
      await resolveAllowedTablesBySection(req, branchId)

    if (allowedTablesBySection.size > 0) {
      for (const selection of selections) {
        const tables = allowedTablesBySection.get(selection.normalizedSection)
        const offlineTables = offlineTablesBySection.get(selection.normalizedSection)

        if (!tables) {
          return Response.json(
            {
              ok: false,
              message: `Section "${selection.section}" is not configured for this branch.`,
              failedSelection: {
                section: selection.section,
                tableNumber: selection.tableNumber,
              },
            },
            { status: 400 },
          )
        }

        if (offlineTables?.has(selection.normalizedTable)) {
          return Response.json(
            {
              ok: false,
              message: `Table "${selection.tableNumber}" in section "${selection.section}" is currently offline.`,
              failedSelection: {
                section: selection.section,
                tableNumber: selection.tableNumber,
              },
            },
            { status: 400 },
          )
        }

        if (!tables.has(selection.normalizedTable)) {
          return Response.json(
            {
              ok: false,
              message: `Table "${selection.tableNumber}" is not configured under section "${selection.section}".`,
              failedSelection: {
                section: selection.section,
                tableNumber: selection.tableNumber,
              },
            },
            { status: 400 },
          )
        }
      }
    }

    const baseBillingData = buildBillingBaseData(body)
    const createdBills: Array<{
      id: string
      invoiceNumber: string | null
      kotNumber: string | null
      status: string | null
      section: string
      tableNumber: string
    }> = []

    for (const selection of selections) {
      const billingCreateData = {
        ...baseBillingData,
        branch: branchId,
        section: selection.section,
        tableNumber: selection.tableNumber,
      } as unknown as RequiredDataFromCollectionSlug<'billings'>

      let created:
        | {
            id: string
            invoiceNumber?: unknown
            kotNumber?: unknown
            status?: unknown
          }
        | null = null

      try {
        created = (await req.payload.create({
          collection: 'billings',
          user: req.user,
          data: billingCreateData,
          depth: 0,
        })) as {
          id: string
          invoiceNumber?: unknown
          kotNumber?: unknown
          status?: unknown
        }
      } catch (error) {
        return Response.json(
          {
            ok: false,
            message: getErrorMessage(error),
            failedSelection: {
              section: selection.section,
              tableNumber: selection.tableNumber,
            },
            createdCount: createdBills.length,
            bills: createdBills,
          },
          { status: getErrorStatus(error) },
        )
      }

      if (!created) {
        return Response.json(
          {
            ok: false,
            message: 'Failed to create table orders',
            failedSelection: {
              section: selection.section,
              tableNumber: selection.tableNumber,
            },
            createdCount: createdBills.length,
            bills: createdBills,
          },
          { status: 500 },
        )
      }

      createdBills.push({
        id: created.id,
        invoiceNumber: toText(created.invoiceNumber),
        kotNumber: toText(created.kotNumber),
        status: toText(created.status),
        section: selection.section,
        tableNumber: selection.tableNumber,
      })
    }

    return Response.json({
      ok: true,
      branchId,
      totalRequested: selections.length,
      createdCount: createdBills.length,
      bills: createdBills,
    })
  } catch (error) {
    req.payload.logger.error({
      msg: 'Failed to create batch table orders',
      err: error,
    })

    return Response.json(
      {
        ok: false,
        message: getErrorMessage(error),
      },
      { status: getErrorStatus(error) },
    )
  }
}
