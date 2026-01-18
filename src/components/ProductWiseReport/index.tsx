'use client'

import React, { useState, useEffect } from 'react'
import './index.scss'

type ReportStats = {
  sNo: number
  productName: string
  price: number
  unit: string
  totalQuantity: number
  totalAmount: number
  branchSales: Record<
    string,
    { amount: number; quantity: number; stockQuantity?: number; returnQuantity?: number }
  >
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

  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [selectedProduct, setSelectedProduct] = useState('all')

  const [showZeroHighlight, setShowZeroHighlight] = useState<boolean>(false)
  const [showTopSaleHighlight, setShowTopSaleHighlight] = useState<boolean>(false)
  const [showLowSaleHighlight, setShowLowSaleHighlight] = useState<boolean>(false)

  const [showExportMenu, setShowExportMenu] = useState(false)

  /* New state for View Type */
  const [viewType, setViewType] = useState<'amount' | 'units'>('amount')

  const viewOptions: { value: 'amount' | 'units'; label: string }[] = [
    { value: 'amount', label: 'Amount' },
    { value: 'units', label: 'Units' },
  ]

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    // Header
    const totalHeader = viewType === 'amount' ? 'TOTAL AMOUNT' : 'TOTAL UNITS'
    csvRows.push(['S.NO', 'PRODUCT', ...data.branchHeaders, totalHeader].join(','))
    // Rows
    data.stats.forEach((row) => {
      const branchValues = data.branchHeaders.map((header) => {
        const val =
          viewType === 'amount'
            ? row.branchSales[header]?.amount || 0
            : row.branchSales[header]?.quantity || 0
        return formatValue(val)
      })

      const totalVal = viewType === 'amount' ? row.totalAmount : row.totalQuantity

      csvRows.push(
        [
          row.sNo,
          `"${row.productName} (${row.price} / ${row.unit})"`, // Combine name and price
          ...branchValues,
          formatValue(totalVal),
        ].join(','),
      )
    })
    // Total Row
    const totalBranchPlaceholders = data.branchHeaders.map((header) => {
      // We need branch totals for Units if view is units.
      // data.totals.branchTotals currently might only be amounts if the backend only sends amounts?
      // Checking schema: ReportData.totals.branchTotals is Record<string, number>.
      // If the backend sums amounts in branchTotals, we might not have unit totals per branch readily available in `totals`.
      // However, `data.stats` has quantity per branch. We can sum it up on the client if needed or check if backend provides it.
      // Looking at types: `branchSales` has { amount, quantity }.
      // `totals.branchTotals` seems to be just one number. Usually amount.
      // Let's assume for now we might need to calculate branch unit totals on the fly if not provided.
      // OR `data.totals.branchTotals` is strictly amount.
      // Let's compute column totals client side for safety in the render loop.
      return '' // Placeholder for CSV export of totals row, sophisticated logic needed if we want it here.
    })

    // Simplified Total Row for CSV (just grand total)
    csvRows.push(
      [
        '',
        'TOTAL',
        ...data.branchHeaders.map(() => ''), // Skip column totals in CSV for now to avoid complexity or calc them.
        formatValue(viewType === 'amount' ? data.totals.totalAmount : data.totals.totalQuantity),
      ].join(','),
    )

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product_report_${viewType}_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
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

  const productOptions = [
    { value: 'all', label: 'All Products' },
    ...products
      .filter((p: any) => {
        if (selectedCategory === 'all') return true
        const pCatId = typeof p.category === 'object' ? p.category?.id : p.category
        return pCatId === selectedCategory
      })
      .map((p) => ({ value: p.id, label: p.name })),
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

  const compactStyles = {
    ...customStyles,
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...customStyles.control(base, state),
      minWidth: '100px',
    }),
    menu: (base: Record<string, unknown>) => ({
      ...customStyles.menu(base),
      minWidth: '100px',
    }),
  }

  // Fetch available branches and categories
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchRes, categoryRes, departmentRes, productRes] = await Promise.all([
          fetch('/api/branches?limit=100&pagination=false'),
          fetch('/api/categories?limit=100&pagination=false'),
          fetch('/api/departments?limit=100&pagination=false'),
          fetch('/api/products?limit=1000&pagination=false'),
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
        if (productRes?.ok) {
          const json = await productRes.json()
          setProducts(json.docs)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchMetadata()
  }, [])

  /* Helper to format date as YYYY-MM-DD using local time to avoid timezone shifts */
  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0') // Month is 0-indexed
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchReport = async (
    start: Date,
    end: Date,
    branchId: string,
    categoryId: string,
    departmentId: string,
    productId: string,
  ) => {
    setLoading(true)
    setError('')
    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const res = await fetch(
        `/api/reports/product-wise?startDate=${startStr}&endDate=${endStr}&branch=${branchId}&category=${categoryId}&department=${departmentId}&product=${productId}`,
      )
      if (!res.ok) throw new Error('Failed to fetch report')
      const json: ReportData = await res.json()

      // Automatically enable zero highlight if there are zero values
      const hasStatsZero = json.stats.some(
        (row) =>
          json.branchHeaders.some((h) => (row.branchSales[h]?.amount || 0) === 0) ||
          row.totalAmount === 0 ||
          row.totalQuantity === 0,
      )

      const hasTotalZero =
        json.totals.totalQuantity === 0 ||
        json.totals.totalAmount === 0 ||
        json.branchHeaders.some((h) => (json.totals.branchTotals[h] || 0) === 0)

      setShowZeroHighlight(hasStatsZero || hasTotalZero)
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
        startDate,
        endDate,
        selectedBranch,
        selectedCategory,
        selectedDepartment,
        selectedProduct,
      )
    }
  }, [startDate, endDate, selectedBranch, selectedCategory, selectedDepartment, selectedProduct])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <h1>Product Wise Report</h1>
          {/* Highlights buttons remain same ... */}
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
          <button
            title="Toggle Top Sale Highlight"
            onClick={() => setShowTopSaleHighlight(!showTopSaleHighlight)}
            style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#006400', // Dark Green
              border: showTopSaleHighlight ? '1px solid #ffffff' : '1px solid #006400',
              cursor: 'pointer',
              padding: 0,
            }}
          />
          <button
            title="Toggle Lowest Sale Highlight"
            onClick={() => setShowLowSaleHighlight(!showLowSaleHighlight)}
            style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#B8860B', // Dark Goldenrod
              border: showLowSaleHighlight ? '1px solid #ffffff' : '1px solid #B8860B',
              cursor: 'pointer',
              padding: 0,
            }}
          />

          {/* Date Picker */}
          <div className="filter-group" style={{ marginLeft: 'auto' }}>
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
                setSelectedProduct('all')
                setViewType('amount') // Reset view type too
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
        <div className="date-filter" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* VIEW TYPE FILTER */}
          <div className="filter-group select-group" style={{ width: '110px' }}>
            <Select
              instanceId="view-select"
              options={viewOptions}
              value={viewOptions.find((o) => o.value === viewType)}
              onChange={(option: { value: 'amount' | 'units'; label: string } | null) =>
                setViewType(option?.value || 'amount')
              }
              styles={compactStyles}
              classNamePrefix="react-select"
              isSearchable={false}
            />
          </div>

          <div className="filter-group select-group">
            <Select
              instanceId="branch-select"
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
              instanceId="department-select"
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
              instanceId="category-select"
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

          <div className="filter-group select-group">
            <Select
              instanceId="product-select"
              options={productOptions}
              value={productOptions.find((o) => o.value === selectedProduct)}
              onChange={(option: { value: string; label: string } | null) =>
                setSelectedProduct(option?.value || 'all')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Product..."
              isSearchable={true}
            />
          </div>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {(() => {
        // Calculate Max and Min per Branch for highlighting
        // We need to calculate these based on the VIEW TYPE
        const maxPerBranch: Record<string, number> = {}
        const minPerBranch: Record<string, number> = {}
        const branchColumnTotals: Record<string, number> = {} // Sales totals
        const branchStockTotals: Record<string, number> = {}
        const branchReturnTotals: Record<string, number> = {}

        if (data) {
          data.branchHeaders.forEach((header) => {
            // Calculate column totals
            let saleSum = 0
            let stockSum = 0
            let returnSum = 0

            data.stats.forEach((row) => {
              const sales = row.branchSales[header] || {
                amount: 0,
                quantity: 0,
                stockQuantity: 0,
                returnQuantity: 0,
              }
              saleSum += viewType === 'amount' ? sales.amount : sales.quantity
              stockSum += sales.stockQuantity || 0
              returnSum += sales.returnQuantity || 0
            })

            branchColumnTotals[header] = saleSum
            branchStockTotals[header] = stockSum
            branchReturnTotals[header] = returnSum

            // Get all values for this branch for stats (highlighting logic based on Sales)
            const values = data.stats.map((row) => {
              const sales = row.branchSales[header] || { amount: 0, quantity: 0 }
              return viewType === 'amount' ? sales.amount : sales.quantity
            })
            const positiveValues = values.filter((v) => v > 0)

            maxPerBranch[header] = values.length > 0 ? Math.max(...values) : 0
            minPerBranch[header] = positiveValues.length > 0 ? Math.min(...positiveValues) : 0
          })
        }

        return (
          data && (
            <div className="table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>S.NO</th>
                    <th>PRODUCT</th>
                    {/* Dynamically render branch headers */}
                    {data.branchHeaders.map((header) => (
                      <th key={header} style={{ textAlign: 'left' }}>
                        {header}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right' }}>
                      {viewType === 'amount' ? 'TOTAL AMOUNT' : 'TOTAL UNITS'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.map((row) => (
                    <tr key={row.sNo}>
                      <td>{row.sNo}</td>
                      <td className="product-name-cell">
                        <span>
                          {row.productName}{' '}
                          <span
                            style={{
                              color: 'var(--theme-elevation-400)',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.unit} {formatValue(row.price)}
                          </span>
                        </span>
                      </td>
                      {/* Dynamically render branch sales cells */}
                      {data.branchHeaders.map((header) => {
                        const sales = row.branchSales[header] || {
                          amount: 0,
                          quantity: 0,
                          stockQuantity: 0,
                        }
                        const value = viewType === 'amount' ? sales.amount : sales.quantity
                        const stockValue = sales.stockQuantity || 0
                        const returnValue = sales.returnQuantity || 0

                        const isZero = value === 0
                        const isTop = row.sNo === 1 && viewType === 'amount' && showTopSaleHighlight
                        const isLow =
                          row.sNo === data.stats.length &&
                          viewType === 'amount' &&
                          showLowSaleHighlight

                        const colTotal = branchColumnTotals[header] || 0
                        const stockTotal = branchStockTotals[header] || 0
                        const returnTotal = branchReturnTotals[header] || 0

                        const percentage =
                          colTotal > 0
                            ? formatValue(Number(((sales.amount / colTotal) * 100).toFixed(2)))
                            : '0'

                        const unitsPct =
                          colTotal > 0
                            ? formatValue(Number(((value / colTotal) * 100).toFixed(2)))
                            : '0'
                        const stockPct =
                          stockTotal > 0
                            ? formatValue(Number(((stockValue / stockTotal) * 100).toFixed(2)))
                            : '0'
                        const returnPct =
                          returnTotal > 0
                            ? formatValue(Number(((returnValue / returnTotal) * 100).toFixed(2)))
                            : '0'

                        const textColor =
                          (showZeroHighlight && isZero) || isTop || isLow ? '#FFFFFF' : undefined

                        return (
                          <td
                            key={header}
                            style={{
                              textAlign: 'left',
                              verticalAlign: 'top',
                              backgroundColor:
                                showZeroHighlight && isZero
                                  ? '#800020'
                                  : isTop
                                    ? '#006400'
                                    : isLow
                                      ? '#B8860B'
                                      : 'inherit',
                              color: textColor || 'inherit',
                            }}
                          >
                            {viewType === 'amount' ? (
                              <>
                                <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>
                                  {formatValue(value)}
                                </div>
                                {value > 0 && (
                                  <div
                                    style={{
                                      fontSize: '0.75rem',
                                      color: textColor || 'var(--theme-elevation-400)',
                                      marginTop: '2px',
                                    }}
                                  >
                                    {percentage}%
                                  </div>
                                )}
                              </>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: '0.8rem',
                                  lineHeight: 1.2,
                                }}
                              >
                                {/* Stock (Received) */}
                                {stockValue > 0 && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: '#FA8603',
                                        fontWeight: 'bold',
                                        fontSize: '22px',
                                      }}
                                      title="Stock Received"
                                    >
                                      {formatValue(stockValue)}
                                    </span>
                                    <span
                                      style={{
                                        color: textColor || 'var(--theme-elevation-400)',
                                        fontSize: '12px',
                                      }}
                                    >
                                      {stockPct}%
                                    </span>
                                  </div>
                                )}
                                {/* Sold */}
                                {value > 0 && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: textColor || '#53fd68',
                                        fontSize: '22px',
                                        fontWeight: '600',
                                      }}
                                      title="Units Sold"
                                    >
                                      {formatValue(value)}
                                    </span>
                                    <span
                                      style={{
                                        color: textColor || 'var(--theme-elevation-400)',
                                        fontSize: '12px',
                                      }}
                                    >
                                      {unitsPct}%
                                    </span>
                                  </div>
                                )}
                                {/* Return */}
                                {returnValue > 0 && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: textColor || '#ef4444',
                                        fontSize: '22px',
                                        fontWeight: '600',
                                      }}
                                      title="Units Returned"
                                    >
                                      {formatValue(returnValue)}
                                    </span>
                                    <span
                                      style={{
                                        color: textColor || 'var(--theme-elevation-400)',
                                        fontSize: '12px',
                                      }}
                                    >
                                      {returnPct}%
                                    </span>
                                  </div>
                                )}
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
                          backgroundColor:
                            showZeroHighlight &&
                            (viewType === 'amount' ? row.totalAmount : row.totalQuantity) === 0
                              ? '#800020'
                              : 'inherit',
                          color:
                            showZeroHighlight &&
                            (viewType === 'amount' ? row.totalAmount : row.totalQuantity) === 0
                              ? '#FFFFFF'
                              : 'inherit',
                        }}
                      >
                        {formatValue(viewType === 'amount' ? row.totalAmount : row.totalQuantity)}
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
                      const val = branchColumnTotals[header] || 0
                      const isZero = val === 0
                      return (
                        <td
                          key={header}
                          style={{
                            textAlign: 'left',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            backgroundColor: showZeroHighlight && isZero ? '#800020' : 'inherit',
                            color: showZeroHighlight && isZero ? '#FFFFFF' : 'inherit',
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
                        backgroundColor:
                          showZeroHighlight &&
                          (viewType === 'amount'
                            ? data.totals.totalAmount
                            : data.totals.totalQuantity) === 0
                            ? '#800020'
                            : 'inherit',
                        color:
                          showZeroHighlight &&
                          (viewType === 'amount'
                            ? data.totals.totalAmount
                            : data.totals.totalQuantity) === 0
                            ? '#FFFFFF'
                            : 'inherit',
                      }}
                    >
                      <strong>
                        {formatValue(
                          viewType === 'amount'
                            ? data.totals.totalAmount
                            : data.totals.totalQuantity,
                        )}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )
      })()}
    </div>
  )
}

export default ProductWiseReport
