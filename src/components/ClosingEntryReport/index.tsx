'use client'

import React, { useState, useEffect } from 'react'
import Select, { OptionProps, ValueContainerProps, GroupBase, components } from 'react-select'
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
  systemCash: number
  systemUpi: number
  systemCard: number
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
  id: string
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
  systemCash: number
  systemUpi: number
  systemCard: number
  notes: string
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

type Branch = {
  id: string
  name: string
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: Omit<ReportStats, 'branchName' | 'sNo' | 'entries' | 'closingNumbers' | 'lastUpdated'>
}

type ClosingEntryReportQueryResponse = {
  data?: {
    closingEntryReport?: ReportData
  }
  errors?: {
    message?: string
  }[]
}

interface BranchOption {
  value: string
  label: string
}

const CLOSING_ENTRY_REPORT_QUERY = `
  query ClosingEntryReport($filter: ClosingEntryReportFilterInput) {
    closingEntryReport(filter: $filter) {
      startDate
      endDate
      stats {
        _id
        branchName
        totalEntries
        closingNumbers
        lastUpdated
        sNo
        systemSales
        totalBills
        manualSales
        onlineSales
        totalSales
        expenses
        returnTotal
        stockOrders
        net
        cash
        upi
        card
        systemCash
        systemUpi
        systemCard
        count2000
        count500
        count200
        count100
        count50
        count10
        count5
        expenseDetails {
          category
          reason
          amount
          imageUrl
          date
        }
        entries {
          id
          closingNumber
          createdAt
          systemSales
          totalBills
          manualSales
          onlineSales
          totalSales
          expenses
          cash
          upi
          card
          systemCash
          systemUpi
          systemCard
          notes
          denominations {
            count2000
            count500
            count200
            count100
            count50
            count10
            count5
          }
          expenseDetails {
            category
            reason
            amount
            imageUrl
            date
          }
        }
      }
      totals {
        totalEntries
        systemSales
        totalBills
        manualSales
        onlineSales
        totalSales
        expenses
        returnTotal
        stockOrders
        net
        cash
        upi
        card
        systemCash
        systemUpi
        systemCard
      }
    }
  }
`

