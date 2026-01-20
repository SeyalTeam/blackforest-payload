'use client'

import React, { useState, useEffect } from 'react'
import Select from 'react-select'
import './index.scss'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

type ReportStats = {
  branchName: string
  totalEntries: number
  systemSales: number
  totalBills: number
  manualSales: number
  onlineSales: number
  totalSales: number
  expenses: number
  cash: number
  upi: number
  card: number
  closingNumbers: string[]
  lastUpdated: string
  entries: ClosingEntryDetail[]
  sNo?: number
  expenseDetails?: ExpenseDetail[]
  count2000?: number
  count500?: number
  count200?: number
  count10?: number
  count5?: number
  count100?: number
  count50?: number
}

type ExpenseDetail = {
  category: string
  reason: string
  amount: number
  imageUrl?: string
  date: string
}

type ClosingEntryDetail = {
  closingNumber: string
  createdAt: string
  systemSales: number
  totalBills: number
  manualSales: number
  onlineSales: number
  totalSales: number
  expenses: number
  cash: number
  upi: number
  card: number
  expenseDetails?: ExpenseDetail[]
  denominations?: Denominations
}

type Denominations = {
  count2000: number
  count500: number
  count200: number
  count100: number
  count50: number
  count10: number
  count5: number
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: Omit<ReportStats, 'branchName' | 'sNo' | 'entries' | 'closingNumbers' | 'lastUpdated'>
}

