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
  Check,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { StylesConfig } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { createPortal } from 'react-dom'
import './index.scss'

dayjs.extend(utc)
dayjs.extend(timezone)

const BILLING_TIMEZONE = 'Asia/Kolkata'

type BillRow = {
  id: string
  invoiceNumber: string
  totalAmount: number
  paymentMethod: string
  upiBankTransactionId?: string
  itemsCount: number
  waiterName: string
  branchName: string
  createdAt: string
  verificationStatus: 'pending' | 'verified' | 'not_verified' | 'not_match' | 'cancelled'
  closingNumber?: string
  originalClosingNumber?: string
  closingStatus?: 'closed' | 'missed' | 'pending' | 'n_a'
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

type PaymentMethodOption = {
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
  { value: 'not_match', label: 'Not Match Only' },
  { value: 'cancelled', label: 'Cancelled Only' },
  { value: 'missed', label: 'Missed in Closing' },
]

const paymentMethodOptions: PaymentMethodOption[] = [
  { value: 'all', label: 'All Payment Methods' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'cashfree', label: 'Cashfree' },
  { value: 'other', label: 'Other' },
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all')
  const [searchInvoice, setSearchInvoice] = useState<string>('')
  const [bills, setBills] = useState<BillRow[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({})
  const [editedTxnIds, setEditedTxnIds] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [previewBillId, setPreviewBillId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  const requestIdRef = useRef(0)

  const { totalItems, totalAmount } = useMemo(() => {
    return bills.reduce(
      (acc, bill) => {
        acc.totalItems += bill.itemsCount || 0
        acc.totalAmount += bill.totalAmount || 0
        return acc
      },
      { totalItems: 0, totalAmount: 0 }
    )
  }, [bills])



  const formatCurrency = (val: number) => {
    return `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)}`
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
    paymentMethod: string,
    search: string
  ) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)

      let url = `/api/reports/accounts-bills?startDate=${startStr}&endDate=${endStr}&branch=${branch}&verificationStatus=${status}&paymentMethod=${paymentMethod}`
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
      fetchReport(startDate, endDate, selectedBranch, selectedStatus, selectedPaymentMethod, searchInvoice)
    }
  }, [startDate, endDate, selectedBranch, selectedStatus, selectedPaymentMethod, searchInvoice, fetchReport])

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

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!previewBillId) {
      return undefined
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewBillId(null)
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [previewBillId])

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

  const handleTxnIdUpdate = async (billId: string, newTxnId: string) => {
    setUpdatingIds((prev) => ({ ...prev, [billId]: true }))
    setError('')

    try {
      const response = await fetch('/api/reports/accounts-bills/update-transaction-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, upiBankTransactionId: newTxnId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update transaction ID')
      }

      // Update state locally
      setBills((prevBills) =>
        prevBills.map((bill) =>
          bill.id === billId ? { ...bill, upiBankTransactionId: newTxnId } : bill
        )
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error updating transaction ID')
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
      'Closing Entry',
      'Payment Method',
      'UPI Bank Transaction ID',
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
          `"${row.closingNumber || '-'}"`,
          `"${row.paymentMethod.toUpperCase()}"`,
          `"${row.paymentMethod === 'upi' ? row.upiBankTransactionId || '-' : '-'}"`,
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
      fetchReport(startDate, endDate, selectedBranch, selectedStatus, selectedPaymentMethod, searchInvoice)
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

  const currentPaymentMethodOption = paymentMethodOptions.find((p) => p.value === selectedPaymentMethod) || {
    value: 'all',
    label: 'All Payment Methods',
  }

  return (
    <div className="branch-report-container accounts-report">
      <div className="report-topbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <p className="crumbs">ACCOUNT / REPORTS</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>All Bills Report</h1>
            <div className="search-input-wrap" style={{ width: '260px', height: '36px' }}>
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search Bill Number"
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                className="search-input"
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>
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

        </div>
      </div>

      <div className="report-card table-card">
        <div className="table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>S.No</th>
                <th style={{ width: '130px' }}>Bill Number</th>
                <th style={{ width: '110px' }}>Waiter</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Payment</th>
                <th style={{ width: '160px', textAlign: 'center' }}>UPI Bank Txn ID</th>
                <th style={{ width: '70px' }}>Items</th>
                <th style={{ width: '95px' }}>Amount</th>
                <th style={{ width: '100px' }}>CLO-Entry</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
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
                      <td className="bold-text">
                        <button
                           type="button"
                          className="invoice-link-btn"
                          onClick={() => setPreviewBillId(bill.id)}
                          title="Click to view bill details"
                        >
                          {bill.invoiceNumber}
                        </button>
                        <div className="small-text">{formatDateTime(bill.createdAt)}</div>
                      </td>
                      <td>{bill.waiterName}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`payment-pill payment--${bill.paymentMethod}`}>
                          {bill.paymentMethod.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {bill.paymentMethod === 'upi' ? (
                          bill.upiBankTransactionId ? (
                            <span className="bold-text">{bill.upiBankTransactionId}</span>
                          ) : (
                            <div className="txn-id-container">
                              <input
                                type="text"
                                className="txn-id-input"
                                value={editedTxnIds[bill.id] !== undefined ? editedTxnIds[bill.id] : (bill.upiBankTransactionId || '')}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setEditedTxnIds((prev) => ({ ...prev, [bill.id]: val }))
                                }}
                                placeholder="Enter Txn ID"
                                disabled={isUpdating}
                              />
                              {(editedTxnIds[bill.id] !== undefined && editedTxnIds[bill.id] !== (bill.upiBankTransactionId || '')) && (
                                <button
                                  type="button"
                                  className="txn-id-save-btn"
                                  onClick={() => handleTxnIdUpdate(bill.id, editedTxnIds[bill.id])}
                                  disabled={isUpdating}
                                  title="Save Transaction ID"
                                >
                                  <Check size={16} />
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>{bill.itemsCount}</td>
                      <td className="bold-text amount-cell">{formatCurrency(bill.totalAmount)}</td>
                      <td>
                        {bill.closingStatus === 'closed' && (
                          <span className="badge badge--success" title={`Original: ${bill.originalClosingNumber || bill.closingNumber}`}>
                            {bill.closingNumber?.split(' ')[0]}
                            <span className="badge-time">
                              {bill.closingNumber?.split(' ')[1]}
                            </span>
                          </span>
                        )}
                        {bill.closingStatus === 'missed' && (
                          <span className="badge badge--danger" title="This bill was not included in any closing report">
                            Missed
                          </span>
                        )}
                        {bill.closingStatus === 'pending' && (
                          <span className="badge badge--warning" title="No closing entry has been created yet for this day">
                            Pending
                          </span>
                        )}
                        {bill.closingStatus === 'n_a' && (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
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
                          <option value="not_match">Not Match</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {!loading && bills.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>
                    Total ({bills.length} {bills.length === 1 ? 'Bill' : 'Bills'}):
                  </td>
                  <td></td>
                  <td></td>
                  <td className="bold-text" style={{ fontWeight: 700 }}>{totalItems}</td>
                  <td className="bold-text amount-cell" style={{ fontWeight: 700 }}>{formatCurrency(totalAmount)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {isMounted &&
        previewBillId &&
        createPortal(
          <div className="bill-detail-modal-overlay" onClick={() => setPreviewBillId(null)} role="presentation">
            <div
              className="bill-detail-modal-content"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Bill sheet details"
            >
              <button
                type="button"
                className="bill-detail-modal-close"
                onClick={() => setPreviewBillId(null)}
                aria-label="Close bill details"
              >
                &times;
              </button>
              <iframe
                src={`/billings/${previewBillId}`}
                title="Bill details preview"
                className="bill-detail-receipt-frame"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default AccountsBillsReport
