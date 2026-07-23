'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  RefreshCw,
  Search,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { StylesConfig } from 'react-select'
import './index.scss'

type ReportStats = {
  branchName: string
  gstMode: string
  totalBills: number
  totalAmount: number
  gstInclusiveAmount: number
  gstExclusiveAmount: number
  gstInclusiveTaxableAmount: number
  gstExclusiveTaxableAmount: number
}

type ProductGSTStat = {
  productName: string
  gstRate: number
  count: number
  taxableAmount: number
  gstAmount: number
  totalAmount: number
}

type CategoryGSTStat = {
  categoryName: string
  count: number
  taxableAmount: number
  gstAmount: number
  totalAmount: number
}

type DealerGSTStat = {
  dealerName: string
  count: number
  taxableAmount: number
  gstAmount: number
  totalAmount: number
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: {
    totalBills: number
    totalAmount: number
    gstInclusiveAmount: number
    gstExclusiveAmount: number
    gstInclusiveTaxableAmount: number
    gstExclusiveTaxableAmount: number
  }
  productGstStats: ProductGSTStat[]
  categoryGstStats: CategoryGSTStat[]
  dealerGstStats: DealerGSTStat[]
}

type DatePresetOption = {
  value: string
  label: string
}

const PAGE_SIZE = 1000
const GST_REPORT_QUERY = `
  query GSTReport($filter: BranchBillingReportFilterInput) {
    branchBillingReport(filter: $filter) {
      startDate
      endDate
      stats {
        branchName
        gstMode
        totalBills
        totalAmount
        gstInclusiveAmount
        gstExclusiveAmount
        gstInclusiveTaxableAmount
        gstExclusiveTaxableAmount
      }
      totals {
        totalBills
        totalAmount
        gstInclusiveAmount
        gstExclusiveAmount
        gstInclusiveTaxableAmount
        gstExclusiveTaxableAmount
      }
      productGstStats {
        productName
        gstRate
        count
        taxableAmount
        gstAmount
        totalAmount
      }
      categoryGstStats {
        categoryName
        count
        taxableAmount
        gstAmount
        totalAmount
      }
      dealerGstStats {
        dealerName
        count
        taxableAmount
        gstAmount
        totalAmount
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
    padding: '0 8px',
    display: 'flex',
    alignItems: 'center',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--theme-text-primary, #0f172a)',
    fontWeight: 600,
    fontSize: '0.85rem',
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: '32px',
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: '4px',
    color: 'var(--theme-elevation-400, #94a3b8)',
    '&:hover': {
      color: 'var(--theme-info-500)',
    }
  }),
  indicatorSeparator: () => ({ display: 'none' })
}

const GSTReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => getDefaultDateRange())
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)
  const [branches, setBranches] = useState<{ id: string, name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [productSearchValue, setProductSearchValue] = useState('')
  const [categorySearchValue, setCategorySearchValue] = useState('')
  const [dealerSearchValue, setDealerSearchValue] = useState('')
  const [page, setPage] = useState(1)
  const requestIdRef = useRef(0)

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

  const formatDateForLabel = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const fetchReport = useCallback(async (start: Date, end: Date, branch: string) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GST_REPORT_QUERY,
          variables: { filter: { startDate: startStr, endDate: endStr, branch } },
        }),
      })

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, 'Failed to fetch report'))
      }

      const json = await response.json()

      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0].message || 'GraphQL Error in report')
      }

      const report = json.data?.branchBillingReport

      if (!report) {
        throw new Error('No report data returned from GraphQL')
      }

      if (requestId !== requestIdRef.current) {
        return
      }

      setPage(1)
      setData(report)
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return
      }
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error loading report data')
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, selectedBranch)
    }
  }, [startDate, endDate, selectedBranch, fetchReport])

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

  const filteredProducts = useMemo(() => {
    if (!data?.productGstStats) return []
    const term = productSearchValue.trim().toLowerCase()
    if (!term) return data.productGstStats
    return data.productGstStats.filter((p) => p.productName.toLowerCase().includes(term))
  }, [data, productSearchValue])

  const productTotals = useMemo(() => {
    if (!filteredProducts) return { count: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0 }
    return filteredProducts.reduce(
      (acc, curr) => ({
        count: acc.count + curr.count,
        taxableAmount: acc.taxableAmount + curr.taxableAmount,
        gstAmount: acc.gstAmount + curr.gstAmount,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { count: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0 },
    )
  }, [filteredProducts])

  const filteredCategories = useMemo(() => {
    if (!data?.categoryGstStats) return []
    const term = categorySearchValue.trim().toLowerCase()
    if (!term) return data.categoryGstStats
    return data.categoryGstStats.filter((c) => c.categoryName.toLowerCase().includes(term))
  }, [data, categorySearchValue])

  const categoryTotals = useMemo(() => {
    if (!filteredCategories) return { count: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0 }
    return filteredCategories.reduce(
      (acc, curr) => ({
        count: acc.count + curr.count,
        taxableAmount: acc.taxableAmount + curr.taxableAmount,
        gstAmount: acc.gstAmount + curr.gstAmount,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { count: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0 },
    )
  }, [filteredCategories])

  const filteredDealers = useMemo(() => {
    if (!data?.dealerGstStats) return []
    const term = dealerSearchValue.trim().toLowerCase()
    if (!term) return data.dealerGstStats
    return data.dealerGstStats.filter((d) => d.dealerName.toLowerCase().includes(term))
  }, [data, dealerSearchValue])

  const dealerTotals = useMemo(() => {
    if (!filteredDealers) return { count: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0 }
    return filteredDealers.reduce(
      (acc, curr) => ({
        count: acc.count + curr.count,
        taxableAmount: acc.taxableAmount + curr.taxableAmount,
        gstAmount: acc.gstAmount + curr.gstAmount,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { count: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0 },
    )
  }, [filteredDealers])

  const totals = data?.totals
  const totalAmount = totals?.totalAmount ?? 0
  const gstInclusiveAmount = totals?.gstInclusiveAmount ?? 0
  const gstExclusiveAmount = totals?.gstExclusiveAmount ?? 0
  const gstInclusiveTaxableAmount = totals?.gstInclusiveTaxableAmount ?? 0
  const gstExclusiveTaxableAmount = totals?.gstExclusiveTaxableAmount ?? 0

  const handleDatePresetChange = (preset: string) => {
    setDateRangePreset(preset)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (preset) {
      case 'today':
        setDateRange([today, today])
        break
      case 'yesterday': {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        setDateRange([yesterday, yesterday])
        break
      }
      case 'last_7_days': {
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 6)
        setDateRange([last7, today])
        break
      }
      case 'this_month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        setDateRange([start, today])
        break
      }
      case 'last_30_days': {
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        setDateRange([last30, today])
        break
      }
      case 'last_month': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const end = new Date(today.getFullYear(), today.getMonth(), 0)
        setDateRange([start, end])
        break
      }
      case 'last_quarter': {
        const { start, end } = getQuarterDates(today)
        setDateRange([start, end])
        break
      }
      case 'till_now': {
        if (firstBillDate) {
          setDateRange([firstBillDate, today])
        } else {
          setDateRange([today, today])
        }
        break
      }
      default:
        break
    }
  }

  const handleManualDateChange = (dates: [Date | null, Date | null]) => {
    setDateRange(dates)
    setDateRangePreset('custom')
  }

  const handleExportCSV = () => {
    if (!data) return

    const csvRows = []
    csvRows.push('BRANCH PERFORMANCE BREAKDOWN')
    const headers = ['S.No', 'Branch Name', 'GST Mode', 'GST Inclusive Amount', 'GST Exclusive Amount', 'Total Amount']
    csvRows.push(headers.join(','))

    data.stats.forEach((row, index) => {
      const mode = row.gstMode === 'exclusive' ? 'Exclusive' : 'Inclusive'
      csvRows.push(
        [
          index + 1,
          `"${row.branchName}"`,
          mode,
          formatValue(row.gstInclusiveAmount),
          formatValue(row.gstExclusiveAmount),
          formatValue(row.totalAmount),
        ].join(','),
      )
    })

    csvRows.push(
      [
        '',
        'TOTAL',
        '',
        formatValue(data.totals.gstInclusiveAmount),
        formatValue(data.totals.gstExclusiveAmount),
        formatValue(data.totals.totalAmount),
      ].join(','),
    )

    csvRows.push('')
    csvRows.push('')

    csvRows.push('PRODUCT-WISE GST BREAKDOWN')
    const productHeaders = ['S.No', 'Product Name', 'Selling Count', 'Taxable Amount', 'GST Tax Amount', 'Total Amount']
    csvRows.push(productHeaders.join(','))

    let totalProdCount = 0
    let totalProdTaxable = 0
    let totalProdGST = 0
    let totalProdTotal = 0

    data.productGstStats.forEach((row, index) => {
      totalProdCount += row.count
      totalProdTaxable += row.taxableAmount
      totalProdGST += row.gstAmount
      totalProdTotal += row.totalAmount

      csvRows.push(
        [
          index + 1,
          `"${row.productName}"`,
          row.count,
          formatValue(row.taxableAmount),
          formatValue(row.gstAmount),
          formatValue(row.totalAmount),
        ].join(','),
      )
    })

    csvRows.push(
      [
        '',
        'TOTAL',
        totalProdCount,
        formatValue(totalProdTaxable),
        formatValue(totalProdGST),
        formatValue(totalProdTotal),
      ].join(','),
    )

    csvRows.push('')
    csvRows.push('')

    csvRows.push('CATEGORY-WISE GST BREAKDOWN')
    const categoryHeaders = ['S.No', 'Category Name', 'Selling Count', 'Taxable Amount', 'GST Tax Amount', 'Total Amount']
    csvRows.push(categoryHeaders.join(','))

    let totalCatCount = 0
    let totalCatTaxable = 0
    let totalCatGST = 0
    let totalCatTotal = 0

    data.categoryGstStats.forEach((row, index) => {
      totalCatCount += row.count
      totalCatTaxable += row.taxableAmount
      totalCatGST += row.gstAmount
      totalCatTotal += row.totalAmount

      csvRows.push(
        [
          index + 1,
          `"${row.categoryName}"`,
          row.count,
          formatValue(row.taxableAmount),
          formatValue(row.gstAmount),
          formatValue(row.totalAmount),
        ].join(','),
      )
    })

    csvRows.push(
      [
        '',
        'TOTAL',
        totalCatCount,
        formatValue(totalCatTaxable),
        formatValue(totalCatGST),
        formatValue(totalCatTotal),
      ].join(','),
    )

    csvRows.push('')
    csvRows.push('')

    csvRows.push('DEALER-WISE GST BREAKDOWN')
    const dealerHeaders = ['S.No', 'Dealer Name', 'Selling Count', 'Taxable Amount', 'GST Tax Amount', 'Total Amount']
    csvRows.push(dealerHeaders.join(','))

    let totalDealerCount = 0
    let totalDealerTaxable = 0
    let totalDealerGST = 0
    let totalDealerTotal = 0

    data.dealerGstStats.forEach((row, index) => {
      totalDealerCount += row.count
      totalDealerTaxable += row.taxableAmount
      totalDealerGST += row.gstAmount
      totalDealerTotal += row.totalAmount

      csvRows.push(
        [
          index + 1,
          `"${row.dealerName}"`,
          row.count,
          formatValue(row.taxableAmount),
          formatValue(row.gstAmount),
          formatValue(row.totalAmount),
        ].join(','),
      )
    })

    csvRows.push(
      [
        '',
        'TOTAL',
        totalDealerCount,
        formatValue(totalDealerTaxable),
        formatValue(totalDealerGST),
        formatValue(totalDealerTotal),
      ].join(','),
    )

    const csvContent = `data:text/csv;charset=utf-8,${csvRows.join('\n')}`
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `gst_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${endDate ? toLocalDateStr(endDate) : ''}.csv`,
    )

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      const startLabel = startDate ? formatDateForLabel(startDate) : ''
      const endLabel = endDate ? formatDateForLabel(endDate) : ''
      return (
        <button type="button" ref={ref} onClick={onClick} className="custom-date-input">
          <span className="date-text">{startLabel}</span>
          <span className="separator">•</span>
          <span className="date-text">{endLabel}</span>
        </button>
      )
    },
  )
  CustomInput.displayName = 'CustomInput'

  return (
    <div className="branch-report-container">
      <div className="report-topbar">
        <div>
          <p className="crumbs">REPORTS • GST REPORT</p>
          <h1>GST Report</h1>
          <p className="subtitle">
            Consolidated financial overview for{' '}
            {startDate && endDate
              ? `${formatDateForLabel(startDate)} - ${formatDateForLabel(endDate)}`
              : 'selected period'}
          </p>
        </div>

        <div className="actions">
          <div className="branch-filter-dropdown" style={{ minWidth: '200px' }}>
            <Select
              instanceId="topbar-branch-filter-select"
              options={[{ value: 'all', label: 'All Branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              value={
                [{ value: 'all', label: 'All Branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))].find(
                  (opt) => opt.value === selectedBranch,
                ) || { value: 'all', label: 'All Branches' }
              }
              onChange={(option) => {
                if (option) setSelectedBranch(option.value)
              }}
              styles={customBranchSelectStyles}
              classNamePrefix="react-select"
              isSearchable={false}
            />
          </div>

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

      <div className="kpi-grid top-kpis gst-kpis">
        <article className="kpi-card kpi-total">
          <div className="kpi-card-header">
            <p className="kpi-label">TOTAL AMOUNT</p>
          </div>
          <h2>{formatCurrency(totalAmount)}</h2>
        </article>

        <article className="kpi-card kpi-gst-inclusive">
          <div className="kpi-card-header">
            <p className="kpi-label">GST INCLUSIVE BILLED</p>
          </div>
          <h2>{formatCurrency(gstInclusiveAmount)}</h2>
          <p className="kpi-sub-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Taxable Value: {formatCurrency(gstInclusiveTaxableAmount)}
          </p>
        </article>

        <article className="kpi-card kpi-gst-exclusive">
          <div className="kpi-card-header">
            <p className="kpi-label">GST EXCLUSIVE BILLED</p>
          </div>
          <h2>{formatCurrency(gstExclusiveAmount)}</h2>
          <p className="kpi-sub-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Taxable Value: {formatCurrency(gstExclusiveTaxableAmount)}
          </p>
        </article>
      </div>

      <section className="table-panel">
        <div className="table-panel-header">
          <div>
            <h3>GST Performance Details</h3>
            <p>Live transaction breakdown by GST Mode</p>
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
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>S.NO</th>
                  <th>BRANCH NAME</th>
                  <th>GST MODE</th>
                  <th>GST INCLUSIVE AMOUNT</th>
                  <th>GST EXCLUSIVE AMOUNT</th>
                  <th>TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No branches match your search.
                    </td>
                  </tr>
                )}

                {paginatedRows.map((row, index) => {
                  const mode = row.gstMode === 'exclusive' ? 'Exclusive' : 'Inclusive'
                  return (
                    <tr key={row.branchName}>
                      <td>{String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}</td>
                      <td>
                        <div className="branch-cell">
                          <p className="branch-name">{row.branchName}</p>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${mode === 'Exclusive' ? 'status-critical' : 'status-active'}`}>
                          {mode}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div>{formatCurrency(row.gstInclusiveAmount)}</div>
                          {row.gstInclusiveAmount > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              on {formatCurrency(row.gstInclusiveTaxableAmount)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div>{formatCurrency(row.gstExclusiveAmount)}</div>
                          {row.gstExclusiveAmount > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              on {formatCurrency(row.gstExclusiveTaxableAmount)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>TOTAL</td>
                  <td>
                    <div>
                      <div>{formatCurrency(totals?.gstInclusiveAmount ?? 0)}</div>
                      {(totals?.gstInclusiveAmount ?? 0) > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px', fontWeight: 500 }}>
                          on {formatCurrency(totals?.gstInclusiveTaxableAmount ?? 0)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>
                      <div>{formatCurrency(totals?.gstExclusiveAmount ?? 0)}</div>
                      {(totals?.gstExclusiveAmount ?? 0) > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px', fontWeight: 500 }}>
                          on {formatCurrency(totals?.gstExclusiveTaxableAmount ?? 0)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{formatCurrency(totals?.totalAmount ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="table-panel" style={{ marginTop: '24px' }}>
        <div className="table-panel-header">
          <div>
            <h3>Product Wise GST Breakdown</h3>
            <p>Product-level sales taxable value and GST collection</p>
          </div>

          <div className="panel-actions">
            <label className="search-box" htmlFor="product-search">
              <Search size={14} />
              <input
                id="product-search"
                type="text"
                placeholder="Filter products..."
                value={productSearchValue}
                onChange={(event) => setProductSearchValue(event.target.value)}
              />
            </label>
          </div>
        </div>

        {loading && <p className="state-text">Loading report...</p>}
        {error && <p className="state-text error">{error}</p>}

        {data && !loading && (
          <div className="table-wrap product-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>S.NO</th>
                  <th>PRODUCT NAME</th>
                  <th>SELLING COUNT</th>
                  <th>TAXABLE AMOUNT</th>
                  <th>GST TAX AMOUNT</th>
                  <th>TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No products match your search.
                    </td>
                  </tr>
                )}

                {filteredProducts.map((row, index) => {
                  return (
                    <tr key={`${row.productName}-${row.gstRate}`}>
                      <td>{String(index + 1).padStart(2, '0')}</td>
                      <td>
                        <div className="branch-cell">
                          <p className="branch-name">{row.productName}</p>
                        </div>
                      </td>
                      <td>{formatInt(row.count)}</td>
                      <td>{formatCurrency(row.taxableAmount)}</td>
                      <td>{formatCurrency(row.gstAmount)}</td>
                      <td>{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>TOTAL ({filteredProducts.length})</td>
                  <td>{formatInt(productTotals.count)}</td>
                  <td>{formatCurrency(productTotals.taxableAmount)}</td>
                  <td>{formatCurrency(productTotals.gstAmount)}</td>
                  <td>{formatCurrency(productTotals.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="table-panel" style={{ marginTop: '24px' }}>
        <div className="table-panel-header">
          <div>
            <h3>Category Wise GST Breakdown</h3>
            <p>Category-level sales taxable value and GST collection</p>
          </div>

          <div className="panel-actions">
            <label className="search-box" htmlFor="category-search">
              <Search size={14} />
              <input
                id="category-search"
                type="text"
                placeholder="Filter categories..."
                value={categorySearchValue}
                onChange={(event) => setCategorySearchValue(event.target.value)}
              />
            </label>
          </div>
        </div>

        {loading && <p className="state-text">Loading report...</p>}
        {error && <p className="state-text error">{error}</p>}

        {data && !loading && (
          <div className="table-wrap product-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>S.NO</th>
                  <th>CATEGORY NAME</th>
                  <th>SELLING COUNT</th>
                  <th>TAXABLE AMOUNT</th>
                  <th>GST TAX AMOUNT</th>
                  <th>TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No categories match your search.
                    </td>
                  </tr>
                )}

                {filteredCategories.map((row, index) => {
                  return (
                    <tr key={row.categoryName}>
                      <td>{String(index + 1).padStart(2, '0')}</td>
                      <td>
                        <div className="branch-cell">
                          <p className="branch-name">{row.categoryName}</p>
                        </div>
                      </td>
                      <td>{formatInt(row.count)}</td>
                      <td>{formatCurrency(row.taxableAmount)}</td>
                      <td>{formatCurrency(row.gstAmount)}</td>
                      <td>{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>TOTAL ({filteredCategories.length})</td>
                  <td>{formatInt(categoryTotals.count)}</td>
                  <td>{formatCurrency(categoryTotals.taxableAmount)}</td>
                  <td>{formatCurrency(categoryTotals.gstAmount)}</td>
                  <td>{formatCurrency(categoryTotals.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="table-panel" style={{ marginTop: '24px' }}>
        <div className="table-panel-header">
          <div>
            <h3>Dealer Wise GST Breakdown</h3>
            <p>Dealer-level sales taxable value and GST collection</p>
          </div>

          <div className="panel-actions">
            <label className="search-box" htmlFor="dealer-search">
              <Search size={14} />
              <input
                id="dealer-search"
                type="text"
                placeholder="Filter dealers..."
                value={dealerSearchValue}
                onChange={(event) => setDealerSearchValue(event.target.value)}
              />
            </label>
          </div>
        </div>

        {loading && <p className="state-text">Loading report...</p>}
        {error && <p className="state-text error">{error}</p>}

        {data && !loading && (
          <div className="table-wrap product-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>S.NO</th>
                  <th>DEALER NAME</th>
                  <th>SELLING COUNT</th>
                  <th>TAXABLE AMOUNT</th>
                  <th>GST TAX AMOUNT</th>
                  <th>TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {filteredDealers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No dealers match your search.
                    </td>
                  </tr>
                )}

                {filteredDealers.map((row, index) => {
                  return (
                    <tr key={row.dealerName}>
                      <td>{String(index + 1).padStart(2, '0')}</td>
                      <td>
                        <div className="branch-cell">
                          <p className="branch-name">{row.dealerName}</p>
                        </div>
                      </td>
                      <td>{formatInt(row.count)}</td>
                      <td>{formatCurrency(row.taxableAmount)}</td>
                      <td>{formatCurrency(row.gstAmount)}</td>
                      <td>{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>TOTAL ({filteredDealers.length})</td>
                  <td>{formatInt(dealerTotals.count)}</td>
                  <td>{formatCurrency(dealerTotals.taxableAmount)}</td>
                  <td>{formatCurrency(dealerTotals.gstAmount)}</td>
                  <td>{formatCurrency(dealerTotals.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default GSTReport