const ClosingEntryReport: React.FC = () => {
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'combined' | 'detailed'>('combined')

  const [branches, setBranches] = useState<Branch[]>([])
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

  const [notesPopupData, setNotesPopupData] = useState<{
    title: string
    entries: { id: string; closingNumber: string; notes: string; createdAt: string }[]
  } | null>(null)
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchesRes, closingRes] = await Promise.all([
          fetch('/api/reports/branches'),
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
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: CLOSING_ENTRY_REPORT_QUERY,
          variables: {
            filter: {
              startDate: startStr,
              endDate: endStr,
              branch: 'all',
            },
          },
        }),
      })
      if (!res.ok) throw new Error(`Failed to fetch report (HTTP ${res.status})`)

      const json = (await res.json()) as ClosingEntryReportQueryResponse
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || 'Failed to fetch report')
      }

      const report = json.data?.closingEntryReport
      if (!report) throw new Error('No report data returned from GraphQL')

      setData(report)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error loading report data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNote = async (entryId: string, notesText: string) => {
    setSavingNotesId(entryId)
    try {
      const res = await fetch(`/api/closing-entries/${entryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: notesText,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to save note (HTTP ${res.status})`)
      }

      // Update local state reactively
      setData((prevData) => {
        if (!prevData) return null
        const updatedStats = prevData.stats.map((stat) => {
          const updatedEntries = stat.entries.map((entry) => {
            if (entry.id === entryId) {
              return { ...entry, notes: notesText }
            }
            return entry
          })
          return { ...stat, entries: updatedEntries }
        })
        return { ...prevData, stats: updatedStats }
      })

      // Update the notesPopupData state so the popup text updates
      setNotesPopupData((prevPopup) => {
        if (!prevPopup) return null
        const updatedEntries = prevPopup.entries.map((entry) => {
          if (entry.id === entryId) {
            return { ...entry, notes: notesText }
          }
          return entry
        })
        return { ...prevPopup, entries: updatedEntries }
      })
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Error saving note')
    } finally {
      setSavingNotesId(null)
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

  const filteredStats = React.useMemo(
    () =>
      (data?.stats || []).filter((row) => {
        if (selectedBranch.includes('all')) return true
        return selectedBranch.includes(row.branchName)
      }),
    [data?.stats, selectedBranch],
  )

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
        systemCash: 0,
        systemUpi: 0,
        systemCard: 0,
      }

    if (selectedBranch.includes('all')) {
      return {
        ...data.totals,
        systemCash: data.totals.systemCash || 0,
        systemUpi: data.totals.systemUpi || 0,
        systemCard: data.totals.systemCard || 0,
      }
    }

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
        systemCash: acc.systemCash + (row.systemCash || 0),
        systemUpi: acc.systemUpi + (row.systemUpi || 0),
        systemCard: acc.systemCard + (row.systemCard || 0),
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
        systemCash: 0,
        systemUpi: 0,
        systemCard: 0,
      },
    )
  }, [data, filteredStats, selectedBranch])

  const displayStats = React.useMemo<ReportStats[]>(() => {
    return filteredStats || []
  }, [filteredStats])

  const handleExportExcel = () => {
    if (!data || filteredStats.length === 0) return
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

  // Specific style for System Sales to handle stacked content

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

  const CheckboxOption = (props: OptionProps<BranchOption, true, GroupBase<BranchOption>>) => {
    return (
      <components.Option {...props}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'var(--theme-text-primary)',
          }}
        >
          <input
            type="checkbox"
            checked={props.isSelected}
            readOnly
            style={{
              marginRight: '10px',
              accentColor: 'var(--theme-info-500)',
              cursor: 'pointer',
            }}
          />
          <label style={{ cursor: 'pointer', flex: 1 }}>{props.label}</label>
        </div>
      </components.Option>
    )
  }

  const CustomValueContainer = (
    props: ValueContainerProps<BranchOption, true, GroupBase<BranchOption>>,
  ) => {
    const selected = props.getValue()
    const selectedCount = Array.isArray(selected) ? selected.length : selected ? 1 : 0
    const allSelected = Array.isArray(selected) && selected.some((v) => v?.value === 'all')
    const { children, ...rest } = props

    const input = React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && child.key && String(child.key).includes('input'),
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
          {/* View Mode Toggle */}
          <button
            className="view-mode-toggle"
            onClick={() => setViewMode(viewMode === 'combined' ? 'detailed' : 'combined')}
            title={viewMode === 'combined' ? 'Switch to Detailed Table View' : 'Switch to Combined Table View'}
            style={{
              background: 'none',
              border: '1px solid var(--theme-elevation-300)',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: 'var(--theme-text-primary, var(--theme-text))',
              marginRight: '1rem',
              height: '42px',
            }}
          >
            {viewMode === 'combined' ? (
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
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            ) : (
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
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            )}
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              {viewMode === 'combined' ? 'Combined Table' : 'Detailed Table'}
            </span>
          </button>

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
            <Select<BranchOption, true, GroupBase<BranchOption>>
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
              closeMenuOnSelect={true}
              blurInputOnSelect={true}
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
                setViewMode('combined')
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
        <>
          {viewMode === 'combined' ? (
            <div className="table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }} className="center-cell">S.NO</th>
                    <th>BRANCH NAME</th>
                    <th className="center-cell" style={{ textAlign: 'center', width: '60px' }}>NOTES</th>
                    <th className="text-right">SYSTEM BILLS</th>
                    <th className="text-right">MANUAL BILLS</th>
                    <th className="text-right">ONLINE BILLS</th>
                    <th className="text-right">TOTAL SALES</th>
                    <th className="text-right">SALES DIF</th>
                    <th className="text-right">EXPENSES</th>
                    <th className="text-right">CASH</th>
                    <th className="text-right">UPI</th>
                    <th className="text-right">CARD</th>
                    <th className="text-right">TOTAL COLLECTION</th>
                    <th className="text-right">NET AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStats.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="center-cell" style={{ padding: '24px', opacity: 0.6 }}>
                        No closing entries found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    displayStats.map((row, index) => {
                      const calculatedTotal = row.expenses + row.cash + row.upi + row.card
                      const salesDiff = calculatedTotal - row.totalSales
                      const hasAnyNegativeEntry = (row.entries || []).some((entry) => {
                        const entryCollectionTotal =
                          (entry.expenses || 0) +
                          (entry.cash || 0) +
                          (entry.upi || 0) +
                          (entry.card || 0)
                        return entryCollectionTotal - (entry.totalSales || 0) < 0
                      })
                      const isNegativeDiffRow = salesDiff < 0 || hasAnyNegativeEntry
                      const isPositiveDiffRow = !isNegativeDiffRow && salesDiff > 0

                      const showClosingIds = ['today', 'yesterday'].includes(dateRangePreset)

                      const closingIds = showClosingIds
                        ? row.closingNumbers?.map((num) => {
                            const parts = num.split('-')
                            if (parts.length >= 4) {
                              return `${parts[0]}-${parts[parts.length - 1]}`
                            }
                            return num
                          }) || []
                        : []
                      const uniqueClosingIds = Array.from(new Set(closingIds))
                      const closingIdStr = uniqueClosingIds.join(', ')

                      const timeStr = row.lastUpdated
                        ? new Date(row.lastUpdated).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : ''

                      const netAmount = salesDiff

                      return (
                        <tr
                          key={row.branchName}
                          className={`${isNegativeDiffRow ? 'negative-diff-row' : ''} ${isPositiveDiffRow ? 'positive-diff-row' : ''}`}
                        >
                          <td className="center-cell">{index + 1}</td>
                          <td
                            className="clickable-branch"
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedBranch([row.branchName])
                              setViewMode('detailed')
                            }}
                            title="Click to view detailed entries"
                          >
                            <div className="branch-title">{row.branchName.toUpperCase()}</div>
                            {(closingIdStr || timeStr) && (
                              <div className="branch-subtext">
                                {closingIdStr && <span>#{closingIdStr} </span>}
                                {timeStr && <span>• {timeStr}</span>}
                              </div>
                            )}
                          </td>
                          <td className="center-cell">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const entriesWithNotes = (row.entries || []).map((entry) => ({
                                  id: entry.id,
                                  closingNumber: entry.closingNumber,
                                  notes: entry.notes || '',
                                  createdAt: entry.createdAt,
                                }))
                                setNotesPopupData({
                                  title: `Notes - ${row.branchName}`,
                                  entries: entriesWithNotes,
                                })
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                color: (row.entries || []).some(entry => entry.notes) ? '#4caf50' : 'var(--theme-text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto',
                              }}
                              title="Click to view/add notes"
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill={(row.entries || []).some(entry => entry.notes) ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                              </svg>
                            </button>
                          </td>
                          <td className="text-right">
                            <div className="bill-amount">₹{formatValue(row.systemSales)}</div>
                            <div className="bill-count">({row.totalBills} Bills)</div>
                          </td>
                          <td className="text-right">₹{formatValue(row.manualSales)}</td>
                          <td className="text-right">₹{formatValue(row.onlineSales)}</td>
                          <td className="text-right bill-amount">₹{formatValue(row.totalSales)}</td>
                          <td className="text-right">
                            <span className={`sales-diff-value ${salesDiff >= 0 ? 'positive' : 'negative'}`}>
                              {salesDiff > 0 ? '↑' : salesDiff < 0 ? '↓' : ''} ₹{formatValue(salesDiff)}
                            </span>
                          </td>
                          <td
                            className="text-right clickable"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpensePopupData({
                                title: `Expenses - ${row.branchName}`,
                                details: row.expenseDetails || [],
                              })
                            }}
                            title="Click to view expenses breakdown"
                          >
                            ₹{formatValue(row.expenses)}
                          </td>
                          <td
                            className="text-right clickable"
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
                            title="Click to view cash denominations"
                          >
                            ₹{formatValue(row.cash)}
                          </td>
                          <td className="text-right">₹{formatValue(row.upi)}</td>
                          <td className="text-right">₹{formatValue(row.card)}</td>
                          <td className="text-right bill-amount">₹{formatValue(calculatedTotal)}</td>
                          <td className="text-right bill-amount">₹{formatValue(netAmount)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td colSpan={2} className="text-left" style={{ fontWeight: 'bold' }}>
                      TOTAL
                    </td>
                    <td></td>
                    <td className="text-right">
                      <div className="bill-amount">₹{formatValue(filteredTotals.systemSales)}</div>
                      <div className="bill-count">({filteredTotals.totalBills} Bills)</div>
                    </td>
                    <td className="text-right">₹{formatValue(filteredTotals.manualSales)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.onlineSales)}</td>
                    <td className="text-right bill-amount">₹{formatValue(filteredTotals.totalSales)}</td>
                    <td className="text-right">
                      {(() => {
                        const diff = filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card - filteredTotals.totalSales
                        return (
                          <span className={`sales-diff-value ${diff >= 0 ? 'positive' : 'negative'}`}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(diff)}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="text-right">₹{formatValue(filteredTotals.expenses)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.cash)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.upi)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.card)}</td>
                    <td className="text-right bill-amount">
                      ₹{formatValue(filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card)}
                    </td>
                    <td className="text-right bill-amount">
                      ₹{formatValue(filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card - filteredTotals.totalSales)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }} className="center-cell">S.NO</th>
                    <th>BRANCH</th>
                    <th className="center-cell" style={{ textAlign: 'center', width: '60px' }}>NOTES</th>
                    <th className="center-cell">CLOSING NO</th>
                    <th>DATE & TIME</th>
                    <th className="text-right">SYSTEM BILLS</th>
                    <th className="text-right">MANUAL BILLS</th>
                    <th className="text-right">ONLINE BILLS</th>
                    <th className="text-right">TOTAL SALES</th>
                    <th className="text-right">SALES DIF</th>
                    <th className="text-right">EXPENSES</th>
                    <th className="text-right">CASH</th>
                    <th className="text-right">UPI</th>
                    <th className="text-right">CARD</th>
                    <th className="text-right">TOTAL COLLECTION</th>
                    <th className="text-right">NET AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let entryIndex = 0
                    const rows: React.ReactNode[] = []

                    filteredStats?.forEach((row) => {
                      if (!row.entries || row.entries.length === 0) return

                      row.entries.forEach((entry, i) => {
                        entryIndex++
                        const entryCollectionTotal =
                          (entry.expenses || 0) + (entry.cash || 0) + (entry.upi || 0) + (entry.card || 0)
                        const salesDiff = entryCollectionTotal - entry.totalSales
                        const isNegativeDiffEntryRow = salesDiff < 0
                        const isPositiveDiffEntryRow = salesDiff > 0

                        const parts = entry.closingNumber.split('-')
                        const displayNo =
                          parts.length >= 4
                            ? `${parts[0]}-${parts[parts.length - 1]}`
                            : entry.closingNumber

                        const entryDate = new Date(entry.createdAt)

                        rows.push(
                          <tr
                            key={`${row.branchName}-entry-${i}`}
                            className={`${isNegativeDiffEntryRow ? 'negative-diff-row' : ''} ${isPositiveDiffEntryRow ? 'positive-diff-row' : ''}`}
                          >
                            <td className="center-cell">{entryIndex}</td>
                            <td>
                              <div className="branch-title">{row.branchName.toUpperCase()}</div>
                            </td>
                            <td className="center-cell">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setNotesPopupData({
                                    title: `Notes - ${row.branchName} (#${displayNo})`,
                                    entries: [{
                                      id: entry.id,
                                      closingNumber: entry.closingNumber,
                                      notes: entry.notes || '',
                                      createdAt: entry.createdAt,
                                    }],
                                  })
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  color: entry.notes ? '#4caf50' : 'var(--theme-text-secondary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto',
                                }}
                                title="Click to view/add notes"
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill={entry.notes ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                              </button>
                            </td>
                            <td className="center-cell">
                              <span className="closing-tag">#{displayNo}</span>
                            </td>
                            <td>
                              <div>{entryDate.toLocaleDateString()}</div>
                              <div className="bill-count">
                                {entryDate.toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </div>
                            </td>
                            <td className="text-right">₹{formatValue(entry.systemSales)}</td>
                            <td className="text-right">₹{formatValue(entry.manualSales)}</td>
                            <td className="text-right">₹{formatValue(entry.onlineSales)}</td>
                            <td className="text-right bill-amount">₹{formatValue(entry.totalSales)}</td>
                            <td className="text-right">
                              <span className={`sales-diff-value ${salesDiff >= 0 ? 'positive' : 'negative'}`}>
                                {salesDiff > 0 ? '↑' : salesDiff < 0 ? '↓' : ''} ₹{formatValue(salesDiff)}
                              </span>
                            </td>
                            <td
                              className="text-right clickable"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpensePopupData({
                                  title: `Expenses - ${displayNo}`,
                                  details: entry.expenseDetails || [],
                                })
                              }}
                              title="Click to view expenses breakdown"
                            >
                              ₹{formatValue(entry.expenses)}
                            </td>
                            <td
                              className="text-right clickable"
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
                              title="Click to view cash denominations"
                            >
                              ₹{formatValue(entry.cash)}
                            </td>
                            <td className="text-right">₹{formatValue(entry.upi)}</td>
                            <td className="text-right">₹{formatValue(entry.card)}</td>
                            <td className="text-right bill-amount">₹{formatValue(entryCollectionTotal)}</td>
                            <td className="text-right bill-amount">₹{formatValue(salesDiff)}</td>
                          </tr>
                        )
                      })
                    })

                    if (rows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={16} className="center-cell" style={{ padding: '24px', opacity: 0.6 }}>
                            No detailed closing entries found for the selected filters.
                          </td>
                        </tr>
                      )
                    }

                    return rows
                  })()}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td colSpan={5} className="text-left" style={{ fontWeight: 'bold' }}>
                      TOTAL
                    </td>
                    <td className="text-right">₹{formatValue(filteredTotals.systemSales)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.manualSales)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.onlineSales)}</td>
                    <td className="text-right bill-amount">₹{formatValue(filteredTotals.totalSales)}</td>
                    <td className="text-right">
                      {(() => {
                        const diff = filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card - filteredTotals.totalSales
                        return (
                          <span className={`sales-diff-value ${diff >= 0 ? 'positive' : 'negative'}`}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(diff)}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="text-right">₹{formatValue(filteredTotals.expenses)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.cash)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.upi)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.card)}</td>
                    <td className="text-right bill-amount">
                      ₹{formatValue(filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card)}
                    </td>
                    <td className="text-right bill-amount">
                      ₹{formatValue(filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card - filteredTotals.totalSales)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Comparison Table Section */}
          <div className="comparison-section" style={{ marginTop: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, color: 'var(--theme-text-primary)' }}>
                  Payment Method Comparison (System vs Manual)
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--theme-text-secondary)', margin: '4px 0 0 0' }}>
                  Compare system-tracked payments from customer bills against the manual entry provided by the branch staff.
                </p>
              </div>
            </div>

            <div className="table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '50px' }} className="center-cell">S.NO</th>
                    <th rowSpan={2}>BRANCH / CLOSING</th>
                    <th rowSpan={2} className="center-cell" style={{ textAlign: 'center', width: '60px' }}>NOTES</th>
                    <th colSpan={3} className="center-cell text-center" style={{ textAlign: 'center', background: 'rgba(22, 163, 74, 0.05)', color: '#4caf50', borderBottom: '2px solid rgba(22, 163, 74, 0.2)' }}>CASH</th>
                    <th colSpan={3} className="center-cell text-center" style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)', color: '#2196f3', borderBottom: '2px solid rgba(59, 130, 246, 0.2)' }}>UPI</th>
                    <th colSpan={3} className="center-cell text-center" style={{ textAlign: 'center', background: 'rgba(139, 92, 246, 0.05)', color: '#9c27b0', borderBottom: '2px solid rgba(139, 92, 246, 0.2)' }}>CARD</th>
                  </tr>
                  <tr>
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>SYSTEM</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>MANUAL</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>DIFF</th>
                    
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>SYSTEM</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>MANUAL</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>DIFF</th>
                    
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>SYSTEM</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>MANUAL</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>DIFF</th>
                  </tr>
                </thead>
                <tbody>
                  {viewMode === 'combined' ? (
                    displayStats.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="center-cell" style={{ padding: '24px', opacity: 0.6, textAlign: 'center' }}>
                          No branch comparison data available.
                        </td>
                      </tr>
                    ) : (
                      displayStats.map((row, index) => {
                        const cashDiff = row.cash - row.systemCash
                        const upiDiff = row.upi - row.systemUpi
                        const cardDiff = row.card - row.systemCard

                        return (
                          <tr key={row.branchName}>
                            <td className="center-cell">{index + 1}</td>
                            <td>
                              <div className="branch-title">{row.branchName.toUpperCase()}</div>
                            </td>
                            <td className="center-cell">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const entriesWithNotes = (row.entries || []).map((entry) => ({
                                    id: entry.id,
                                    closingNumber: entry.closingNumber,
                                    notes: entry.notes || '',
                                    createdAt: entry.createdAt,
                                  }))
                                  setNotesPopupData({
                                    title: `Notes - ${row.branchName}`,
                                    entries: entriesWithNotes,
                                  })
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  color: (row.entries || []).some(entry => entry.notes) ? '#4caf50' : 'var(--theme-text-secondary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto',
                                }}
                                title="Click to view/add notes"
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill={(row.entries || []).some(entry => entry.notes) ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                              </button>
                            </td>
                            {/* Cash column block */}
                            <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(row.systemCash)}</td>
                            <td className="text-right">₹{formatValue(row.cash)}</td>
                            <td className="text-right" style={{ fontWeight: 'bold' }}>
                              <span className={cashDiff === 0 ? 'text-muted' : cashDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                {cashDiff > 0 ? '↑' : cashDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(cashDiff))}
                              </span>
                            </td>
                            {/* UPI column block */}
                            <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(row.systemUpi)}</td>
                            <td className="text-right">₹{formatValue(row.upi)}</td>
                            <td className="text-right" style={{ fontWeight: 'bold' }}>
                              <span className={upiDiff === 0 ? 'text-muted' : upiDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                {upiDiff > 0 ? '↑' : upiDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(upiDiff))}
                              </span>
                            </td>
                            {/* Card column block */}
                            <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(row.systemCard)}</td>
                            <td className="text-right">₹{formatValue(row.card)}</td>
                            <td className="text-right" style={{ fontWeight: 'bold' }}>
                              <span className={cardDiff === 0 ? 'text-muted' : cardDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                {cardDiff > 0 ? '↑' : cardDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(cardDiff))}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )
                  ) : (
                    (() => {
                      let entryIndex = 0
                      const rows: React.ReactNode[] = []

                      filteredStats?.forEach((row) => {
                        if (!row.entries || row.entries.length === 0) return

                        row.entries.forEach((entry, i) => {
                          entryIndex++
                          const cashDiff = entry.cash - entry.systemCash
                          const upiDiff = entry.upi - entry.systemUpi
                          const cardDiff = entry.card - entry.systemCard

                          const parts = entry.closingNumber.split('-')
                          const displayNo = parts.length >= 4 ? `${parts[0]}-${parts[parts.length - 1]}` : entry.closingNumber

                          rows.push(
                            <tr key={`${row.branchName}-comp-entry-${i}`}>
                              <td className="center-cell">{entryIndex}</td>
                              <td>
                                <div className="branch-title">{row.branchName.toUpperCase()}</div>
                                <div className="branch-subtext">#{displayNo}</div>
                              </td>
                              <td className="center-cell">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setNotesPopupData({
                                      title: `Notes - ${row.branchName} (#${displayNo})`,
                                      entries: [{
                                        id: entry.id,
                                        closingNumber: entry.closingNumber,
                                        notes: entry.notes || '',
                                        createdAt: entry.createdAt,
                                      }],
                                    })
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    color: entry.notes ? '#4caf50' : 'var(--theme-text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto',
                                  }}
                                  title="Click to view/add notes"
                                >
                                  <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill={entry.notes ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                  </svg>
                                </button>
                              </td>
                              {/* Cash column block */}
                              <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(entry.systemCash)}</td>
                              <td className="text-right">₹{formatValue(entry.cash)}</td>
                              <td className="text-right" style={{ fontWeight: 'bold' }}>
                                <span className={cashDiff === 0 ? 'text-muted' : cashDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                  {cashDiff > 0 ? '↑' : cashDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(cashDiff))}
                                </span>
                              </td>
                              {/* UPI column block */}
                              <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(entry.systemUpi)}</td>
                              <td className="text-right">₹{formatValue(entry.upi)}</td>
                              <td className="text-right" style={{ fontWeight: 'bold' }}>
                                <span className={upiDiff === 0 ? 'text-muted' : upiDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                  {upiDiff > 0 ? '↑' : upiDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(upiDiff))}
                                </span>
                              </td>
                              {/* Card column block */}
                              <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(entry.systemCard)}</td>
                              <td className="text-right">₹{formatValue(entry.card)}</td>
                              <td className="text-right" style={{ fontWeight: 'bold' }}>
                                <span className={cardDiff === 0 ? 'text-muted' : cardDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                  {cardDiff > 0 ? '↑' : cardDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(cardDiff))}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      })

                      if (rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={12} className="center-cell" style={{ padding: '24px', opacity: 0.6, textAlign: 'center' }}>
                              No detailed comparison data available.
                            </td>
                          </tr>
                        )
                      }
                      return rows
                    })()
                  )}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td colSpan={2} className="text-left" style={{ fontWeight: 'bold' }}>TOTAL</td>
                    <td></td>
                    {/* Cash totals */}
                    <td className="text-right">₹{formatValue(filteredTotals.systemCash)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.cash)}</td>
                    <td className="text-right" style={{ fontWeight: 'bold' }}>
                      {(() => {
                        const diff = filteredTotals.cash - filteredTotals.systemCash
                        return (
                          <span className={diff === 0 ? '' : diff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(diff))}
                          </span>
                        )
                      })()}
                    </td>
                    {/* UPI totals */}
                    <td className="text-right">₹{formatValue(filteredTotals.systemUpi)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.upi)}</td>
                    <td className="text-right" style={{ fontWeight: 'bold' }}>
                      {(() => {
                        const diff = filteredTotals.upi - filteredTotals.systemUpi
                        return (
                          <span className={diff === 0 ? '' : diff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(diff))}
                          </span>
                        )
                      })()}
                    </td>
                    {/* Card totals */}
                    <td className="text-right">₹{formatValue(filteredTotals.systemCard)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.card)}</td>
                    <td className="text-right" style={{ fontWeight: 'bold' }}>
                      {(() => {
                        const diff = filteredTotals.card - filteredTotals.systemCard
                        return (
                          <span className={diff === 0 ? '' : diff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(diff))}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
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
                    const count =
                      cashPopupData.denominations[`count${val}` as keyof Denominations] || 0

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
                        ([2000, 500, 200, 100, 50, 10, 5] as const).reduce(
                          (sum, val) =>
                            sum +
                            val *
                              (cashPopupData.denominations[`count${val}` as keyof Denominations] ||
                                0),
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

      {notesPopupData && (
        <div
          className="modal-overlay"
          onClick={() => setNotesPopupData(null)}
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
              color: 'var(--theme-text-primary, #fff)',
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
              <h3 style={{ margin: 0 }}>{notesPopupData.title}</h3>
              <button
                onClick={() => setNotesPopupData(null)}
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
                maxHeight: '60vh',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {notesPopupData.entries.map((entry) => {
                const parts = entry.closingNumber.split('-')
                const displayNo = parts.length >= 4 ? `${parts[0]}-${parts[parts.length - 1]}` : entry.closingNumber
                const dateStr = new Date(entry.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <div
                    key={entry.id}
                    style={{
                      marginBottom: '20px',
                      padding: '12px',
                      background: 'var(--theme-elevation-50)',
                      borderRadius: '8px',
                      border: '1px solid var(--theme-elevation-200)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
                      <span style={{ fontWeight: 600 }}>#{displayNo}</span>
                      <span>{dateStr}</span>
                    </div>
                    <textarea
                      defaultValue={entry.notes}
                      placeholder="Write notes about this closing entry here..."
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--theme-elevation-0)',
                        border: '1px solid var(--theme-elevation-250)',
                        color: 'var(--theme-text-primary, #fff)',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        outline: 'none',
                      }}
                      onBlur={(e) => {
                        // Optimistically store updated text locally on blur so we can read it on save
                        entry.notes = e.target.value
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        onClick={() => handleSaveNote(entry.id, entry.notes)}
                        disabled={savingNotesId === entry.id}
                        style={{
                          backgroundColor: '#2e7d32',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {savingNotesId === entry.id ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--theme-elevation-200)', paddingTop: '12px' }}>
              <button
                onClick={() => setNotesPopupData(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--theme-elevation-300)',
                  color: 'var(--theme-text-secondary)',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClosingEntryReport
