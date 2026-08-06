'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  RefreshCw,
  Calendar,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { StylesConfig } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import './index.scss'

dayjs.extend(utc)
dayjs.extend(timezone)

const BILLING_TIMEZONE = 'Asia/Kolkata'

type BillRow = {
  id: string
  invoiceNumber: string
  totalAmount: number
  paymentMethod: string
  verificationStatus: 'pending' | 'verified' | 'not_verified' | 'not_match' | 'cancelled'
  branchName?: string
  createdAt: string
}

type DatePresetOption = {
  value: string
  label: string
}

type BranchOption = {
  value: string
  label: string
}

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

const paymentMethodOptions = [
  { value: 'all', label: 'All Payments' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

const verificationStatusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'verified', label: 'Verified' },
  { value: 'not_verified', label: 'Not Verified' },
  { value: 'not_match', label: 'Not Match' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
]

const customSelectStyles: StylesConfig<any, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--theme-elevation-50, #ffffff)',
    borderColor: state.isFocused ? 'var(--theme-info-500, #38bdf8)' : 'var(--theme-elevation-200, #cbd5e1)',
    borderRadius: '8px',
    height: '42px',
    minHeight: '42px',
    minWidth: '180px',
    boxShadow: state.isFocused ? '0 0 0 1px var(--theme-info-500, #38bdf8)' : 'none',
    color: 'var(--theme-text-primary, #0f172a)',
    '&:hover': {
      borderColor: 'var(--theme-info-750, #0284c7)',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--theme-text-primary, #0f172a)',
    fontWeight: 600,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--theme-info-500, #38bdf8)'
      : state.isFocused
        ? 'var(--theme-elevation-100, #f1f5f9)'
        : 'var(--theme-elevation-50, #ffffff)',
    color: state.isSelected ? '#fff' : 'var(--theme-text-primary, #0f172a)',
    cursor: 'pointer',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--theme-elevation-50, #ffffff)',
    border: '1px solid var(--theme-elevation-150, #e2e8f0)',
    zIndex: 9999,
  }),
  input: (base) => ({
    ...base,
    color: 'var(--theme-text-primary, #0f172a)',
  }),
}

