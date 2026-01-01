'use client'

import React, { useState, useEffect } from 'react'
import './index.scss'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select from 'react-select'

type ReportStats = {
  branchName: string
  stockOrders: number
  liveOrders: number
  totalOrders: number
}

type DetailItem = {
  productName: string
  price: number
  ordQty: number
  ordTime?: string
  sntQty: number
  sntTime?: string
  conQty: number
  conTime?: string
  picQty: number
  picTime?: string
  recQty: number
  recTime?: string
  difQty: number
  branchName: string
  branchDisplay?: string
  categoryName?: string
  departmentName?: string
  invoiceNumber?: string
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: {
    stockOrders: number
    liveOrders: number
    totalOrders: number
  }
  details: DetailItem[]
  invoiceNumbers?: Array<{ invoice: string; isLive: boolean; createdAt?: string }>
}

const StockOrderReport: React.FC = () => {
  // ... (existing state)
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filters State
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedProd, setSelectedProd] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  const [selectedOrderType, setSelectedOrderType] = useState<'' | 'stock' | 'live'>('')
  const [selectedInvoice, setSelectedInvoice] = useState('')

  // React Select Constants
  const statusOptions = [
    { value: 'ordered', label: 'Ordered' },
    { value: 'sending', label: 'Sending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'picked', label: 'Picked' },
    { value: 'received', label: 'Received' },
  ]

  const customStyles = {
    control: (base: any, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: '#18181b',
      borderColor: state.isFocused ? '#3b82f6' : '#27272a',
      borderRadius: '6px',
      height: '38px',
      minHeight: '38px',
      minWidth: '90px',
      padding: '0 2px',
      boxShadow: 'none',
      color: '#ffffff',
      '&:hover': {
        borderColor: '#52525b',
      },
    }),
    singleValue: (base: any) => ({
      ...base,
      color: '#ffffff',
      fontWeight: '500',
    }),
    option: (base: any, state: { isSelected: boolean; isFocused: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#27272a' : '#18181b',
      color: '#ffffff',
      cursor: 'pointer',
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: '#18181b',
      border: '1px solid #27272a',
      zIndex: 9999,
    }),
    input: (base: any) => ({
      ...base,
      color: '#ffffff',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base: any) => ({
      ...base,
      color: '#a1a1aa',
      padding: '4px',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#a1a1aa',
    }),
  }

  // Options Lists
  const [branches, setBranches] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    // Fetch Filter Options
    const fetchOptions = async () => {
      try {
        const [resBranches, resDepts, resCats, resProds] = await Promise.all([
          fetch('/api/branches?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/departments?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/categories?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/products?limit=1000&sort=name').then((res) => res.json()),
        ])
        setBranches(resBranches.docs || [])
        setDepartments(resDepts.docs || [])
        setCategories(resCats.docs || [])
        setProducts(resProds.docs || [])
      } catch (err) {
        console.error('Error fetching filter options', err)
      }
    }
    fetchOptions()
  }, [])

  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const fetchReport = React.useCallback(async (start: Date, end: Date, filters: any) => {
    setLoading(true)
    setError('')
    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const query = new URLSearchParams({
        startDate: startStr,
        endDate: endStr,
        ...(filters.branch && { branch: filters.branch }),
        ...(filters.department && { department: filters.department }),
        ...(filters.category && { category: filters.category }),
        ...(filters.product && { product: filters.product }),
        ...(filters.status && { status: filters.status }),
        ...(filters.orderType && { orderType: filters.orderType }),
        ...(filters.orderType && { orderType: filters.orderType }),
      })

      const res = await fetch(`/api/reports/stock-order?${query.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch report')
      const json: ReportData = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      setError('Error loading report data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, {
        branch: selectedBranch,
        department: selectedDept,
        category: selectedCat,
        product: selectedProd,
        status: selectedStatus,
        orderType: selectedOrderType,
        invoice: undefined, // Client-side filtering only
      })
    }
  }, [
    dateRange,
    startDate,
    endDate,
    fetchReport,
    selectedBranch,
    selectedDept,
    selectedCat,
    selectedProd,
    selectedStatus,
    selectedOrderType,
  ])

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
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

    // Header Row: Metric, Branch Name 1, Branch Name 2, ..., Total
    const branchNames = data.stats.map((s) => `"${s.branchName.substring(0, 3).toUpperCase()}"`)
    const headers = ['Metric', ...branchNames, 'TOTAL']
    csvRows.push(headers.join(','))

    // Stock Orders Row
    const stockValues = data.stats.map((s) => s.stockOrders)
    csvRows.push(['Stock Orders', ...stockValues, data.totals.stockOrders].join(','))

    // Live Orders Row
    const liveValues = data.stats.map((s) => s.liveOrders)
    csvRows.push(['Live Orders', ...liveValues, data.totals.liveOrders].join(','))

    // Total Orders Row
    const totalValues = data.stats.map((s) => s.totalOrders)
    csvRows.push(['Total Orders', ...totalValues, data.totals.totalOrders].join(','))

    // Details Table Export
    csvRows.push([])
    csvRows.push(['PRODUCT ORDER DETAILS'])
    csvRows.push([
      'Product Name',
      'Branch',
      'Price',
      'ORD',
      'SNT',
      'Time',
      'CON',
      'Time',
      'PIC',
      'Time',
      'REC',
      'Time',
      'DIF',
    ])

    data.details.forEach((item) => {
      csvRows.push(
        [
          `"${item.productName}"`,
          `"${item.branchName}"`,
          item.price,
          item.ordQty,
          item.sntQty,
          formatTime(item.sntTime),
          item.conQty,
          formatTime(item.conTime),
          item.picQty,
          formatTime(item.picTime),
          item.recQty,
          formatTime(item.recTime),
          item.difQty,
        ].join(','),
      )
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `stock_order_report_transposed_${startDate ? toLocalDateStr(startDate) : ''}_to_${endDate ? toLocalDateStr(endDate) : ''}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper to filter categories based on selected department (simple logic)
  const filteredCategories = selectedDept
    ? categories.filter((c) => {
        if (!c.department) return false
        const deptId = typeof c.department === 'object' ? c.department.id : c.department
        return deptId === selectedDept
      })
    : categories

  // Helper to filter products based on selected category
  const filteredProducts = selectedCat
    ? products.filter((p) => {
        if (!p.category) return false
        const catId = typeof p.category === 'object' ? p.category.id : p.category
        return catId === selectedCat
      })
    : products

  // Group Details by Department -> Category
  const groupedDetails = React.useMemo(() => {
    if (!data?.details) return {}
    return data.details.reduce(
      (acc, item) => {
        const dept = item.departmentName || 'No Department'
        const cat = item.categoryName || 'Uncategorized'

        if (!acc[dept]) acc[dept] = {}
        if (!acc[dept][cat]) acc[dept][cat] = []

        acc[dept][cat].push(item)
        return acc
      },
      {} as Record<string, Record<string, DetailItem[]>>,
    )
  }, [data?.details])

  return (
    <div className="stock-order-report-container">
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Stock Order Report</h1>
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
                setSelectedBranch('')
                setSelectedDept('')
                setSelectedCat('')
                setSelectedProd('')
                setSelectedStatus('')
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

      {loading && !data && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div
          className="report-content"
          style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}
        >
          <div className="table-container summary-table">
            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '150px', position: 'sticky', left: 0, zIndex: 2 }}>
                    METRIC
                  </th>
                  {data.stats.map((row) => (
                    <th key={row.branchName} style={{ textAlign: 'center' }}>
                      {row.branchName.substring(0, 3).toUpperCase()}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', minWidth: '100px', fontWeight: 'bold' }}>
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Stock Orders Row */}
                <tr>
                  <td
                    style={{
                      fontWeight: '600',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'var(--theme-elevation-50)',
                      zIndex: 1,
                      borderRight: '1px solid var(--theme-elevation-200)',
                    }}
                  >
                    Stock Orders
                  </td>
                  {data.stats.map((row) => (
                    <td key={row.branchName} style={{ textAlign: 'center' }}>
                      {row.stockOrders}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {data.totals.stockOrders}
                  </td>
                </tr>

                {/* Live Orders Row */}
                <tr>
                  <td
                    style={{
                      fontWeight: '600',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'var(--theme-elevation-50)',
                      zIndex: 1,
                      borderRight: '1px solid var(--theme-elevation-200)',
                    }}
                  >
                    Live Orders
                  </td>
                  {data.stats.map((row) => (
                    <td key={row.branchName} style={{ textAlign: 'center' }}>
                      {row.liveOrders}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {data.totals.liveOrders}
                  </td>
                </tr>

                {/* Total Orders Row */}
                <tr style={{ backgroundColor: 'var(--theme-elevation-100)', fontWeight: 'bold' }}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'var(--theme-elevation-100)',
                      zIndex: 1,
                      borderRight: '1px solid var(--theme-elevation-200)',
                    }}
                  >
                    Total Orders
                  </td>
                  {data.stats.map((row) => (
                    <td key={row.branchName} style={{ textAlign: 'center' }}>
                      {row.totalOrders}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {data.totals.totalOrders}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            className="table-title"
            style={{
              marginTop: '30px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
            }}
          >
            <h3 style={{ margin: 0 }}>Product Order Details</h3>

            {/* Order Type Chips */}
            <div
              className="filter-group"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <button
                onClick={() => setSelectedOrderType((prev) => (prev === 'stock' ? '' : 'stock'))}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #22c55e',
                  backgroundColor: selectedOrderType === 'stock' ? '#22c55e' : 'transparent',
                  color: selectedOrderType === 'stock' ? '#ffffff' : '#22c55e',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '11px',
                  transition: 'all 0.2s',
                }}
              >
                Stock
              </button>
              <button
                onClick={() => setSelectedOrderType((prev) => (prev === 'live' ? '' : 'live'))}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #ef4444',
                  backgroundColor: selectedOrderType === 'live' ? '#ef4444' : 'transparent',
                  color: selectedOrderType === 'live' ? '#ffffff' : '#ef4444',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '11px',
                  transition: 'all 0.2s',
                }}
              >
                Live
              </button>
            </div>
          </div>

          <div
            className="filters-row"
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '15px',
            }}
          >
            <div style={{ flex: '0 0 140px' }}>
              <Select
                options={[
                  { value: '', label: 'All Branches' },
                  ...branches.map((b: any) => ({ value: b.id, label: b.name })),
                ]}
                value={
                  selectedBranch
                    ? {
                        value: selectedBranch,
                        label:
                          branches.find((b: any) => b.id === selectedBranch)?.name ||
                          'All Branches',
                      }
                    : null
                }
                onChange={(option: any) => {
                  setLoading(true)
                  setSelectedBranch(option?.value || '')
                }}
                styles={customStyles}
                placeholder="All Branches"
                isClearable={true}
              />
            </div>

            <div style={{ flex: '0 0 140px' }}>
              <Select
                options={[
                  { value: '', label: 'Departments' },
                  ...departments.map((d: any) => ({ value: d.id, label: d.name })),
                ]}
                value={
                  selectedDept
                    ? {
                        value: selectedDept,
                        label:
                          departments.find((d: any) => d.id === selectedDept)?.name ||
                          'Departments',
                      }
                    : null
                }
                onChange={(option: any) => setSelectedDept(option?.value || '')}
                styles={customStyles}
                placeholder="Departments"
                isClearable={true}
              />
            </div>

            <div style={{ flex: '0 0 140px' }}>
              <Select
                options={[
                  { value: '', label: 'All Categories' },
                  ...filteredCategories.map((c: any) => ({ value: c.id, label: c.name })),
                ]}
                value={
                  selectedCat
                    ? {
                        value: selectedCat,
                        label:
                          filteredCategories.find((c: any) => c.id === selectedCat)?.name ||
                          'All Categories',
                      }
                    : null
                }
                onChange={(option: any) => setSelectedCat(option?.value || '')}
                styles={customStyles}
                placeholder="All Categories"
                isClearable={true}
              />
            </div>

            <div style={{ flex: '0 0 140px' }}>
              <Select
                options={[
                  { value: '', label: 'All Products' },
                  ...filteredProducts.map((p: any) => ({ value: p.id, label: p.name })),
                ]}
                value={
                  selectedProd
                    ? {
                        value: selectedProd,
                        label:
                          filteredProducts.find((p: any) => p.id === selectedProd)?.name ||
                          'All Products',
                      }
                    : null
                }
                onChange={(option: any) => setSelectedProd(option?.value || '')}
                styles={customStyles}
                placeholder="All Products"
                isClearable={true}
              />
            </div>

            <div style={{ flex: '0 0 140px' }}>
              <Select
                options={[{ value: '', label: 'All Status' }, ...statusOptions]}
                value={
                  selectedStatus ? statusOptions.find((opt) => opt.value === selectedStatus) : null
                }
                onChange={(option: any) => setSelectedStatus(option?.value || '')}
                styles={customStyles}
                placeholder="All Status"
                isClearable={true}
              />
            </div>
          </div>

          <div className="table-container details-table">
            <table className="report-table">
              {/* thead removed as per request to move headers inside body */}
              <tbody>
                {/* Invoice Number Row (Only when Branch Filter is active) */}
                {selectedBranch && data?.invoiceNumbers && data.invoiceNumbers.length > 0 && (
                  <tr style={{ backgroundColor: '#18181b' }}>
                    <td
                      colSpan={8}
                      style={{
                        padding: '12px',
                        fontWeight: '700',
                        color: '#d4d4d8',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #3f3f46',
                      }}
                    >
                      {(() => {
                        const invoices = data.invoiceNumbers || []
                        const firstEntry = invoices[0]
                        const firstInvoice = firstEntry?.invoice || ''
                        const parts = firstInvoice.split('-')
                        const branchCode = parts.length >= 4 ? parts[0] : ''

                        // If we have a branch code, display it and chips.
                        if (branchCode) {
                          if (loading) {
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#a1a1aa', fontStyle: 'italic' }}>
                                  Loading invoices...
                                </span>
                              </div>
                            )
                          }
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#a1a1aa', fontWeight: '800' }}>
                                {branchCode}
                              </span>
                              <span style={{ color: '#a1a1aa' }}>INVOICE:</span>
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {invoices.map((entry) => {
                                  const invString = entry.invoice
                                  const seq = invString.split('-').pop()
                                  // Live = Red (#ef4444), Stock = Green (#22c55e)
                                  const chipColor = entry.isLive ? '#ef4444' : '#22c55e'
                                  const isSelected = selectedInvoice === invString
                                  const textColor = '#ffffff'

                                  const timeString = entry.createdAt
                                    ? new Date(entry.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                      })
                                    : ''

                                  return (
                                    <span
                                      key={invString}
                                      onClick={() =>
                                        setSelectedInvoice((prev) =>
                                          prev === invString ? '' : invString,
                                        )
                                      }
                                      style={{
                                        backgroundColor: chipColor,
                                        color: textColor,
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        letterSpacing: '0.5px',
                                        cursor: 'pointer',
                                        border: isSelected ? '2px solid #ffffff' : 'none',
                                        outline: isSelected ? '2px solid #3b82f6' : 'none',
                                        transform: isSelected ? 'scale(1.1)' : 'none',
                                        transition: 'all 0.1s ease',
                                        boxShadow: isSelected
                                          ? '0 0 0 2px rgba(255, 255, 255, 0.4)'
                                          : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      {seq}
                                      {timeString && (
                                        <>
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{ opacity: 0.9 }}
                                          >
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                          </svg>
                                          <span style={{ fontSize: '11px', opacity: 0.95 }}>
                                            {timeString}
                                          </span>
                                        </>
                                      )}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }

                        // Fallback (for old format)
                        return (
                          <>
                            <span style={{ color: '#a1a1aa', marginRight: '8px' }}>INVOICE:</span>
                            <span style={{ color: '#ffffff', letterSpacing: '0.5px' }}>
                              {invoices.map((i) => i.invoice).join(', ')}
                            </span>
                          </>
                        )
                      })()}
                    </td>
                  </tr>
                )}

                {Object.entries(groupedDetails).map(([dept, categories]) => {
                  // Calculate Department Totals
                  const deptItems = Object.values(categories).flat()
                  const filteredDeptItems = selectedInvoice
                    ? deptItems.filter((i) => i.invoiceNumber === selectedInvoice)
                    : deptItems

                  const deptOrdTotal = filteredDeptItems.reduce(
                    (sum, item) => sum + item.ordQty * item.price,
                    0,
                  )
                  const deptSntTotal = filteredDeptItems.reduce(
                    (sum, item) => sum + item.sntQty * item.price,
                    0,
                  )
                  const deptConTotal = filteredDeptItems.reduce(
                    (sum, item) => sum + item.conQty * item.price,
                    0,
                  )
                  const deptPicTotal = filteredDeptItems.reduce(
                    (sum, item) => sum + item.picQty * item.price,
                    0,
                  )
                  const deptRecTotal = filteredDeptItems.reduce(
                    (sum, item) => sum + item.recQty * item.price,
                    0,
                  )
                  const deptDifTotal = filteredDeptItems.reduce(
                    (sum, item) => sum + item.difQty * item.price,
                    0,
                  )

                  // Don't render dept if empty after filter? (Optional, but user might want to see empty headers)
                  // If "All Branches" and filter hides everything, maybe hide dept.
                  if (filteredDeptItems.length === 0) return null

                  return (
                    <React.Fragment key={dept}>
                      {/* Department Header Row */}
                      <tr style={{ backgroundColor: '#18181b' }}>
                        <td
                          colSpan={8}
                          style={{
                            padding: '10px 12px',
                            fontWeight: '800',
                            color: '#fbbf24',
                            fontSize: '14px',
                            textAlign: 'left',
                            letterSpacing: '1px',
                            borderTop: '1px solid #3f3f46',
                            borderBottom: '1px solid #3f3f46',
                            textTransform: 'uppercase',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>{dept}</span>
                            <span
                              style={{
                                fontSize: '12px',
                                color: '#fbbf24',
                                fontWeight: '600',
                                letterSpacing: '0.5px',
                              }}
                            >
                              ORD: {deptOrdTotal.toLocaleString('en-IN')} | SNT:{' '}
                              {deptSntTotal.toLocaleString('en-IN')} | CON:{' '}
                              {deptConTotal.toLocaleString('en-IN')} | PIC:{' '}
                              {deptPicTotal.toLocaleString('en-IN')} | REC:{' '}
                              {deptRecTotal.toLocaleString('en-IN')} | DIF:{' '}
                              {deptDifTotal.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {Object.entries(categories).map(([category, items]) => {
                        // --- Client-side Invoice Filtering ---
                        const filteredItems = selectedInvoice
                          ? items.filter((item) => item.invoiceNumber === selectedInvoice)
                          : items

                        if (filteredItems.length === 0) return null

                        const catOrdTotal = filteredItems.reduce(
                          (sum, item) => sum + item.ordQty * item.price,
                          0,
                        )
                        const catSntTotal = filteredItems.reduce(
                          (sum, item) => sum + item.sntQty * item.price,
                          0,
                        )
                        const catConTotal = filteredItems.reduce(
                          (sum, item) => sum + item.conQty * item.price,
                          0,
                        )
                        const catPicTotal = filteredItems.reduce(
                          (sum, item) => sum + item.picQty * item.price,
                          0,
                        )
                        const catRecTotal = filteredItems.reduce(
                          (sum, item) => sum + item.recQty * item.price,
                          0,
                        )
                        const catDifTotal = filteredItems.reduce(
                          (sum, item) => sum + item.difQty * item.price,
                          0,
                        )

                        return (
                          <React.Fragment key={category}>
                            {/* Category Header Row */}
                            <tr style={{ backgroundColor: '#27272a' }}>
                              <td
                                colSpan={8}
                                style={{
                                  padding: '8px 12px',
                                  fontWeight: 'bold',
                                  color: '#38bdf8',
                                  fontSize: '14px',
                                  textAlign: 'left',
                                  letterSpacing: '0.5px',
                                  borderTop: '1px solid #3f3f46',
                                  borderBottom: '1px solid #3f3f46',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span>{category}</span>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      color: '#38bdf8',
                                      fontWeight: '500',
                                    }}
                                  >
                                    ORD: {catOrdTotal.toLocaleString('en-IN')} | SNT:{' '}
                                    {catSntTotal.toLocaleString('en-IN')} | CON:{' '}
                                    {catConTotal.toLocaleString('en-IN')} | PIC:{' '}
                                    {catPicTotal.toLocaleString('en-IN')} | REC:{' '}
                                    {catRecTotal.toLocaleString('en-IN')} | DIF:{' '}
                                    {catDifTotal.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Column Sub-headers */}
                            <tr
                              style={{
                                backgroundColor: '#202022',
                                borderBottom: '1px solid #3f3f46',
                              }}
                            >
                              <th
                                style={{
                                  width: '180px',
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  fontSize: '11px',
                                  color: '#a1a1aa',
                                  fontWeight: '600',
                                }}
                              >
                                PRODUCT NAME
                              </th>
                              <th
                                style={{
                                  width: '75px',
                                  textAlign: 'right',
                                  padding: '8px',
                                  fontSize: '11px',
                                  color: '#a1a1aa',
                                  fontWeight: '600',
                                }}
                              >
                                PRC
                              </th>
                              <th
                                style={{
                                  width: '75px',
                                  textAlign: 'center',
                                  padding: '8px',
                                  fontSize: '11px',
                                  color: '#a1a1aa',
                                  fontWeight: '600',
                                }}
                              >
                                ORD
                              </th>
                              <th
                                style={{
                                  width: '75px',
                                  textAlign: 'center',
                                  padding: '8px',
                                  fontSize: '11px',
                                  color: '#a1a1aa',
                                  fontWeight: '600',
                                }}
                              >
                                SNT
                              </th>
                              <th
                                style={{
                                  width: '75px',
                                  textAlign: 'center',
                                  padding: '8px',
                                  fontSize: '11px',
                                  color: '#a1a1aa',
                                  fontWeight: '600',
                                }}
                              >
                                CON
                              </th>
                              <th
                                style={{
                                  width: '75px',
                                  textAlign: 'center',
                                  padding: '8px',
                                  fontSize: '11px',
                                  color: '#a1a1aa',
                                  fontWeight: '600',
                                }}
                              >
                                PIC
                              </th>
                              <th
                                style={{
                                  width: '75px',
                                  textAlign: 'center',
                                  padding: '8px',
                                  fontSize: '11px',
                                  color: '#a1a1aa',
                                  fontWeight: '600',
                                }}
                              >
                                REC
                              </th>
                              <th
                                style={{
                                  width: '75px',
                                  textAlign: 'center',
                                  padding: '8px',
                                  fontSize: '11px',
                                  color: '#a1a1aa',
                                  fontWeight: '600',
                                }}
                              >
                                DIF
                              </th>
                            </tr>

                            {/* Items for this Category */}
                            {/* Items for this Category */}
                            {filteredItems.map((item, idx) => (
                              <tr key={`${dept}-${category}-${idx}`}>
                                <td
                                  style={{
                                    maxWidth: '180px',
                                    whiteSpace: 'normal',
                                    fontSize: '13px',
                                  }}
                                >
                                  <div style={{ fontWeight: 500 }}>{item.productName}</div>
                                  <div
                                    style={{
                                      fontSize: '0.8em',
                                      color: 'var(--theme-elevation-400)',
                                    }}
                                  >
                                    {(item.branchDisplay || item.branchName)
                                      .split(',')
                                      .filter(Boolean)
                                      .map((branch, i) => (
                                        <span
                                          key={i}
                                          style={{
                                            display: 'inline-block',
                                            backgroundColor: '#27272a',
                                            padding: '1px 3px',
                                            borderRadius: '3px',
                                            marginRight: '2px',
                                            fontSize: '9px',
                                            fontWeight: '600',
                                            color: '#a1a1aa',
                                            lineHeight: '1',
                                          }}
                                        >
                                          {branch.trim()}
                                        </span>
                                      ))}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontSize: '13px' }}>
                                  {item.price}
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '13px' }}>
                                  <div>{item.ordQty}</div>
                                  <div
                                    style={{
                                      fontSize: '0.75em',
                                      color: 'var(--theme-elevation-450)',
                                    }}
                                  >
                                    {formatTime(item.ordTime)}
                                  </div>
                                </td>

                                <td style={{ textAlign: 'center', fontSize: '13px' }}>
                                  <div>{item.sntQty}</div>
                                  <div
                                    style={{
                                      fontSize: '0.75em',
                                      color: 'var(--theme-elevation-450)',
                                    }}
                                  >
                                    {formatTime(item.sntTime)}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '13px' }}>
                                  <div>{item.conQty}</div>
                                  <div
                                    style={{
                                      fontSize: '0.75em',
                                      color: 'var(--theme-elevation-450)',
                                    }}
                                  >
                                    {formatTime(item.conTime)}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '13px' }}>
                                  <div>{item.picQty}</div>
                                  <div
                                    style={{
                                      fontSize: '0.75em',
                                      color: 'var(--theme-elevation-450)',
                                    }}
                                  >
                                    {formatTime(item.picTime)}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '13px' }}>
                                  <div>{item.recQty}</div>
                                  <div
                                    style={{
                                      fontSize: '0.75em',
                                      color: 'var(--theme-elevation-450)',
                                    }}
                                  >
                                    {formatTime(item.recTime)}
                                  </div>
                                </td>

                                <td
                                  style={{
                                    textAlign: 'center',
                                    color: item.difQty !== 0 ? '#ef4444' : 'inherit',
                                    fontWeight: item.difQty !== 0 ? '600' : 'normal',
                                    fontSize: '13px',
                                  }}
                                >
                                  {item.difQty}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
                {data.details.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockOrderReport
