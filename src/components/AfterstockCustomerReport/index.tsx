'use client'

import React, { useState, useEffect } from 'react'
import './index.scss' // reusing the same scss or creating new one? Let's assume we can reuse basic table styles if they are global or in a similar scss.
// However, the prompt implies "follow same table ui in product wise".
// ProductWise has its own index.scss. I should probably create one or reuse it.
// For now, I will assume I need to create a basic scss file or use inline styles for simplicity if scss is not shared.
// Actually, I'll create a scss file for it to be safe.

import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

type CustomerStat = {
  sNo: number
  customerName: string
  phoneNumber: string
  totalBills: number
  totalAmount: number
  lastPurchasingDate: string
}

type ReportData = {
  startDate: string
  endDate: string
  stats: CustomerStat[]
}

const AfterstockCustomerReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showExportMenu, setShowExportMenu] = useState(false)

  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  useEffect(() => {
    const fetchReport = async (start: Date, end: Date) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const res = await fetch(
          `/api/reports/afterstock-customer?startDate=${startStr}&endDate=${endStr}`,
        )
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

    if (startDate && endDate) {
      fetchReport(startDate, endDate)
    }
  }, [startDate, endDate])

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    csvRows.push(
      [
        'S.NO',
        'CUSTOMER NAME',
        'PHONE NUMBER',
        'TOTAL BILLS',
        'TOTAL AMOUNT',
        'LAST PURCHASING DATE',
      ].join(','),
    )
    data.stats.forEach((row) => {
      csvRows.push(
        [
          row.sNo,
          `"${row.customerName}"`,
          `"${row.phoneNumber}"`,
          row.totalBills,
          row.totalAmount,
          `"${new Date(row.lastPurchasingDate).toLocaleString()}"`,
        ].join(','),
      )
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customer_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    a.click()
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
    <div className="product-report-container">
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Customer Report</h1>
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
              monthsShown={1}
              dateFormat="yyyy-MM-dd"
              className="date-input"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
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
                setDateRange([new Date(), new Date()])
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
                <th>CUSTOMER NAME</th>
                <th>PHONE NUMBER</th>
                <th style={{ textAlign: 'right' }}>TOTAL BILLS</th>
                <th style={{ textAlign: 'right' }}>TOTAL AMOUNT</th>
                <th style={{ textAlign: 'right' }}>LAST PURCHASING DATE</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((row) => (
                <tr key={row.sNo}>
                  <td>{row.sNo}</td>
                  <td>{row.customerName}</td>
                  <td>{row.phoneNumber}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{row.totalBills}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600', fontSize: '1.1rem' }}>
                    {formatValue(row.totalAmount)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {new Date(row.lastPurchasingDate).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AfterstockCustomerReport
