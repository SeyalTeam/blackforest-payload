'use client'

import React, { useState, useEffect } from 'react'
import './index.scss'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

type ReportStats = {
  branchName: string
  totalBills: number
  totalAmount: number
  cash: number
  upi: number
  card: number
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: Omit<ReportStats, 'branchName'>
}

const BranchBillingReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showZeroHighlight, setShowZeroHighlight] = useState<boolean>(false)

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchReport = async (start: Date, end: Date) => {
    setLoading(true)
    setError('')
    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const res = await fetch(`/api/reports/branch-billing?startDate=${startStr}&endDate=${endStr}`)
      if (!res.ok) throw new Error('Failed to fetch report')
      const json: ReportData = await res.json()

      // Automatically enable zero highlight if there are zero values
      const hasZero =
        json.stats.some(
          (row) => row.cash === 0 || row.upi === 0 || row.card === 0 || row.totalAmount === 0,
        ) ||
        json.totals.cash === 0 ||
        json.totals.upi === 0 ||
        json.totals.card === 0 ||
        json.totals.totalAmount === 0

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
  }, [dateRange, startDate, endDate])

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      // split the value "YYYY-MM-DD - YYYY-MM-DD"
      const [start, end] = value ? value.split(' - ') : ['', '']

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref}>
          <span className="date-text">{start}</span>
          <span className="separator" style={{ padding: '0 5px' }}>
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
    const headers = ['S.No', 'Branch Name', 'Total Bills', 'Cash', 'UPI', 'Card', 'Total Amount']
    csvRows.push(headers.join(','))

    // Rows
    data.stats.forEach((row, index) => {
      csvRows.push(
        [
          index + 1,
          `"${row.branchName}"`,
          row.totalBills,
          formatValue(row.cash),
          formatValue(row.upi),
          formatValue(row.card),
          formatValue(row.totalAmount),
        ].join(','),
      )
    })

    // Total Row
    csvRows.push(
      [
        '',
        'TOTAL',
        data.totals.totalBills,
        formatValue(data.totals.cash),
        formatValue(data.totals.upi),
        formatValue(data.totals.card),
        formatValue(data.totals.totalAmount),
      ].join(','),
    )

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `branch_billing_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${endDate ? toLocalDateStr(endDate) : ''}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="branch-report-container">
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Branch Billing Report</h1>
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
              onChange={(update: [Date | null, Date | null]) => {
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
                <th style={{ textAlign: 'right' }}>TOTAL BILLS</th>
                <th style={{ textAlign: 'right' }}>CASH</th>
                <th style={{ textAlign: 'right' }}>UPI</th>
                <th style={{ textAlign: 'right' }}>CARD</th>
                <th style={{ textAlign: 'right' }}>TOTAL AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((row, index) => (
                <tr key={row.branchName}>
                  <td>{index + 1}</td>{' '}
                  {/* Using index + 1 for S.No as row.sNo is not defined in ReportStats */}
                  <td className="branch-name-cell">{row.branchName.toUpperCase()}</td>
                  <td style={{ textAlign: 'right' }}>{row.totalBills}</td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: '600',
                      fontSize: '1.2rem',
                      backgroundColor: showZeroHighlight && row.cash === 0 ? '#800020' : 'inherit',
                      color: showZeroHighlight && row.cash === 0 ? '#FFFFFF' : 'inherit',
                    }}
                  >
                    {formatValue(row.cash)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: '600',
                      fontSize: '1.2rem',
                      backgroundColor: showZeroHighlight && row.upi === 0 ? '#800020' : 'inherit',
                      color: showZeroHighlight && row.upi === 0 ? '#FFFFFF' : 'inherit',
                    }}
                  >
                    {formatValue(row.upi)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: '600',
                      fontSize: '1.2rem',
                      backgroundColor: showZeroHighlight && row.card === 0 ? '#800020' : 'inherit',
                      color: showZeroHighlight && row.card === 0 ? '#FFFFFF' : 'inherit',
                    }}
                  >
                    {formatValue(row.card)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: '600',
                      fontSize: '1.2rem',
                      backgroundColor:
                        showZeroHighlight && row.totalAmount === 0 ? '#800020' : 'inherit',
                      color: showZeroHighlight && row.totalAmount === 0 ? '#FFFFFF' : 'inherit',
                    }}
                  >
                    {formatValue(row.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="grand-total">
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.totalBills}</strong>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    backgroundColor:
                      showZeroHighlight && data.totals.cash === 0 ? '#800020' : 'inherit',
                    color: showZeroHighlight && data.totals.cash === 0 ? '#FFFFFF' : 'inherit',
                  }}
                >
                  <strong>{formatValue(data.totals.cash)}</strong>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    backgroundColor:
                      showZeroHighlight && data.totals.upi === 0 ? '#800020' : 'inherit',
                    color: showZeroHighlight && data.totals.upi === 0 ? '#FFFFFF' : 'inherit',
                  }}
                >
                  <strong>{formatValue(data.totals.upi)}</strong>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    backgroundColor:
                      showZeroHighlight && data.totals.card === 0 ? '#800020' : 'inherit',
                    color: showZeroHighlight && data.totals.card === 0 ? '#FFFFFF' : 'inherit',
                  }}
                >
                  <strong>{formatValue(data.totals.card)}</strong>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    backgroundColor:
                      showZeroHighlight && data.totals.totalAmount === 0 ? '#800020' : 'inherit',
                    color:
                      showZeroHighlight && data.totals.totalAmount === 0 ? '#FFFFFF' : 'inherit',
                  }}
                >
                  <strong>{formatValue(data.totals.totalAmount)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default BranchBillingReport
