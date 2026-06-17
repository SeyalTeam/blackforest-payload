import type { CollectionConfig } from 'payload'

type TableSectionInput = {
  name?: unknown
  tableCount?: unknown
  tableRange?: unknown
  offlineTables?: unknown
  waiterAllocations?: unknown
  [key: string]: unknown
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

const normalizeSectionsWithMetadata = (
  sections: unknown,
  options: { strict: boolean },
): NormalizedSectionResult[] => {
  if (!Array.isArray(sections)) return []

  return sections.map((section, index) => {
    const sectionRecord: TableSectionInput =
      section && typeof section === 'object' ? ({ ...section } as TableSectionInput) : {}

    const totalTables = normalizeTableCount(sectionRecord.tableCount)

    sectionRecord.tableRange =
      totalTables > 0 ? formatTableRange(1, totalTables) : 'No tables configured'

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
        console.log('[beforeValidate] dataRecord.sections:', JSON.stringify(dataRecord.sections, null, 2))
        const originalRecord =
          originalDoc && typeof originalDoc === 'object' ? (originalDoc as Record<string, unknown>) : null
        const hasSectionsInData = Object.prototype.hasOwnProperty.call(dataRecord, 'sections')
        const rawSections = hasSectionsInData ? dataRecord.sections : originalRecord?.sections
        const normalizedSections = normalizeSectionsWithMetadata(rawSections, {
          strict: true,
        })
        const sectionsWithRanges = normalizedSections.map((entry) => entry.section)
        console.log('[beforeValidate] sectionsWithRanges output:', JSON.stringify(sectionsWithRanges, null, 2))

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
        description: 'Define the sections and number of tables per section.',
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
          required: true,
          min: 1,
          admin: {
            placeholder: 'Number of tables in this section',
            description: 'Define the number of tables in this section (e.g., 10 generates tables T1-T10).',
          },
        },
        {
          name: 'tableRange',
          type: 'textarea',
          admin: {
            readOnly: true,
            description: 'Auto-generated section summary of table range.',
          },
        },
        {
          name: 'offlineTables',
          type: 'select',
          hasMany: true,
          admin: {
            description: 'Select table numbers in this section that are currently offline.',
            isClearable: true,
          },
          options: Array.from({ length: 150 }, (_, i) => String(i + 1)),
        },
        {
          name: 'waiterAllocations',
          label: 'Waiter Allocations',
          type: 'array',
          admin: {
            description: 'Allocate waiters to tables in this section. Allocations made in the Live Table widget will automatically appear here.',
          },
          fields: [
            {
              name: 'tableNumber',
              label: 'Table Number',
              type: 'select',
              required: true,
              options: Array.from({ length: 150 }, (_, i) => String(i + 1)),
            },
            {
              name: 'waiter',
              label: 'Waiter',
              type: 'relationship',
              relationTo: 'users',
              required: true,
              filterOptions: {
                role: { in: ['waiter', 'supervisor', 'cashier'] },
              },
            },
          ],
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
