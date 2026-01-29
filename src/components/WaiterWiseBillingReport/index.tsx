'use client'

import React, { useState, useEffect, useCallback } from 'react'
import './index.scss'

type ReportStats = {
  waiterId: string
  waiterName: string
  employeeId?: string
  branchNames?: string[] // Updated to array
  branchIds?: string[] // Updated to array
  lastBillTime?: string
  totalBills: number
  totalAmount: number
  cashAmount: number
  upiAmount: number
  cardAmount: number
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: {
    totalBills: number
    totalAmount: number
    cashAmount: number
    upiAmount: number
    cardAmount: number
  }
  activeBranches?: { id: string; name: string }[]
  timeline?: { minHour: number; maxHour: number }
  branchBenchmarks?: { _id: string; totalAmount: number; totalBills: number }[]
}

import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps } from 'react-select'

const CheckboxOption = (props: OptionProps<any>) => {
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

const CustomValueContainer = ({ children, ...props }: any) => {
  const { getValue, hasValue, selectProps } = props
  const selected = getValue()
  const count = selected.length
  const isTyping = selectProps.inputValue && selectProps.inputValue.length > 0

  return (
    <components.ValueContainer {...props}>
      {hasValue && count > 0 && !isTyping && (
        <div style={{ paddingLeft: '8px', position: 'absolute', pointerEvents: 'none' }}>
          {count === 1 ? selected[0].label : `${count} Selected`}
        </div>
      )}
      {children}
    </components.ValueContainer>
  )
}

const MultiValue = () => null

/* Helper to format time (e.g. 2:30 pm) */
const formatTime = (isoString?: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const WaiterWiseBillingReport: React.FC = () => {
  // Combine start and end date into a single range state for the picker
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [waiters, setWaiters] = useState<{ id: string; name: string; employee?: any }[]>([])
  const [selectedWaiter, setSelectedWaiter] = useState<string[]>(['all'])

  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedWaiterStats, setSelectedWaiterStats] = useState<ReportStats | null>(null)

  const formatValue = (val: number) => {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    // Headers
    const headers = [
      'S.NO',
      'WAITER NAME',
      'BRANCH',
      'LAST BILL TIME',
      'TOTAL BILLS',
      'CASH',
      'UPI',
      'CARD',
      'TOTAL AMOUNT',
    ]
    csvRows.push(headers.join(','))

    // Rows
    const rows = data.stats.map((row, index) => {
      const waiterLabel = row.employeeId
        ? `${row.employeeId} - ${row.waiterName?.toUpperCase() || ''}`
        : row.waiterName?.toUpperCase() || ''

      return [
        index + 1,
        `"${waiterLabel}"`,
        `"${row.branchNames?.join(', ').toUpperCase() || ''}"`,
        row.lastBillTime ? formatTime(row.lastBillTime) : '',
        row.totalBills,
        row.cashAmount.toFixed(2),
        row.upiAmount.toFixed(2),
        row.cardAmount.toFixed(2),
        row.totalAmount.toFixed(2),
      ]
    })
    rows.forEach((r) => csvRows.push(r.join(',')))

    // Total Row
    csvRows.push(
      [
        '',
        'TOTAL',
        '',
        '',
        data.totals.totalBills,
        data.totals.cashAmount.toFixed(2),
        data.totals.upiAmount.toFixed(2),
        data.totals.cardAmount.toFixed(2),
        data.totals.totalAmount.toFixed(2),
      ].join(','),
    )

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `waiter_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    a.click()
    setShowExportMenu(false)
  }

  const dateRangeOptions = [
    { value: 'till_now', label: 'Till Now' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_month', label: 'Last Month' },
  ]

  const handleDatePresetChange = (value: string) => {
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
      case 'yesterday':
        const yest = new Date(today)
        yest.setDate(yest.getDate() - 1)
        start = yest
        end = yest
        break
      case 'last_7_days':
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 6)
        start = last7
        break
      case 'this_month':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        start = thisMonthStart
        end = today
        break
      case 'last_30_days':
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        start = last30
        break
      case 'last_month':
        const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        start = prevMonthStart
        end = prevMonthEnd
        break
    }

    if (start && end) {
      setDateRange([start, end])
    }
  }

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const waiterOptions = [
    { value: 'all', label: 'All Waiters' },
    ...waiters.map((w) => {
      // User requested to remove ID from the filter label
      return { value: w.id, label: w.name.toUpperCase() }
    }),
  ]

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
      borderRadius: '8px',
      height: '42px', // Match fixed height of datepicker
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
      fontWeight: '600', // Darker number/text
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
      zIndex: 9999, // Ensure it's above everything
      minWidth: '200px',
    }),
    input: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary)',
      fontWeight: '600', // Darker number/text
    }),
  }

  /* Helper to format date as YYYY-MM-DD using local time to avoid timezone shifts */
  const toLocalDateStr = (d: Date) => {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60 * 1000)
    return local.toISOString().split('T')[0]
  }

  // --- TIMELINE LOGIC ---
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [timelineRange, setTimelineRange] = useState<{ min: number; max: number } | null>(null)

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (!startDate && !endDate) return

      const startStr = startDate ? toLocalDateStr(startDate) : ''
      const endStr = endDate ? toLocalDateStr(endDate) : ''

      // Construct URL with filters
      let url = `/api/reports/waiter-wise?startDate=${startStr}&endDate=${endStr}`
      if (!selectedBranch.includes('all')) {
        url += `&branch=${selectedBranch.join(',')}`
      }
      if (!selectedWaiter.includes('all')) {
        url += `&waiter=${selectedWaiter.join(',')}`
      }
      if (selectedHour !== null) {
        url += `&hour=${selectedHour}`
      }

      const res = await fetch(url)
      const json: ReportData = await res.json()

      if (res.ok) {
        setData(json)

        // Populate options DYNAMICALLY based on the date range.
        // 1. Branches: Use the `activeBranches` returned by the API (which are distinct branches for the date range)
        if (json.activeBranches && Array.isArray(json.activeBranches)) {
          setBranches(json.activeBranches)
        }

        // Timeline: Set range if available (and we are NOT currently filtering by hour,
        // to keep the timeline stable? No, backend calculates it independent of hour filter?
        // Yes, backend timeline calculation uses only branchMatchQuery which is date+branch.)
        if (json.timeline) {
          // Only update range if it's different or NULL.
          // We want the range to represent the *day's* activity.
          setTimelineRange({ min: json.timeline.minHour, max: json.timeline.maxHour })
        }

        // 2. Waiters: Use the stats to find unique waiters who worked.
        // NOTE: If a waiter filter is applied, the response only contains that waiter.
        // To keep the full list available, checking against "all" selection
        if (selectedWaiter.includes('all') && json.stats) {
          const uniqueWaitersMap = new Map()
          json.stats.forEach((row: any) => {
            if (!uniqueWaitersMap.has(row.waiterId)) {
              uniqueWaitersMap.set(row.waiterId, {
                id: row.waiterId,
                name: row.waiterName,
                // User requested to remove ID from filter, so label will be just Name
              })
            }
          })
          setWaiters(Array.from(uniqueWaitersMap.values()))
        }
      }
    } catch (error) {
      console.error('Failed to fetch report:', error)
      setError('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedBranch, selectedWaiter, selectedHour])

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const billRes = await fetch('/api/billings?sort=createdAt&limit=1')
        if (billRes.ok) {
          const json = await billRes.json()
          if (json.docs && json.docs.length > 0) {
            setFirstBillDate(new Date(json.docs[0].createdAt))
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchMetadata()
    fetchReport()
  }, [fetchReport])

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      // split the value "YYYY-MM-DD - YYYY-MM-DD"
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

  // Component for Timeline Block
  const TimelineBlock = ({
    hour,
    isSelected,
    onClick,
  }: {
    hour: number
    isSelected: boolean
    onClick: () => void
  }) => {
    // User requested 24h format
    const label24 = hour.toString()

    return (
      <div
        onClick={onClick}
        style={{
          backgroundColor: isSelected ? '#D1004A' : 'var(--theme-elevation-150)', // Active vs Inactive
          color: isSelected ? 'white' : 'var(--theme-text-primary)',
          padding: '6px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
          minWidth: '40px',
          textAlign: 'center',
          position: 'relative',
          fontSize: '0.9rem',
        }}
      >
        {label24}
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #D1004A',
            }}
          />
        )}
      </div>
    )
  }

  // Generate timeline blocks
  const renderTimeline = () => {
    if (!timelineRange) return null
    const blocks = []
    // Safety cap
    let start = timelineRange.min >= 0 ? timelineRange.min : 6
    let end = timelineRange.max <= 23 ? timelineRange.max : 23

    if (timelineRange.min === undefined || timelineRange.max === undefined) {
      start = 6
      end = 23
    }

    for (let h = start; h <= end; h++) {
      blocks.push(
        <TimelineBlock
          key={h}
          hour={h}
          isSelected={selectedHour === h}
          onClick={() => setSelectedHour((prev) => (prev === h ? null : h))}
        />,
      )
    }
    return (
      <div
        className="timeline-container"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          padding: '10px 0',
          marginBottom: '15px',
        }}
      >
        {blocks}
      </div>
    )
  }

  return (
    <div className="waiter-report-container">
      <div className="report-header">
        <div className="title-row">
          <h1>Waiter Wise Billing Report</h1>
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
            <Select
              instanceId="branch-select"
              options={branchOptions}
              isMulti
              value={branchOptions.filter((o) => selectedBranch.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? (newValue as any).map((x: any) => x.value) : []
                const wasAll = selectedBranch.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x: any) => x !== 'all')
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
            <Select
              instanceId="waiter-select"
              options={waiterOptions}
              isMulti
              value={waiterOptions.filter((o) => selectedWaiter.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? (newValue as any).map((x: any) => x.value) : []
                const wasAll = selectedWaiter.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x: any) => x !== 'all')
                else if (final.length === 0) final = ['all']
                setSelectedWaiter(final)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Waiter..."
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
            <div className="export-container">
              <button
                className="export-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Report"
              >
                <span>Export</span>
                <span className="icon">↓</span>
              </button>
              {showExportMenu && (
                <div className="export-menu">
                  <button onClick={handleExportExcel}>Excel</button>
                </div>
              )}
            </div>
            {/* Backdrop to close menu */}
            {showExportMenu && (
              <div
                className="export-backdrop"
                onClick={() => setShowExportMenu(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 9998,
                  cursor: 'default',
                }}
              />
            )}
          </div>

          <div className="filter-group">
            <button
              onClick={() => {
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                setDateRange([today, today])
                setDateRangePreset('today')
                setSelectedBranch(['all'])
                setSelectedWaiter(['all'])
                setSelectedHour(null)
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

      {/* Timeline Filter */}
      {renderTimeline()}

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="table-container" style={{ width: '55%', margin: '0 0' }}>
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>WAITER NAME</th>
                <th className="text-center">AVG (BILL)</th>
                <th className="text-center">TOTAL BILLS</th>
                <th className="text-center">TOTAL AMOUNT</th>
                <th>BRANCH</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((row, index) => (
                <tr
                  key={row.waiterId || Math.random().toString()}
                  className="clickable-row"
                  onClick={() => setSelectedWaiterStats(row)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{index + 1}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontWeight: 'bold' }}>
                        <span style={{ color: 'var(--theme-text-primary)' }}>
                          {row.waiterName?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </td>
                  {(() => {
                    const waiterAvg = row.totalBills > 0 ? row.totalAmount / row.totalBills : 0
                    return (
                      <td className="text-center">
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 'bold' }}>{formatValue(waiterAvg)}</span>
                        </div>
                      </td>
                    )
                  })()}
                  <td className="text-center">{row.totalBills}</td>
                  <td className="text-center amount-cell">{formatValue(row.totalAmount)}</td>
                  <td>
                    <div
                      style={{
                        color: 'var(--theme-text-secondary)',
                        textTransform: 'uppercase',
                        fontWeight: '600',
                      }}
                    >
                      {row.branchNames
                        ?.map((name) => name.substring(0, 3).toUpperCase())
                        .join(', ') || 'UNK'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="grand-total">
                <td colSpan={2}>TOTAL</td>
                <td className="text-center">
                  {data.totals.totalBills > 0
                    ? formatValue(data.totals.totalAmount / data.totals.totalBills)
                    : '0.00'}
                </td>
                <td className="text-center">{data.totals.totalBills}</td>
                <td className="text-center amount-cell">{formatValue(data.totals.totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {/* Breakdown Popup */}
          {selectedWaiterStats && (
            <div className="breakdown-modal-overlay" onClick={() => setSelectedWaiterStats(null)}>
              <div className="breakdown-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>
                    {selectedWaiterStats.employeeId} {selectedWaiterStats.waiterName?.toUpperCase()}
                  </h3>
                  <button className="close-btn" onClick={() => setSelectedWaiterStats(null)}>
                    &times;
                  </button>
                </div>
                <div className="modal-body">
                  {(() => {
                    const waiterAvg =
                      selectedWaiterStats.totalBills > 0
                        ? selectedWaiterStats.totalAmount / selectedWaiterStats.totalBills
                        : 0
                    const branchIds = selectedWaiterStats.branchIds || []
                    const benchTotalAmount = branchIds.reduce((acc, id) => {
                      const b = data.branchBenchmarks?.find((x: any) => x._id === id)
                      return acc + (b ? b.totalAmount : 0)
                    }, 0)
                    const benchTotalBills = branchIds.reduce((acc, id) => {
                      const b = data.branchBenchmarks?.find((x: any) => x._id === id)
                      return acc + (b ? b.totalBills : 0)
                    }, 0)
                    const branchAvg = benchTotalBills > 0 ? benchTotalAmount / benchTotalBills : 0
                    const avgPercentage =
                      branchAvg > 0 ? ((waiterAvg / branchAvg) * 100).toFixed(0) : '0'

                    return (
                      <>
                        <div className="breakdown-item" style={{ marginBottom: '15px' }}>
                          <span style={{ color: 'var(--theme-text-secondary)', fontSize: '0.9em' }}>
                            LAST BILL
                          </span>
                          <span style={{ fontWeight: 'bold' }}>
                            {selectedWaiterStats.lastBillTime
                              ? formatTime(selectedWaiterStats.lastBillTime)
                              : '--'}{' '}
                            {selectedWaiterStats.branchNames
                              ?.map((name) => name.substring(0, 3).toUpperCase())
                              .join(', ')}
                          </span>
                        </div>
                        <div className="breakdown-item" style={{ marginBottom: '15px' }}>
                          <span style={{ color: 'var(--theme-text-secondary)', fontSize: '0.9em' }}>
                            AVG (BILL)
                          </span>
                          <span style={{ fontWeight: 'bold' }}>
                            {formatValue(waiterAvg)} ({avgPercentage}%)
                          </span>
                        </div>
                        <div className="breakdown-item" style={{ marginBottom: '15px' }}>
                          <span style={{ color: 'var(--theme-text-secondary)', fontSize: '0.9em' }}>
                            TOTAL BILLS
                          </span>
                          <span style={{ fontWeight: 'bold' }}>
                            {selectedWaiterStats.totalBills}
                          </span>
                        </div>
                      </>
                    )
                  })()}
                  <hr />
                  <div className="breakdown-item">
                    <span>CASH</span>
                    <span className="amount">{formatValue(selectedWaiterStats.cashAmount)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span>UPI</span>
                    <span className="amount">{formatValue(selectedWaiterStats.upiAmount)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span>CARD</span>
                    <span className="amount">{formatValue(selectedWaiterStats.cardAmount)}</span>
                  </div>
                  <hr />
                  <div className="breakdown-item total">
                    <span>TOTAL</span>
                    <span className="amount">{formatValue(selectedWaiterStats.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WaiterWiseBillingReport
