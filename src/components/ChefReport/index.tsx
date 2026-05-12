'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, GroupBase, OptionProps, ValueContainerProps } from 'react-select'
import './index.scss'

type NamedOption = {
  id: string
  name: string
}

type ChefSummaryRow = {
  chefName: string
  amount: number
  role: 'stock order' | 'table order'
}

type ChefSummaryApiRow = {
  chefName?: unknown
  sendingAmount?: unknown
}

type ChefTableOrderApiRow = {
  chefName?: unknown
  amount?: unknown
}

type ChefReportResponse = {
  data?: {
    stockOrderReport?: {
      chefSummary?: ChefSummaryApiRow[]
    }
    productPreparationBillDetailsReport?: {
      details?: ChefTableOrderApiRow[]
    }
  }
  errors?: Array<{ message?: string }>
}

type SelectOption = {
  value: string
  label: string
}

type DatePreset =
  | 'till_now'
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'last_month'

type OrderTypeFilter = 'all' | 'stock' | 'table'

const CHEF_REPORT_QUERY = `
  query ChefReportSummary(
    $stockFilter: StockOrderReportFilterInput
    $tableFilter: ProductPreparationBillDetailsReportFilterInput
  ) {
    stockOrderReport(filter: $stockFilter) {
      chefSummary {
        chefName
        sendingAmount
      }
    }
    productPreparationBillDetailsReport(filter: $tableFilter) {
      details {
        chefName
        amount
      }
    }
  }
`

const CheckboxOption = (props: OptionProps<SelectOption, true>) => {
  return (
    <components.Option {...props}>
      <input
        type="checkbox"
        checked={props.isSelected}
        onChange={() => null}
        style={{ marginRight: 8 }}
      />
      {props.label}
    </components.Option>
  )
}

const CustomValueContainer = ({
  children,
  ...props
}: ValueContainerProps<SelectOption, true, GroupBase<SelectOption>>) => {
  const { getValue, hasValue, selectProps } = props
  const selected = getValue()
  const count = selected.length
  const isTyping = selectProps.inputValue && selectProps.inputValue.length > 0

  return (
    <components.ValueContainer {...props}>
      {hasValue && count > 0 && !isTyping && (
        <div style={{ paddingLeft: '8px', position: 'absolute', pointerEvents: 'none' }}>
          {count === 1 ? selected[0]?.label : `${count} Selected`}
        </div>
      )}
      {children}
    </components.ValueContainer>
  )
}

const MultiValue = () => null

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

const toNamedOptions = (rawDocs: unknown[]): NamedOption[] =>
  rawDocs
    .filter((doc): doc is { id?: unknown; name?: unknown } => !!doc && typeof doc === 'object')
    .map((doc) => ({
      id: toStringValue(doc.id),
      name: toStringValue(doc.name),
    }))
    .filter((doc) => doc.id.length > 0 && doc.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

/* Helper to format date as YYYY-MM-DD using local time to avoid timezone shifts */
const toLocalDateStr = (d: Date) => {
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().split('T')[0]
}

const formatValue = (val: number) => {
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const ChefReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<DatePreset>('today')

  const [branches, setBranches] = useState<NamedOption[]>([])
  const [chefs, setChefs] = useState<NamedOption[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [selectedChef, setSelectedChef] = useState<string[]>(['all'])
  const [selectedOrderType, setSelectedOrderType] = useState<OrderTypeFilter>('all')

  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)
  const [loadingFilters, setLoadingFilters] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<ChefSummaryRow[]>([])
  const [showExportMenu, setShowExportMenu] = useState(false)

  const dateRangeOptions = [
    { value: 'till_now', label: 'Till Now' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_month', label: 'Last Month' },
  ]

  const orderTypeOptions: SelectOption[] = [
    { value: 'all', label: 'All Orders' },
    { value: 'stock', label: 'Stock Order' },
    { value: 'table', label: 'Table Order' },
  ]

  const branchOptions = useMemo<SelectOption[]>(
    () => [{ value: 'all', label: 'All Branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))],
    [branches],
  )

  const chefOptions = useMemo<SelectOption[]>(
    () => [{ value: 'all', label: 'All Chefs' }, ...chefs.map((c) => ({ value: c.id, label: c.name.toUpperCase() }))],
    [chefs],
  )

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
      borderRadius: '8px',
      height: '42px',
      minHeight: '42px',
      minWidth: '200px',
      padding: '0',
      boxShadow: state.isFocused ? '0 0 0 1px var(--theme-info-500)' : 'none',
      color: 'var(--theme-text-primary)',
      '&:hover': {
        borderColor: 'var(--theme-info-750)',
      },
    }),
    singleValue: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary)',
      fontWeight: '600',
    }),
    option: (
      base: Record<string, unknown>,
      state: { isSelected: boolean; isFocused: boolean },
    ) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--theme-info-500)'
        : state.isFocused
          ? 'var(--theme-elevation-100)'
          : 'var(--theme-input-bg, var(--theme-elevation-50))',
      color: state.isSelected ? '#fff' : 'var(--theme-text-primary)',
      cursor: 'pointer',
    }),
    menu: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      border: '1px solid var(--theme-elevation-150)',
      zIndex: 9999,
      minWidth: '200px',
    }),
    input: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary)',
      fontWeight: '600',
    }),
  }

  const handleDatePresetChange = (value: DatePreset) => {
    setDateRangePreset(value)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let start: Date | null = null
    let end: Date | null = today

    switch (value) {
      case 'till_now':
        if (firstBillDate) {
          start = firstBillDate
        }
        break
      case 'today':
        start = today
        end = today
        break
      case 'yesterday': {
        const yest = new Date(today)
        yest.setDate(yest.getDate() - 1)
        start = yest
        end = yest
        break
      }
      case 'last_7_days': {
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 6)
        start = last7
        break
      }
      case 'this_month': {
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        start = thisMonthStart
        end = today
        break
      }
      case 'last_30_days': {
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        start = last30
        break
      }
      case 'last_month': {
        const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        start = prevMonthStart
        end = prevMonthEnd
        break
      }
    }

    if (start && end) {
      setDateRange([start, end])
    }
  }

  const fetchReport = useCallback(async () => {
    setLoadingReport(true)
    setError('')

    try {
      if (!startDate || !endDate) return

      const startStr = toLocalDateStr(startDate)
      const endStr = toLocalDateStr(endDate)

      const branchParam = selectedBranch.includes('all') ? 'all' : selectedBranch.join(',')
      const chefParam = selectedChef.includes('all') ? 'all' : selectedChef.join(',')

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CHEF_REPORT_QUERY,
          variables: {
            stockFilter: {
              startDate: startStr,
              endDate: endStr,
              branch: branchParam,
              chef: chefParam,
            },
            tableFilter: {
              startDate: startStr,
              endDate: endStr,
              branch: branchParam,
              chefId: chefParam,
              orderType: 'table',
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch chef report (HTTP ${response.status})`)
      }

      const json = (await response.json()) as ChefReportResponse
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || 'Failed to fetch chef report')
      }

      const reportRows = Array.isArray(json.data?.stockOrderReport?.chefSummary)
        ? json.data?.stockOrderReport?.chefSummary
        : []
      const tableRows = Array.isArray(json.data?.productPreparationBillDetailsReport?.details)
        ? json.data?.productPreparationBillDetailsReport?.details
        : []

      const stockSummaryRows = reportRows
        .map((row) => ({
          chefName: toStringValue(row.chefName).trim() || 'Unknown',
          amount: toFiniteNumber(row.sendingAmount),
          role: 'stock order' as const,
        }))
        .filter((row) => row.amount > 0)

      const tableSummaryMap = new Map<string, number>()
      tableRows.forEach((row) => {
        const chefName = toStringValue(row.chefName).trim() || 'Unknown'
        const amount = toFiniteNumber(row.amount)
        if (amount <= 0) return
        tableSummaryMap.set(chefName, (tableSummaryMap.get(chefName) || 0) + amount)
      })

      const tableSummaryRows = Array.from(tableSummaryMap.entries())
        .map(([chefName, amount]) => ({
          chefName,
          amount,
          role: 'table order' as const,
        }))
        .sort((a, b) => a.chefName.localeCompare(b.chefName))

      const normalizedRows = [...stockSummaryRows, ...tableSummaryRows].sort((a, b) => {
        const byName = a.chefName.localeCompare(b.chefName)
        if (byName !== 0) return byName
        return a.role.localeCompare(b.role)
      })

      const filteredRows =
        selectedOrderType === 'all'
          ? normalizedRows
          : normalizedRows.filter((row) =>
              selectedOrderType === 'stock' ? row.role === 'stock order' : row.role === 'table order',
            )

      setRows(filteredRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading chef report')
      setRows([])
    } finally {
      setLoadingReport(false)
    }
  }, [endDate, selectedBranch, selectedChef, selectedOrderType, startDate])

  useEffect(() => {
    const fetchMetadata = async () => {
      setLoadingFilters(true)
      try {
        const [branchRes, chefRes, billRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/users?where[role][equals]=chef&limit=1000&pagination=false&sort=name&depth=0'),
          fetch('/api/billings?sort=createdAt&limit=1'),
        ])

        if (branchRes.ok) {
          const branchJson = await branchRes.json()
          const branchDocs = Array.isArray(branchJson?.docs) ? branchJson.docs : []
          setBranches(toNamedOptions(branchDocs))
        }

        if (chefRes.ok) {
          const chefJson = await chefRes.json()
          const chefDocs = Array.isArray(chefJson?.docs) ? chefJson.docs : []
          setChefs(toNamedOptions(chefDocs))
        }

        if (billRes.ok) {
          const billJson = await billRes.json()
          if (Array.isArray(billJson?.docs) && billJson.docs.length > 0 && billJson.docs[0]?.createdAt) {
            const parsed = new Date(billJson.docs[0].createdAt)
            if (!Number.isNaN(parsed.getTime())) {
              setFirstBillDate(parsed)
            }
          }
        }
      } catch (_err) {
        setBranches([])
        setChefs([])
      } finally {
        setLoadingFilters(false)
      }
    }

    void fetchMetadata()
  }, [])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0),
    [rows],
  )

  const handleExportCsv = () => {
    const csvRows: string[] = []
    csvRows.push(['Chef Name', 'Amount', 'Role'].join(','))
    rows.forEach((row) => {
      csvRows.push(
        [`"${row.chefName.replace(/"/g, '""')}"`, row.amount.toString(), `"${row.role}"`].join(','),
      )
    })
    csvRows.push(['"TOTAL"', totalAmount.toString(), '""'].join(','))

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chef_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  const resetFilters = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setDateRange([today, today])
    setDateRangePreset('today')
    setSelectedBranch(['all'])
    setSelectedChef(['all'])
    setSelectedOrderType('all')
    setShowExportMenu(false)
  }

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      const [start, end] = value ? value.split(' - ') : ['', '']

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref}>
          <span className="date-text">{start}</span>
          <span className="separator">→</span>
          <span className="date-text">{end || start}</span>
          <span className="icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </span>
        </button>
      )
    },
  )
  CustomInput.displayName = 'CustomInput'

  return (
    <div className="chef-report-container">
      <div className="report-header">
        <div className="title-row">
          <h1>Chef Report</h1>
        </div>

        <div className="date-filter">
          <div className="filter-group">
            <Select<SelectOption, false>
              instanceId="chef-date-preset-select"
              options={dateRangeOptions}
              value={dateRangeOptions.find((o) => o.value === dateRangePreset)}
              onChange={(option: { value: string; label: string } | null) => {
                if (!option) return
                handleDatePresetChange(option.value as DatePreset)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Date Range..."
              isSearchable={false}
            />
          </div>

          <div className="filter-group">
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update: [Date | null, Date | null]) => {
                setDateRange(update)
              }}
              monthsShown={1}
              dateFormat="yyyy-MM-dd"
              className="date-input"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
            />
          </div>

          <div className="filter-group select-group">
            <Select<SelectOption, true>
              instanceId="chef-branch-select"
              options={branchOptions}
              isMulti
              isDisabled={loadingFilters}
              value={branchOptions.filter((o) => selectedBranch.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedBranch.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
                else if (final.length === 0) final = ['all']
                setSelectedBranch(final)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Branch..."
              isSearchable={true}
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{
                Option: CheckboxOption,
                ValueContainer: CustomValueContainer,
                MultiValue,
              }}
            />
          </div>

          <div className="filter-group select-group">
            <Select<SelectOption, true>
              instanceId="chef-user-select"
              options={chefOptions}
              isMulti
              isDisabled={loadingFilters}
              value={chefOptions.filter((o) => selectedChef.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedChef.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
                else if (final.length === 0) final = ['all']
                setSelectedChef(final)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Chef..."
              isSearchable={true}
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{
                Option: CheckboxOption,
                ValueContainer: CustomValueContainer,
                MultiValue,
              }}
            />
          </div>

          <div className="filter-group">
            <Select<SelectOption, false>
              instanceId="chef-order-type-select"
              options={orderTypeOptions}
              value={orderTypeOptions.find((o) => o.value === selectedOrderType)}
              onChange={(option: { value: string; label: string } | null) => {
                if (!option) return
                const value = option.value === 'stock' || option.value === 'table' ? option.value : 'all'
                setSelectedOrderType(value)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Order Type..."
              isSearchable={false}
            />
          </div>

          <div className="filter-group">
            <div className="export-container">
              <button
                className="export-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Report"
                type="button"
              >
                <span>Export</span>
                <span className="icon">↓</span>
              </button>

              {showExportMenu && (
                <div className="export-menu">
                  <button onClick={handleExportCsv}>Excel</button>
                </div>
              )}
            </div>

            {showExportMenu && <div className="export-backdrop" onClick={() => setShowExportMenu(false)} />}
          </div>

          <div className="filter-group">
            <button
              onClick={resetFilters}
              title="Reset Filters"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 0 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--theme-text-primary)',
              }}
              type="button"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loadingReport && <p>Loading chef report...</p>}
      {error && <p className="error">{error}</p>}

      <div className="table-container" style={{ width: '35%', maxWidth: '100%' }}>
        <table className="report-table">
          <thead>
            <tr>
              <th>CHEF NAME</th>
              <th className="text-right">AMOUNT</th>
              <th>ROLE</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${row.chefName}-${row.role}-${index}`}>
                  <td className="name-cell">{row.chefName.toUpperCase()}</td>
                  <td className="text-right amount-cell">{formatValue(row.amount)}</td>
                  <td style={{ textTransform: 'uppercase', fontWeight: 600 }}>{row.role}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center' }}>
                  No chef report data found.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="grand-total">
              <td>TOTAL</td>
              <td className="text-right amount-cell">{formatValue(totalAmount)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default ChefReport
