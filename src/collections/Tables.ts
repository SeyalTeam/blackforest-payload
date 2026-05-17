import type { CollectionConfig } from 'payload'

type TableRangeRowInput = {
  label?: unknown
  tableRange?: unknown
  [key: string]: unknown
}

type TableSectionInput = {
  name?: unknown
  tableCount?: unknown
  tableRange?: unknown
  rangeRows?: unknown
  [key: string]: unknown
}

type ParsedTableRange = {
  start: number
  end: number
  label: string
}

type NormalizedSectionResult = {
  section: TableSectionInput
  totalTables: number
}

const normalizeTableCount = (value: unknown): number => {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0
  return Math.floor(numericValue)
}

const formatTableRange = (startTable: number, endTable: number): string => {
  if (startTable === endTable) return `T${startTable}`
  return `T${startTable} - T${endTable}`
}

const parseRangeText = (value: string): ParsedTableRange | null => {
  const normalizedValue = value.trim()
  if (!normalizedValue) return null

  const match = normalizedValue.match(/^T?\s*(\d+)(?:\s*-\s*T?\s*(\d+))?$/i)
  if (!match) return null

  const start = Number.parseInt(match[1], 10)
  const end = Number.parseInt(match[2] ?? match[1], 10)

  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) return null
  if (end < start) return null

  return {
    start,
    end,
    label: formatTableRange(start, end),
  }
}

const normalizeRangeRows = (
  rangeRows: unknown,
  options: { strict: boolean; sectionLabel: string },
): { normalizedRows: TableRangeRowInput[]; parsedRanges: ParsedTableRange[] } => {
  if (!Array.isArray(rangeRows)) return { normalizedRows: [], parsedRanges: [] }

  const parsedRanges: ParsedTableRange[] = []
  const normalizedRows: TableRangeRowInput[] = []
  const usedTableNumbers = new Set<number>()
  let rowCounter = 1

  rangeRows.forEach((row, index) => {
    const rowRecord: TableRangeRowInput =
      row && typeof row === 'object' ? ({ ...row } as TableRangeRowInput) : {}
    const rawRange = typeof rowRecord.tableRange === 'string' ? rowRecord.tableRange.trim() : ''

    if (!rawRange) {
      if (options.strict) {
        throw new Error(
          `${options.sectionLabel}, Row ${index + 1}: table range is required (example: T1-T3).`,
        )
      }
      return
    }

    const parsed = parseRangeText(rawRange)
    if (!parsed) {
      if (options.strict) {
        throw new Error(
          `${options.sectionLabel}, Row ${index + 1}: invalid table range "${rawRange}". Use format like T1-T3.`,
        )
      }
      return
    }

    for (let tableNumber = parsed.start; tableNumber <= parsed.end; tableNumber += 1) {
      if (usedTableNumbers.has(tableNumber)) {
        if (options.strict) {
          throw new Error(
            `${options.sectionLabel}, Row ${index + 1}: table T${tableNumber} overlaps another row range.`,
          )
        }
        return
      }
      usedTableNumbers.add(tableNumber)
    }

    rowRecord.label = `Row ${rowCounter}`
    rowRecord.tableRange = parsed.label
    rowCounter += 1

    parsedRanges.push(parsed)
    normalizedRows.push(rowRecord)
  })

  return { normalizedRows, parsedRanges }
}

const normalizeSectionsWithMetadata = (
  sections: unknown,
  options: { strict: boolean },
): NormalizedSectionResult[] => {
  if (!Array.isArray(sections)) return []

  return sections.map((section, index) => {
    const sectionRecord: TableSectionInput =
      section && typeof section === 'object' ? ({ ...section } as TableSectionInput) : {}
    const sectionName =
      typeof sectionRecord.name === 'string' && sectionRecord.name.trim()
        ? sectionRecord.name.trim()
        : `Section ${index + 1}`

    const { normalizedRows, parsedRanges } = normalizeRangeRows(sectionRecord.rangeRows, {
      strict: options.strict,
      sectionLabel: sectionName,
    })

    const totalTablesFromRanges = parsedRanges.reduce(
      (sum, range) => sum + (range.end - range.start + 1),
      0,
    )
    const fallbackTableCount = normalizeTableCount(sectionRecord.tableCount)
    const totalTables = totalTablesFromRanges > 0 ? totalTablesFromRanges : fallbackTableCount

    if (normalizedRows.length > 0) {
      sectionRecord.rangeRows = normalizedRows
      sectionRecord.tableRange = normalizedRows
        .map((row) => `${String(row.label)}: ${String(row.tableRange)}`)
        .join(', ')
    } else {
      sectionRecord.tableRange =
        totalTables > 0 ? formatTableRange(1, totalTables) : 'No tables configured'
    }

    return {
      section: sectionRecord,
      totalTables,
    }
  })
}

