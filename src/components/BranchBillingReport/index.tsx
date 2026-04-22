'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Download,
  RefreshCw,
  Search,
  ReceiptText,
  WalletCards,
  Zap,
  TrendingUp,
  CircleDollarSign,
  RotateCcw,
  ClipboardCheck,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  CheckCircle2,
  CreditCard,
  XCircle,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { StylesConfig } from 'react-select'
import './index.scss'

type ReportStats = {
  branchName: string
  totalBills: number
  totalAmount: number
  cash: number
  upi: number
  card: number
  completedCount: number
  completedAmount: number
  settledCount: number
  settledAmount: number
  cancelledCount: number
  cancelledAmount: number
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: Omit<ReportStats, 'branchName'> & {
    totalExpenses: number
    totalReturns: number
    totalClosingSales: number
  }
  trendData: Array<{ label: string; fullLabel: string; totalAmount: number; totalExpense: number; totalReturn: number }>
  heatmapData: Array<{ day: number; hour: number; amount: number; count: number }>
  summary: {
    averageTrendAmount: number
    trendPercentage: number
    medianAmount: number
  }
}

type BranchBillingReportQueryResponse = {
  data?: {
    branchBillingReport?: ReportData
  }
  errors?: Array<{ message: string }>
}

type DatePresetOption = {
  value: string
  label: string
}

const PAGE_SIZE = 1000
const BRANCH_BILLING_REPORT_QUERY = `
  query BranchBillingReport($filter: BranchBillingReportFilterInput) {
    branchBillingReport(filter: $filter) {
      startDate
      endDate
      stats {
        branchName
        totalBills
        totalAmount
        cash
        upi
        card
        completedCount
        completedAmount
        settledCount
        settledAmount
        cancelledCount
        cancelledAmount
      }
      totals {
        totalBills
        totalAmount
        cash
        upi
        card
        completedCount
        completedAmount
        settledCount
        settledAmount
        cancelledCount
        cancelledAmount
        totalExpenses
        totalReturns
        totalClosingSales
      }
      trendData {
        label
        fullLabel
        totalAmount
        totalExpense
        totalReturn
      }
      summary {
        averageTrendAmount
        trendPercentage
        medianAmount
      }
      heatmapData {
        day
        hour
        amount
        count
      }
    }
  }
`

const SALES_TREND_QUERY = `
  query SalesTrend($filter: BranchBillingReportFilterInput) {
    branchBillingReport(filter: $filter) {
      trendData {
        label
        fullLabel
        totalAmount
        totalExpense
        totalReturn
      }
      summary {
        averageTrendAmount
        trendPercentage
        medianAmount
      }
      heatmapData {
        day
        hour
        amount
        count
      }
    }
  }
`

const getDefaultDateRange = (): [Date, Date] => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return [today, today]
}

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getQuarterDates = (date: Date) => {
  const currQuarter = Math.floor((date.getMonth() + 3) / 3)
  const prevQuarter = currQuarter - 1
  let startMonth = 0
  let year = date.getFullYear()

  if (prevQuarter === 0) {
    startMonth = 9
    year -= 1
  } else {
    startMonth = (prevQuarter - 1) * 3
  }

  const endMonth = startMonth + 2
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, endMonth + 1, 0)

  return { start, end }
}

const getResponseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as {
        message?: string
        error?: string
        errors?: { message?: string }[]
      }
      return (
        payload.message ||
        payload.error ||
        payload.errors?.[0]?.message ||
        `${fallback} (HTTP ${response.status})`
      )
    }

    const text = (await response.text()).trim()
    return text || `${fallback} (HTTP ${response.status})`
  } catch (_error) {
    return `${fallback} (HTTP ${response.status})`
  }
}

const dateRangeOptions: DatePresetOption[] = [
  { value: 'till_now', label: 'Till Now' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_quarter', label: 'Last Quarter' },
]

const customDatePresetStyles: StylesConfig<DatePresetOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
    borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
    borderRadius: '8px',
    height: '42px',
    minHeight: '42px',
    minWidth: '200px',
    padding: '0',
    boxShadow: state.isFocused ? '0 0 0 1px var(--theme-info-500)' : 'none',
    color: 'var(--theme-text-primary)',
    '&:hover': {
      borderColor: 'var(--theme-info-750)',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--theme-text-primary)',
    fontWeight: 600,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--theme-info-500)'
      : state.isFocused
        ? 'var(--theme-elevation-100)'
        : 'var(--theme-input-bg, var(--theme-elevation-50))',
    color: state.isSelected ? '#fff' : 'var(--theme-text-primary)',
    cursor: 'pointer',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
    border: '1px solid var(--theme-elevation-150)',
    zIndex: 9999,
    minWidth: '200px',
  }),
  input: (base) => ({
    ...base,
    color: 'var(--theme-text-primary)',
  }),
}

