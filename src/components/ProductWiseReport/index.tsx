'use client'

import React, { useState, useEffect } from 'react'
import './index.scss'

type ReportStats = {
  sNo: number
  productName: string
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

const ProductWiseReport: React.FC = () => {
  // Combine start and end date into a single range state for the picker
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState('all')

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState('all')

  const [showExportMenu, setShowExportMenu] = useState(false)

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    // Header
    csvRows.push(
      ['S.No', 'Product', ...data.branchHeaders, 'Total Quantity', 'Total Amount'].join(','),
    )
    // Rows
    data.stats.forEach((row) => {
      const branchValues = data.branchHeaders.map((header) =>
        formatValue(row.branchSales[header]?.amount || 0),
      )
      csvRows.push(
        [
          row.sNo,
          `"${row.productName}"`, // Quote strings
          ...branchValues,
          formatValue(row.totalQuantity),
          formatValue(row.totalAmount),
        ].join(','),
      )
    })
    // Total Row
    const totalBranchPlaceholders = data.branchHeaders.map((header) =>
      formatValue(data.totals.branchTotals[header] || 0),
    )
    csvRows.push(
      [
        '',
        'TOTAL',
        ...totalBranchPlaceholders,
        formatValue(data.totals.totalQuantity),
        formatValue(data.totals.totalAmount),
      ].join(','),
    )

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product_report_${startDate?.toISOString().split('T')[0]}_to_${
      endDate?.toISOString().split('T')[0]
    }.csv`
    a.click()
    setShowExportMenu(false)
  }

  // TODO: Add PDF export if backend supports it for Product Report
  const _handleExportPDF = async () => {
    alert('PDF Export for Product Wise Report is not yet implemented.')
    setShowExportMenu(false)
  }

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
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
    }),
  }

  // Fetch available branches and categories
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchRes, categoryRes, departmentRes] = await Promise.all([
          fetch('/api/branches?limit=100&pagination=false'),
          fetch('/api/categories?limit=100&pagination=false'),
          fetch('/api/departments?limit=100&pagination=false'),
        ])

        if (branchRes.ok) {
          const json = await branchRes.json()
          setBranches(json.docs)
        }
        if (categoryRes.ok) {
          const json = await categoryRes.json()
          setCategories(json.docs)
        }
        if (departmentRes.ok) {
          const json = await departmentRes.json()
          setDepartments(json.docs)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchMetadata()
  }, [])

  const fetchReport = async (
    start: string,
    end: string,
    branchId: string,
    categoryId: string,
    departmentId: string,
  ) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/reports/product-wise?startDate=${start}&endDate=${end}&branch=${branchId}&category=${categoryId}&department=${departmentId}`,
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
        selectedCategory,
        selectedDepartment,
      )
    }
  }, [startDate, endDate, selectedBranch, selectedCategory, selectedDepartment])

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
    <div className="product-report-container">
      <div className="report-header">
        <h1>Product Wise Report</h1>
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

          <div className="filter-group select-group">
            <Select
              options={branchOptions}
              value={branchOptions.find((o) => o.value === selectedBranch)}
              onChange={(option: { value: string; label: string } | null) =>
                setSelectedBranch(option?.value || 'all')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Branch..."
              isSearchable={true}
            />
          </div>

          <div className="filter-group select-group">
            <Select
              options={departmentOptions}
              value={departmentOptions.find((o) => o.value === selectedDepartment)}
              onChange={(option: { value: string; label: string } | null) =>
                setSelectedDepartment(option?.value || 'all')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Department..."
              isSearchable={true}
            />
          </div>

          <div className="filter-group select-group">
            <Select
              options={categoryOptions}
              value={categoryOptions.find((o) => o.value === selectedCategory)}
              onChange={(option: { value: string; label: string } | null) =>
                setSelectedCategory(option?.value || 'all')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Category..."
              isSearchable={true}
            />
          </div>

          {/* Export Button */}
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
                  {/* <button onClick={handleExportPDF}>PDF</button> */}
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
                setDateRange([new Date(), new Date()])
                setSelectedBranch('all')
                setSelectedDepartment('all')
                setSelectedCategory('all')
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
                <th style={{ width: '50px' }}>S.No</th>
                <th>Product</th>
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
                  <td>{row.productName}</td>
                  {/* Dynamically render branch sales cells */}
                  {data.branchHeaders.map((header) => {
                    const sales = row.branchSales[header] || { amount: 0, quantity: 0 }
                    const isZero = sales.amount === 0
                    return (
                      <td
                        key={header}
                        style={{
                          textAlign: 'left',
                          verticalAlign: 'top',
                          backgroundColor: isZero ? '#800020' : 'inherit',
                          color: isZero ? '#FFFFFF' : 'inherit',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>
                          {formatValue(sales.amount)}
                        </div>
                        {sales.quantity > 0 && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: isZero ? '#FFFFFF' : 'var(--theme-elevation-400)',
                              marginTop: '2px',
                            }}
                          >
                            {formatValue(sales.quantity)} Units
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: '600',
                      fontSize: '1.2rem',
                      backgroundColor: row.totalQuantity === 0 ? '#800020' : 'inherit',
                      color: row.totalQuantity === 0 ? '#FFFFFF' : 'inherit',
                    }}
                  >
                    {formatValue(row.totalQuantity)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: '600',
                      fontSize: '1.2rem',
                      backgroundColor: row.totalAmount === 0 ? '#800020' : 'inherit',
                      color: row.totalAmount === 0 ? '#FFFFFF' : 'inherit',
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
                {/* Dynamically render branch totals in footer */}
                {data.branchHeaders.map((header) => {
                  const val = data.totals.branchTotals[header] || 0
                  const isZero = val === 0
                  return (
                    <td
                      key={header}
                      style={{
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        backgroundColor: isZero ? '#800020' : 'inherit',
                        color: isZero ? '#FFFFFF' : 'inherit',
                      }}
                    >
                      <strong>{formatValue(val)}</strong>
                    </td>
                  )
                })}
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: '600',
                    fontSize: '1.2rem',
                    backgroundColor: data.totals.totalQuantity === 0 ? '#800020' : 'inherit',
                    color: data.totals.totalQuantity === 0 ? '#FFFFFF' : 'inherit',
                  }}
                >
                  <strong>{formatValue(data.totals.totalQuantity)}</strong>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: '600',
                    fontSize: '1.2rem',
                    backgroundColor: data.totals.totalAmount === 0 ? '#800020' : 'inherit',
                    color: data.totals.totalAmount === 0 ? '#FFFFFF' : 'inherit',
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

export default ProductWiseReport