const ClosingEntryReport: React.FC = () => {
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [firstClosingDate, setFirstClosingDate] = useState<Date | null>(null)

  const [expensePopupData, setExpensePopupData] = useState<{
    title: string
    details: ExpenseDetail[]
  } | null>(null)

  const [cashPopupData, setCashPopupData] = useState<{
    title: string
    denominations: Denominations
  } | null>(null)

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchesRes, closingRes] = await Promise.all([
          fetch('/api/branches?limit=1000&sort=name'),
          fetch('/api/closing-entries?sort=createdAt&limit=1'),
        ])
        const branchesJson = await branchesRes.json()
        setBranches(branchesJson.docs || [])

        const closingJson = await closingRes.json()
        if (closingJson.docs && closingJson.docs.length > 0) {
          setFirstClosingDate(new Date(closingJson.docs[0].createdAt))
        }
      } catch (err) {
        console.error('Error fetching metadata', err)
      }
    }
    fetchMetadata()
  }, [])

  const getQuarterDates = (date: Date) => {
    const currQuarter = Math.floor((date.getMonth() + 3) / 3)
    const prevQuarter = currQuarter - 1
    let startMonth = 0
    let year = date.getFullYear()

    if (prevQuarter === 0) {
      startMonth = 9 // Oct
      year -= 1
    } else {
      startMonth = (prevQuarter - 1) * 3
    }
    const endMonth = startMonth + 2

    // Start of quarter
    const start = new Date(year, startMonth, 1)
    // End of quarter (last day of endMonth)
    const end = new Date(year, endMonth + 1, 0)

    return { start, end }
  }

  const handleDatePresetChange = (value: string) => {
    setDateRangePreset(value)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let start: Date | null = null
    let end: Date | null = today

    switch (value) {
      case 'till_now':
        if (firstClosingDate) {
          start = firstClosingDate
        }
        break
      case 'today':
        start = today
        end = today
        break
      case 'yesterday': {
        const y = new Date(today)
        y.setDate(y.getDate() - 1)
        start = y
        end = y
        break
      }
      case 'last_7_days': {
        const d7 = new Date(today)
        d7.setDate(d7.getDate() - 6)
        start = d7
        break
      }
      case 'this_month': {
        const mStart = new Date(today.getFullYear(), today.getMonth(), 1)
        start = mStart
        break
      }
      case 'last_30_days': {
        const d30 = new Date(today)
        d30.setDate(d30.getDate() - 29)
        start = d30
        break
      }
      case 'last_month': {
        const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        start = lmStart
        end = lmEnd
        break
      }
      case 'last_quarter': {
        const { start: qStart, end: qEnd } = getQuarterDates(today)
        start = qStart
        end = qEnd
        break
      }
    }
    setDateRange([start, end])
  }

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  /* Helper to format date as YYYY-MM-DD using local time to avoid timezone shifts */
  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0') // Month is 0-indexed
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchReport = async (start: Date, end: Date) => {
    setLoading(true)
    setError('')
    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const res = await fetch(`/api/reports/closing-entry?startDate=${startStr}&endDate=${endStr}`)
      if (!res.ok) throw new Error('Failed to fetch report')
      const json: ReportData = await res.json()

      setData(json)
    } catch (err) {
      console.error(err)
      setError('Error loading report data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  // Initial load: set default date range (Today)
  useEffect(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setDateRange([today, today])
  }, [])

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      // split the value "YYYY-MM-DD - YYYY-MM-DD"
      const [start, end] = value ? value.split(' - ') : ['', '']

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref}>
          <span className="date-text">{start}</span>
          <span className="separator" style={{ color: 'var(--theme-text-primary)' }}>
            →
          </span>
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

  const filteredStats = data?.stats.filter((row) => {
    if (selectedBranch.includes('all')) return true
    return selectedBranch.includes(row.branchName)
  })

  // Recalculate totals based on filteredStats
  const filteredTotals = React.useMemo(() => {
    if (!data)
      return {
        systemSales: 0,
        totalBills: 0,
        manualSales: 0,
        onlineSales: 0,
        totalSales: 0,
        expenses: 0,
        cash: 0,
        upi: 0,
        card: 0,
      }

    if (selectedBranch.includes('all')) return data.totals

    return (filteredStats || []).reduce(
      (acc, row) => ({
        systemSales: acc.systemSales + row.systemSales,
        totalBills: acc.totalBills + row.totalBills,
        manualSales: acc.manualSales + row.manualSales,
        onlineSales: acc.onlineSales + row.onlineSales,
        totalSales: acc.totalSales + row.totalSales,
        expenses: acc.expenses + row.expenses,
        cash: acc.cash + row.cash,
        upi: acc.upi + row.upi,
        card: acc.card + row.card,
      }),
      {
        systemSales: 0,
        totalBills: 0,
        manualSales: 0,
        onlineSales: 0,
        totalSales: 0,
        expenses: 0,
        cash: 0,
        upi: 0,
        card: 0,
      },
    )
  }, [data, filteredStats, selectedBranch])

  const handleExportExcel = () => {
    if (!data || !filteredStats) return
    const csvRows = []
    // Header
    const headers = [
      'S.No',
      'Branch Name',
      'System Bills',
      'Total Bills',
      'Manual Bills',
      'Online Bills',
      'Total Bills',
      'Expenses',
      'Cash',
      'UPI',
      'Card',
      'Total Sales',
      'Sales Dif',
    ]
    csvRows.push(headers.join(','))

    // Rows
    filteredStats.forEach((row, index) => {
      const calculatedTotal = row.expenses + row.cash + row.upi + row.card
      csvRows.push(
        [
          index + 1,
          `"${row.branchName}"`,
          formatValue(row.systemSales),
          row.totalBills,
          formatValue(row.manualSales),
          formatValue(row.onlineSales),
          formatValue(row.totalSales),
          formatValue(row.expenses),
          formatValue(row.cash),
          formatValue(row.upi),
          formatValue(row.card),
          formatValue(calculatedTotal),
          formatValue(calculatedTotal - row.totalSales),
        ].join(','),
      )
    })

    // Total Row
    csvRows.push(
      [
        '',
        'TOTAL',
        formatValue(filteredTotals.systemSales),
        filteredTotals.totalBills,
        formatValue(filteredTotals.manualSales),
        formatValue(filteredTotals.onlineSales),
        formatValue(filteredTotals.totalSales),
        formatValue(filteredTotals.expenses),
        formatValue(filteredTotals.cash),
        formatValue(filteredTotals.upi),
        formatValue(filteredTotals.card),
        formatValue(
          filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card,
        ),
      ].join(','),
    )

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `closing_entry_report_${startDate ? toLocalDateStr(startDate) : ''}_${endDate ? toLocalDateStr(endDate) : ''}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper for zero highlighting
  const getStyle = (_val: number) => ({
    textAlign: 'center' as const,
    fontWeight: '600' as const,
    fontSize: '1.2rem' as const,
    verticalAlign: 'middle' as const, // Ensure vertical centering
    padding: '0.85rem 1rem', // Match SCSS padding
    backgroundColor: 'inherit',
    color: 'inherit',
  })

  // Specific style for System Sales to handle stacked content
  const getSystemSalesStyle = (_val: number) => ({
    ...getStyle(_val),
    // Removed display: flex to allow table-cell behavior (full height background)
    // Content will handle its own alignment via text-align: right
  })

  const dateRangeOptions = [
    { value: 'till_now', label: 'Till Now' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'last_quarter', label: 'Last Quarter' },
  ]

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.name, label: b.name })),
  ]

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
      borderRadius: '8px',
      height: '42px', // Match fixed height of datepicker
      minHeight: '42px',
      boxShadow: 'none',
      '&:hover': {
        borderColor: 'var(--theme-info-500)',
      },
      width: '180px', // Uniform width for dropdowns
    }),
    singleValue: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary, #fff)',
    }),
    placeholder: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-secondary, #888)',
    }),
    menu: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: 'var(--theme-elevation-100)',
      border: '1px solid var(--theme-elevation-300)',
      zIndex: 9999,
    }),
    option: (
      base: Record<string, unknown>,
      state: { isFocused: boolean; isSelected: boolean },
    ) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--theme-info-500)'
        : state.isFocused
          ? 'var(--theme-elevation-200)'
          : 'transparent',
      color: 'var(--theme-text-primary, #fff)',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: 'var(--theme-info-600)',
      },
    }),
    input: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary, #fff)',
    }),
    multiValue: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: 'var(--theme-elevation-200)',
      borderRadius: '4px',
    }),
    multiValueLabel: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary, #fff)',
    }),
    multiValueRemove: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary, #fff)',
      ':hover': {
        backgroundColor: 'var(--theme-error-500)',
        color: 'white',
      },
    }),
  }

  // Custom Option component with checkbox
  const CheckboxOption = (props: any) => {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          cursor: 'pointer',
          backgroundColor: props.isFocused ? 'var(--theme-elevation-200)' : 'transparent',
          color: 'var(--theme-text-primary)',
        }}
        onClick={() => props.selectOption(props.data)}
      >
        <input
          type="checkbox"
          checked={props.isSelected}
          onChange={() => null}
          style={{
            marginRight: '10px',
            accentColor: 'var(--theme-info-500)',
            cursor: 'pointer',
          }}
        />
        <label style={{ cursor: 'pointer', flex: 1 }}>{props.label}</label>
      </div>
    )
  }

  // Custom Value Container to show "X Selected"
  const CustomValueContainer = (props: any) => {
    const selectedCount = props.getValue().length
    const allSelected = props.getValue().some((v: any) => v.value === 'all')
    const { children, ...rest } = props

    // We still want to render the input for search functionality
    const input = React.Children.toArray(children).find(
      (child: any) => child.key && child.key.includes('input'),
    )

    return (
      <div
        {...rest.innerProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          color: 'var(--theme-text-primary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {allSelected ? (
          'All Branches'
        ) : selectedCount > 0 ? (
          `${selectedCount} Selected`
        ) : (
          <span style={{ color: 'var(--theme-text-secondary, #888)' }}>Select Branch...</span>
        )}
        <div style={{ margin: 0, padding: 0, visibility: 'visible', width: 0, height: 0 }}>
          {input}
        </div>
      </div>
    )
  }

  return (
    <div className="branch-report-container">
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Closing Entry Report</h1>
        </div>
        <div className="date-filter">
          <div className="filter-group">
            <Select
              instanceId="date-preset-select"
              options={dateRangeOptions}
              value={dateRangeOptions.find((o) => o.value === dateRangePreset)}
              onChange={(option: { value: string; label: string } | null) => {
                if (option) handleDatePresetChange(option.value)
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
              onChange={(update) => {
                setDateRange(update)
              }}
              monthsShown={1}
              dateFormat="yyyy-MM-dd"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
            />
          </div>

          <div className="filter-group">
            <Select
              options={branchOptions}
              isMulti
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
              }}
            />
          </div>

          <div className="filter-group">
            <button className="export-btn" onClick={handleExportExcel} title="Export to Excel">
              Export Excel
              <span className="icon">↓</span>
            </button>
          </div>

          <div className="filter-group">
            <button
              onClick={() => {
                setDateRangePreset('today')
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                setDateRange([today, today])
                setSelectedBranch(['all'])
              }}
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

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>BRANCH NAME</th>
                <th style={{ textAlign: 'center' }}>SYSTEM BILLS</th>
                <th style={{ textAlign: 'center' }}>MANUAL BILLS</th>
                <th style={{ textAlign: 'center' }}>ONLINE BILLS</th>
                <th style={{ textAlign: 'center' }}>TOTAL BILLS</th>
                <th style={{ textAlign: 'center' }}>EXPENSES</th>
                <th style={{ textAlign: 'center' }}>CASH</th>
                <th style={{ textAlign: 'center' }}>UPI</th>
                <th style={{ textAlign: 'center' }}>CARD</th>
                <th style={{ textAlign: 'center' }}>TOTAL SALES</th>
                <th style={{ textAlign: 'center' }}>SALES DIF</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats?.map((row, index) => {
                const calculatedTotal = row.expenses + row.cash + row.upi + row.card

                const today = new Date()
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)

                const sStr = startDate ? toLocalDateStr(startDate) : ''
                const eStr = endDate ? toLocalDateStr(endDate) : ''
                const tStr = toLocalDateStr(today)
                const yStr = toLocalDateStr(yesterday)

                const showTime =
                  (sStr === tStr && eStr === tStr) || (sStr === yStr && eStr === yStr)
                return (
                  <React.Fragment key={row.branchName}>
                    <tr
                      key={row.branchName}
                      onClick={() =>
                        setExpandedBranch(expandedBranch === row.branchName ? null : row.branchName)
                      }
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{index + 1}</td>
                      <td className="branch-name-cell">
                        <div>{row.branchName.toUpperCase()}</div>
                        {showTime && (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: '#888',
                              marginTop: '4px',
                              display: 'flex',
                              whiteSpace: 'nowrap',
                              alignItems: 'center',
                            }}
                          >
                            <span>
                              {row.closingNumbers
                                ?.map((num) => {
                                  const parts = num.split('-')
                                  if (parts.length >= 4) {
                                    return `${parts[0]}-${parts[parts.length - 1]}`
                                  }
                                  return num
                                })
                                .join(', ')}
                            </span>
                            {row.lastUpdated && (
                              <span style={{ marginLeft: '8px' }}>
                                {new Date(row.lastUpdated).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={getSystemSalesStyle(row.systemSales)}>
                        <div>{formatValue(row.systemSales)}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                          {row.totalBills} Bills
                        </div>
                      </td>
                      <td style={getStyle(row.manualSales)}>{formatValue(row.manualSales)}</td>
                      <td style={getStyle(row.onlineSales)}>{formatValue(row.onlineSales)}</td>
                      <td style={getStyle(row.totalSales)}>{formatValue(row.totalSales)}</td>
                      <td
                        style={{ ...getStyle(row.expenses), cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpensePopupData({
                            title: `Expenses - ${row.branchName}`,
                            details: row.expenseDetails || [],
                          })
                        }}
                      >
                        {formatValue(row.expenses)}
                      </td>
                      <td
                        style={{ ...getStyle(row.cash), cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCashPopupData({
                            title: `Cash Denominations - ${row.branchName}`,
                            denominations: {
                              count2000: row.count2000 || 0,
                              count500: row.count500 || 0,
                              count200: row.count200 || 0,
                              count100: row.count100 || 0,
                              count50: row.count50 || 0,
                              count10: row.count10 || 0,
                              count5: row.count5 || 0,
                            },
                          })
                        }}
                      >
                        {formatValue(row.cash)}
                      </td>
                      <td style={getStyle(row.upi)}>{formatValue(row.upi)}</td>
                      <td style={getStyle(row.card)}>{formatValue(row.card)}</td>
                      <td
                        style={{
                          ...getStyle(calculatedTotal),
                          fontWeight:
                            calculatedTotal > row.totalSales || calculatedTotal < row.totalSales
                              ? 'bold'
                              : 'normal',
                          backgroundColor:
                            calculatedTotal > row.totalSales
                              ? '#53161D'
                              : calculatedTotal < row.totalSales
                                ? '#960018'
                                : 'inherit',
                          color:
                            calculatedTotal > row.totalSales
                              ? '#F5EBD0'
                              : calculatedTotal < row.totalSales
                                ? 'white'
                                : 'inherit',
                        }}
                      >
                        {formatValue(calculatedTotal)}
                      </td>
                      <td
                        style={{
                          ...getStyle(calculatedTotal - row.totalSales),
                          backgroundColor:
                            calculatedTotal - row.totalSales < 0 ? '#960018' : 'inherit',
                          color: calculatedTotal - row.totalSales < 0 ? 'white' : 'inherit',
                        }}
                      >
                        {formatValue(calculatedTotal - row.totalSales)}
                      </td>
                    </tr>
                    {expandedBranch === row.branchName &&
                      row.entries?.map((entry, i) => {
                        const entryTotal =
                          (entry.expenses || 0) +
                          (entry.cash || 0) +
                          (entry.upi || 0) +
                          (entry.card || 0)
                        const parts = entry.closingNumber.split('-')
                        const displayNo =
                          parts.length >= 4
                            ? `${parts[0]}-${parts[parts.length - 1]}`
                            : entry.closingNumber

                        return (
                          <tr
                            key={`${row.branchName}-entry-${i}`}
                            style={{
                              backgroundColor: '#FBF8EF',
                              color: 'black',
                            }}
                          >
                            <td></td>
                            <td className="branch-name-cell">
                              <div
                                style={{
                                  fontSize: '1rem',
                                  color: 'black',
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span>{displayNo}</span>
                                <span
                                  style={{
                                    marginLeft: '8px',
                                    fontSize: '0.9rem', // Slightly increased relative to parent
                                    opacity: 0.9,
                                    color: 'black',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {new Date(entry.createdAt).toLocaleString([], {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.systemSales),
                                fontWeight: 'bold',
                                color: entry.systemSales < 0 ? '#960018' : 'black',
                              }}
                            >
                              {formatValue(entry.systemSales)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.manualSales),
                                fontWeight: 'bold',
                                color: entry.manualSales < 0 ? '#960018' : 'black',
                              }}
                            >
                              {formatValue(entry.manualSales)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.onlineSales),
                                fontWeight: 'bold',
                                color: entry.onlineSales < 0 ? '#960018' : 'black',
                              }}
                            >
                              {formatValue(entry.onlineSales)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.totalSales),
                                fontWeight: 'bold',
                                color: entry.totalSales < 0 ? '#960018' : 'black',
                              }}
                            >
                              {formatValue(entry.totalSales)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.expenses),
                                fontWeight: 'bold',
                                color: entry.expenses < 0 ? '#960018' : 'black',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpensePopupData({
                                  title: `Expenses - ${displayNo}`,
                                  details: entry.expenseDetails || [],
                                })
                              }}
                            >
                              {formatValue(entry.expenses)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.cash),
                                fontWeight: 'bold',
                                color: entry.cash < 0 ? '#960018' : 'black',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setCashPopupData({
                                  title: `Cash Denominations - ${displayNo}`,
                                  denominations: entry.denominations || {
                                    count2000: 0,
                                    count500: 0,
                                    count200: 0,
                                    count100: 0,
                                    count50: 0,
                                    count10: 0,
                                    count5: 0,
                                  },
                                })
                              }}
                            >
                              {formatValue(entry.cash)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.upi),
                                fontWeight: 'bold',
                                color: entry.upi < 0 ? '#960018' : 'black',
                              }}
                            >
                              {formatValue(entry.upi)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.card),
                                fontWeight: 'bold',
                                color: entry.card < 0 ? '#960018' : 'black',
                              }}
                            >
                              {formatValue(entry.card)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entryTotal),
                                fontWeight: 'bold',
                                backgroundColor: '#FBF8EF',
                                color:
                                  entryTotal > entry.totalSales
                                    ? '#53161D'
                                    : entryTotal < entry.totalSales
                                      ? '#960018'
                                      : 'black',
                              }}
                            >
                              {formatValue(entryTotal)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entryTotal - entry.totalSales),
                                fontWeight: 'bold',
                                backgroundColor: '#FBF8EF',
                                color: entryTotal - entry.totalSales < 0 ? '#960018' : 'black',
                              }}
                            >
                              {formatValue(entryTotal - entry.totalSales)}
                            </td>
                          </tr>
                        )
                      })}
                  </React.Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="grand-total">
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td style={getSystemSalesStyle(filteredTotals.systemSales)}>
                  <div>{formatValue(filteredTotals.systemSales)}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    {filteredTotals.totalBills} Bills
                  </div>
                </td>
                <td style={getStyle(filteredTotals.manualSales)}>
                  {formatValue(filteredTotals.manualSales)}
                </td>
                <td style={getStyle(filteredTotals.onlineSales)}>
                  {formatValue(filteredTotals.onlineSales)}
                </td>
                <td style={getStyle(filteredTotals.totalSales)}>
                  {formatValue(filteredTotals.totalSales)}
                </td>
                <td style={getStyle(filteredTotals.expenses)}>
                  {formatValue(filteredTotals.expenses)}
                </td>
                <td style={getStyle(filteredTotals.cash)}>{formatValue(filteredTotals.cash)}</td>
                <td style={getStyle(filteredTotals.upi)}>{formatValue(filteredTotals.upi)}</td>
                <td style={getStyle(filteredTotals.card)}>{formatValue(filteredTotals.card)}</td>
                <td
                  style={{
                    ...getStyle(
                      filteredTotals.expenses +
                        filteredTotals.cash +
                        filteredTotals.upi +
                        filteredTotals.card,
                    ),
                    fontWeight:
                      filteredTotals.expenses +
                        filteredTotals.cash +
                        filteredTotals.upi +
                        filteredTotals.card >
                        filteredTotals.totalSales ||
                      filteredTotals.expenses +
                        filteredTotals.cash +
                        filteredTotals.upi +
                        filteredTotals.card <
                        filteredTotals.totalSales
                        ? 'bold'
                        : 'normal',
                    backgroundColor:
                      filteredTotals.expenses +
                        filteredTotals.cash +
                        filteredTotals.upi +
                        filteredTotals.card >
                      filteredTotals.totalSales
                        ? '#53161D'
                        : filteredTotals.expenses +
                              filteredTotals.cash +
                              filteredTotals.upi +
                              filteredTotals.card <
                            filteredTotals.totalSales
                          ? '#960018'
                          : 'inherit',
                    color:
                      filteredTotals.expenses +
                        filteredTotals.cash +
                        filteredTotals.upi +
                        filteredTotals.card >
                      filteredTotals.totalSales
                        ? '#F5EBD0'
                        : filteredTotals.expenses +
                              filteredTotals.cash +
                              filteredTotals.upi +
                              filteredTotals.card <
                            filteredTotals.totalSales
                          ? 'white'
                          : 'inherit',
                  }}
                >
                  {formatValue(
                    filteredTotals.expenses +
                      filteredTotals.cash +
                      filteredTotals.upi +
                      filteredTotals.card,
                  )}
                </td>
                <td
                  style={{
                    ...getStyle(
                      filteredTotals.expenses +
                        filteredTotals.cash +
                        filteredTotals.upi +
                        filteredTotals.card -
                        filteredTotals.totalSales,
                    ),
                    backgroundColor:
                      filteredTotals.expenses +
                        filteredTotals.cash +
                        filteredTotals.upi +
                        filteredTotals.card -
                        filteredTotals.totalSales <
                      0
                        ? '#960018'
                        : 'inherit',
                    color:
                      filteredTotals.expenses +
                        filteredTotals.cash +
                        filteredTotals.upi +
                        filteredTotals.card -
                        filteredTotals.totalSales <
                      0
                        ? 'white'
                        : 'inherit',
                  }}
                >
                  {formatValue(
                    filteredTotals.expenses +
                      filteredTotals.cash +
                      filteredTotals.upi +
                      filteredTotals.card -
                      filteredTotals.totalSales,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {expensePopupData && (
        <div
          className="expense-popup-overlay"
          onClick={() => setExpensePopupData(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            className="expense-popup-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--theme-elevation-50)',
              padding: '24px',
              borderRadius: '12px',
              minWidth: '400px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--theme-elevation-200)',
                paddingBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0 }}>{expensePopupData.title}</h3>
              <button
                onClick={() => setExpensePopupData(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                marginBottom: '16px',
                fontSize: '1.1rem',
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg
                width="18"
                height="18"
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
              <span>
                {startDate ? startDate.toLocaleDateString() : ''} -{' '}
                {endDate ? endDate.toLocaleDateString() : ''}
              </span>
            </div>
            <div
              style={{
                maxHeight: '60vh',
                overflowY: 'auto',
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: '8px',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--theme-elevation-100)',
                    zIndex: 1,
                  }}
                >
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-200)',
                      }}
                    >
                      Category
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-200)',
                      }}
                    >
                      Reason
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-200)',
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        textAlign: 'center',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-200)',
                        width: '60px',
                      }}
                    >
                      IMG
                    </th>
                    <th style={{ textAlign: 'center', padding: '12px', width: '80px' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {expensePopupData.details.length > 0 ? (
                    expensePopupData.details.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--theme-elevation-250)' }}>
                        <td
                          style={{
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          {d.category}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          {d.reason}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          ₹{formatValue(d.amount)}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          {d.imageUrl ? (
                            <a
                              href={d.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#3b82f6',
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                              title="View Proof"
                            >
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
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                              </svg>
                            </a>
                          ) : (
                            <div
                              style={{
                                color: 'var(--theme-elevation-400)',
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                              title="No Proof"
                            >
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
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                              </svg>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px' }}>
                          {new Date(d.date).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}
                      >
                        No detailed expenses recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
                {expensePopupData.details.length > 0 && (
                  <tfoot
                    style={{
                      position: 'sticky',
                      bottom: 0,
                      backgroundColor: 'var(--theme-elevation-100)',
                      zIndex: 1,
                    }}
                  >
                    <tr style={{ fontWeight: 'bold' }}>
                      <td
                        colSpan={2}
                        style={{
                          padding: '12px',
                          borderRight: '1px solid var(--theme-elevation-250)',
                          borderTop: '1px solid var(--theme-elevation-250)',
                        }}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--theme-elevation-250)',
                          borderTop: '1px solid var(--theme-elevation-250)',
                        }}
                      >
                        ₹{formatValue(expensePopupData.details.reduce((s, d) => s + d.amount, 0))}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          borderTop: '1px solid var(--theme-elevation-250)',
                          borderRight: '1px solid var(--theme-elevation-250)',
                        }}
                      ></td>
                      <td
                        style={{
                          padding: '12px',
                          borderTop: '1px solid var(--theme-elevation-250)',
                        }}
                      ></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {cashPopupData && (
        <div
          className="modal-overlay"
          onClick={() => setCashPopupData(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--theme-elevation-100)',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              color: 'var(--theme-elevation-800)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ margin: 0 }}>{cashPopupData.title}</h3>
              <button
                onClick={() => setCashPopupData(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                marginBottom: '16px',
                fontSize: '1.1rem',
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg
                width="18"
                height="18"
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
              <span>
                {startDate ? startDate.toLocaleDateString() : ''} -{' '}
                {endDate ? endDate.toLocaleDateString() : ''}
              </span>
            </div>
            <div
              style={{
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead
                  style={{
                    backgroundColor: 'var(--theme-elevation-100)',
                    borderBottom: '1px solid var(--theme-elevation-250)',
                  }}
                >
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-250)',
                      }}
                    >
                      Denomination
                    </th>
                    <th
                      style={{
                        textAlign: 'center',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-250)',
                      }}
                    >
                      Count
                    </th>
                    <th style={{ textAlign: 'right', padding: '12px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[2000, 500, 200, 100, 50, 10, 5].map((val) => {
                    const count = (cashPopupData.denominations as any)[`count${val}`] || 0
                    if (count === 0) return null
                    return (
                      <tr
                        key={val}
                        style={{ borderBottom: '1px solid var(--theme-elevation-250)' }}
                      >
                        <td
                          style={{
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          ₹{val}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-200)',
                          }}
                        >
                          {count}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px', fontWeight: 'bold' }}>
                          ₹{formatValue(val * count)}
                        </td>
                      </tr>
                    )
                  })}
                  {!Object.values(cashPopupData.denominations).some((v) => v > 0) && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}
                      >
                        No denominations recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot
                  style={{ backgroundColor: 'var(--theme-elevation-100)', fontWeight: 'bold' }}
                >
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-250)',
                        borderTop: '1px solid var(--theme-elevation-250)',
                      }}
                    >
                      Total Cash
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '12px',
                        borderTop: '1px solid var(--theme-elevation-250)',
                      }}
                    >
                      ₹
                      {formatValue(
                        [2000, 500, 200, 100, 50, 10, 5].reduce(
                          (sum, val) =>
                            sum + val * ((cashPopupData.denominations as any)[`count${val}`] || 0),
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClosingEntryReport
