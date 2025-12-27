'use client'

import React, { useState, useEffect } from 'react'
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
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

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

  const handleExportExcel = () => {
    if (!data) return
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
    data.stats.forEach((row, index) => {
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
        formatValue(data.totals.systemSales),
        data.totals.totalBills,
        formatValue(data.totals.manualSales),
        formatValue(data.totals.onlineSales),
        formatValue(data.totals.totalSales),
        formatValue(data.totals.expenses),
        formatValue(data.totals.cash),
        formatValue(data.totals.upi),
        formatValue(data.totals.card),
        formatValue(data.totals.expenses + data.totals.cash + data.totals.upi + data.totals.card),
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
              {data.stats.map((row, index) => {
                const calculatedTotal = row.expenses + row.cash + row.upi + row.card
                return (
                  <React.Fragment key={row.branchName}>
                    <tr
                      key={row.branchName}
                      onClick={() =>
                        setSelectedBranch(selectedBranch === row.branchName ? null : row.branchName)
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
                    {selectedBranch === row.branchName &&
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
                              backgroundColor:
                                i % 2 === 0
                                  ? 'var(--theme-elevation-100)'
                                  : 'var(--theme-elevation-150)',
                            }}
                          >
                            <td></td>
                            <td className="branch-name-cell">
                              <div
                                style={{
                                  fontSize: '1rem',
                                  color: '#FFFFFF',
                                  fontWeight: 600,
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
                                    color: '#FFFFFF',
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
                            <td style={getStyle(entry.systemSales)}>
                              {formatValue(entry.systemSales)}
                            </td>
                            <td style={getStyle(entry.manualSales)}>
                              {formatValue(entry.manualSales)}
                            </td>
                            <td style={getStyle(entry.onlineSales)}>
                              {formatValue(entry.onlineSales)}
                            </td>
                            <td style={getStyle(entry.totalSales)}>
                              {formatValue(entry.totalSales)}
                            </td>
                            <td style={getStyle(entry.expenses)}>{formatValue(entry.expenses)}</td>
                            <td style={getStyle(entry.cash)}>{formatValue(entry.cash)}</td>
                            <td style={getStyle(entry.upi)}>{formatValue(entry.upi)}</td>
                            <td style={getStyle(entry.card)}>{formatValue(entry.card)}</td>
                            <td style={getStyle(entryTotal)}>{formatValue(entryTotal)}</td>
                            <td style={getStyle(entryTotal - entry.totalSales)}>
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
                <td style={getSystemSalesStyle(data.totals.systemSales)}>
                  <div>{formatValue(data.totals.systemSales)}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    {data.totals.totalBills} Bills
                  </div>
                </td>
                <td style={getStyle(data.totals.manualSales)}>
                  {formatValue(data.totals.manualSales)}
                </td>
                <td style={getStyle(data.totals.onlineSales)}>
                  {formatValue(data.totals.onlineSales)}
                </td>
                <td style={getStyle(data.totals.totalSales)}>
                  {formatValue(data.totals.totalSales)}
                </td>
                <td style={getStyle(data.totals.expenses)}>{formatValue(data.totals.expenses)}</td>
                <td style={getStyle(data.totals.cash)}>{formatValue(data.totals.cash)}</td>
                <td style={getStyle(data.totals.upi)}>{formatValue(data.totals.upi)}</td>
                <td style={getStyle(data.totals.card)}>{formatValue(data.totals.card)}</td>
                <td
                  style={getStyle(
                    data.totals.expenses + data.totals.cash + data.totals.upi + data.totals.card,
                  )}
                >
                  {formatValue(
                    data.totals.expenses + data.totals.cash + data.totals.upi + data.totals.card,
                  )}
                </td>
                <td
                  style={getStyle(
                    data.totals.expenses +
                      data.totals.cash +
                      data.totals.upi +
                      data.totals.card -
                      data.totals.totalSales,
                  )}
                >
                  {formatValue(
                    data.totals.expenses +
                      data.totals.cash +
                      data.totals.upi +
                      data.totals.card -
                      data.totals.totalSales,
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
