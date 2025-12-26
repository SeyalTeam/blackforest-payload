'use client'

import React, { useState, useEffect } from 'react'
import './index.scss'

type ReportStats = {
  sNo: number
  categoryName: string
  totalQuantity: number
  totalAmount: number
  branchSales: Record<string, { amount: number; quantity: number }>
}

type ReportData = {
  startDate: string
  endDate: string
  branchHeaders: string[]
  stats: ReportStats[]
  totals: {
    totalQuantity: number
    totalAmount: number
    branchTotals: Record<string, number>
  }
}

import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select from 'react-select'

// ... existing code ...

const CategoryWiseReport: React.FC = () => {
  // Combine start and end date into a single range state for the picker
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState('all')

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState('all')

  const handleExportExcel = () => {
    // ... existing export logic ...
    if (!data) return
    const csvRows = []
    // Header
    csvRows.push(
      ['S.No', 'Category', ...data.branchHeaders, 'Total Units', 'Total Amount'].join(','),
    )
    // Rows
    data.stats.forEach((row) => {
      const branchValues = data.branchHeaders.map((header) =>
        (row.branchSales[header]?.amount || 0).toFixed(2),
      )
      csvRows.push(
        [
          row.sNo,
          `"${row.categoryName}"`, // Quote strings
          ...branchValues,
          row.totalQuantity,
          row.totalAmount.toFixed(2),
        ].join(','),
      )
    })
    // Total Row
    const totalBranchValues = data.branchHeaders.map((header) =>
      (data.totals.branchTotals[header] || 0).toFixed(2),
    )
    csvRows.push(
      [
        '',
        'TOTAL',
        ...totalBranchValues,
        data.totals.totalQuantity,
        data.totals.totalAmount.toFixed(2),
      ].join(','),
    )

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `category_report_${startDate?.toISOString().split('T')[0]}_to_${
      endDate?.toISOString().split('T')[0]
    }.csv`
    a.click()
  }

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ]

  const customStyles = {
    // ... exact styles as before ...
    control: (base: any, state: any) => ({
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
    singleValue: (base: any) => ({
      ...base,
      color: 'var(--theme-text-primary)',
      fontWeight: '600', // Darker number/text
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--theme-info-500)'
        : state.isFocused
          ? 'var(--theme-elevation-100)'
          : 'var(--theme-input-bg, var(--theme-elevation-50))',
      color: state.isSelected ? '#fff' : 'var(--theme-text-primary)',
      cursor: 'pointer',
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      border: '1px solid var(--theme-elevation-150)',
      zIndex: 9999, // Ensure it's above everything
      minWidth: '200px',
    }),
    input: (base: any) => ({
      ...base,
      color: 'var(--theme-text-primary)',
    }),
  }

  // Fetch available branches and departments
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchRes, deptRes] = await Promise.all([
          fetch('/api/branches?limit=100&pagination=false'),
          fetch('/api/departments?limit=100&pagination=false'),
        ])

        if (branchRes.ok) {
          const json = await branchRes.json()
          setBranches(json.docs)
        }
        if (deptRes.ok) {
          const json = await deptRes.json()
          setDepartments(json.docs)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchMetadata()
  }, [])

  const fetchReport = async (start: string, end: string, branchId: string, deptId: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/reports/category-wise?startDate=${start}&endDate=${end}&branch=${branchId}&department=${deptId}`,
      )
      if (!res.ok) throw new Error('Failed to fetch report')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      setError('Error loading report data')
    } finally {
      setLoading(false)
    }
  }

  // Sync dateRange changes to backend fetch
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        selectedBranch,
        selectedDepartment,
      )
    }
  }, [dateRange, selectedBranch, selectedDepartment])

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

  return (
    <div className="category-report-container">
      <div className="report-header">
        <h1>Category Wise Report</h1>
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
              className="date-input"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
            />
          </div>

          <div className="filter-group">
            <Select
              options={branchOptions}
              value={branchOptions.find((o) => o.value === selectedBranch)}
              onChange={(option: any) => setSelectedBranch(option?.value || 'all')}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Branch..."
              isSearchable={true}
            />
          </div>

          <div className="filter-group">
            <Select
              options={departmentOptions}
              value={departmentOptions.find((o) => o.value === selectedDepartment)}
              onChange={(option: any) => setSelectedDepartment(option?.value || 'all')}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Department..."
              isSearchable={true}
            />
          </div>

          {/* Export Button */}
          <div className="filter-group">
            <div className="export-container">
              <button
                className="export-btn"
                onClick={handleExportExcel}
                title="Export to Excel"
                disabled={!data}
                style={{ opacity: !data ? 0.5 : 1, cursor: !data ? 'not-allowed' : 'pointer' }}
              >
                <span>Export</span>
                <span className="icon">↓</span>
              </button>
            </div>
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
                <th style={{ width: '50px' }}>S.No</th>
                <th>Category</th>
                {/* Dynamically render branch headers */}
                {data.branchHeaders.map((header) => (
                  <th key={header} style={{ textAlign: 'left' }}>
                    {header}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Total Units</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((row) => (
                <tr key={row.sNo}>
                  <td>{row.sNo}</td>
                  <td>{row.categoryName}</td>
                  {data.branchHeaders.map((header) => {
                    const sales = row.branchSales[header] || { amount: 0, quantity: 0 }
                    return (
                      <td key={header} style={{ textAlign: 'left', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 500 }}>{sales.amount.toFixed(2)}</div>
                        {sales.quantity > 0 && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--theme-elevation-400)',
                              marginTop: '2px',
                            }}
                          >
                            {sales.quantity} Units
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'right' }}>{row.totalQuantity}</td>
                  <td style={{ textAlign: 'right' }}>{row.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="grand-total">
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                {/* Branch Totals */}
                {data.branchHeaders.map((header) => (
                  <td key={header} style={{ textAlign: 'left', fontWeight: 'bold' }}>
                    {(data.totals.branchTotals[header] || 0).toFixed(2)}
                  </td>
                ))}
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.totalQuantity}</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.totalAmount.toFixed(2)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default CategoryWiseReport
