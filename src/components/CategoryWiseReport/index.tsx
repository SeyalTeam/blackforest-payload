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
import './index.scss'
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

// ... existing code ...

const CategoryWiseReport: React.FC = () => {
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

  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)

  const [sortBy, setSortBy] = useState<'amount' | 'units'>('amount')

  const [showZeroHighlight, setShowZeroHighlight] = useState<boolean>(false)
  const [showTopSaleHighlight, setShowTopSaleHighlight] = useState<boolean>(false)
  const [showLowSaleHighlight, setShowLowSaleHighlight] = useState<boolean>(false)

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    // Header
    csvRows.push(
      ['S.NO', 'CATEGORY', ...data.branchHeaders, 'TOTAL UNITS', 'TOTAL AMOUNT'].join(','),
    )
    // Rows
    data.stats.forEach((row) => {
      const branchValues = data.branchHeaders.map((header) =>
        formatValue(row.branchSales[header]?.amount || 0),
      )
      csvRows.push(
        [
          row.sNo,
          `"${row.categoryName}"`, // Quote strings
          ...branchValues,
          formatValue(row.totalQuantity),
          formatValue(row.totalAmount),
        ].join(','),
      )
    })
    // Total Row
    const totalBranchValues = data.branchHeaders.map((header) =>
      formatValue(data.totals.branchTotals[header] || 0),
    )
    csvRows.push(
      [
        '',
        'TOTAL',
        ...totalBranchValues,
        formatValue(data.totals.totalQuantity),
        formatValue(data.totals.totalAmount),
      ].join(','),
    )

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `category_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    a.click()
    setShowExportMenu(false)
  }

  const getQuarterDates = (date: Date) => {
    const currQuarter = Math.floor((date.getMonth() + 3) / 3)
    const prevQuarter = currQuarter - 1
    let startMonth = 0
    let year = date.getFullYear()

    if (prevQuarter === 0) {
      startMonth = 9 // Oct
      year -= 1
    } else {
      startMonth = (prevQuarter - 1) * 3
    }
    const endMonth = startMonth + 2

    // Start of quarter
    const start = new Date(year, startMonth, 1)
    // End of quarter (last day of endMonth)
    const end = new Date(year, endMonth + 1, 0)

    return { start, end }
  }

  const dateRangeOptions = [
    { value: 'till_now', label: 'Till Now' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'last_quarter', label: 'Last Quarter' },
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
      case 'last_quarter':
        const { start: qStart, end: qEnd } = getQuarterDates(today)
        start = qStart
        end = qEnd
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

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ]

  const sortOptions = [
    { value: 'amount', label: 'Amount' },
    { value: 'units', label: 'Units' },
  ]

  const customStyles = {
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
        const [branchRes, deptRes, billRes] = await Promise.all([
          fetch('/api/branches?limit=100&pagination=false'),
          fetch('/api/departments?limit=100&pagination=false'),
          fetch('/api/billings?sort=createdAt&limit=1'),
        ])

        if (branchRes.ok) {
          const json = await branchRes.json()
          setBranches(json.docs)
        }
        if (deptRes.ok) {
          const json = await deptRes.json()
          setDepartments(json.docs)
        }
        // Fetch Categories too
        const catRes = await fetch('/api/categories?limit=100&pagination=false')
        if (catRes.ok) {
          const json = await catRes.json()
          setCategories(json.docs)
        }
        // Set date range from first bill
        // Set first bill date state but default view is Today
        if (billRes.ok) {
          const json = await billRes.json()
          if (json.docs && json.docs.length > 0) {
            const firstDate = new Date(json.docs[0].createdAt)
            setFirstBillDate(firstDate)
          }
        }
        // Set default range to Today
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        setDateRange([today, today])
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
    deptId: string,
  ) => {
    setLoading(true)
    setError('')
    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const branchParam = branchIds.includes('all') ? 'all' : branchIds.join(',')
      const categoryParam = categoryIds.includes('all') ? 'all' : categoryIds.join(',')
      const res = await fetch(
        `/api/reports/category-wise?startDate=${startStr}&endDate=${endStr}&branch=${branchParam}&category=${categoryParam}&department=${deptId}`,
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

  // Sync dateRange changes to backend fetch
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, selectedBranch, selectedCategory, selectedDepartment)
    }
  }, [dateRange, selectedBranch, selectedCategory, selectedDepartment])

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      // split the value "YYYY-MM-DD - YYYY-MM-DD"
      const [start, end] = value ? value.split(' - ') : ['', '']

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref}>
          <span className="date-text">{start}</span>
          <span className="separator">→</span>
          <span className="date-text">{end || start}</span>
          <span
            className="icon"
            onClick={(e) => {
              e.stopPropagation()
              setDateRange([null, null])
            }}
            style={{ cursor: 'pointer' }}
          >
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <h1>Category Wise Report</h1>
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            />
            {/* Export Button */}
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
            {/* Backdrop */}
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
        </div>
        <div className="date-filter">
          <div className="filter-group">
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

          <div className="filter-group">
            <Select
              options={branchOptions}
              isMulti
              value={branchOptions.filter((o) => selectedBranch.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedBranch.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
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

          <div className="filter-group">
            <Select
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              isMulti
              value={[
                { value: 'all', label: 'All Categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ].filter((o) => selectedCategory.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedCategory.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
                else if (final.length === 0) final = ['all']
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

          <div className="filter-group">
            <button
              onClick={() => {
                setDateRange([new Date(), new Date()])
                setSelectedBranch(['all'])
                setSelectedCategory(['all'])
                setSelectedDepartment('all')
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
      </div>

      {!selectedCategory.includes('all') && selectedCategory.length > 0 && (
        <div style={{ padding: '0 0 10px 0', marginTop: '-15px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {selectedCategory.map((catId) => {
              const cat = categories.find((c) => c.id === catId)
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
                  <span style={{ marginRight: '6px' }}>{cat.name}</span>
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
                    <th style={{ width: '180px', maxWidth: '180px', whiteSpace: 'normal' }}>
                      CATEGORY
                    </th>
                    {/* Dynamically render branch headers */}
                    {data.branchHeaders.map((header) => (
                      <th key={header} style={{ textAlign: 'center' }}>
                        {header}
                      </th>
                    ))}
                    <th
                      style={{
                        textAlign: 'center',
                      }}
                    >
                      TOTAL UNITS
                    </th>
                    <th style={{ textAlign: 'center' }}>TOTAL AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((row) => (
                    <tr key={row.sNo}>
                      <td>{row.sNo}</td>
                      <td
                        style={{ whiteSpace: 'normal', cursor: 'pointer' }}
                        onClick={() => {
                          setExpandedCategory(
                            expandedCategory === row.categoryName ? null : row.categoryName,
                          )
                        }}
                      >
                        {row.categoryName}
                      </td>
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

                        const isUnitsSort = sortBy === 'units'
                        const numValue = isUnitsSort ? sales.quantity : sales.amount
                        const mainValue = numValue === 0 ? '' : formatValue(numValue)

                        const subValue = isUnitsSort
                          ? `₹${formatValue(sales.amount)}`
                          : `${formatValue(sales.quantity)} Units`

                        const isExpanded = expandedCategory === row.categoryName

                        return (
                          <td
                            key={header}
                            style={{
                              textAlign: 'center',
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
                              cursor:
                                sales.quantity > 0 || sales.amount > 0 ? 'pointer' : 'default',
                            }}
                            onClick={() => {
                              setExpandedCategory(
                                expandedCategory === row.categoryName ? null : row.categoryName,
                              )
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{mainValue}</div>
                            {isExpanded && (sales.quantity > 0 || sales.amount > 0) && (
                              <div
                                style={{
                                  fontSize: '0.85rem',
                                  color:
                                    isZero || isTopSale || isLowSale
                                      ? '#FFFFFF'
                                      : 'var(--theme-elevation-400)',
                                  marginTop: '4px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                <div>{subValue}</div>
                                {sales.amount > 0 && <div>{percentage}%</div>}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '1.2rem',
                          backgroundColor:
                            showZeroHighlight && row.totalQuantity === 0 ? '#800020' : 'inherit',
                          color:
                            showZeroHighlight && row.totalQuantity === 0 ? '#FFFFFF' : 'inherit',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setExpandedCategory(
                            expandedCategory === row.categoryName ? null : row.categoryName,
                          )
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>
                          {row.totalQuantity === 0 ? '' : formatValue(row.totalQuantity)}
                        </div>
                        {expandedCategory === row.categoryName && row.totalQuantity > 0 && (
                          <div
                            style={{
                              fontSize: '0.85rem',
                              color: 'var(--theme-elevation-400)',
                              marginTop: '4px',
                            }}
                          >
                            {((row.totalQuantity / data.totals.totalQuantity) * 100).toFixed(2)}%
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '1.2rem',
                          backgroundColor:
                            showZeroHighlight && row.totalAmount === 0 ? '#800020' : 'inherit',
                          color: showZeroHighlight && row.totalAmount === 0 ? '#FFFFFF' : 'inherit',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setExpandedCategory(
                            expandedCategory === row.categoryName ? null : row.categoryName,
                          )
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>
                          {row.totalAmount === 0 ? '' : formatValue(row.totalAmount)}
                        </div>
                        {expandedCategory === row.categoryName && row.totalAmount > 0 && (
                          <div
                            style={{
                              fontSize: '0.85rem',
                              color: 'var(--theme-elevation-400)',
                              marginTop: '4px',
                            }}
                          >
                            {((row.totalAmount / data.totals.totalAmount) * 100).toFixed(2)}%
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td colSpan={2}>
                      <strong>TOTAL</strong>
                    </td>
                    {/* Branch Totals */}
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
                          {val === 0 ? '' : formatValue(val)}
                        </td>
                      )
                    })}
                    <td
                      style={{
                        textAlign: 'center',
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
                      {data.totals.totalQuantity === 0
                        ? ''
                        : formatValue(data.totals.totalQuantity)}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
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
                      {data.totals.totalAmount === 0 ? '' : formatValue(data.totals.totalAmount)}
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

export default CategoryWiseReport