const customBranchSelectStyles: StylesConfig<{ value: string, label: string }, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--theme-elevation-50, #ffffff)',
    borderColor: state.isFocused ? 'var(--theme-info-500, #38bdf8)' : 'var(--theme-elevation-200, #cbd5e1)',
    borderRadius: '8px',
    minHeight: '34px',
    height: '34px',
    minWidth: '180px',
    boxShadow: state.isFocused ? '0 0 0 1px var(--theme-info-500, #38bdf8)' : 'none',
    cursor: 'pointer',
    '&:hover': {
      borderColor: 'var(--theme-info-750, #0284c7)',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 12px',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--theme-text-primary, #1e293b)',
    fontSize: '0.95rem',
    fontWeight: 700,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--theme-info-500, #38bdf8)'
      : state.isFocused
        ? 'var(--theme-elevation-100, #e2e8f0)'
        : 'var(--theme-elevation-50, #ffffff)',
    color: state.isSelected ? '#ffffff' : 'var(--theme-text-primary, #1e293b)',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--theme-elevation-50, #ffffff)',
    border: '1px solid var(--theme-elevation-150, #cbd5e1)',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    zIndex: 9999,
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: '4px 8px',
    color: 'var(--text-primary)',
    '&:hover': {
      color: 'var(--theme-info-500)',
    }
  }),
  indicatorSeparator: () => ({ display: 'none' })
}

const BranchBillingReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => getDefaultDateRange())
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [activeTrendPeriod, setActiveTrendPeriod] = useState<string>('thisMonth')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)
  const [branches, setBranches] = useState<{ id: string, name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [trendLoading, setTrendLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(1)

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const formatCurrency = (val: number) => {
    const value = Number(formatValue(val))
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`
  }

  const formatInt = (val: number) => {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)
  }

  const formatPercent = (val: number) => {
    return `${val.toFixed(1)}%`
  }

  const formatYAxisLabel = (val: number) => {
    if (val >= 100000) {
      return `${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 2)}L`
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(0)}k`
    }
    return val.toString()
  }

  const formatDateForLabel = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const fetchReport = useCallback(async (start: Date, end: Date, trendPeriod: string, branch: string) => {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)

      const promises = [
        fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: BRANCH_BILLING_REPORT_QUERY,
            variables: { filter: { startDate: startStr, endDate: endStr, trendPeriod, branch: 'all' } },
          }),
        }).then(res => {
          if (!res.ok) throw new Error('Failed to fetch report')
          return res.json()
        })
      ]

      if (branch !== 'all') {
        promises.push(
          fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: SALES_TREND_QUERY,
              variables: { filter: { startDate: startStr, endDate: endStr, trendPeriod, branch } },
            }),
          }).then(res => {
            if (!res.ok) throw new Error('Failed to fetch isolated trend data')
            return res.json()
          })
        )
      }

      const [mainJson, trendJson] = await Promise.all(promises)

      if (mainJson.errors && mainJson.errors.length > 0) {
        throw new Error(mainJson.errors[0].message || 'GraphQL Error in main report')
      }

      if (trendJson && trendJson.errors && trendJson.errors.length > 0) {
        throw new Error(trendJson.errors[0].message || 'GraphQL Error in trend data')
      }

      const report = mainJson.data?.branchBillingReport
      
      if (!report) {
        throw new Error('No report data returned from GraphQL')
      }

      if (trendJson && trendJson.data?.branchBillingReport) {
        report.trendData = trendJson.data.branchBillingReport.trendData
        report.summary = trendJson.data.branchBillingReport.summary
        report.heatmapData = trendJson.data.branchBillingReport.heatmapData
      }

      setPage(1)
      setData(report)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error loading report data')
    } finally {
      setLoading(false)
    }
  }, [loading])

  const fetchTrendData = useCallback(async (start: Date, end: Date, trendPeriod: string, branch: string) => {
    if (trendLoading) return
    setTrendLoading(true)

    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: SALES_TREND_QUERY,
          variables: {
            filter: {
              startDate: startStr,
              endDate: endStr,
              trendPeriod,
              branch,
            },
          },
        }),
      })

      if (!res.ok) return

      const json = (await res.json()) as BranchBillingReportQueryResponse
      const report = json.data?.branchBillingReport
      if (report && report.trendData) {
        setData(prev => prev ? {
          ...prev,
          trendData: report.trendData,
          heatmapData: report.heatmapData,
          summary: report.summary
        } : null)
      }
    } catch (err) {
      console.error('Error fetching trend data', err)
    } finally {
      setTrendLoading(false)
    }
  }, [trendLoading])

  // Global Date Change (Fetches full table data for 'all' + graph data for selectedBranch)
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, activeTrendPeriod, selectedBranch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  // Chart-Only branch filter or period change (Fetches isolated trendData)
  useEffect(() => {
    if (startDate && endDate && data && !loading) {
      fetchTrendData(startDate, endDate, activeTrendPeriod, selectedBranch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrendPeriod, selectedBranch])

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchesRes, billingsRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/billings?sort=createdAt&limit=1'),
        ])
        
        if (branchesRes.ok) {
          const branchesJson = await branchesRes.json()
          setBranches(branchesJson.docs || [])
        }

        if (billingsRes.ok) {
          const json = await billingsRes.json()
          if (json.docs && json.docs.length > 0) {
            setFirstBillDate(new Date(json.docs[0].createdAt))
          }
        }
      } catch (err) {
        console.error('Error fetching metadata', err)
      }
    }

    fetchMetadata()
  }, [])

  const filteredRows = useMemo(() => {
    if (!data) return []

    const term = searchValue.trim().toLowerCase()
    if (!term) return data.stats

    return data.stats.filter((row) => row.branchName.toLowerCase().includes(term))
  }, [data, searchValue])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [filteredRows, currentPage])

  useEffect(() => {
    setPage(1)
  }, [searchValue])

  const totals = data?.totals
  const totalAmount = totals?.totalAmount ?? 0
  const totalBills = totals?.totalBills ?? 0
  const totalExpenses = totals?.totalExpenses ?? 0
  const totalReturns = totals?.totalReturns ?? 0
  const totalClosingSales = totals?.totalClosingSales ?? 0
  const totalBranches = data?.stats.length ?? 0
  const averageBillValue = totalBills > 0 ? totalAmount / totalBills : 0
  const billPerBranch = totalBranches > 0 ? totalBills / totalBranches : 0

  const maxBranchAverage =
    filteredRows.length > 0
      ? Math.max(
          ...filteredRows.map((row) => (row.totalBills > 0 ? row.totalAmount / row.totalBills : 0)),
          1,
        )
      : 1

  const averageBillProgress = Math.min(
    100,
    Math.max(8, Number(((averageBillValue / maxBranchAverage) * 100).toFixed(1))),
  )
  const amountProgress = Math.min(100, Math.max(8, totalBranches * 4))

  const paymentMix = [
    { label: 'UPI Payments', value: totals?.upi ?? 0, className: 'mix-upi' },
    { label: 'Card Transactions', value: totals?.card ?? 0, className: 'mix-card' },
    { label: 'Cash Settlements', value: totals?.cash ?? 0, className: 'mix-cash' },
  ]
  const orderedPaymentMix = [...paymentMix].sort((a, b) => b.value - a.value)

  const mixTotal = paymentMix.reduce((acc, item) => acc + item.value, 0)

  const trendRows = [...filteredRows].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10)

  const maxTrend = trendRows[0]?.totalAmount ?? 1
  const trendTotalAmount = trendRows.reduce((acc, row) => acc + row.totalAmount, 0)

  const handleDatePresetChange = (value: string) => {
    setDateRangePreset(value)

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let start: Date | null = null
    let end: Date | null = today

    switch (value) {
      case 'till_now':
        start = firstBillDate || today
        break
      case 'today':
        start = today
        end = today
        break
      case 'yesterday': {
        const yest = new Date(today)
        yest.setDate(yest.getDate() - 1)
        start = yest
        end = yest
        break
      }
      case 'last_7_days': {
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 6)
        start = last7
        break
      }
      case 'this_month': {
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = today
        break
      }
      case 'last_30_days': {
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        start = last30
        break
      }
      case 'last_month': {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      }
      case 'last_quarter': {
        const { start: qStart, end: qEnd } = getQuarterDates(today)
        start = qStart
        end = qEnd
        break
      }
      case 'custom':
        return
      default:
        break
    }

    if (start && end) {
      setDateRange([start, end])
    }
  }

  const handleManualDateChange = (update: [Date | null, Date | null]) => {
    setDateRange(update)
    setDateRangePreset('custom')
  }

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      const [start, end] = value ? value.split(' - ') : ['', '']

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref}>
          <span className="date-text">{start}</span>
          <span className="separator">→</span>
          <span className="date-text">{end || start}</span>
          <span
            className="icon"
            onClick={(event) => {
              event.stopPropagation()
              setDateRange([null, null])
              setDateRangePreset('custom')
            }}
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

  const handleExportCSV = () => {
    if (!data) return

    const csvRows = []
    const headers = ['S.No', 'Branch Name', 'Total Bills', 'Cash', 'UPI', 'Card', 'Total Amount']
    csvRows.push(headers.join(','))

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

    const csvContent = `data:text/csv;charset=utf-8,${csvRows.join('\n')}`
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
      <div className="report-topbar">
        <div>
          <p className="crumbs">REPORTS • BRANCH BILLING REPORT</p>
          <h1>Branch Billing Report</h1>
          <p className="subtitle">
            Consolidated financial overview for{' '}
            {startDate && endDate
              ? `${formatDateForLabel(startDate)} - ${formatDateForLabel(endDate)}`
              : 'selected period'}
          </p>
        </div>

        <div className="actions">
          <Select
            instanceId="date-preset-select"
            options={dateRangeOptions}
            value={dateRangeOptions.find((option) => option.value === dateRangePreset) ?? null}
            onChange={(option) => {
              if (option) handleDatePresetChange(option.value)
            }}
            styles={customDatePresetStyles}
            classNamePrefix="react-select"
            placeholder="Date Range..."
            isSearchable={false}
          />

          <DatePicker
            selectsRange={true}
            startDate={startDate}
            endDate={endDate}
            onChange={handleManualDateChange}
            monthsShown={1}
            dateFormat="yyyy-MM-dd"
            customInput={<CustomInput />}
            calendarClassName="custom-calendar"
          />

          <button className="action-btn" onClick={handleExportCSV}>
            <Download size={16} />
            Export CSV
          </button>

          <button
            className="icon-btn"
            title="Reset date range"
            onClick={() => {
              setDateRangePreset('today')
              setDateRange(getDefaultDateRange())
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="kpi-grid top-kpis">
        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-cyan">
              <CircleDollarSign size={16} />
            </div>
            <p className="kpi-label">TOTAL BILLS</p>
          </div>
          <h2>{formatCurrency(totalAmount)}</h2>
          <p className="kpi-footnote highlight">
            {formatInt(totalBills)} Bills / {formatCurrency(averageBillValue)} avg
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-emerald">
              <CheckCircle2 size={16} />
            </div>
            <p className="kpi-label">COMPLETED</p>
          </div>
          <h2>{formatCurrency(totals?.completedAmount ?? 0)}</h2>
          <p className="kpi-footnote highlight">
            {formatInt(totals?.completedCount ?? 0)} Bills
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-cyan">
              <CreditCard size={16} />
            </div>
            <p className="kpi-label">SETTLED</p>
          </div>
          <h2>{formatCurrency(totals?.settledAmount ?? 0)}</h2>
          <p className="kpi-footnote highlight">
            {formatInt(totals?.settledCount ?? 0)} Bills
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-red">
              <XCircle size={16} />
            </div>
            <p className="kpi-label">CANCELLED</p>
          </div>
          <h2 style={{ color: 'var(--danger)' }}>{formatCurrency(totals?.cancelledAmount ?? 0)}</h2>
          <p className="kpi-footnote highlight" style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)' }}>
            {formatInt(totals?.cancelledCount ?? 0)} Bills
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-indigo">
              <WalletCards size={16} />
            </div>
            <p className="kpi-label">PAYMENT METHOD</p>
          </div>
          <div className="distribution-list compact-kpi">
            {orderedPaymentMix.map((item) => {
              const percent = mixTotal === 0 ? 0 : Number(((item.value / mixTotal) * 100).toFixed(1))
              return (
                <div className="distribution-row" key={item.label}>
                  <div className="distribution-head">
                    <span>{item.label.split(' ')[0]}</span>
                    <strong>{percent}%</strong>
                  </div>
                  <div className="distribution-bar">
                    <span className={item.className} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      </div>

      <section className="table-panel">
        <div className="table-panel-header">
          <div>
            <h3>Branch Performance Details</h3>
            <p>Live transaction breakdown by payment method</p>
          </div>

          <div className="panel-actions">
            <label className="search-box" htmlFor="branch-search">
              <Search size={14} />
              <input
                id="branch-search"
                type="text"
                placeholder="Filter branches..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </label>
          </div>
        </div>

        {loading && <p className="state-text">Loading report...</p>}
        {error && <p className="state-text error">{error}</p>}

        {data && !loading && (
          <>
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>S.NO</th>
                    <th>BRANCH NAME</th>
                    <th>TOTAL BILLS</th>
                    <th>CASH TOTAL</th>
                    <th>UPI PAYMENTS</th>
                    <th>CARD REVENUE</th>
                    <th>TOTAL AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        No branches match your search.
                      </td>
                    </tr>
                  )}

                  {paginatedRows.map((row, index) => (
                    <tr key={row.branchName}>
                      <td>{String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}</td>
                      <td>
                        <div className="branch-cell">
                          <p className="branch-name">{row.branchName}</p>
                        </div>
                      </td>
                      <td>{formatInt(row.totalBills)}</td>
                      <td>{formatCurrency(row.cash)}</td>
                      <td>{formatCurrency(row.upi)}</td>
                      <td>{formatCurrency(row.card)}</td>
                      <td>{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>TOTAL</td>
                    <td>{formatInt(totals?.totalBills ?? 0)}</td>
                    <td>{formatCurrency(totals?.cash ?? 0)}</td>
                    <td>{formatCurrency(totals?.upi ?? 0)}</td>
                    <td>{formatCurrency(totals?.card ?? 0)}</td>
                    <td>{formatCurrency(totals?.totalAmount ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="kpi-grid bottom-kpis">
        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-red">
              <WalletCards size={16} />
            </div>
            <p className="kpi-label">EXPENSES</p>
          </div>
          <h2>{formatCurrency(totalExpenses)}</h2>
        </article>

        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-violet">
              <ClipboardCheck size={16} />
            </div>
            <p className="kpi-label">CLOSING ENTRY</p>
          </div>
          <h2>{formatCurrency(totalClosingSales)}</h2>
        </article>

        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-orange">
              <Zap size={16} />
            </div>
            <p className="kpi-label">SALES DIF</p>
          </div>
          <h2>{formatCurrency(totalAmount - totalClosingSales)}</h2>
        </article>

        <article className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon icon-orange">
              <RotateCcw size={16} />
            </div>
            <p className="kpi-label">RETURN ORDER</p>
          </div>
          <h2>{formatCurrency(totalReturns)}</h2>
        </article>
      </div>

      {data && data.trendData && (
        <div className="sales-report-container">
          {(() => {
            const step = 50000
            const rawMaxSales = Math.max(...data.trendData.map(s => s.totalAmount), 0)
            const rawMaxExpense = Math.max(...data.trendData.map(s => s.totalExpense), 0)
            const overallMax = Math.max(rawMaxSales, rawMaxExpense, 1)
            
            const topValue = Math.ceil(overallMax / step) * step || step
            const tickCount = topValue / step
            const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => i * step).reverse()
            const isDenseTrend = data.trendData.length > 14
            const chartMinWidth = isDenseTrend ? Math.max(980, data.trendData.length * 62) : null

            return (
              <div className="report-analytics-grid">
                {/* Left Side Card: Sales/Expense Trend */}
                <section className="sales-report-card">
                  <header className="report-header">
                    <div className="header-main">
                      <div className="title-row">
                        <h3>Sales Report</h3>
                        <span 
                          className="trend-refresh" 
                          style={{ 
                            opacity: trendLoading ? 1 : 0, 
                            visibility: trendLoading ? 'visible' : 'hidden',
                            transition: 'opacity 0.2s',
                            pointerEvents: 'none'
                          }}
                        >
                          <RefreshCw size={14} className={trendLoading ? 'animate-spin' : ''} />
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="period-tabs">
                          <button 
                            type="button" 
                            className={activeTrendPeriod === '12months' ? 'active' : ''}
                            onClick={() => setActiveTrendPeriod('12months')}
                          >12 Months</button>
                          <button 
                            type="button" 
                            className={activeTrendPeriod === '6months' ? 'active' : ''}
                            onClick={() => setActiveTrendPeriod('6months')}
                          >6 Months</button>
                          <button 
                            type="button" 
                            className={activeTrendPeriod === '30days' ? 'active' : ''}
                            onClick={() => setActiveTrendPeriod('30days')}
                          >30 Days</button>
                          <button 
                            type="button" 
                            className={activeTrendPeriod === 'thisMonth' ? 'active' : ''}
                            onClick={() => setActiveTrendPeriod('thisMonth')}
                          >This Month</button>
                          <button 
                            type="button" 
                            className={activeTrendPeriod === '7days' ? 'active' : ''}
                            onClick={() => setActiveTrendPeriod('7days')}
                          >7 Days</button>
                        </div>

                        <div className="branch-filter-dropdown" style={{ minWidth: '200px' }}>
                          <Select
                            instanceId="branch-filter-select"
                            options={[{ value: 'all', label: 'All Branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
                            value={[{ value: 'all', label: 'All Branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))].find(opt => opt.value === selectedBranch) || { value: 'all', label: 'All Branches' }}
                            onChange={(option) => {
                              if (option) setSelectedBranch(option.value)
                            }}
                            styles={customBranchSelectStyles}
                            classNamePrefix="react-select"
                            isSearchable={false}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="report-actions">
                      <button type="button" className="icon-btn" title="Download"><Download size={18} /></button>
                      <button type="button" className="icon-btn" title="Options"><MoreHorizontal size={18} /></button>
                    </div>
                  </header>

                  <div className={`report-content-wrapper ${trendLoading ? 'loading' : ''}`}>
                    <div className="chart-container-root">
                      <div className="chart-legend">
                        <div className="legend-item">
                          <span className="dot billing"></span>
                          <span className="label">Billing</span>
                        </div>
                        <div className="legend-item">
                          <span className="dot expense"></span>
                          <span className="label">Expense</span>
                        </div>
                      </div>
                      
                      <div className="chart-wrapper">
                        <div className="chart-y-axis">
                          {yTicks.map(tick => (
                            <div key={tick} className="y-axis-tick">
                              {formatYAxisLabel(tick)}
                            </div>
                          ))}
                        </div>

                        <div className="chart-main-scroll">
                          <div
                            className={`chart-main-area${isDenseTrend ? ' dense' : ''}`}
                            style={chartMinWidth ? { minWidth: `${chartMinWidth}px` } : undefined}
                          >
                            <div className="chart-grid-lines">
                              {yTicks.map(tick => (
                                <div key={tick} className="grid-line" />
                              ))}
                            </div>
                            
                            <div className="median-line" 
                              style={{ 
                                bottom: `${(data.summary.medianAmount / topValue) * 215 + 25}px` 
                              }} 
                            />

                            <div className="chart-bars">
                              {data.trendData.map((point, idx) => {
                                const salesHeight = (point.totalAmount / topValue) * 215
                                const expenseHeight = (point.totalExpense / topValue) * 215
                                const pointTotal = point.totalAmount + point.totalExpense
                                const pointBillingPercent = pointTotal > 0 ? (point.totalAmount / pointTotal) * 100 : 0
                                const pointExpensePercent = pointTotal > 0 ? (point.totalExpense / pointTotal) * 100 : 0
                                const isCurrent = idx === data.trendData.length - 1

                                return (
                                  <div className="chart-col" key={`${point.label}-${idx}`}>
                                    <div className="bar-container">
                                      <div className="bar-tooltip" style={{ bottom: `${Math.max(salesHeight, expenseHeight) + 25}px` }}>
                                        <div className="tt-header">{point.fullLabel}</div>
                                        <div className="tt-row">
                                          <span className="dot billing"></span>
                                          <span className="val">{formatCurrency(point.totalAmount)}</span>
                                        </div>
                                        <div className="tt-row">
                                          <span className="dot expense"></span>
                                          <span className="val">{formatCurrency(point.totalExpense)}</span>
                                        </div>
                                      </div>
                                      <div className="bar-stack">
                                        <span className="bar-fixed-percent billing">
                                          {formatPercent(pointBillingPercent)}
                                        </span>
                                        <div
                                          className="bar billing"
                                          style={{ height: `${Math.max(4, salesHeight)}px` }}
                                        />
                                      </div>
                                      <div className="bar-stack">
                                        <span className="bar-fixed-percent expense">
                                          {formatPercent(pointExpensePercent)}
                                        </span>
                                        <div
                                          className="bar expense"
                                          style={{ height: `${Math.max(4, expenseHeight)}px` }}
                                        />
                                      </div>
                                    </div>
                                    <div className={`month-label ${isCurrent ? 'active' : ''}`}>
                                      {point.label.includes('|') ? (
                                        <>
                                          <span className="date-num">{point.label.split('|')[0]}</span>
                                          <span className="day-initial">{point.label.split('|')[1]}</span>
                                        </>
                                      ) : (
                                        point.label
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default BranchBillingReport
