'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, X, Search } from 'lucide-react'
import StockOrderGraph from './StockOrderGraph'
import './index.scss'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select from 'react-select'

const formatTime = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

const getStatusColor = (currentQty: number, targetQty: number, currentTime?: string) => {
  if (currentQty > targetQty) return '#FA8603'
  if (currentQty < targetQty && currentTime) return '#ef4444'
  if (currentTime) return '#53fd68'
  return undefined
}
const getDifColor = (val: number) => {
  if (val < 0) return '#FA8603'
  if (val > 0) return '#ef4444'
  return '#53fd68'
}

const getStatusCellStyle = (currentQty: number, targetQty: number, currentTime?: string) => {
  return { backgroundColor: 'transparent', color: 'inherit' }
}

const getStatusQtyStyle = (currentQty: number, targetQty: number, currentTime?: string) => {
  const color = getStatusColor(currentQty, targetQty, currentTime)
  return {
    fontWeight: '700',
    fontSize: '22px',
    color: color || 'inherit',
  }
}

const getStatusTimeStyle = (currentQty: number, targetQty: number, currentTime?: string) => {
  return {
    color: 'var(--theme-elevation-450)',
  }
}

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
  invoiceNumbers?: Array<{
    invoice: string
    isLive: boolean
    createdAt?: string
    deliveryDate?: string
  }>
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
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<DetailItem | null>(null)
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
  // Group Details by Department -> Category
  const groupedDetails = React.useMemo(() => {
    if (!data?.details) return {}

    let processedItems: DetailItem[] = []

    if (selectedInvoice) {
      // If invoice selected, show only items for that invoice
      processedItems = data.details.filter((item) => item.invoiceNumber === selectedInvoice)
    } else {
      // If NO invoice selected, Aggregate duplicates (same product in multiple invoices)
      const aggregationMap = new Map<string, DetailItem>()

      const mergeBranchDisplays = (d1: string | undefined, d2: string | undefined) => {
        const map = new Map<string, number>()
        const parse = (str: string | undefined) => {
          if (!str) return
          str.split(',').forEach((part) => {
            const [code, qty] = part.split('-').map((s) => s.trim())
            if (code && qty) map.set(code, (map.get(code) || 0) + parseInt(qty, 10))
          })
        }
        parse(d1)
        parse(d2)
        return Array.from(map.entries())
          .map(([code, qty]) => `${code} - ${qty}`)
          .join(',')
      }

      data.details.forEach((item) => {
        const key = `${item.departmentName}||${item.categoryName}||${item.productName}`

        if (!aggregationMap.has(key)) {
          aggregationMap.set(key, { ...item })
        } else {
          const existing = aggregationMap.get(key)!
          // Sum Quantities
          existing.ordQty += item.ordQty
          existing.sntQty += item.sntQty
          existing.conQty += item.conQty
          existing.picQty += item.picQty
          existing.recQty += item.recQty
          existing.difQty += item.difQty

          // Max Times
          const getMaxTime = (t1?: string, t2?: string) => {
            if (!t1) return t2
            if (!t2) return t1
            return t1 > t2 ? t1 : t2
          }
          existing.ordTime = getMaxTime(existing.ordTime, item.ordTime)
          existing.sntTime = getMaxTime(existing.sntTime, item.sntTime)
          existing.conTime = getMaxTime(existing.conTime, item.conTime)
          existing.picTime = getMaxTime(existing.picTime, item.picTime)
          existing.recTime = getMaxTime(existing.recTime, item.recTime)

          // Merge Branch Display
          existing.branchDisplay = mergeBranchDisplays(existing.branchDisplay, item.branchDisplay)
        }
      })
      processedItems = Array.from(aggregationMap.values())
    }

    return processedItems.reduce(
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
  }, [data?.details, selectedInvoice])

  const invoiceList = React.useMemo(() => {
    if (!data?.invoiceNumbers) return []

    // 1. Calculate Amount per Invoice
    const amounts = new Map<string, number>()
    if (data.details) {
      data.details.forEach((item) => {
        if (item.invoiceNumber) {
          amounts.set(
            item.invoiceNumber,
            (amounts.get(item.invoiceNumber) || 0) + item.price * item.ordQty,
          )
        }
      })
    }

    // 2. Filter & Map
    return data.invoiceNumbers
      .filter((inv) => {
        if (!selectedOrderType) return true
        if (selectedOrderType === 'stock') return !inv.isLive
        if (selectedOrderType === 'live') return inv.isLive
        return true
      })
      .map((inv) => ({
        ...inv,
        amount: amounts.get(inv.invoice) || 0,
      }))
  }, [data?.invoiceNumbers, data?.details, selectedOrderType])

  const formatCardDate = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${dd}.${mm}.${yy}- ${time.replace(':', '.')}`
  }

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
          <div
            className="filters-row"
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '15px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: '#18181b', // Dark background for sticky header
              paddingTop: '10px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--theme-elevation-200)',
            }}
          >
            <div style={{ flex: '0 0 140px' }}>
              <Select
                options={[
                  { value: '', label: 'All Orders' },
                  { value: 'stock', label: 'Stock Orders' },
                  { value: 'live', label: 'Live Orders' },
                ]}
                value={
                  selectedOrderType
                    ? {
                        value: selectedOrderType,
                        label: selectedOrderType === 'stock' ? 'Stock Orders' : 'Live Orders',
                      }
                    : { value: '', label: 'All Orders' }
                }
                onChange={(opt: any) => setSelectedOrderType(opt?.value || '')}
                styles={customStyles}
                isSearchable={false}
              />
            </div>
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
          <div className="report-body">
            {/* Sidebar */}
            <div className="report-sidebar">
              <div className="order-list">
                {invoiceList.map((inv) => (
                  <div
                    key={inv.invoice}
                    className={`order-card ${selectedInvoice === inv.invoice ? 'active' : ''}`}
                    onClick={() =>
                      setSelectedInvoice((prev) => (prev === inv.invoice ? '' : inv.invoice))
                    }
                  >
                    <div className="card-header">
                      <h4>{inv.invoice}</h4>
                    </div>
                    <div className="card-row">
                      <span className="value">Ord: {formatCardDate(inv.createdAt)}</span>
                    </div>
                    <div className="card-row">
                      <span className="value">
                        Del: {formatCardDate(inv.deliveryDate) || 'N/A'}
                      </span>
                    </div>
                    <div className="card-row amount">
                      <span className="value" style={{ color: '#D8E4BC' }}>
                        Amt: ₹ {(inv.amount ?? 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
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
                    <tr
                      style={{
                        backgroundColor: 'var(--theme-elevation-100)',
                        fontWeight: 'bold',
                      }}
                    >
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

              <div style={{ marginBottom: '20px', marginTop: '30px' }}>
                <StockOrderGraph
                  items={
                    selectedInvoice
                      ? data.details.filter((item) => item.invoiceNumber === selectedInvoice)
                      : data.details
                  }
                />
              </div>

              <div
                className="table-title"
                style={{
                  marginTop: '10px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                }}
              >
                <h3 style={{ margin: 0 }}>Product Order Details</h3>
              </div>

              <div className="table-container details-table">
                <table className="report-table">
                  <tbody>
                    {Object.entries(groupedDetails).map(([dept, categories]) => {
                      // Calculate Department Totals
                      const deptItems = Object.values(categories).flat()
                      // Items are already processed
                      const filteredDeptItems = deptItems

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
                            // Items are already processed in groupedDetails
                            const filteredItems = items

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
                                  <tr
                                    key={`${dept}-${category}-${idx}`}
                                    onClick={() =>
                                      !selectedInvoice && setSelectedDetailProduct(item)
                                    }
                                    style={{ cursor: !selectedInvoice ? 'pointer' : 'default' }}
                                  >
                                    <td
                                      style={{
                                        maxWidth: '180px',
                                        whiteSpace: 'normal',
                                        fontSize: '16px',
                                        padding: '12px 8px',
                                      }}
                                    >
                                      <div style={{ fontWeight: 700 }}>{item.productName}</div>
                                    </td>

                                    <td
                                      style={{
                                        textAlign: 'right',
                                        fontSize: '13px',
                                        padding: '12px 8px',
                                      }}
                                    >
                                      {item.price}
                                    </td>
                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '13px',
                                        padding: '12px 8px',
                                      }}
                                    >
                                      <div style={{ fontWeight: '700', fontSize: '22px' }}>
                                        {item.ordQty}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: '600',
                                          color: 'var(--theme-elevation-450)',
                                        }}
                                      >
                                        {formatTime(item.ordTime)}
                                      </div>
                                    </td>

                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '13px',
                                        padding: '12px 8px',
                                        ...getStatusCellStyle(
                                          item.sntQty,
                                          item.ordQty,
                                          item.sntTime,
                                        ),
                                      }}
                                    >
                                      <div
                                        style={{
                                          ...getStatusQtyStyle(
                                            item.sntQty,
                                            item.ordQty,
                                            item.sntTime,
                                          ),
                                        }}
                                      >
                                        {item.sntQty}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: '600',
                                          ...getStatusTimeStyle(
                                            item.sntQty,
                                            item.ordQty,
                                            item.sntTime,
                                          ),
                                        }}
                                      >
                                        {formatTime(item.sntTime)}
                                      </div>
                                    </td>
                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '13px',
                                        padding: '12px 8px',
                                        ...getStatusCellStyle(
                                          item.conQty,
                                          item.sntQty,
                                          item.conTime,
                                        ),
                                      }}
                                    >
                                      <div
                                        style={{
                                          ...getStatusQtyStyle(
                                            item.conQty,
                                            item.sntQty,
                                            item.conTime,
                                          ),
                                        }}
                                      >
                                        {item.conQty}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: '600',
                                          ...getStatusTimeStyle(
                                            item.conQty,
                                            item.sntQty,
                                            item.conTime,
                                          ),
                                        }}
                                      >
                                        {formatTime(item.conTime)}
                                      </div>
                                    </td>
                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '13px',
                                        padding: '12px 8px',
                                        ...getStatusCellStyle(
                                          item.picQty,
                                          item.conQty,
                                          item.picTime,
                                        ),
                                      }}
                                    >
                                      <div
                                        style={{
                                          ...getStatusQtyStyle(
                                            item.picQty,
                                            item.conQty,
                                            item.picTime,
                                          ),
                                        }}
                                      >
                                        {item.picQty}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: '600',
                                          ...getStatusTimeStyle(
                                            item.picQty,
                                            item.conQty,
                                            item.picTime,
                                          ),
                                        }}
                                      >
                                        {formatTime(item.picTime)}
                                      </div>
                                    </td>
                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '13px',
                                        padding: '12px 8px',
                                        ...getStatusCellStyle(
                                          item.recQty,
                                          item.picQty,
                                          item.recTime,
                                        ),
                                      }}
                                    >
                                      <div
                                        style={{
                                          ...getStatusQtyStyle(
                                            item.recQty,
                                            item.picQty,
                                            item.recTime,
                                          ),
                                        }}
                                      >
                                        {item.recQty}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: '600',
                                          ...getStatusTimeStyle(
                                            item.recQty,
                                            item.picQty,
                                            item.recTime,
                                          ),
                                        }}
                                      >
                                        {formatTime(item.recTime)}
                                      </div>
                                    </td>

                                    <td
                                      style={{
                                        textAlign: 'center',
                                        color: getDifColor(item.difQty),
                                        fontWeight: item.difQty !== 0 ? '700' : '700',
                                        fontSize: '22px',
                                        padding: '12px 8px',
                                      }}
                                    >
                                      {Math.abs(Number(item.difQty)) % 1 === 0
                                        ? Math.abs(Number(item.difQty)).toFixed(0)
                                        : Math.abs(Number(item.difQty)).toFixed(2)}
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
          </div>
        </div>
      )}
      {selectedDetailProduct && data?.details && (
        <ProductDetailPopup
          product={selectedDetailProduct}
          allDetails={data.details}
          onClose={() => setSelectedDetailProduct(null)}
        />
      )}
    </div>
  )
}

const ProductDetailPopup = ({
  product,
  allDetails,
  onClose,
}: {
  product: DetailItem
  allDetails: DetailItem[]
  onClose: () => void
}) => {
  const branchDetails = allDetails.filter(
    (d) =>
      d.productName === product.productName &&
      d.categoryName === product.categoryName &&
      d.departmentName === product.departmentName,
  )

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-container" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>{product.productName}</h2>
          <button onClick={onClose}>CLOSE</button>
        </div>

        <div className="popup-body">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Branch Name</th>
                <th style={{ textAlign: 'center', width: '60px' }}>PRC</th>
                <th style={{ textAlign: 'center', width: '60px' }}>ORD</th>
                <th style={{ textAlign: 'center', width: '60px' }}>SNT</th>
                <th style={{ textAlign: 'center', width: '60px' }}>CON</th>
                <th style={{ textAlign: 'center', width: '60px' }}>PIC</th>
                <th style={{ textAlign: 'center', width: '60px' }}>REC</th>
                <th style={{ textAlign: 'center', width: '60px' }}>DIF</th>
              </tr>
            </thead>
            <tbody>
              {branchDetails.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <div style={{ fontWeight: 600, padding: '12px 8px' }}>{item.branchName}</div>
                    <div style={{ fontSize: '10px', color: '#a1a1aa', padding: '0 8px' }}>
                      {item.invoiceNumber}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>{item.price}</td>

                  {/* ORD */}
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <div style={{ fontWeight: '700', fontSize: '22px' }}>{item.ordQty}</div>
                    <div style={{ fontSize: '0.75em', color: 'var(--theme-elevation-450)' }}>
                      {formatTime(item.ordTime)}
                    </div>
                  </td>

                  {/* SNT */}
                  <td
                    style={{
                      textAlign: 'center',
                      padding: '12px 8px',
                      ...getStatusCellStyle(item.sntQty, item.ordQty, item.sntTime),
                    }}
                  >
                    <div
                      style={{
                        ...getStatusQtyStyle(item.sntQty, item.ordQty, item.sntTime),
                      }}
                    >
                      {item.sntQty}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        ...getStatusTimeStyle(item.sntQty, item.ordQty, item.sntTime),
                      }}
                    >
                      {formatTime(item.sntTime)}
                    </div>
                  </td>

                  {/* CON */}
                  <td
                    style={{
                      textAlign: 'center',
                      padding: '12px 8px',
                      ...getStatusCellStyle(item.conQty, item.sntQty, item.conTime),
                    }}
                  >
                    <div
                      style={{
                        ...getStatusQtyStyle(item.conQty, item.sntQty, item.conTime),
                      }}
                    >
                      {item.conQty}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        ...getStatusTimeStyle(item.conQty, item.sntQty, item.conTime),
                      }}
                    >
                      {formatTime(item.conTime)}
                    </div>
                  </td>

                  {/* PIC */}
                  <td
                    style={{
                      textAlign: 'center',
                      ...getStatusCellStyle(item.picQty, item.conQty, item.picTime),
                    }}
                  >
                    <div
                      style={{
                        ...getStatusQtyStyle(item.picQty, item.conQty, item.picTime),
                      }}
                    >
                      {item.picQty}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        ...getStatusTimeStyle(item.picQty, item.conQty, item.picTime),
                      }}
                    >
                      {formatTime(item.picTime)}
                    </div>
                  </td>

                  {/* REC */}
                  <td
                    style={{
                      textAlign: 'center',
                      ...getStatusCellStyle(item.recQty, item.picQty, item.recTime),
                    }}
                  >
                    <div
                      style={{
                        ...getStatusQtyStyle(item.recQty, item.picQty, item.recTime),
                      }}
                    >
                      {item.recQty}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        ...getStatusTimeStyle(item.recQty, item.picQty, item.recTime),
                      }}
                    >
                      {formatTime(item.recTime)}
                    </div>
                  </td>

                  <td
                    style={{
                      textAlign: 'center',
                      color: getDifColor(item.difQty),
                      fontWeight: item.difQty !== 0 ? '700' : '700',
                      fontSize: '22px',
                      padding: '12px 8px',
                    }}
                  >
                    {Math.abs(Number(item.difQty)) % 1 === 0
                      ? Math.abs(Number(item.difQty)).toFixed(0)
                      : Math.abs(Number(item.difQty)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default StockOrderReport
