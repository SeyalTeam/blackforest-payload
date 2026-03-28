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
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: Omit<ReportStats, 'branchName'>
}

type DatePresetOption = {
  value: string
  label: string
}

const PAGE_SIZE = 5
const BRANCH_BILLING_API_BASE_URL = 'https://blackforest.vseyal.com'

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

const BranchBillingReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => getDefaultDateRange())
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
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

  const formatDateForLabel = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const fetchReport = useCallback(async (start: Date, end: Date) => {
    setLoading(true)
    setError('')

    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const res = await fetch(
        `${BRANCH_BILLING_API_BASE_URL}/api/reports/branch-billing?startDate=${startStr}&endDate=${endStr}`,
      )

      if (!res.ok) throw new Error('Failed to fetch report')

      const json: ReportData = await res.json()
      setPage(1)
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
      fetchReport(startDate, endDate)
    }
  }, [fetchReport, startDate, endDate])

  useEffect(() => {
    const fetchFirstBillDate = async () => {
      try {
        const res = await fetch(`${BRANCH_BILLING_API_BASE_URL}/api/billings?sort=createdAt&limit=1`)
        if (!res.ok) return

        const json = await res.json()
        if (json.docs && json.docs.length > 0) {
          setFirstBillDate(new Date(json.docs[0].createdAt))
        }
      } catch (err) {
        console.error('Error fetching first bill date', err)
      }
    }

    fetchFirstBillDate()
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

      <div className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-icon icon-cyan">
            <CircleDollarSign size={18} />
          </div>
          <p className="kpi-label">Total Billable Amount</p>
          <h2>{formatCurrency(totalAmount)}</h2>
          <p className="kpi-footnote">
            Avg. {formatCurrency(totalBranches > 0 ? totalAmount / totalBranches : 0)} per branch
          </p>
          <div className="kpi-progress">
            <span style={{ width: `${amountProgress}%` }} />
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon icon-violet">
            <ReceiptText size={18} />
          </div>
          <p className="kpi-label">Total Bill Count</p>
          <h2>{formatInt(totalBills)}</h2>
          <p className="kpi-footnote">~{formatInt(Math.round(billPerBranch))} bills per branch</p>
          <div className="kpi-progress">
            <span
              className="progress-violet"
              style={{ width: `${Math.min(100, Math.max(8, totalBranches * 4))}%` }}
            />
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon icon-emerald">
            <Zap size={18} />
          </div>
          <p className="kpi-label">Average Bill Value</p>
          <h2>{formatCurrency(averageBillValue)}</h2>
          <p className="kpi-footnote">{formatInt(totalBills)} bills in selected range</p>
          <div className="kpi-progress segmented">
            <span style={{ width: `${averageBillProgress}%` }} />
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

            <div className="table-footer">
              <p>
                Showing {paginatedRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}-
                {(currentPage - 1) * PAGE_SIZE + paginatedRows.length} of {filteredRows.length} branches
              </p>

              <div className="pagination">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  {'<'}
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const number = idx + 1
                  return (
                    <button
                      type="button"
                      key={number}
                      className={number === currentPage ? 'active' : ''}
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  {'>'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="analytics-grid">
        <article className="analytics-card">
          <h4>
            <TrendingUp size={16} />
            Historical Trend Analysis
          </h4>
          <div className="trend-bars">
            {trendRows.length === 0 && <p className="state-text">No data to render trend chart.</p>}

            {trendRows.map((row) => {
              const trendPercent =
                trendTotalAmount === 0 ? 0 : Number(((row.totalAmount / trendTotalAmount) * 100).toFixed(1))

              return (
                <div className="trend-col" key={`trend-${row.branchName}`}>
                  <span className="trend-percent">{trendPercent}%</span>
                  <div
                    className={`bar ${row.totalAmount === maxTrend ? 'peak' : ''}`}
                    style={{ height: `${Math.max(20, (row.totalAmount / maxTrend) * 160)}px` }}
                  />
                  <span className="trend-label" title={row.branchName}>
                    {row.branchName}
                  </span>
                </div>
              )
            })}
          </div>
        </article>

        <article className="analytics-card">
          <h4>
            <WalletCards size={16} />
            Volume Distribution
          </h4>

          <div className="distribution-list">
            {orderedPaymentMix.map((item) => {
              const percent = mixTotal === 0 ? 0 : Number(((item.value / mixTotal) * 100).toFixed(1))

              return (
                <div className="distribution-row" key={item.label}>
                  <div className="distribution-head">
                    <span>{item.label}</span>
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
      </section>
    </div>
  )
}

export default BranchBillingReport
