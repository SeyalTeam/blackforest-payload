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
      {hasValue && count > 0 && selected[0].value !== 'all' && !isTyping && (
        <div style={{ paddingLeft: '8px', position: 'absolute', pointerEvents: 'none' }}>
          {count === 1 ? selected[0].label : `${count} Selected`}
        </div>
      )}
      {children}
    </components.ValueContainer>
  )
}

const MultiValue = () => null

const ProductWiseReport: React.FC = () => {
  // Combine start and end date into a single range state for the picker
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string[]>(['all'])

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState('all')

  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string[]>(['all'])

  const [sortBy, setSortBy] = useState<'amount' | 'units'>('amount')

  const [showZeroHighlight, setShowZeroHighlight] = useState<boolean>(false)
  const [showTopSaleHighlight, setShowTopSaleHighlight] = useState<boolean>(false)
  const [showLowSaleHighlight, setShowLowSaleHighlight] = useState<boolean>(false)

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
      ['S.NO', 'PRODUCT', ...data.branchHeaders, 'TOTAL UNITS', 'TOTAL AMOUNT'].join(','),
    )
    // Rows
    data.stats.forEach((row) => {
      const branchValues = data.branchHeaders.map((header) =>
        formatValue(row.branchSales[header]?.amount || 0),
      )
      csvRows.push(
        [
          row.sNo,
          `"${row.productName} (${row.price} / ${row.unit})"`, // Combine name and price
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
    a.download = `product_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
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
        if (selectedCategory.includes('all')) return true
        const pCatId = typeof p.category === 'object' ? p.category?.id : p.category
        return selectedCategory.includes(pCatId)
      })
      .map((p) => ({ value: p.id, label: p.name })),
  ]

  const sortOptions = [
    { value: 'amount', label: 'Amount' },
    { value: 'units', label: 'Units' },
  ]

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
      borderRadius: '8px',
      height: '42px', // Match fixed height of datepicker
      minHeight: '42px',
      width: '200px', // Fixed width
      maxWidth: '200px', // Enforce max width
      padding: '0',
      boxShadow: state.isFocused ? '0 0 0 1px var(--theme-info-500)' : 'none',
      color: 'var(--theme-text-primary)',
      '&:hover': {
        borderColor: 'var(--theme-info-750)',
      },
      flexWrap: 'nowrap' as any, // Prevent wrapping
    }),
    valueContainer: (base: Record<string, unknown>) => ({
      ...base,
      flexWrap: 'nowrap' as any,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
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
    branchIds: string[],
    categoryIds: string[],
    departmentId: string,
    productIds: string[],
  ) => {
    setLoading(true)
    setError('')
    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const branchParam = branchIds.includes('all') ? 'all' : branchIds.join(',')
      const categoryParam = categoryIds.includes('all') ? 'all' : categoryIds.join(',')
      const productParam = productIds.includes('all') ? 'all' : productIds.join(',')
      const res = await fetch(
        `/api/reports/product-wise?startDate=${startStr}&endDate=${endStr}&branch=${branchParam}&category=${categoryParam}&department=${departmentId}&product=${productParam}`,
      )
      if (!res.ok) throw new Error('Failed to fetch report')
      const json: ReportData = await res.json()

      // Automatically enable zero highlight if there are zero values -- REMOVED per user request
      /*
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
      */
      // Default to false now
      setShowZeroHighlight(false)
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

          <div className="filter-group" style={{ marginLeft: 'auto' }}>
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
              popperPlacement="bottom-end"
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
                setSelectedBranch(['all'])
                setSelectedDepartment('all')
                setSelectedDepartment('all')
                setSelectedCategory(['all'])
                setSelectedProduct(['all'])
                setSortBy('amount')
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
        <div className="date-filter">
          <div className="filter-group select-group">
            <Select
              instanceId="sort-select"
              options={sortOptions}
              value={sortOptions.find((o) => o.value === sortBy)}
              onChange={(option: { value: string; label: string } | null) =>
                setSortBy((option?.value as 'amount' | 'units') || 'amount')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Sort By..."
              isSearchable={false}
            />
          </div>

          <div className="filter-group select-group">
            <Select
              instanceId="branch-select"
              options={branchOptions}
              isMulti
              value={branchOptions.filter((o) => selectedBranch.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedBranch.includes('all')
                const hasAll = selected.includes('all')

                let final = selected
                if (hasAll && !wasAll) {
                  final = ['all']
                } else if (hasAll && wasAll && selected.length > 1) {
                  final = selected.filter((x) => x !== 'all')
                } else if (final.length === 0) {
                  final = ['all']
                }
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
              isMulti
              value={categoryOptions.filter((o) => selectedCategory.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedCategory.includes('all')
                const hasAll = selected.includes('all')

                let final = selected
                if (hasAll && !wasAll) {
                  final = ['all']
                } else if (hasAll && wasAll && selected.length > 1) {
                  final = selected.filter((x) => x !== 'all')
                } else if (final.length === 0) {
                  final = ['all']
                }
                setSelectedCategory(final)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Category..."
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
              instanceId="product-select"
              options={productOptions}
              isMulti
              value={productOptions.filter((o) => selectedProduct.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedProduct.includes('all')
                const hasAll = selected.includes('all')

                let final = selected
                if (hasAll && !wasAll) {
                  final = ['all']
                } else if (hasAll && wasAll && selected.length > 1) {
                  final = selected.filter((x) => x !== 'all')
                } else if (final.length === 0) {
                  final = ['all']
                }
                setSelectedProduct(final)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Product..."
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
        </div>
      </div>

      {!selectedCategory.includes('all') && selectedCategory.length > 0 && (
        <div style={{ padding: '0 0 10px 0', marginTop: '-15px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {selectedCategory.map((catId) => {
              const cat = categoryOptions.find((c) => c.value === catId)
              if (!cat) return null
              return (
                <div
                  key={catId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--theme-elevation-150)',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: 'var(--theme-text-primary)',
                    border: '1px solid var(--theme-elevation-200)',
                  }}
                >
                  <span style={{ marginRight: '6px' }}>{cat.label}</span>
                  <button
                    onClick={() => {
                      const newSelected = selectedCategory.filter((id) => id !== catId)
                      setSelectedCategory(newSelected.length > 0 ? newSelected : ['all'])
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--theme-text-secondary)',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                    }}
                    title="Remove category"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {(() => {
        // Calculate Max and Min Branch Sale Amount per Branch
        const maxSalesPerBranch: Record<string, number> = {}
        const minSalesPerBranch: Record<string, number> = {}

        if (data) {
          data.branchHeaders.forEach((header) => {
            // Get all amounts for this branch
            const amounts = data.stats.map((row) => row.branchSales[header]?.amount || 0)
            const positiveAmounts = amounts.filter((a) => a > 0)

            // Max is max of all amounts (or 0 if none)
            maxSalesPerBranch[header] = amounts.length > 0 ? Math.max(...amounts) : 0

            // Min is min of positive amounts (or 0 if none)
            minSalesPerBranch[header] =
              positiveAmounts.length > 0 ? Math.min(...positiveAmounts) : 0
          })
        }

        const sortedStats = data
          ? [...data.stats].sort((a, b) => {
              if (sortBy === 'units') {
                return b.totalQuantity - a.totalQuantity
              }
              return b.totalAmount - a.totalAmount
            })
          : []

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
                    <th style={{ textAlign: 'right' }}>TOTAL UNITS</th>
                    <th style={{ textAlign: 'right' }}>TOTAL AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((row) => (
                    <tr key={row.sNo}>
                      <td>{row.sNo}</td>
                      <td className="product-name-cell">
                        <div>{row.productName}</div>
                        <div className="product-price-unit">
                          {formatValue(row.price)} {row.unit}
                        </div>
                      </td>
                      {/* Dynamically render branch sales cells */}
                      {data.branchHeaders.map((header) => {
                        const sales = row.branchSales[header] || { amount: 0, quantity: 0 }
                        const isZero = sales.amount === 0
                        const isTopSale =
                          showTopSaleHighlight &&
                          selectedBranch.includes('all') &&
                          sales.amount > 0 &&
                          Math.abs(sales.amount - maxSalesPerBranch[header]) < 0.001

                        const isLowSale =
                          showLowSaleHighlight &&
                          selectedBranch.includes('all') &&
                          sales.amount > 0 &&
                          Math.abs(sales.amount - minSalesPerBranch[header]) < 0.001

                        const branchTotal = data.totals.branchTotals[header] || 0
                        const percentage =
                          branchTotal > 0 ? ((sales.amount / branchTotal) * 100).toFixed(2) : '0.00'

                        return (
                          <td
                            key={header}
                            style={{
                              textAlign: 'left',
                              verticalAlign: 'top',
                              backgroundColor:
                                showZeroHighlight && isZero
                                  ? '#800020'
                                  : isTopSale
                                    ? '#006400'
                                    : isLowSale
                                      ? '#B8860B'
                                      : 'inherit',
                              color:
                                (showZeroHighlight && isZero) || isTopSale || isLowSale
                                  ? '#FFFFFF'
                                  : 'inherit',
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>
                              {formatValue(sales.amount)}
                            </div>
                            {(sales.quantity > 0 || sales.amount > 0) && (
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color:
                                    isZero || isTopSale || isLowSale
                                      ? '#FFFFFF'
                                      : 'var(--theme-elevation-400)',
                                  marginTop: '2px',
                                }}
                              >
                                {sales.quantity > 0 && (
                                  <span>{formatValue(sales.quantity)} Units</span>
                                )}
                                {sales.amount > 0 && (
                                  <span style={{ marginLeft: sales.quantity > 0 ? '8px' : '0' }}>
                                    {percentage}%
                                  </span>
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
                            showZeroHighlight && row.totalQuantity === 0 ? '#800020' : 'inherit',
                          color:
                            showZeroHighlight && row.totalQuantity === 0 ? '#FFFFFF' : 'inherit',
                        }}
                      >
                        {formatValue(row.totalQuantity)}
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
                          showZeroHighlight && data.totals.totalQuantity === 0
                            ? '#800020'
                            : 'inherit',
                        color:
                          showZeroHighlight && data.totals.totalQuantity === 0
                            ? '#FFFFFF'
                            : 'inherit',
                      }}
                    >
                      <strong>{formatValue(data.totals.totalQuantity)}</strong>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: '600',
                        fontSize: '1.2rem',
                        backgroundColor:
                          showZeroHighlight && data.totals.totalAmount === 0
                            ? '#800020'
                            : 'inherit',
                        color:
                          showZeroHighlight && data.totals.totalAmount === 0
                            ? '#FFFFFF'
                            : 'inherit',
                      }}
                    >
                      <strong>{formatValue(data.totals.totalAmount)}</strong>
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
