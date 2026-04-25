'use client'

import React, { useState, useEffect, useRef } from 'react'
import './index.scss' // reusing the same scss or creating new one? Let's assume we can reuse basic table styles if they are global or in a similar scss.
// However, the prompt implies "follow same table ui in product wise".
// ProductWise has its own index.scss. I should probably create one or reuse it.
// For now, I will assume I need to create a basic scss file or use inline styles for simplicity if scss is not shared.
// Actually, I'll create a scss file for it to be safe.

import Select from 'react-select'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { getBills } from '@/app/actions/getBill'
import BillReceipt, { BillData } from '@/components/BillReceipt'

type CustomerStat = {
  sNo: number
  customerName: string
  phoneNumber: string
  totalBills: number
  lifetimeBillCount?: number
  lifetimeTotalAmount?: number
  isExistingCustomer?: boolean
  totalAmount: number
  lastPurchasingDate: string
  billId?: string
  billIds?: string[]
  lifetimeBillIds?: string[]
  branchName?: string
  waiterName?: string
}

type ReportData = {
  startDate: string
  endDate: string
  stats: CustomerStat[]
  sourceSummary?: {
    table?: {
      amount?: number
      bills?: number
    }
    billing?: {
      amount?: number
      bills?: number
    }
  }
}

type ReportBranch = {
  id: string
  name: string
}

type ReportWaiter = {
  id: string
  name?: string | null
}

