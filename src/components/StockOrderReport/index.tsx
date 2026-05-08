'use client'

import React, { useState, useEffect } from 'react'
import {
  ChevronDown as _ChevronDown,
  ChevronRight as _ChevronRight,
  X as _X,
  Search as _Search,
} from 'lucide-react'
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

const formatQty = (val: number) => {
  const n = Number(val)
  if (Math.abs(n) % 1 === 0) return n.toFixed(0)
  return n.toFixed(2)
}

const formatUpdaterName = (name?: string) => {
  if (!name) return 'N/A'
  const trimmed = name.trim()
  return trimmed || 'N/A'
}

const getSummaryAmountFontSize = (formattedAmount: string) => {
  const len = formattedAmount.length
  if (len <= 8) return 'clamp(2.3rem, 2.8vw, 3rem)'
  if (len <= 10) return 'clamp(2rem, 2.5vw, 2.6rem)'
  if (len <= 12) return 'clamp(1.7rem, 2.2vw, 2.2rem)'
  if (len <= 14) return 'clamp(1.45rem, 2vw, 1.9rem)'
  return 'clamp(1.2rem, 1.7vw, 1.6rem)'
}

const getSummaryRefFontSize = (formattedAmount: string) => {
  const len = formattedAmount.length
  if (len <= 10) return '0.9rem'
  if (len <= 12) return '0.85rem'
  if (len <= 14) return '0.8rem'
  return '0.76rem'
}

const getStatusColor = (currentQty: number, targetQty: number, currentTime?: string) => {
  if (currentQty > targetQty) return '#FA8603'
  if (currentQty < targetQty && currentTime) return '#ef4444'
  if (currentTime) return '#a856f6'
  return undefined
}
const getDifColor = (val: number) => {
  if (val < 0) return '#FA8603'
  if (val > 0) return '#ef4444'
  return '#a856f6'
}

const getStatusCellStyle = (_currentQty: number, _targetQty: number, _currentTime?: string) => {
  return { backgroundColor: 'transparent', color: 'inherit' }
}

const getStatusQtyStyle = (currentQty: number, targetQty: number, currentTime?: string) => {
  const color = getStatusColor(currentQty, targetQty, currentTime)
  return {
    fontWeight: '700',
    fontSize: '1.2rem',
    color: color || 'inherit',
  }
}

const getStatusTimeStyle = (_currentQty: number, _targetQty: number, _currentTime?: string) => {
  return {
    color: 'var(--theme-elevation-450)',
    fontSize: '0.8rem',
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
  ordUpdatedByName?: string
  sntUpdatedByName?: string
  conUpdatedByName?: string
  picUpdatedByName?: string
  recUpdatedByName?: string
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
  chefSummary?: Array<{
    chefName: string
    sendingAmount: number
  }>
}

type BranchStatusKey = 'ordered' | 'sending' | 'confirmed' | 'picked' | 'received'

const BRANCH_STATUS_QTY_KEY: Record<
  BranchStatusKey,
  keyof Pick<DetailItem, 'ordQty' | 'sntQty' | 'conQty' | 'picQty' | 'recQty'>
> = {
  ordered: 'ordQty',
  sending: 'sntQty',
  confirmed: 'conQty',
  picked: 'picQty',
  received: 'recQty',
}

const BRANCH_STATUS_UPDATER_KEY: Record<
  BranchStatusKey,
  keyof Pick<
    DetailItem,
    'ordUpdatedByName' | 'sntUpdatedByName' | 'conUpdatedByName' | 'picUpdatedByName' | 'recUpdatedByName'
  >
> = {
  ordered: 'ordUpdatedByName',
  sending: 'sntUpdatedByName',
  confirmed: 'conUpdatedByName',
  picked: 'picUpdatedByName',
  received: 'recUpdatedByName',
}

const BRANCH_STATUS_UPDATER_LABEL: Record<BranchStatusKey, string> = {
  ordered: 'ORDERED BY',
  sending: 'SENT BY',
  confirmed: 'CONFIRMED BY',
  picked: 'PICKED BY',
  received: 'RECEIVED BY',
}

const SUMMARY_WIRE_STATUS_INDEX: Record<BranchStatusKey, number> = {
  ordered: 0,
  sending: 1,
  confirmed: 2,
  picked: 3,
  received: 4,
}

const STATUS_MINDMAP_THEME: Record<BranchStatusKey, { stroke: string; glow: string }> = {
  ordered: { stroke: '#818cf8', glow: 'rgba(129, 140, 248, 0.52)' },
  sending: { stroke: '#34d399', glow: 'rgba(52, 211, 153, 0.5)' },
  confirmed: { stroke: '#facc15', glow: 'rgba(250, 204, 21, 0.5)' },
  picked: { stroke: '#38bdf8', glow: 'rgba(56, 189, 248, 0.5)' },
  received: { stroke: '#fb7185', glow: 'rgba(251, 113, 133, 0.5)' },
}

const resolveBranchStatus = (status: string): BranchStatusKey => {
  switch (status) {
    case 'sending':
    case 'confirmed':
    case 'picked':
    case 'received':
      return status
    default:
      return 'ordered'
  }
}

const STOCK_ORDER_REPORT_QUERY = `
  query StockOrderReport($filter: StockOrderReportFilterInput) {
    stockOrderReport(filter: $filter) {
      startDate
      endDate
      stats {
        branchName
        stockOrders
        liveOrders
        totalOrders
      }
      totals {
        stockOrders
        liveOrders
        totalOrders
      }
      details {
        productName
        categoryName
        departmentName
        price
        invoiceNumber
        ordQty
        ordTime
        sntQty
        sntTime
        conQty
        conTime
        picQty
        picTime
        recQty
        recTime
        difQty
        ordUpdatedByName
        sntUpdatedByName
        conUpdatedByName
        picUpdatedByName
        recUpdatedByName
        branchName
        branchDisplay
      }
      invoiceNumbers {
        invoice
        isLive
        createdAt
        deliveryDate
      }
      chefSummary {
        chefName
        sendingAmount
      }
    }
  }
`

const StockOrderReport: React.FC = () => {
  // ... (existing state)
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
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
  const [selectedUpdater, setSelectedUpdater] = useState('')
  const branchRowRef = React.useRef<HTMLDivElement | null>(null)
  const branchCardRefs = React.useRef<Array<HTMLDivElement | null>>([])
  const [branchWireTargets, setBranchWireTargets] = useState<number[]>([])
  const [branchWireViewportWidth, setBranchWireViewportWidth] = useState(0)

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
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-200)',
      borderRadius: '6px',
      height: '38px',
      minHeight: '38px',
      minWidth: '90px',
      padding: '0 2px',
      boxShadow: 'none',
      color: 'var(--theme-text-primary, var(--theme-text))',
      '&:hover': {
        borderColor: 'var(--theme-elevation-350)',
      },
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'var(--theme-text-primary, var(--theme-text))',
      fontWeight: '500',
    }),
    option: (base: any, state: { isSelected: boolean; isFocused: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--theme-info-500)'
        : state.isFocused
          ? 'var(--theme-elevation-100)'
          : 'var(--theme-input-bg, var(--theme-elevation-50))',
      color: state.isSelected
        ? 'var(--theme-text-invert, #fff)'
        : 'var(--theme-text-primary, var(--theme-text))',
      cursor: 'pointer',
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      border: '1px solid var(--theme-elevation-150)',
      zIndex: 9999,
    }),
    input: (base: any) => ({
      ...base,
      color: 'var(--theme-text-primary, var(--theme-text))',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base: any) => ({
      ...base,
      color: 'var(--theme-text-secondary, var(--theme-elevation-600))',
      padding: '4px',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: 'var(--theme-text-secondary, var(--theme-elevation-600))',
    }),
  }

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_month', label: 'Last Month' },
  ]

  const handleDatePresetChange = (value: string) => {
    setDateRangePreset(value)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let start: Date | null = null
    let end: Date | null = today

    switch (value) {
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
    }

    if (start && end) {
      setDateRange([start, end])
    }
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
          fetch('/api/reports/branches').then((res) => res.json()),
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

      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: STOCK_ORDER_REPORT_QUERY,
          variables: {
            filter: {
              startDate: startStr,
              endDate: endStr,
              branch: filters.branch || 'all',
              department: filters.department || 'all',
              category: filters.category || 'all',
              product: filters.product || 'all',
              // Keep full-stage data so status comparisons (e.g. SENDING vs ORDERED)
              // are always accurate in branch/department cards.
              status: 'all',
              orderType: filters.orderType || 'all',
            },
          },
        }),
      })

      if (!res.ok) throw new Error('Failed to fetch report')
      const json = await res.json()
      if (json.errors) throw new Error(json.errors[0]?.message || 'Failed to fetch report')

      setData(json.data.stockOrderReport)
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

    // Chef Summary Export (requested format)
    csvRows.push(['CHEF REPORT'])
    csvRows.push(['Chef Name', 'Sending Amount'])
    const chefSummaryRows = data.chefSummary || []
    chefSummaryRows.forEach((item) => {
      csvRows.push([`"${item.chefName}"`, item.sendingAmount].join(','))
    })
    const chefSummaryTotal = chefSummaryRows.reduce((sum, item) => sum + item.sendingAmount, 0)
    csvRows.push(['TOTAL', chefSummaryTotal].join(','))
    csvRows.push([])

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

          // Keep latest stage time and matching updater name while aggregating
          const getLatestStage = (
            existingTime?: string,
            existingName?: string,
            incomingTime?: string,
            incomingName?: string,
          ) => {
            if (!incomingTime) {
              return {
                time: existingTime,
                name: existingName || incomingName || '',
              }
            }
            if (!existingTime || incomingTime > existingTime) {
              return {
                time: incomingTime,
                name: incomingName || '',
              }
            }
            if (incomingTime === existingTime && !existingName && incomingName) {
              return {
                time: existingTime,
                name: incomingName,
              }
            }
            return {
              time: existingTime,
              name: existingName || '',
            }
          }

          const ordStage = getLatestStage(
            existing.ordTime,
            existing.ordUpdatedByName,
            item.ordTime,
            item.ordUpdatedByName,
          )
          existing.ordTime = ordStage.time
          existing.ordUpdatedByName = ordStage.name

          const sntStage = getLatestStage(
            existing.sntTime,
            existing.sntUpdatedByName,
            item.sntTime,
            item.sntUpdatedByName,
          )
          existing.sntTime = sntStage.time
          existing.sntUpdatedByName = sntStage.name

          const conStage = getLatestStage(
            existing.conTime,
            existing.conUpdatedByName,
            item.conTime,
            item.conUpdatedByName,
          )
          existing.conTime = conStage.time
          existing.conUpdatedByName = conStage.name

          const picStage = getLatestStage(
            existing.picTime,
            existing.picUpdatedByName,
            item.picTime,
            item.picUpdatedByName,
          )
          existing.picTime = picStage.time
          existing.picUpdatedByName = picStage.name

          const recStage = getLatestStage(
            existing.recTime,
            existing.recUpdatedByName,
            item.recTime,
            item.recUpdatedByName,
          )
          existing.recTime = recStage.time
          existing.recUpdatedByName = recStage.name

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

  const stageSummaryCards = React.useMemo(() => {
    type StageQtyKey = 'ordQty' | 'sntQty' | 'conQty' | 'picQty' | 'recQty' | 'difQty'
    type StageCardTone = 'total' | 'existing' | 'new' | 'table' | 'billing' | 'difference'
    type StatusFilterKey = '' | 'ordered' | 'sending' | 'confirmed' | 'picked' | 'received'
    type StageReference = {
      label: string
      amount: number
    }
    const allItems = Object.values(groupedDetails).flatMap((categories) =>
      Object.values(categories).flat(),
    ) as DetailItem[]

    const stageAmounts: Record<Exclude<StatusFilterKey, ''>, number> = {
      ordered: allItems.reduce((sum, item) => sum + item.ordQty * item.price, 0),
      sending: allItems.reduce((sum, item) => sum + item.sntQty * item.price, 0),
      confirmed: allItems.reduce((sum, item) => sum + item.conQty * item.price, 0),
      picked: allItems.reduce((sum, item) => sum + item.picQty * item.price, 0),
      received: allItems.reduce((sum, item) => sum + item.recQty * item.price, 0),
    }

    const getReferenceForStatus = (statusKey: StatusFilterKey): StageReference | null => {
      switch (statusKey) {
        case 'sending':
          return { label: 'ORDERED', amount: stageAmounts.ordered }
        case 'confirmed':
          return { label: 'SENDING', amount: stageAmounts.sending }
        case 'picked':
          return { label: 'CONFIRMED', amount: stageAmounts.confirmed }
        case 'received':
          return { label: 'PICKED', amount: stageAmounts.picked }
        default:
          return null
      }
    }

    const toCard = (
      title: string,
      qtyKey: StageQtyKey,
      tone: StageCardTone,
      statusKey: StatusFilterKey = '',
    ) => {
      const baseAmount = allItems.reduce((sum, item) => sum + item[qtyKey] * item.price, 0)
      const amount = selectedStatus && selectedStatus !== statusKey ? 0 : baseAmount
      const reference = selectedStatus === statusKey ? getReferenceForStatus(statusKey) : null
      return { title, amount, tone, reference, statusKey }
    }

    return [
      toCard('BRANCH ORDERED', 'ordQty', 'total', 'ordered'),
      toCard('CHEF PREPARED', 'sntQty', 'existing', 'sending'),
      toCard('SUPERVISOR CONFIRMED', 'conQty', 'new', 'confirmed'),
      toCard('DRIVER PICKED', 'picQty', 'table', 'picked'),
      toCard('BRANCH RECEIVED', 'recQty', 'billing', 'received'),
      toCard('DIFFERENCE', 'difQty', 'difference'),
    ]
  }, [groupedDetails, selectedStatus])

  const activeBranchStatus = resolveBranchStatus(selectedStatus)
  const summaryWireSourceRatio = (SUMMARY_WIRE_STATUS_INDEX[activeBranchStatus] + 0.5) / 6
  const summaryWireSourceX = branchWireViewportWidth * summaryWireSourceRatio
  const activeMindmapTheme = STATUS_MINDMAP_THEME[activeBranchStatus]
  const activeUpdaterLabel = BRANCH_STATUS_UPDATER_LABEL[activeBranchStatus]
  const handleSummaryCardClick = (
    statusKey: '' | 'ordered' | 'sending' | 'confirmed' | 'picked' | 'received',
  ) => {
    if (!statusKey) return
    setSelectedStatus((prev) => (prev === statusKey ? '' : statusKey))
  }

  const baseScopedDetails = React.useMemo(() => {
    if (!data?.details) return []
    return selectedInvoice
      ? data.details.filter((item) => item.invoiceNumber === selectedInvoice)
      : data.details
  }, [data?.details, selectedInvoice])

  const branchOrderedTotals = React.useMemo(() => {
    const totalsByBranch = new Map<
      string,
      {
        amount: number
        orderedAmount: number
        sendingAmount: number
        confirmedAmount: number
        pickedAmount: number
      }
    >()
    const qtyKey = BRANCH_STATUS_QTY_KEY[activeBranchStatus]
    baseScopedDetails.forEach((item) => {
      const branchName = item.branchName || 'Unknown Branch'
      const current = totalsByBranch.get(branchName) || {
        amount: 0,
        orderedAmount: 0,
        sendingAmount: 0,
        confirmedAmount: 0,
        pickedAmount: 0,
      }
      const statusAmount = current.amount + item[qtyKey] * item.price
      const orderedAmount = current.orderedAmount + item.ordQty * item.price
      const sendingAmount = current.sendingAmount + item.sntQty * item.price
      const confirmedAmount = current.confirmedAmount + item.conQty * item.price
      const pickedAmount = current.pickedAmount + item.picQty * item.price
      totalsByBranch.set(branchName, {
        amount: statusAmount,
        orderedAmount,
        sendingAmount,
        confirmedAmount,
        pickedAmount,
      })
    })

    return Array.from(totalsByBranch.entries())
      .map(([branchName, totals]) => ({
        branchName,
        amount: totals.amount,
        orderedAmount: totals.orderedAmount,
        sendingAmount: totals.sendingAmount,
        confirmedAmount: totals.confirmedAmount,
        pickedAmount: totals.pickedAmount,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [baseScopedDetails, activeBranchStatus])

  const getComparisonRow = (totals: {
    orderedAmount: number
    sendingAmount: number
    confirmedAmount: number
    pickedAmount: number
  }) => {
    switch (activeBranchStatus) {
      case 'sending':
        return { label: 'ORDERED', amount: totals.orderedAmount }
      case 'confirmed':
        return { label: 'SENDING', amount: totals.sendingAmount }
      case 'picked':
        return { label: 'CONFIRMED', amount: totals.confirmedAmount }
      case 'received':
        return { label: 'PICKED', amount: totals.pickedAmount }
      default:
        return null
    }
  }

  const employeeStatusTotals = React.useMemo(() => {
    if (activeBranchStatus === 'ordered') {
      return branchOrderedTotals.map((branch) => ({
        name: branch.branchName,
        amount: branch.amount,
      }))
    }

    const qtyKey = BRANCH_STATUS_QTY_KEY[activeBranchStatus]
    const updaterKey = BRANCH_STATUS_UPDATER_KEY[activeBranchStatus]
    const totalsByEmployee = new Map<string, number>()

    baseScopedDetails.forEach((item) => {
      const updaterName = formatUpdaterName(item[updaterKey])
      if (updaterName === 'N/A') return

      const lineAmount = item[qtyKey] * item.price
      if (!lineAmount) return

      totalsByEmployee.set(updaterName, (totalsByEmployee.get(updaterName) || 0) + lineAmount)
    })

    return Array.from(totalsByEmployee.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [activeBranchStatus, branchOrderedTotals, baseScopedDetails])

  const selectedUpdaterDetails = React.useMemo(() => {
    if (!selectedUpdater) return baseScopedDetails

    if (activeBranchStatus === 'ordered') {
      return baseScopedDetails.filter(
        (item) => (item.branchName || 'Unknown Branch') === selectedUpdater,
      )
    }

    const qtyKey = BRANCH_STATUS_QTY_KEY[activeBranchStatus]
    const updaterKey = BRANCH_STATUS_UPDATER_KEY[activeBranchStatus]
    return baseScopedDetails.filter((item) => {
      const updaterName = formatUpdaterName(item[updaterKey])
      if (updaterName !== selectedUpdater) return false
      return item[qtyKey] * item.price !== 0
    })
  }, [selectedUpdater, activeBranchStatus, baseScopedDetails])

  const departmentOrderedTotals = React.useMemo(() => {
    const totalsByDepartment = new Map<
      string,
      {
        amount: number
        orderedAmount: number
        sendingAmount: number
        confirmedAmount: number
        pickedAmount: number
      }
    >()
    const qtyKey = BRANCH_STATUS_QTY_KEY[activeBranchStatus]
    selectedUpdaterDetails.forEach((item) => {
      const departmentName = item.departmentName || 'No Department'
      const current = totalsByDepartment.get(departmentName) || {
        amount: 0,
        orderedAmount: 0,
        sendingAmount: 0,
        confirmedAmount: 0,
        pickedAmount: 0,
      }
      const statusAmount = current.amount + item[qtyKey] * item.price
      const orderedAmount = current.orderedAmount + item.ordQty * item.price
      const sendingAmount = current.sendingAmount + item.sntQty * item.price
      const confirmedAmount = current.confirmedAmount + item.conQty * item.price
      const pickedAmount = current.pickedAmount + item.picQty * item.price
      totalsByDepartment.set(departmentName, {
        amount: statusAmount,
        orderedAmount,
        sendingAmount,
        confirmedAmount,
        pickedAmount,
      })
    })

    return Array.from(totalsByDepartment.entries())
      .map(([departmentName, totals]) => ({
        departmentName,
        amount: totals.amount,
        orderedAmount: totals.orderedAmount,
        sendingAmount: totals.sendingAmount,
        confirmedAmount: totals.confirmedAmount,
        pickedAmount: totals.pickedAmount,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [selectedUpdaterDetails, activeBranchStatus])

  const visibleBranchOrderedTotals = React.useMemo(() => {
    if (!selectedUpdater) return branchOrderedTotals

    const totalsByBranch = new Map<
      string,
      {
        amount: number
        orderedAmount: number
        sendingAmount: number
        confirmedAmount: number
        pickedAmount: number
      }
    >()
    const qtyKey = BRANCH_STATUS_QTY_KEY[activeBranchStatus]
    selectedUpdaterDetails.forEach((item) => {
      const branchName = item.branchName || 'Unknown Branch'
      const current = totalsByBranch.get(branchName) || {
        amount: 0,
        orderedAmount: 0,
        sendingAmount: 0,
        confirmedAmount: 0,
        pickedAmount: 0,
      }
      const statusAmount = current.amount + item[qtyKey] * item.price
      const orderedAmount = current.orderedAmount + item.ordQty * item.price
      const sendingAmount = current.sendingAmount + item.sntQty * item.price
      const confirmedAmount = current.confirmedAmount + item.conQty * item.price
      const pickedAmount = current.pickedAmount + item.picQty * item.price
      totalsByBranch.set(branchName, {
        amount: statusAmount,
        orderedAmount,
        sendingAmount,
        confirmedAmount,
        pickedAmount,
      })
    })

    return Array.from(totalsByBranch.entries())
      .map(([branchName, totals]) => ({
        branchName,
        amount: totals.amount,
        orderedAmount: totals.orderedAmount,
        sendingAmount: totals.sendingAmount,
        confirmedAmount: totals.confirmedAmount,
        pickedAmount: totals.pickedAmount,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [selectedUpdater, branchOrderedTotals, activeBranchStatus, selectedUpdaterDetails])

  useEffect(() => {
    setSelectedUpdater('')
  }, [activeBranchStatus, selectedInvoice])

  useEffect(() => {
    if (!selectedUpdater) return
    const isUpdaterAvailable = employeeStatusTotals.some((employee) => employee.name === selectedUpdater)
    if (!isUpdaterAvailable) {
      setSelectedUpdater('')
    }
  }, [selectedUpdater, employeeStatusTotals])

  const combinedEntityCardCount = Math.max(
    visibleBranchOrderedTotals.length + departmentOrderedTotals.length,
    1,
  )

  const recalculateBranchWireTargets = React.useCallback(() => {
    const rowEl = branchRowRef.current
    if (!rowEl || visibleBranchOrderedTotals.length === 0) {
      setBranchWireTargets([])
      setBranchWireViewportWidth(0)
      return
    }

    const rowRect = rowEl.getBoundingClientRect()
    const viewportWidth = rowEl.clientWidth
    const targets = branchCardRefs.current
      .slice(0, visibleBranchOrderedTotals.length)
      .map((cardEl) => {
        if (!cardEl) return null
        const cardRect = cardEl.getBoundingClientRect()
        const centerX = cardRect.left - rowRect.left + cardRect.width / 2
        return Math.max(0, Math.min(viewportWidth, centerX))
      })
      .filter((x): x is number => typeof x === 'number')

    setBranchWireViewportWidth(viewportWidth)
    setBranchWireTargets(targets)
  }, [visibleBranchOrderedTotals])

  useEffect(() => {
    recalculateBranchWireTargets()
    const rowEl = branchRowRef.current
    if (!rowEl) return

    const rafId = requestAnimationFrame(recalculateBranchWireTargets)
    const handleResize = () => recalculateBranchWireTargets()
    const handleScroll = () => recalculateBranchWireTargets()

    window.addEventListener('resize', handleResize)
    rowEl.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
      rowEl.removeEventListener('scroll', handleScroll)
    }
  }, [recalculateBranchWireTargets])

  const renderDetailsMetricHeaderRow = (rowKey: string) => {
    const headerBg = '#f3f4f6'
    const headerBorder = '#9ca3af'
    const sharedHeaderCellStyle = {
      padding: '6px 8px',
      fontSize: '11px',
      color: '#000000',
      fontWeight: 700,
      position: 'static' as const,
      backgroundColor: headerBg,
      borderColor: headerBorder,
    }

    return (
      <tr
        key={rowKey}
        style={{
          backgroundColor: headerBg,
          borderTop: `1px solid ${headerBorder}`,
          borderBottom: `1px solid ${headerBorder}`,
        }}
      >
        <th
          style={{
            ...sharedHeaderCellStyle,
            width: '180px',
            textAlign: 'left',
            padding: '6px 12px',
          }}
        >
          PRODUCT NAME
        </th>
        <th
          style={{
            ...sharedHeaderCellStyle,
            width: '75px',
            textAlign: 'right',
          }}
        >
          PRC
        </th>
        <th
          style={{
            ...sharedHeaderCellStyle,
            width: '75px',
            textAlign: 'center',
          }}
        >
          ORD
        </th>
        <th
          style={{
            ...sharedHeaderCellStyle,
            width: '75px',
            textAlign: 'center',
          }}
        >
          SNT
        </th>
        <th
          style={{
            ...sharedHeaderCellStyle,
            width: '75px',
            textAlign: 'center',
          }}
        >
          CON
        </th>
        <th
          style={{
            ...sharedHeaderCellStyle,
            width: '75px',
            textAlign: 'center',
          }}
        >
          PIC
        </th>
        <th
          style={{
            ...sharedHeaderCellStyle,
            width: '75px',
            textAlign: 'center',
          }}
        >
          REC
        </th>
        <th
          style={{
            ...sharedHeaderCellStyle,
            width: '75px',
            textAlign: 'center',
          }}
        >
          DIF
        </th>
      </tr>
    )
  }

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

          <div className="filter-group">
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update: [Date | null, Date | null]) => {
                setDateRange(update)
              }}
              monthsShown={1}
              dateFormat="yyyy-MM-dd"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
              portalId="root"
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
              backgroundColor: 'var(--theme-elevation-50)', // Dark background for sticky header
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
            {/* Main Content */}
            <div className="main-content">
              <div className="summary-cards-grid">
                {stageSummaryCards.map((card) => {
                  const formattedAmount = card.amount.toLocaleString('en-IN')
                  const isFilterCard = Boolean(card.statusKey)
                  const isActiveFilterCard = Boolean(card.statusKey && selectedStatus === card.statusKey)
                  return (
                    <article
                      key={card.title}
                      className={`stock-summary-card stock-summary-card--${card.tone}${isFilterCard ? ' stock-summary-card--clickable' : ''}${isActiveFilterCard ? ' stock-summary-card--active' : ''}`}
                      onClick={isFilterCard ? () => handleSummaryCardClick(card.statusKey) : undefined}
                      onKeyDown={
                        isFilterCard
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleSummaryCardClick(card.statusKey)
                              }
                            }
                          : undefined
                      }
                      role={isFilterCard ? 'button' : undefined}
                      tabIndex={isFilterCard ? 0 : undefined}
                    >
                      <div className="stock-summary-title">{card.title}</div>
                      <div
                        className="stock-summary-amount"
                        style={{
                          fontSize: getSummaryAmountFontSize(formattedAmount),
                        }}
                      >
                        ₹ {formattedAmount}
                      </div>
                      {card.reference && (
                        <div
                          className="stock-summary-ref"
                          style={{
                            fontSize: getSummaryRefFontSize(
                              card.reference.amount.toLocaleString('en-IN'),
                            ),
                          }}
                        >
                          {card.reference.label}: ₹ {card.reference.amount.toLocaleString('en-IN')}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>

              {visibleBranchOrderedTotals.length > 0 && branchWireTargets.length > 0 && (
                <div className="summary-branch-wire" aria-hidden="true">
                  {(() => {
                    const wireHeight = 92
                    const startY = 4
                    const endY = wireHeight - 4
                    const c1Y = 34
                    const c2Y = 66
                    return (
                  <svg
                    className="summary-branch-wire-svg"
                    viewBox={`0 0 ${Math.max(branchWireViewportWidth, 1)} ${wireHeight}`}
                    preserveAspectRatio="none"
                  >
                    <g className="summary-branch-wire-paths">
                      {branchWireTargets.map((targetX, index) => (
                        <path
                          key={`wire-path-${index}-${Math.round(targetX)}`}
                          d={`M ${summaryWireSourceX} ${startY} C ${summaryWireSourceX} ${c1Y}, ${targetX} ${c2Y}, ${targetX} ${endY}`}
                          fill="none"
                          stroke={activeMindmapTheme.stroke}
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          style={{
                            filter: `drop-shadow(0 0 6px ${activeMindmapTheme.glow})`,
                          }}
                        />
                      ))}
                    </g>
                    <circle
                      className="summary-branch-wire-node"
                      cx={summaryWireSourceX}
                      cy={startY}
                      r={4.5}
                      fill={activeMindmapTheme.stroke}
                      style={{
                        filter: `drop-shadow(0 0 7px ${activeMindmapTheme.glow})`,
                      }}
                    />
                  </svg>
                    )
                  })()}
                </div>
              )}

              {(visibleBranchOrderedTotals.length > 0 || departmentOrderedTotals.length > 0) && (
                <div
                  className={`branch-ordered-row${activeBranchStatus === 'ordered' ? ' branch-ordered-row--ordered' : ''}`}
                  style={
                    {
                      '--entity-card-count': String(combinedEntityCardCount),
                    } as React.CSSProperties
                  }
                  ref={branchRowRef}
                >
                  {visibleBranchOrderedTotals.map((branch, index) => {
                    const comparison = getComparisonRow(branch)
                    return (
                      <div
                        key={branch.branchName}
                        className={`branch-ordered-chip branch-ordered-chip--tone-${index % 6}`}
                        ref={(el) => {
                          branchCardRefs.current[index] = el
                        }}
                      >
                        <div className="branch-head">
                          <span className="branch-name">{branch.branchName}</span>
                        </div>
                        <span className="branch-amount">₹ {branch.amount.toLocaleString('en-IN')}</span>
                        {comparison && (
                          <span className="branch-ordered-ref">
                            {comparison.label}: ₹ {comparison.amount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    )
                  })}

                  {departmentOrderedTotals.map((department, index) => {
                    const comparison = getComparisonRow(department)
                    return (
                      <div
                        key={department.departmentName}
                        className={`department-ordered-chip department-ordered-chip--tone-${index % 6}`}
                      >
                        <div className="department-ordered-head">{department.departmentName}</div>
                        <div className="department-ordered-amount">
                          ₹ {department.amount.toLocaleString('en-IN')}
                        </div>
                        {comparison && (
                          <span className="department-ordered-ref">
                            {comparison.label}: ₹ {comparison.amount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {employeeStatusTotals.length > 0 && (
                <div className="employee-updater-section">
                  <div className="employee-updater-title">{activeUpdaterLabel}</div>
                  <div className="employee-updater-row">
                    {employeeStatusTotals.map((employee) => (
                      <button
                        key={employee.name}
                        type="button"
                        className={`employee-updater-chip${selectedUpdater === employee.name ? ' employee-updater-chip--active' : ''}`}
                        onClick={() =>
                          setSelectedUpdater((prev) => (prev === employee.name ? '' : employee.name))
                        }
                        aria-pressed={selectedUpdater === employee.name}
                      >
                        <span className="employee-updater-name">{employee.name}</span>
                        <span className="employee-updater-separator">-</span>
                        <span className="employee-updater-amount">
                          ₹ {employee.amount.toLocaleString('en-IN')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                <h3 style={{ margin: 0, color: 'var(--theme-text-primary, var(--theme-text))' }}>
                  Product Order Details
                </h3>
              </div>

              <div className="tables-with-sidebar">
                <div className="tables-main">
                  <div className="details-table">
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
                      const departmentTotalCellStyle: React.CSSProperties = {
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '1.9rem',
                        color: '#fbbf24',
                        borderTop: '1px solid var(--theme-elevation-250)',
                        borderBottom: '1px solid var(--theme-elevation-250)',
                      }

                      // Don't render dept if empty after filter? (Optional, but user might want to see empty headers)
                      // If "All Branches" and filter hides everything, maybe hide dept.
                      if (filteredDeptItems.length === 0) return null

                      return (
                        <div key={dept} className="table-container" style={{ marginBottom: '18px' }}>
                          <table className="report-table">
                            <tbody>
                          {/* Department Header Row */}
                          <tr style={{ backgroundColor: 'var(--theme-elevation-50)' }}>
                            <td
                              style={{
                                padding: '10px 12px',
                                fontWeight: '800',
                                color: '#fbbf24',
                                fontSize: '14px',
                                textAlign: 'left',
                                letterSpacing: '1px',
                                borderTop: '1px solid var(--theme-elevation-250)',
                                borderBottom: '1px solid var(--theme-elevation-250)',
                                textTransform: 'uppercase',
                              }}
                            >
                              {dept}
                            </td>
                            <td
                              style={{
                                padding: '10px 8px',
                                borderTop: '1px solid var(--theme-elevation-250)',
                                borderBottom: '1px solid var(--theme-elevation-250)',
                              }}
                            />
                            <td
                              style={departmentTotalCellStyle}
                            >
                              {deptOrdTotal.toLocaleString('en-IN')}
                            </td>
                            <td
                              style={departmentTotalCellStyle}
                            >
                              {deptSntTotal.toLocaleString('en-IN')}
                            </td>
                            <td
                              style={departmentTotalCellStyle}
                            >
                              {deptConTotal.toLocaleString('en-IN')}
                            </td>
                            <td
                              style={departmentTotalCellStyle}
                            >
                              {deptPicTotal.toLocaleString('en-IN')}
                            </td>
                            <td
                              style={departmentTotalCellStyle}
                            >
                              {deptRecTotal.toLocaleString('en-IN')}
                            </td>
                            <td
                              style={departmentTotalCellStyle}
                            >
                              {deptDifTotal.toLocaleString('en-IN')}
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
                            const categoryTotalCellStyle: React.CSSProperties = {
                              textAlign: 'center',
                              fontWeight: 800,
                              fontSize: '1.8rem',
                              color: '#38bdf8',
                              borderTop: '1px solid var(--theme-elevation-250)',
                              borderBottom: '1px solid var(--theme-elevation-250)',
                            }

                            return (
                              <React.Fragment key={category}>
                                {renderDetailsMetricHeaderRow(`${dept}-${category}-metric-header`)}
                                {/* Category Header Row */}
                                <tr style={{ backgroundColor: 'var(--theme-elevation-100)' }}>
                                  <td
                                    style={{
                                      padding: '8px 12px',
                                      fontWeight: 'bold',
                                      color: '#38bdf8',
                                      fontSize: '14px',
                                      textAlign: 'left',
                                      letterSpacing: '0.5px',
                                      borderTop: '1px solid var(--theme-elevation-250)',
                                      borderBottom: '1px solid var(--theme-elevation-250)',
                                    }}
                                  >
                                    {category}
                                  </td>
                                  <td
                                    style={{
                                      padding: '8px',
                                      borderTop: '1px solid var(--theme-elevation-250)',
                                      borderBottom: '1px solid var(--theme-elevation-250)',
                                    }}
                                  />
                                  <td
                                    style={categoryTotalCellStyle}
                                  >
                                    {catOrdTotal.toLocaleString('en-IN')}
                                  </td>
                                  <td
                                    style={categoryTotalCellStyle}
                                  >
                                    {catSntTotal.toLocaleString('en-IN')}
                                  </td>
                                  <td
                                    style={categoryTotalCellStyle}
                                  >
                                    {catConTotal.toLocaleString('en-IN')}
                                  </td>
                                  <td
                                    style={categoryTotalCellStyle}
                                  >
                                    {catPicTotal.toLocaleString('en-IN')}
                                  </td>
                                  <td
                                    style={categoryTotalCellStyle}
                                  >
                                    {catRecTotal.toLocaleString('en-IN')}
                                  </td>
                                  <td
                                    style={categoryTotalCellStyle}
                                  >
                                    {catDifTotal.toLocaleString('en-IN')}
                                  </td>
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
                                        fontSize: '0.8rem',
                                        padding: '12px 8px',
                                      }}
                                    >
                                      {item.price}
                                    </td>
                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '0.8rem',
                                        padding: '12px 8px',
                                      }}
                                    >
                                      <div style={{ fontWeight: '700', fontSize: '1.2rem' }}>
                                        {formatQty(item.ordQty)}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '0.8rem',
                                          fontWeight: '600',
                                          color: 'var(--theme-elevation-450)',
                                        }}
                                      >
                                        {formatTime(item.ordTime)}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          color: 'var(--theme-elevation-500)',
                                        }}
                                      >
                                        {formatUpdaterName(item.ordUpdatedByName)}
                                      </div>
                                    </td>

                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '0.8rem',
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
                                        {formatQty(item.sntQty)}
                                      </div>
                                      <div
                                        style={{
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
                                      <div
                                        style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          color: 'var(--theme-elevation-500)',
                                        }}
                                      >
                                        {formatUpdaterName(item.sntUpdatedByName)}
                                      </div>
                                    </td>
                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '0.8rem',
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
                                        {formatQty(item.conQty)}
                                      </div>
                                      <div
                                        style={{
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
                                      <div
                                        style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          color: 'var(--theme-elevation-500)',
                                        }}
                                      >
                                        {formatUpdaterName(item.conUpdatedByName)}
                                      </div>
                                    </td>
                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '0.8rem',
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
                                        {formatQty(item.picQty)}
                                      </div>
                                      <div
                                        style={{
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
                                      <div
                                        style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          color: 'var(--theme-elevation-500)',
                                        }}
                                      >
                                        {formatUpdaterName(item.picUpdatedByName)}
                                      </div>
                                    </td>
                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '0.8rem',
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
                                        {formatQty(item.recQty)}
                                      </div>
                                      <div
                                        style={{
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
                                      <div
                                        style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          color: 'var(--theme-elevation-500)',
                                        }}
                                      >
                                        {formatUpdaterName(item.recUpdatedByName || item.ordUpdatedByName)}
                                      </div>
                                    </td>

                                    <td
                                      style={{
                                        textAlign: 'center',
                                        fontSize: '0.8rem',
                                        padding: '12px 8px',
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: '700',
                                          fontSize: '1.2rem',
                                          color: getDifColor(item.difQty),
                                        }}
                                      >
                                        {formatQty(item.difQty)}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            )
                          })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}
                {Object.keys(groupedDetails).length === 0 && (
                  <div className="table-container">
                    <table className="report-table">
                      <tbody>
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>
                            No items found.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="table-container summary-table" style={{ marginTop: '40px' }}>
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
                </div>

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
                          <span className="value" style={{ color: 'var(--theme-success-500)' }}>
                            Amt: ₹ {(inv.amount ?? 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                    <div style={{ fontSize: '10px', color: 'var(--theme-text-secondary, var(--theme-elevation-600))', padding: '0 8px' }}>
                      {item.invoiceNumber}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>{item.price}</td>

                  {/* ORD */}
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem' }}>
                      {formatQty(item.ordQty)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-450)' }}>
                      {formatTime(item.ordTime)}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--theme-elevation-500)' }}>
                      {formatUpdaterName(item.ordUpdatedByName)}
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
                      {formatQty(item.sntQty)}
                    </div>
                    <div
                      style={{
                        fontWeight: '600',
                        ...getStatusTimeStyle(item.sntQty, item.ordQty, item.sntTime),
                      }}
                    >
                      {formatTime(item.sntTime)}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--theme-elevation-500)' }}>
                      {formatUpdaterName(item.sntUpdatedByName)}
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
                      {formatQty(item.conQty)}
                    </div>
                    <div
                      style={{
                        fontWeight: '600',
                        ...getStatusTimeStyle(item.conQty, item.sntQty, item.conTime),
                      }}
                    >
                      {formatTime(item.conTime)}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--theme-elevation-500)' }}>
                      {formatUpdaterName(item.conUpdatedByName)}
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
                      {formatQty(item.picQty)}
                    </div>
                    <div
                      style={{
                        fontWeight: '600',
                        ...getStatusTimeStyle(item.picQty, item.conQty, item.picTime),
                      }}
                    >
                      {formatTime(item.picTime)}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--theme-elevation-500)' }}>
                      {formatUpdaterName(item.picUpdatedByName)}
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
                      {formatQty(item.recQty)}
                    </div>
                    <div
                      style={{
                        fontWeight: '600',
                        ...getStatusTimeStyle(item.recQty, item.picQty, item.recTime),
                      }}
                    >
                      {formatTime(item.recTime)}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--theme-elevation-500)' }}>
                      {formatUpdaterName(item.recUpdatedByName || item.ordUpdatedByName)}
                    </div>
                  </td>

                  <td
                    style={{
                      textAlign: 'center',
                      color: getDifColor(item.difQty),
                      fontWeight: item.difQty !== 0 ? '700' : '700',
                      fontSize: '1.2rem',
                      padding: '12px 8px',
                    }}
                  >
                    {formatQty(Math.abs(item.difQty))}
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
