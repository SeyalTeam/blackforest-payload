'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  HelpCircle,
  Calendar,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { StylesConfig } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import './index.scss'

dayjs.extend(utc)
dayjs.extend(timezone)

const BILLING_TIMEZONE = 'Asia/Kolkata'

type BillRow = {
  id: string
  invoiceNumber: string
  totalAmount: number
  paymentMethod: string
  itemsCount: number
  waiterName: string
  branchName: string
  createdAt: string
  verificationStatus: 'pending' | 'verified' | 'not_verified'
}

type DatePresetOption = {
  value: string
  label: string
}

type BranchOption = {
  value: string
  label: string
}

type StatusOption = {
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

const verificationStatusOptions: StatusOption[] = [
  { value: 'all', label: 'All Verification Statuses' },
  { value: 'pending', label: 'Pending Verification' },
  { value: 'verified', label: 'Verified Only' },
  { value: 'not_verified', label: 'Not Verified Only' },
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

const AccountsBillsReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => getDefaultDateRange())
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchInvoice, setSearchInvoice] = useState<string>('')
  const [bills, setBills] = useState<BillRow[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const requestIdRef = useRef(0)

  const formatCurrency = (val: number) => {
    return `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`
  }

  const formatDateTime = (dateStr: string) => {
    return dayjs(dateStr).tz(BILLING_TIMEZONE).format('DD MMM YYYY, hh:mm A')
  }

  const getVerificationBadge = (status: 'pending' | 'verified' | 'not_verified') => {
    switch (status) {
      case 'verified':
        return (
          <span className="badge badge--success">
            <CheckCircle size={14} className="badge-icon" /> Verified
          </span>
        )
      case 'not_verified':
        return (
          <span className="badge badge--danger">
            <XCircle size={14} className="badge-icon" /> Not Verified
          </span>
        )
      default:
        return (
          <span className="badge badge--warning">
            <HelpCircle size={14} className="badge-icon" /> Pending
          </span>
        )
    }
  }

  const fetchReport = useCallback(async (
    start: Date,
    end: Date,
    branch: string,
    status: string,
    search: string
  ) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)

      let url = `/api/reports/accounts-bills?startDate=${startStr}&endDate=${endStr}&branch=${branch}&verificationStatus=${status}`
      if (search.trim().length > 0) {
        url += `&search=${encodeURIComponent(search.trim())}`
      }

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

  // Initial loads and filter changes
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, selectedBranch, selectedStatus, searchInvoice)
    }
  }, [startDate, endDate, selectedBranch, selectedStatus, searchInvoice, fetchReport])

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

  const handleStatusUpdate = async (billId: string, newStatus: 'pending' | 'verified' | 'not_verified') => {
    setUpdatingIds((prev) => ({ ...prev, [billId]: true }))
    setError('')

    try {
      const response = await fetch('/api/reports/accounts-bills/update-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update verification status')
      }

      // Update state locally
      setBills((prevBills) =>
        prevBills.map((bill) =>
          bill.id === billId ? { ...bill, verificationStatus: newStatus } : bill
        )
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error updating bill status')
    } finally {
      setUpdatingIds((prev) => ({ ...prev, [billId]: false }))
    }
  }

  const handleExportCSV = () => {
    if (bills.length === 0) return

    const csvRows = []
    csvRows.push('ACCOUNTS BILLING VERIFICATION REPORT')
    const headers = [
      'S.No',
      'Bill Number',
      'Amount',
      'Payment Method',
      'Items Count',
      'Waiter Name',
      'Branch Name',
      'Date and Time',
      'Verification Status',
    ]
    csvRows.push(headers.join(','))

    bills.forEach((row, index) => {
      csvRows.push(
        [
          index + 1,
          `"${row.invoiceNumber}"`,
          row.totalAmount,
          `"${row.paymentMethod.toUpperCase()}"`,
          row.itemsCount,
          `"${row.waiterName}"`,
          `"${row.branchName}"`,
          `"${formatDateTime(row.createdAt)}"`,
          `"${row.verificationStatus.replace('_', ' ').toUpperCase()}"`,
        ].join(',')
      )
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    const startStr = startDate ? toLocalDateStr(startDate) : ''
    const endStr = endDate ? toLocalDateStr(endDate) : ''
    link.setAttribute('download', `Accounts_Bills_Report_${startStr}_to_${endStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleRefresh = () => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, selectedBranch, selectedStatus, searchInvoice)
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

  const currentStatusOption = verificationStatusOptions.find((s) => s.value === selectedStatus) || {
    value: 'all',
    label: 'All Verification Statuses',
  }

  return (
    <div className="branch-report-container accounts-report">
      <div className="report-topbar">
        <div>
          <p className="crumbs">ACCOUNT / REPORTS</p>
          <h1>All Bills Report</h1>
          <p className="subtitle">Verify and track sales invoices across waitstaff and branches</p>
        </div>
        <div className="actions">
          <button className="icon-btn" onClick={handleRefresh} disabled={loading} title="Refresh report">
            <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
          </button>
          <button
            className="action-btn"
            onClick={handleExportCSV}
            disabled={loading || bills.length === 0}
            style={{ opacity: bills.length === 0 ? 0.5 : 1 }}
          >
            <Download size={18} style={{ marginRight: '8px' }} /> Export CSV
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

          {/* Verification Status */}
          <div className="filter-item">
            <label className="filter-label">Verification Status</label>
            <Select
              options={verificationStatusOptions}
              value={currentStatusOption}
              onChange={(opt) => opt && setSelectedStatus(opt.value)}
              styles={customSelectStyles}
              isSearchable={false}
            />
          </div>

          {/* Search bar */}
          <div className="filter-item search-filter">
            <label className="filter-label">Search Bill Number</label>
            <div className="search-input-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="e.g. INV-20260715"
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="report-card table-card">
        <div className="table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>S.No</th>
                <th>Bill Number</th>
                <th>Branch</th>
                <th>Waiter</th>
                <th>Date & Time</th>
                <th>Payment Method</th>
                <th>Items</th>
                <th>Amount</th>
                <th style={{ width: '220px', textAlign: 'center' }}>Verification Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="td-loading">
                    <RefreshCw size={24} className="animate-spin text-muted" />
                    <p style={{ marginTop: '10px' }}>Fetching bills...</p>
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="td-empty">
                    No billing documents found for the selected filters.
                  </td>
                </tr>
              ) : (
                bills.map((bill, index) => {
                  const isUpdating = updatingIds[bill.id]
                  return (
                    <tr key={bill.id}>
                      <td>{index + 1}</td>
                      <td className="bold-text">{bill.invoiceNumber}</td>
                      <td>{bill.branchName}</td>
                      <td>{bill.waiterName}</td>
                      <td className="small-text">{formatDateTime(bill.createdAt)}</td>
                      <td>
                        <span className={`payment-pill payment--${bill.paymentMethod}`}>
                          {bill.paymentMethod.toUpperCase()}
                        </span>
                      </td>
                      <td>{bill.itemsCount}</td>
                      <td className="bold-text amount-cell">{formatCurrency(bill.totalAmount)}</td>
                      <td>
                        <div className="verification-actions">
                          {getVerificationBadge(bill.verificationStatus)}
                          <select
                            className={`verification-dropdown status--${bill.verificationStatus}`}
                            value={bill.verificationStatus}
                            onChange={(e) =>
                              handleStatusUpdate(bill.id, e.target.value as any)
                            }
                            disabled={isUpdating}
                          >
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="not_verified">Not Verified</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AccountsBillsReport