const buildTableLayoutSummary = (sections: NormalizedSectionResult[]): string => {
  const summaryParts = sections.map(({ section, totalTables }, index) => {
    const sectionName =
      typeof section.name === 'string' && section.name.trim() ? section.name.trim() : `Section ${index + 1}`
    const range = typeof section.tableRange === 'string' ? section.tableRange : 'No tables configured'
    return `${sectionName}: ${range}${totalTables > 0 ? ` (${totalTables} tables)` : ''}`
  })

  return summaryParts.join(' | ')
}

const Tables: CollectionConfig = {
  slug: 'tables',
  admin: {
    useAsTitle: 'branch',
    defaultColumns: ['branch', 'tableLayoutSummary', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    afterRead: [
      ({ doc }) => {
        if (!doc || typeof doc !== 'object') return doc

        const docRecord = doc as Record<string, unknown>
        const normalizedSections = normalizeSectionsWithMetadata(docRecord.sections, {
          strict: false,
        })
        const sectionsWithRanges = normalizedSections.map((entry) => entry.section)

        return {
          ...docRecord,
          sections: sectionsWithRanges,
          tableLayoutSummary: buildTableLayoutSummary(normalizedSections),
        }
      },
    ],
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data || typeof data !== 'object') return data

        const dataRecord = data as Record<string, unknown>
        const originalRecord =
          originalDoc && typeof originalDoc === 'object' ? (originalDoc as Record<string, unknown>) : null
        const hasSectionsInData = Object.prototype.hasOwnProperty.call(dataRecord, 'sections')
        const rawSections = hasSectionsInData ? dataRecord.sections : originalRecord?.sections
        const normalizedSections = normalizeSectionsWithMetadata(rawSections, {
          strict: true,
        })
        const sectionsWithRanges = normalizedSections.map((entry) => entry.section)

        return {
          ...dataRecord,
          ...(hasSectionsInData ? { sections: sectionsWithRanges } : {}),
          tableLayoutSummary: buildTableLayoutSummary(normalizedSections),
        }
      },
    ],
  },
  fields: [
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      unique: true,
      admin: {
        description: 'Select the branch this table configuration belongs to.',
      },
    },
    {
      name: 'sections',
      type: 'array',
      required: true,
      minRows: 1,
      admin: {
        initCollapsed: false,
        description:
          'Single section can have multiple rows. Add one table range per row (example: Row 1 = T1-T3, Row 2 = T4-T6).',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            placeholder: 'e.g., AC, Non-AC, 1st Floor Dining',
          },
        },
        {
          name: 'tableCount',
          type: 'number',
          min: 1,
          admin: {
            placeholder: 'Legacy fallback: number of tables in this section',
            description: 'Optional. Prefer using Table Rows below.',
          },
        },
        {
          name: 'rangeRows',
          label: 'Table Rows',
          type: 'array',
          admin: {
            initCollapsed: false,
            description: 'Each row should contain one range (example: T1-T3).',
          },
          fields: [
            {
              name: 'label',
              type: 'text',
              admin: {
                readOnly: true,
                description: 'Auto-generated row label.',
              },
            },
            {
              name: 'tableRange',
              type: 'text',
              required: true,
              admin: {
                placeholder: 'e.g., T1-T3',
              },
            },
          ],
        },
        {
          name: 'tableRange',
          type: 'textarea',
          admin: {
            readOnly: true,
            description: 'Auto-generated section summary of row-wise ranges.',
          },
        },
      ],
    },
    {
      name: 'tableLayoutSummary',
      label: 'Table Layout Summary',
      type: 'textarea',
      admin: {
        readOnly: true,
        description:
          'Auto-generated summary used in collection list view to identify row-wise table mapping quickly.',
      },
    },
  ],
  timestamps: true,
}

export default Tables