type CustomerStatusFilter = 'existing' | 'new' | 'bf_customer'
type OrderSourceFilter = 'table' | 'billing'

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const formatCurrencyAmount = (value: number): string => {
  const amount = toFiniteNumber(value)
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

const BillModal: React.FC<{
  billDataList: BillData[]
  loading: boolean
  customerName: string
  customerPhone: string
  totalBills: number
  onClose: () => void
}> = ({ billDataList, loading, customerName, customerPhone, totalBills, onClose }) => {
  if (billDataList.length === 0 && !loading) return null

  const totalAmount = billDataList.reduce(
    (sum, billData) => sum + toFiniteNumber(billData.totalAmount),
    0,
  )

  return (
    <div className="bill-modal-overlay" onClick={onClose}>
      <div className="bill-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="bill-modal-toolbar">
          <div className="bill-modal-customer">
            <strong>{customerName?.toUpperCase() || 'CUSTOMER'}</strong>
            <span>{customerPhone}</span>
          </div>
          <span className="bill-modal-counter">{totalBills} Bills</span>
        </div>
        {loading ? (
          <div className="bill-modal-loading">Loading Bills...</div>
        ) : (
          <>
            <div className="bill-modal-list">
              {billDataList.map((billData, index) => (
                <div className="bill-modal-bill" key={`${index}-${billData.invoiceNumber || ''}`}>
                  <BillReceipt data={billData} />
                </div>
              ))}
            </div>
            <div className="bill-modal-footer">
              <button className="total-summary-btn">
                Total Amount: {formatCurrencyAmount(totalAmount)} (
                {billDataList.length || totalBills} Bills)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const AfterstockCustomerReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<ReportBranch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [waiters, setWaiters] = useState<ReportWaiter[]>([])
  const [selectedWaiter, setSelectedWaiter] = useState('all')
  const [selectedCustomerStatus, setSelectedCustomerStatus] = useState<CustomerStatusFilter | null>(
    null,
  )
  const [selectedOrderSource, setSelectedOrderSource] = useState<OrderSourceFilter | null>(null)

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedBills, setSelectedBills] = useState<BillData[]>([])
  const [loadingBills, setLoadingBills] = useState(false)
  const [selectedBillIDs, setSelectedBillIDs] = useState<string[]>([])
  const [activeCustomerName, setActiveCustomerName] = useState('')
  const [activeCustomerPhone, setActiveCustomerPhone] = useState('')
  const billFetchTokenRef = useRef(0)

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

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const isExistingCustomer = (row: CustomerStat) => {
    if (typeof row.isExistingCustomer === 'boolean') return row.isExistingCustomer
    return row.totalBills > 1
  }

  const getCustomerStatus = (row: CustomerStat) => (isExistingCustomer(row) ? 'Existing' : 'New')

  const isBFCustomer = (row: CustomerStat) =>
    row.customerName?.trim().toUpperCase() === 'BF CUSTOMER'

  const getCustomerHistoryBillCount = (row: CustomerStat) => row.lifetimeBillCount ?? row.totalBills

  const getCustomerHistoryTotalAmount = (row: CustomerStat) =>
    row.lifetimeTotalAmount ?? row.totalAmount

  const getCustomerBillIds = (row: CustomerStat) => {
    if (Array.isArray(row.lifetimeBillIds) && row.lifetimeBillIds.length > 0) {
      return row.lifetimeBillIds
    }
    if (Array.isArray(row.billIds) && row.billIds.length > 0) return row.billIds
    return row.billId ? [row.billId] : []
  }

  const loadCustomerBills = async (billIDs: string[]) => {
    const fetchToken = billFetchTokenRef.current + 1
    billFetchTokenRef.current = fetchToken
    setLoadingBills(true)
    setSelectedBills([])

    try {
      const bills = await getBills(billIDs)
      if (billFetchTokenRef.current !== fetchToken) return

      const billsByID = new Map(bills.map((billData) => [billData.id, billData]))
      const orderedBills = billIDs.flatMap((billID) => {
        const bill = billsByID.get(billID)
        return bill ? [bill] : []
      })

      if (orderedBills.length === 0) {
        alert('Unable to load bill details')
        return
      }
      setSelectedBills(orderedBills)
    } catch (billError) {
      if (billFetchTokenRef.current !== fetchToken) return
      console.error('Failed to fetch bill details', billError)
      alert('Failed to load bill details')
    } finally {
      if (billFetchTokenRef.current === fetchToken) {
        setLoadingBills(false)
      }
    }
  }

  const handleCustomerRowClick = async (row: CustomerStat) => {
    const billIDs = getCustomerBillIds(row)

    if (billIDs.length === 0) {
      alert('Bill details are not available for this customer.')
      return
    }

    setActiveCustomerName(row.customerName || '')
    setActiveCustomerPhone(row.phoneNumber || '')
    setSelectedBillIDs(billIDs)

    await loadCustomerBills(billIDs)
  }

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchRes, waiterRes, billRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/users?where[role][equals]=waiter&limit=1000&pagination=false'),
          fetch('/api/billings?sort=createdAt&limit=1'),
        ])

        if (branchRes.ok) {
          const json = await branchRes.json()
          setBranches(json.docs)
        }
        if (waiterRes.ok) {
          const json = await waiterRes.json()
          setWaiters(json.docs)
        }
        if (billRes.ok) {
          const json = await billRes.json()
          if (json.docs && json.docs.length > 0) {
            setFirstBillDate(new Date(json.docs[0].createdAt))
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchMetadata()
  }, [])

  useEffect(() => {
    const fetchReport = async (start: Date, end: Date) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        let url = `/api/reports/afterstock-customer?startDate=${startStr}&endDate=${endStr}`
        if (selectedBranch !== 'all') {
          url += `&branch=${selectedBranch}`
        }
        if (selectedWaiter !== 'all') {
          url += `&waiter=${selectedWaiter}`
        }
        if (selectedOrderSource) {
          url += `&orderSource=${selectedOrderSource}`
        }

        const res = await fetch(url)
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

    if (startDate && endDate) {
      fetchReport(startDate, endDate)
    }
  }, [startDate, endDate, selectedBranch, selectedWaiter, selectedOrderSource])

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    csvRows.push(
      [
        'S.NO',
        'CUSTOMER NAME',
        'PHONE NUMBER',
        'STATUS',
        'TOTAL BILLS',
        'TOTAL AMOUNT',
        'LAST PURCHASING DATE',
      ].join(','),
    )
    filteredStats.forEach((row, index) => {
      const customerStatus = getCustomerStatus(row)
      csvRows.push(
        [
          index + 1,
          `"${row.customerName}"`,
          `"${row.phoneNumber}"`,
          customerStatus,
          getCustomerHistoryBillCount(row),
          row.totalAmount,
          `"${new Date(row.lastPurchasingDate).toLocaleString()}"`,
        ].join(','),
      )
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customer_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    a.click()
    setShowExportMenu(false)
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
        start = firstBillDate || today
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
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = today
        break
      case 'last_30_days':
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        start = last30
        break
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
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

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
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

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const waiterOptions = [
    { value: 'all', label: 'All Waiters' },
    ...waiters.map((w) => ({ value: w.id, label: (w.name || 'Unknown').toUpperCase() })),
  ]

  const customerStatusOptions: { value: CustomerStatusFilter; label: string }[] = [
    { value: 'existing', label: 'EXISTING' },
    { value: 'new', label: 'NEW' },
    { value: 'bf_customer', label: 'BF CUSTOMER' },
  ]

  const orderSourceOptions: { value: OrderSourceFilter; label: string }[] = [
    { value: 'table', label: 'TABLE' },
    { value: 'billing', label: 'BILLING' },
  ]

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
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
    singleValue: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary)',
      fontWeight: '600',
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
      zIndex: 9999,
      minWidth: '200px',
    }),
    input: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary)',
      fontWeight: '600',
    }),
  }

  const customerSummary = data?.stats.reduce(
    (summary, row) => {
      const bucket = isExistingCustomer(row) ? summary.existing : summary.new
      bucket.amount += row.totalAmount
      bucket.bills += row.totalBills
      summary.total.amount += row.totalAmount
      summary.total.bills += row.totalBills
      return summary
    },
    {
      existing: { amount: 0, bills: 0 },
      new: { amount: 0, bills: 0 },
      total: { amount: 0, bills: 0 },
    },
  ) ?? {
    existing: { amount: 0, bills: 0 },
    new: { amount: 0, bills: 0 },
    total: { amount: 0, bills: 0 },
  }

  const orderSourceSummary = {
    table: {
      amount: data?.sourceSummary?.table?.amount ?? 0,
      bills: data?.sourceSummary?.table?.bills ?? 0,
    },
    billing: {
      amount: data?.sourceSummary?.billing?.amount ?? 0,
      bills: data?.sourceSummary?.billing?.bills ?? 0,
    },
  }

  const filteredStats =
    data?.stats.filter((row) => {
      if (!selectedCustomerStatus) return true
      if (selectedCustomerStatus === 'bf_customer') return isBFCustomer(row)
      return selectedCustomerStatus === 'existing'
        ? isExistingCustomer(row)
        : !isExistingCustomer(row)
    }) ?? []

  const handleResetFilters = () => {
    setDateRangePreset('today')
    setDateRange([new Date(), new Date()])
    setSelectedBranch('all')
    setSelectedWaiter('all')
    setSelectedCustomerStatus(null)
    setSelectedOrderSource(null)
  }

  return (
    <div className="customer-report-container">
      <div className="report-header">
        <div className="report-title-row">
          <h1>Customer Report</h1>
          <div className="report-header-actions">
            <div className="export-container">
              <button
                className="export-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Report"
                type="button"
              >
                <span>Export</span>
                <span className="icon">↓</span>
              </button>
              {showExportMenu && (
                <div className="export-menu">
                  <button onClick={handleExportExcel} type="button">
                    Excel
                  </button>
                </div>
              )}
            </div>
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
            <button
              className="refresh-btn"
              onClick={handleResetFilters}
              title="Reset Filters"
              type="button"
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
              onChange={(update) => {
                setDateRange(update)
              }}
              monthsShown={1}
              dateFormat="yyyy-MM-dd"
              className="date-input"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
            />
          </div>

          <div className="filter-group select-group">
            <Select
              instanceId="branch-select"
              options={branchOptions}
              value={branchOptions.find((o) => o.value === selectedBranch)}
              onChange={(option: { value: string; label: string } | null) =>
                setSelectedBranch(option?.value || 'all')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Branch..."
              isSearchable={true}
            />
          </div>

          <div className="filter-group select-group">
            <Select
              instanceId="waiter-select"
              options={waiterOptions}
              value={waiterOptions.find((o) => o.value === selectedWaiter)}
              onChange={(option: { value: string; label: string } | null) =>
                setSelectedWaiter(option?.value || 'all')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Waiter..."
              isSearchable={true}
            />
          </div>

          <div className="filter-group select-group">
            <Select
              instanceId="customer-status-select"
              options={customerStatusOptions}
              value={customerStatusOptions.find((o) => o.value === selectedCustomerStatus) ?? null}
              onChange={(option: { value: CustomerStatusFilter; label: string } | null) =>
                setSelectedCustomerStatus(option?.value ?? null)
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="EXISTING / NEW / BF"
              isSearchable={false}
              isClearable={true}
            />
          </div>

          <div className="filter-group select-group">
            <Select
              instanceId="order-source-select"
              options={orderSourceOptions}
              value={orderSourceOptions.find((o) => o.value === selectedOrderSource) ?? null}
              onChange={(option: { value: OrderSourceFilter; label: string } | null) =>
                setSelectedOrderSource(option?.value ?? null)
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="TABLE / BILLING"
              isSearchable={false}
              isClearable={true}
            />
          </div>
        </div>
      </div>

      {data && (
        <div className="customer-summary-grid">
          <article className="customer-summary-card customer-summary-card--total">
            <div className="customer-summary-title">Total Amount</div>
            <div className="customer-summary-amount">
              {formatCurrencyAmount(customerSummary.total.amount)}
            </div>
            <div className="customer-summary-bills">{customerSummary.total.bills} Bills</div>
          </article>

          <article className="customer-summary-card customer-summary-card--existing">
            <div className="customer-summary-title">Existing Customer</div>
            <div className="customer-summary-amount">
              {formatCurrencyAmount(customerSummary.existing.amount)}
            </div>
            <div className="customer-summary-bills">{customerSummary.existing.bills} Bills</div>
          </article>

          <article className="customer-summary-card customer-summary-card--new">
            <div className="customer-summary-title">New Customer</div>
            <div className="customer-summary-amount">
              {formatCurrencyAmount(customerSummary.new.amount)}
            </div>
            <div className="customer-summary-bills">{customerSummary.new.bills} Bills</div>
          </article>

          <article className="customer-summary-card customer-summary-card--table">
            <div className="customer-summary-title">Table Order</div>
            <div className="customer-summary-amount">
              {formatCurrencyAmount(orderSourceSummary.table.amount)}
            </div>
            <div className="customer-summary-bills">{orderSourceSummary.table.bills} Bills</div>
          </article>

          <article className="customer-summary-card customer-summary-card--billing">
            <div className="customer-summary-title">Billing</div>
            <div className="customer-summary-amount">
              {formatCurrencyAmount(orderSourceSummary.billing.amount)}
            </div>
            <div className="customer-summary-bills">{orderSourceSummary.billing.bills} Bills</div>
          </article>
        </div>
      )}

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>CUSTOMER NAME</th>
                <th>PHONE NUMBER</th>
                <th>STATUS</th>
                <th>BRANCH</th>
                <th>WAITER</th>
                <th style={{ textAlign: 'right' }}>TOTAL BILLS</th>
                <th style={{ textAlign: 'right' }}>TOTAL AMOUNT</th>
                <th style={{ textAlign: 'right' }}>LAST PURCHASING DATE</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map((row, index) => {
                const canViewBill = getCustomerBillIds(row).length > 0
                const customerStatus = getCustomerStatus(row)
                return (
                  <tr
                    key={`${row.sNo}-${row.phoneNumber}-${row.billId || index}`}
                    className={
                      canViewBill ? 'customer-row customer-row--clickable' : 'customer-row'
                    }
                    onClick={canViewBill ? () => void handleCustomerRowClick(row) : undefined}
                    title={canViewBill ? 'Click to view latest bill' : 'Bill unavailable'}
                  >
                    <td>{index + 1}</td>
                    <td>{row.customerName?.toUpperCase()}</td>
                    <td>{row.phoneNumber}</td>
                    <td
                      className={
                        customerStatus === 'Existing'
                          ? 'customer-status customer-status--existing'
                          : 'customer-status customer-status--new'
                      }
                    >
                      {customerStatus}
                    </td>
                    <td>{row.branchName?.toUpperCase()}</td>
                    <td>{row.waiterName?.toUpperCase()}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      {getCustomerHistoryBillCount(row)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', fontSize: '1.1rem' }}>
                      {formatValue(row.totalAmount)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {new Date(row.lastPurchasingDate).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(selectedBills.length > 0 || loadingBills) && (
        <BillModal
          billDataList={selectedBills}
          loading={loadingBills}
          customerName={activeCustomerName}
          customerPhone={activeCustomerPhone}
          totalBills={selectedBillIDs.length}
          onClose={() => {
            billFetchTokenRef.current += 1
            setSelectedBills([])
            setLoadingBills(false)
            setSelectedBillIDs([])
            setActiveCustomerName('')
            setActiveCustomerPhone('')
          }}
        />
      )}
    </div>
  )
}

export default AfterstockCustomerReport
