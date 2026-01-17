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
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: Omit<ReportStats, 'branchName' | 'sNo' | 'entries' | 'closingNumbers' | 'lastUpdated'>
}

const ClosingEntryReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showZeroHighlight, setShowZeroHighlight] = useState<boolean>(false)
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [filterBranch, setFilterBranch] = useState<string | null>(null)

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch('/api/branches?limit=1000&sort=name')
        const json = await res.json()
        setBranches(json.docs || [])
      } catch (err) {
        console.error('Error fetching branches', err)
      }
    }
    fetchBranches()
  }, [])

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

      // Automatically enable zero highlight if there are zero amounts in totals
      const hasZero =
        json.stats.some(
          (row) =>
            row.systemSales === 0 ||
            row.manualSales === 0 ||
            row.onlineSales === 0 ||
            row.totalSales === 0 ||
            row.totalBills === 0,
        ) ||
        json.totals.systemSales === 0 ||
        json.totals.manualSales === 0 ||
        json.totals.onlineSales === 0 ||
        json.totals.totalSales === 0 ||
        json.totals.totalBills === 0

      setShowZeroHighlight(hasZero)
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
    if (!filterBranch) return true
    return row.branchName === filterBranch
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

    if (!filterBranch) return data.totals

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
  }, [data, filteredStats, filterBranch])

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
  const getStyle = (val: number) => ({
    textAlign: 'right' as const,
    fontWeight: '600' as const,
    fontSize: '1.2rem' as const,
    verticalAlign: 'middle' as const, // Ensure vertical centering
    padding: '8px', // Ensure padding matches
    backgroundColor: showZeroHighlight && val === 0 ? '#800020' : 'inherit',
    color: showZeroHighlight && val === 0 ? '#FFFFFF' : 'inherit',
  })

  // Specific style for System Sales to handle stacked content
  const getSystemSalesStyle = (val: number) => ({
    ...getStyle(val),
    // Removed display: flex to allow table-cell behavior (full height background)
    // Content will handle its own alignment via text-align: right
  })

  return (
    <div className="branch-report-container">
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Closing Entry Report</h1>
          <button
            title="Toggle Zero Highlight"
            onClick={() => setShowZeroHighlight(!showZeroHighlight)}
            style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#800020',
              border: showZeroHighlight ? '1px solid #ffffff' : '1px solid #800020',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        </div>
        <div className="date-filter">
          <div className="filter-group">
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => {
                setDateRange(update)
              }}
              monthsShown={2}
              dateFormat="yyyy-MM-dd"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
            />
          </div>

          <div className="filter-group" style={{ minWidth: '200px' }}>
            <Select
              options={[
                { value: '', label: 'All Branches' },
                ...branches.map((b) => ({ value: b.name, label: b.name })),
              ]}
              value={
                filterBranch
                  ? { value: filterBranch, label: filterBranch }
                  : { value: '', label: 'All Branches' }
              }
              onChange={(option) => setFilterBranch(option?.value || null)}
              placeholder="All Branches"
              isClearable
              styles={{
                control: (base) => ({
                  ...base,
                  backgroundColor: '#18181b',
                  borderColor: '#27272a',
                  color: '#ffffff',
                }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  zIndex: 9999,
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isFocused ? '#27272a' : '#18181b',
                  color: '#ffffff',
                  cursor: 'pointer',
                }),
                singleValue: (base) => ({
                  ...base,
                  color: '#ffffff',
                }),
                input: (base) => ({
                  ...base,
                  color: '#ffffff',
                }),
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
                setDateRange([new Date(), new Date()]) // Reset to Today
                setFilterBranch(null)
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
                <th style={{ textAlign: 'left' }}>SYSTEM BILLS</th>
                <th style={{ textAlign: 'left' }}>MANUAL BILLS</th>
                <th style={{ textAlign: 'left' }}>ONLINE BILLS</th>
                <th style={{ textAlign: 'left' }}>TOTAL BILLS</th>
                <th style={{ textAlign: 'left' }}>EXPENSES</th>
                <th style={{ textAlign: 'left' }}>CASH</th>
                <th style={{ textAlign: 'left' }}>UPI</th>
                <th style={{ textAlign: 'left' }}>CARD</th>
                <th style={{ textAlign: 'left' }}>TOTAL SALES</th>
                <th style={{ textAlign: 'left' }}>SALES DIF</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats?.map((row, index) => {
                const calculatedTotal = row.expenses + row.cash + row.upi + row.card
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
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: '#888',
                            marginTop: '4px',
                            display: 'flex',
                            // flexWrap: 'wrap', // Removed to prevent wrapping
                            whiteSpace: 'nowrap', // Force single line
                            alignItems: 'center',
                          }}
                        >
                          <span>
                            {row.closingNumbers
                              ?.map((num) => {
                                const parts = num.split('-')
                                // Expected format: SAW-CLO-271225-01
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
                      <td style={getStyle(row.expenses)}>{formatValue(row.expenses)}</td>
                      <td style={getStyle(row.cash)}>{formatValue(row.cash)}</td>
                      <td style={getStyle(row.upi)}>{formatValue(row.upi)}</td>
                      <td style={getStyle(row.card)}>{formatValue(row.card)}</td>
                      <td style={getStyle(calculatedTotal)}>{formatValue(calculatedTotal)}</td>
                      <td style={getStyle(calculatedTotal - row.totalSales)}>
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
                              backgroundColor: '#ffcedf',
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
                                  {new Date(entry.createdAt).toLocaleTimeString([], {
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
                                color: entry.systemSales < 0 ? '#ef4444' : 'black',
                              }}
                            >
                              {formatValue(entry.systemSales)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.manualSales),
                                fontWeight: 'bold',
                                color: entry.manualSales < 0 ? '#ef4444' : 'black',
                              }}
                            >
                              {formatValue(entry.manualSales)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.onlineSales),
                                fontWeight: 'bold',
                                color: entry.onlineSales < 0 ? '#ef4444' : 'black',
                              }}
                            >
                              {formatValue(entry.onlineSales)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.totalSales),
                                fontWeight: 'bold',
                                color: entry.totalSales < 0 ? '#ef4444' : 'black',
                              }}
                            >
                              {formatValue(entry.totalSales)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.expenses),
                                fontWeight: 'bold',
                                color: entry.expenses < 0 ? '#ef4444' : 'black',
                              }}
                            >
                              {formatValue(entry.expenses)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.cash),
                                fontWeight: 'bold',
                                color: entry.cash < 0 ? '#ef4444' : 'black',
                              }}
                            >
                              {formatValue(entry.cash)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.upi),
                                fontWeight: 'bold',
                                color: entry.upi < 0 ? '#ef4444' : 'black',
                              }}
                            >
                              {formatValue(entry.upi)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entry.card),
                                fontWeight: 'bold',
                                color: entry.card < 0 ? '#ef4444' : 'black',
                              }}
                            >
                              {formatValue(entry.card)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entryTotal),
                                fontWeight: 'bold',
                                color:
                                  entryTotal > entry.totalSales
                                    ? '#006400'
                                    : entryTotal < entry.totalSales
                                      ? '#ef4444'
                                      : 'black',
                              }}
                            >
                              {formatValue(entryTotal)}
                            </td>
                            <td
                              style={{
                                ...getStyle(entryTotal - entry.totalSales),
                                fontWeight: 'bold',
                                color: entryTotal - entry.totalSales < 0 ? '#ef4444' : 'black',
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
                  style={getStyle(
                    filteredTotals.expenses +
                      filteredTotals.cash +
                      filteredTotals.upi +
                      filteredTotals.card,
                  )}
                >
                  {formatValue(
                    filteredTotals.expenses +
                      filteredTotals.cash +
                      filteredTotals.upi +
                      filteredTotals.card,
                  )}
                </td>
                <td
                  style={getStyle(
                    filteredTotals.expenses +
                      filteredTotals.cash +
                      filteredTotals.upi +
                      filteredTotals.card -
                      filteredTotals.totalSales,
                  )}
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
    </div>
  )
}

export default ClosingEntryReport