const BillSummary: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => getDefaultDateRange())
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all')
  const [selectedVerificationStatus, setSelectedVerificationStatus] = useState<string>('all')
  const [bills, setBills] = useState<BillRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requestIdRef = useRef(0)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)
  }

  const fetchReport = useCallback(async (
    start: Date,
    end: Date,
    branch: string,
    paymentMethod: string,
    verificationStatus: string
  ) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)

      const url = `/api/reports/accounts-bills?startDate=${startStr}&endDate=${endStr}&branch=${branch}&verificationStatus=${verificationStatus}&paymentMethod=${paymentMethod}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch bills report (HTTP ${response.status})`)
      }

      const json = await response.json()
      if (requestId !== requestIdRef.current) {
        return
      }

      setBills(json.bills || [])
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
      fetchReport(startDate, endDate, selectedBranch, selectedPaymentMethod, selectedVerificationStatus)
    }
  }, [startDate, endDate, selectedBranch, selectedPaymentMethod, selectedVerificationStatus, fetchReport])

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchesRes, billingsRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/billings?sort=createdAt&limit=1'),
        ])

        if (branchesRes.ok) {
          const branchesJson = await branchesRes.json()
          const docs = branchesJson.docs || []
          const opts = docs.map((b: any) => ({ value: b.id, label: b.name }))
          setBranches([{ value: 'all', label: 'All Branches' }, ...opts])
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

  const handleRefresh = () => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, selectedBranch, selectedPaymentMethod, selectedVerificationStatus)
    }
  }

  const selectedPresetOption = dateRangeOptions.find((o) => o.value === dateRangePreset) || {
    value: 'custom',
    label: 'Custom Range',
  }

  const currentBranchOption = branches.find((b) => b.value === selectedBranch) || {
    value: 'all',
    label: 'All Branches',
  }

  const currentPaymentMethodOption = paymentMethodOptions.find((p) => p.value === selectedPaymentMethod) || {
    value: 'all',
    label: 'All Payments',
  }

  const currentVerificationStatusOption = verificationStatusOptions.find((v) => v.value === selectedVerificationStatus) || {
    value: 'all',
    label: 'All Statuses',
  }

  const uniqueBranches = useMemo(() => {
    const branches = new Set<string>()
    bills.forEach((bill) => {
      if (bill.branchName) {
        branches.add(bill.branchName)
      }
    })
    const branchList = Array.from(branches)

    const branchTotals: Record<string, number> = {}
    branchList.forEach((b) => {
      branchTotals[b] = 0
    })
    bills.forEach((bill) => {
      if (bill.branchName) {
        branchTotals[bill.branchName] += bill.totalAmount || 0
      }
    })

    return branchList.sort((a, b) => branchTotals[a] - branchTotals[b])
  }, [bills])

  const branchSummaryTotals = useMemo(() => {
    const totalsMap: Record<string, {
      total: number
      verified: number
      not_verified: number
      not_match: number
      pending: number
      cancelled: number
    }> = {}

    uniqueBranches.forEach((branchName) => {
      totalsMap[branchName] = {
        total: 0,
        verified: 0,
        not_verified: 0,
        not_match: 0,
        pending: 0,
        cancelled: 0,
      }
    })

    bills.forEach((bill) => {
      if (bill.branchName && totalsMap[bill.branchName]) {
        const branchRow = totalsMap[bill.branchName]
        const amount = bill.totalAmount || 0
        branchRow.total += amount

        const status = bill.verificationStatus
        if (status === 'verified') branchRow.verified += amount
        else if (status === 'not_verified') branchRow.not_verified += amount
        else if (status === 'not_match') branchRow.not_match += amount
        else if (status === 'pending') branchRow.pending += amount
        else if (status === 'cancelled') branchRow.cancelled += amount
      }
    })

    return totalsMap
  }, [bills, uniqueBranches])

  const grandTotalTotals = useMemo(() => {
    const grand = {
      total: 0,
      verified: 0,
      not_verified: 0,
      not_match: 0,
      pending: 0,
      cancelled: 0,
    }

    Object.values(branchSummaryTotals).forEach((row) => {
      grand.total += row.total
      grand.verified += row.verified
      grand.not_verified += row.not_verified
      grand.not_match += row.not_match
      grand.pending += row.pending
      grand.cancelled += row.cancelled
    })

    return grand
  }, [branchSummaryTotals])

  const paymentSummaryTotals = useMemo(() => {
    const totalsMap: Record<string, {
      total: number
      verified: number
      not_verified: number
      not_match: number
      pending: number
      cancelled: number
    }> = {
      cash: { total: 0, verified: 0, not_verified: 0, not_match: 0, pending: 0, cancelled: 0 },
      upi: { total: 0, verified: 0, not_verified: 0, not_match: 0, pending: 0, cancelled: 0 },
      card: { total: 0, verified: 0, not_verified: 0, not_match: 0, pending: 0, cancelled: 0 },
    }

    bills.forEach((bill) => {
      const pm = (bill.paymentMethod || '').toLowerCase()
      if (totalsMap[pm]) {
        const row = totalsMap[pm]
        const amount = bill.totalAmount || 0
        row.total += amount

        const status = bill.verificationStatus
        if (status === 'verified') row.verified += amount
        else if (status === 'not_verified') row.not_verified += amount
        else if (status === 'not_match') row.not_match += amount
        else if (status === 'pending') row.pending += amount
        else if (status === 'cancelled') row.cancelled += amount
      }
    })

    return totalsMap
  }, [bills])

  const grandTotalAmount = useMemo(() => {
    return grandTotalTotals.total
  }, [grandTotalTotals])

  const getPercentageStr = useCallback((amount: number) => {
    if (grandTotalAmount === 0) return '0%'
    return `${Math.round((amount / grandTotalAmount) * 100)}%`
  }, [grandTotalAmount])

  const BRANCH_COLORS = useMemo(() => [
    '#0ea5e9', // Sky Blue
    '#10b981', // Emerald Green
    '#f59e0b', // Amber/Yellow
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#14b8a6', // Teal
  ], [])

  const chartSeries = useMemo(() => {
    if (selectedPaymentMethod === 'all') {
      return [
        { key: 'Cash', color: '#10b981' }, // Emerald Green
        { key: 'UPI', color: '#0ea5e9' },  // Sky Blue
        { key: 'Card', color: '#f59e0b' }, // Amber/Yellow
      ]
    } else {
      return uniqueBranches.map((branchName, idx) => ({
        key: branchName,
        color: BRANCH_COLORS[idx % BRANCH_COLORS.length],
      }))
    }
  }, [selectedPaymentMethod, uniqueBranches, BRANCH_COLORS])

  const isMultiDayRange = useMemo(() => {
    if (!startDate || !endDate) return false
    return toLocalDateStr(startDate) !== toLocalDateStr(endDate)
  }, [startDate, endDate])

  const showDatesOnXAxis = selectedVerificationStatus !== 'all' || isMultiDayRange

  const chartTitle = useMemo(() => {
    if (showDatesOnXAxis) {
      if (selectedPaymentMethod === 'all') {
        return selectedVerificationStatus === 'all'
          ? 'Daily Breakdown by Payment Method'
          : `Daily Breakdown of ${verificationStatusOptions.find((v) => v.value === selectedVerificationStatus)?.label} Payments`
      } else {
        return selectedVerificationStatus === 'all'
          ? `Daily Breakdown by Branch (${selectedPaymentMethod.toUpperCase()})`
          : `Daily Breakdown of ${verificationStatusOptions.find((v) => v.value === selectedVerificationStatus)?.label} (${selectedPaymentMethod.toUpperCase()})`
      }
    } else {
      if (selectedPaymentMethod === 'all') {
        return selectedVerificationStatus === 'all'
          ? 'Verification Status Breakdown by Payment Method'
          : `Breakdown of ${verificationStatusOptions.find((v) => v.value === selectedVerificationStatus)?.label} Payments`
      } else {
        return selectedVerificationStatus === 'all'
          ? `Verification Status Breakdown by Branch (${selectedPaymentMethod.toUpperCase()})`
          : `Breakdown of ${verificationStatusOptions.find((v) => v.value === selectedVerificationStatus)?.label} (${selectedPaymentMethod.toUpperCase()})`
      }
    }
  }, [showDatesOnXAxis, selectedPaymentMethod, selectedVerificationStatus])

  const dateRangeList = useMemo(() => {
    if (!startDate || !endDate) return []
    const dates: string[] = []
    let current = dayjs(startDate).startOf('day')
    const end = dayjs(endDate).startOf('day')
    while (current.isBefore(end) || current.isSame(end)) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'day')
    }
    return dates
  }, [startDate, endDate])

  const graphData = useMemo(() => {
    if (showDatesOnXAxis) {
      return dateRangeList.map((dateStr) => {
        const row: Record<string, any> = {
          status: dayjs(dateStr).format('DD MMM'),
          Cash: 0,
          UPI: 0,
          Card: 0,
        }

        uniqueBranches.forEach((branchName) => {
          row[branchName] = 0
        })

        bills.forEach((bill) => {
          const billDate = dayjs(bill.createdAt).tz('Asia/Kolkata').format('YYYY-MM-DD')
          if (billDate === dateStr) {
            const statusMatches = selectedVerificationStatus === 'all' || bill.verificationStatus === selectedVerificationStatus

            if (statusMatches && bill.branchName) {
              row[bill.branchName] += bill.totalAmount || 0

              const pm = bill.paymentMethod ? bill.paymentMethod.toLowerCase() : ''
              if (pm === 'cash') row['Cash'] += bill.totalAmount || 0
              else if (pm === 'upi') row['UPI'] += bill.totalAmount || 0
              else if (pm === 'card') row['Card'] += bill.totalAmount || 0
            }
          }
        })

        return row
      })
    }

    const statuses = [
      { key: 'verified', label: 'Verified' },
      { key: 'not_verified', label: 'Not Verified' },
      { key: 'not_match', label: 'Not Match' },
      { key: 'pending', label: 'Pending' },
      { key: 'cancelled', label: 'Cancelled' },
    ]

    return statuses.map((status) => {
      const row: Record<string, any> = {
        status: status.label,
        Cash: 0,
        UPI: 0,
        Card: 0,
      }

      uniqueBranches.forEach((branchName) => {
        row[branchName] = 0
      })

      bills.forEach((bill) => {
        if (bill.verificationStatus === status.key && bill.branchName) {
          row[bill.branchName] += bill.totalAmount || 0

          const pm = bill.paymentMethod ? bill.paymentMethod.toLowerCase() : ''
          if (pm === 'cash') row['Cash'] += bill.totalAmount || 0
          else if (pm === 'upi') row['UPI'] += bill.totalAmount || 0
          else if (pm === 'card') row['Card'] += bill.totalAmount || 0
        }
      })

      return row
    })
  }, [bills, uniqueBranches, selectedVerificationStatus, dateRangeList, showDatesOnXAxis])

  return (
    <div className="branch-report-container accounts-report">
      <div className="report-topbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <p className="crumbs">ACCOUNT / REPORTS</p>
          <h1>Bill Summary</h1>
        </div>
        <div className="actions">
          <button className="icon-btn" onClick={handleRefresh} disabled={loading} title="Refresh report">
            <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
          </button>
        </div>
      </div>

      {error && <div className="report-alert alert--error">{error}</div>}

      <div className="report-card report-filters">
        <div className="filters-grid">
          {/* Date Preset */}
          <div className="filter-item">
            <label className="filter-label">Date Range Preset</label>
            <Select
              options={dateRangeOptions}
              value={selectedPresetOption}
              onChange={(opt) => opt && handleDatePresetChange(opt.value)}
              styles={customSelectStyles}
              isSearchable={false}
            />
          </div>

          {/* Date Picker */}
          <div className="filter-item">
            <label className="filter-label">Choose Dates</label>
            <div className="custom-datepicker-wrap">
              <Calendar size={16} className="date-icon" />
              <DatePicker
                selectsRange
                startDate={startDate || undefined}
                endDate={endDate || undefined}
                onChange={handleManualDateChange}
                maxDate={new Date()}
                placeholderText="Choose start and end dates"
                className="datepicker-input"
              />
            </div>
          </div>

          {/* Branch Select */}
          <div className="filter-item">
            <label className="filter-label">Branch</label>
            <Select
              options={branches}
              value={currentBranchOption}
              onChange={(opt) => opt && setSelectedBranch(opt.value)}
              styles={customSelectStyles}
              placeholder="Select branch..."
            />
          </div>

          {/* Payment Method Filter */}
          <div className="filter-item">
            <label className="filter-label">Payment Method</label>
            <Select
              options={paymentMethodOptions}
              value={currentPaymentMethodOption}
              onChange={(opt) => opt && setSelectedPaymentMethod(opt.value)}
              styles={customSelectStyles}
              isSearchable={false}
            />
          </div>

          {/* Verification Status Filter */}
          <div className="filter-item">
            <label className="filter-label">Verification Status</label>
            <Select
              options={verificationStatusOptions}
              value={currentVerificationStatusOption}
              onChange={(opt) => opt && setSelectedVerificationStatus(opt.value)}
              styles={customSelectStyles}
              isSearchable={false}
            />
          </div>
        </div>
      </div>

      <div className="report-card summary-card">
        <div className="summary-header">
          <h3 className="summary-title">Summary Totals by Branch</h3>
        </div>
        <div className="table-wrapper">
          <table className="report-table summary-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>S.No.</th>
                <th style={{ width: '150px' }}>Branch Name</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Verified</th>
                <th style={{ textAlign: 'right' }}>Not Verified</th>
                <th style={{ textAlign: 'right' }}>Not Match</th>
                <th style={{ textAlign: 'right' }}>Pending</th>
                <th style={{ textAlign: 'right' }}>Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="td-loading" style={{ padding: '2rem' }}>
                    <RefreshCw size={20} className="animate-spin text-muted" style={{ margin: '0 auto 8px' }} />
                    <p>Calculating totals...</p>
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--theme-text-muted, #64748b)' }}>
                    No bills found for the selected filters.
                  </td>
                </tr>
              ) : (
                <>
                  {uniqueBranches.map((branchName, index) => {
                    const rowData = branchSummaryTotals[branchName] || {
                      total: 0,
                      verified: 0,
                      not_verified: 0,
                      not_match: 0,
                      pending: 0,
                      cancelled: 0,
                    }
                    return (
                      <tr key={branchName}>
                        <td style={{ width: '60px', textAlign: 'center', fontWeight: 600 }}>
                          {index + 1}
                        </td>
                        <td className="bold-text">
                          {branchName}
                        </td>
                        <td className="bold-text amount-cell" style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.total)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.verified)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.not_verified)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.not_match)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.pending)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.cancelled)}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="summary-grand-total-row" style={{ fontWeight: 700 }}>
                    <td className="bold-text" colSpan={2} style={{ fontSize: '1.1rem' }}>GRAND TOTAL</td>
                    <td className="bold-text amount-cell" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.total)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.verified)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.not_verified)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.not_match)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.pending)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.cancelled)}
                    </td>
                  </tr>
                  <tr className="summary-percentage-row" style={{ fontWeight: 600, backgroundColor: 'var(--theme-elevation-50, #f8fafc)' }}>
                    <td className="bold-text" colSpan={2} style={{ color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>PERCENTAGE</td>
                    <td className="bold-text amount-cell" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      100%
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.verified)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.not_verified)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.not_match)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.pending)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.cancelled)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-card summary-card" style={{ marginTop: '2rem' }}>
        <div className="summary-header">
          <h3 className="summary-title">Summary Totals by Payment Method</h3>
        </div>
        <div className="table-wrapper">
          <table className="report-table summary-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>S.No.</th>
                <th style={{ width: '150px' }}>Payment Method</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Verified</th>
                <th style={{ textAlign: 'right' }}>Not Verified</th>
                <th style={{ textAlign: 'right' }}>Not Match</th>
                <th style={{ textAlign: 'right' }}>Pending</th>
                <th style={{ textAlign: 'right' }}>Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="td-loading" style={{ padding: '2rem' }}>
                    <RefreshCw size={20} className="animate-spin text-muted" style={{ margin: '0 auto 8px' }} />
                    <p>Calculating totals...</p>
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--theme-text-muted, #64748b)' }}>
                    No bills found for the selected filters.
                  </td>
                </tr>
              ) : (
                <>
                  {['CASH', 'UPI', 'CARD'].map((pm, index) => {
                    const rowData = paymentSummaryTotals[pm.toLowerCase()] || {
                      total: 0,
                      verified: 0,
                      not_verified: 0,
                      not_match: 0,
                      pending: 0,
                      cancelled: 0,
                    }
                    return (
                      <tr key={pm}>
                        <td style={{ width: '60px', textAlign: 'center', fontWeight: 600 }}>
                          {index + 1}
                        </td>
                        <td className="bold-text">
                          <span className={`payment-pill payment--${pm.toLowerCase()}`}>
                            {pm}
                          </span>
                        </td>
                        <td className="bold-text amount-cell" style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.total)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.verified)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.not_verified)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.not_match)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.pending)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(rowData.cancelled)}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="summary-grand-total-row" style={{ fontWeight: 700 }}>
                    <td className="bold-text" colSpan={2} style={{ fontSize: '1.1rem' }}>GRAND TOTAL</td>
                    <td className="bold-text amount-cell" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.total)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.verified)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.not_verified)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.not_match)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.pending)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', borderTop: '2px solid var(--border-soft)', fontSize: '1.15rem' }}>
                      {formatCurrency(grandTotalTotals.cancelled)}
                    </td>
                  </tr>
                  <tr className="summary-percentage-row" style={{ fontWeight: 600, backgroundColor: 'var(--theme-elevation-50, #f8fafc)' }}>
                    <td className="bold-text" colSpan={2} style={{ color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>PERCENTAGE</td>
                    <td className="bold-text amount-cell" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      100%
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.verified)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.not_verified)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.not_match)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.pending)}
                    </td>
                    <td className="bold-text" style={{ textAlign: 'right', color: 'var(--theme-text-muted, #64748b)', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                      {getPercentageStr(grandTotalTotals.cancelled)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-card chart-card" style={{ marginTop: '2rem' }}>
        <div className="summary-header">
          <h3 className="summary-title">{chartTitle}</h3>
        </div>
        <div style={{ padding: '1.5rem', width: '100%' }}>
          {bills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--theme-text-muted, #64748b)' }}>
              No data available to display graph.
            </div>
          ) : (
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={graphData}
                  margin={{ top: 25, right: 20, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-soft, #e2e8f0)" />
                  <XAxis dataKey="status" stroke="var(--theme-text-muted, #64748b)" style={{ fontWeight: 600 }} />
                  <YAxis type="number" tickFormatter={(val) => `${val}`} stroke="var(--theme-text-muted, #64748b)" />
                  <Tooltip
                    formatter={(value: any) => [`${Number(value || 0).toLocaleString('en-IN')}`, 'Amount']}
                    cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }}
                    contentStyle={{
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      borderColor: 'var(--border-soft, #cbd5e1)',
                      color: 'var(--theme-text-primary, #0f172a)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  {chartSeries.map((series) => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      fill={series.color}
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey={series.key}
                        position="top"
                        formatter={(val: any) => val > 0 ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(val))}` : ''}
                        style={{ fontSize: '0.65rem', fontWeight: 600, fill: 'var(--theme-text-primary, #0f172a)' }}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BillSummary
