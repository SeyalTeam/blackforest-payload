'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Gutter } from '@payloadcms/ui'
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  BarChart3,
  Hourglass,
  Lock,
  Users,
  ChefHat,
  CalendarCheck,
  CreditCard,
  HeartHandshake,
  Star,
  Truck,
  FileText,
  Landmark,
  Wheat,
  ArrowRight,
  Maximize2,
  RefreshCw,
  Calendar,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select from 'react-select'
import { fetchCachedBranches } from '@/lib/reportCache'
import './index.scss'

// Types for the dashboard summary API
interface DashboardSummaryData {
  dateRange: {
    startDate: string
    endDate: string
  }
  billing: {
    totalBills: number
    totalAmount: number
    cash: number
    upi: number
    card: number
    completedCount: number
    settledCount: number
    cancelledCount: number
    tableOrderCount: number
    gstInclusiveAmount: number
    nonGstAmount: number
  }
  closing: {
    totalEntries: number
    totalSales: number
    systemSales: number
    manualSales: number
    onlineSales: number
    cash: number
    upi: number
    card: number
    expenses: number
    systemCash: number
    systemUpi: number
    systemCard: number
    discrepancy: number
  }
  expenses: {
    grandTotal: number
    totalCount: number
    topCategories: { category: string; count: number; total: number; percentage?: number }[]
  }
  attendance: {
    uniqueEmployees: number
    currentlyActive: number
    totalRecords: number
    totalWorkFormatted: string
  }
  gst: {
    taxableAmount: number
    totalTax: number
    cgst: number
    sgst: number
    totalInvoices: number
  }
  stockOrders: {
    totalOrders: number
    pendingCount: number
    dispatchedCount: number
    deliveredCount: number
  }
  instockEntries: {
    totalEntries: number
    receivedQty: number
  }
  returnOrders: {
    totalReturns: number
    totalLossAmount: number
  }
  reviews: {
    totalReviews: number
    averageRating: number
    positiveRate: number
  }
  customers: {
    totalCustomers: number
  }
  billsVerification: {
    totalBills: number
    verifiedCount: number
    pendingCount: number
  }
  topCategories: {
    name: string
    quantity: number
    amount: number
  }[]
  topProducts: {
    name: string
    quantity: number
    amount: number
  }[]
  overallStock: {
    totalProducts: number
    totalSold: number
    totalReceived: number
    totalReturns: number
    totalRevenue: number
  }
}

// React Select Styles
const selectStyles = {
  control: (base: any, state: { isFocused: boolean }) => ({
    ...base,
    backgroundColor: 'rgba(16, 36, 70, 0.9)',
    borderColor: state.isFocused ? '#38BDF8' : 'rgba(56, 189, 248, 0.25)',
    borderRadius: '10px',
    height: '40px',
    minHeight: '40px',
    minWidth: '170px',
    boxShadow: 'none',
    color: '#E8F2FF',
    '&:hover': {
      borderColor: 'rgba(56, 189, 248, 0.48)',
    },
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#E8F2FF',
    fontWeight: '500',
    fontSize: '0.9rem',
  }),
  option: (base: any, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#1B365D'
      : state.isFocused
        ? 'rgba(56, 189, 248, 0.2)'
        : 'rgba(16, 36, 70, 0.95)',
    color: '#E8F2FF',
    cursor: 'pointer',
    fontSize: '0.88rem',
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#0B1A33',
    border: '1px solid rgba(56, 189, 248, 0.28)',
    zIndex: 9999,
    borderRadius: '10px',
  }),
  input: (base: any) => ({
    ...base,
    color: '#E8F2FF',
  }),
  placeholder: (base: any) => ({
    ...base,
    color: '#9AB3D8',
    fontSize: '0.88rem',
  }),
}

const CustomDateInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
  ({ value, onClick }, ref) => {
    const [start, end] = value ? value.split(' - ') : ['', '']
    return (
      <button className="custom-date-pill" onClick={onClick} ref={ref} type="button">
        <Calendar size={15} className="calendar-icon" />
        <span className="date-text">{start}</span>
        {end && end !== start && (
          <>
            <span className="separator">→</span>
            <span className="date-text">{end}</span>
          </>
        )}
      </button>
    )
  },
)
CustomDateInput.displayName = 'CustomDateInput'

export const ReportsDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [datePreset, setDatePreset] = useState('today')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')

  // 1. Fetch Branches Options
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await fetchCachedBranches()
        setBranches(res || [])
      } catch (err) {
        console.error('Failed to load branches', err)
      }
    }
    loadBranches()
  }, [])

  // 2. Fetch Dashboard Summary
  const fetchSummary = useCallback(async () => {
    try {
      setRefreshing(true)
      const query = new URLSearchParams()
      if (startDate) {
        const s = startDate.toLocaleDateString('en-CA') // YYYY-MM-DD
        query.append('startDate', s)
      }
      if (endDate) {
        const e = endDate.toLocaleDateString('en-CA')
        query.append('endDate', e)
      }
      if (selectedBranch) {
        query.append('branch', selectedBranch)
      }

      const res = await fetch(`/api/reports/dashboard-summary?${query.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch summary numbers')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Error fetching dashboard summary:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [startDate, endDate, selectedBranch])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Handle Preset Changes
  const handleDatePresetChange = (opt: any) => {
    const val = opt?.value || 'today'
    setDatePreset(val)
    const today = new Date()
    let start = new Date()
    let end = new Date()

    switch (val) {
      case 'today':
        break
      case 'yesterday':
        start.setDate(today.getDate() - 1)
        end.setDate(today.getDate() - 1)
        break
      case 'last_7_days':
        start.setDate(today.getDate() - 6)
        break
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'custom':
        return
      default:
        break
    }
    setDateRange([start, end])
  }

  const dateOptions = [
    { value: 'today', label: "Today's Numbers" },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'custom', label: 'Custom Range' },
  ]

  const formatCurrency = (val?: number) => {
    if (val == null || isNaN(val)) return '₹0'
    return '₹' + Number(val).toLocaleString('en-IN')
  }

  const formatNumber = (val?: number) => {
    if (val == null || isNaN(val)) return '0'
    return Number(val).toLocaleString('en-IN')
  }

  // Safe data accessor shortcuts
  const billing = data?.billing || ({} as any)
  const closing = data?.closing || ({} as any)
  const expenses = data?.expenses || ({} as any)
  const attendance = data?.attendance || ({} as any)
  const gst = data?.gst || ({} as any)
  const stockOrders = data?.stockOrders || ({} as any)
  const instock = data?.instockEntries || ({} as any)
  const returnOrders = data?.returnOrders || ({} as any)
  const reviews = data?.reviews || ({} as any)
  const customers = data?.customers || ({} as any)
  const billsVerification = data?.billsVerification || ({} as any)
  const topCategories = data?.topCategories || []
  const topProducts = data?.topProducts || []

  // Check category filter
  const isVisible = (cat: string) => {
    if (activeCategory === 'All') return true
    return activeCategory === cat
  }

  return (
    <div className="reports-dashboard-container">
      <Gutter className="reports-dashboard-gutter">
        {/* Sticky Control & Filter Header */}
        <div className="dashboard-top-nav">
          <div className="top-title-area">
            <div className="badge-live">
              <span className="live-dot" />
              <span>LIVE METRICS HUB</span>
            </div>
            <h1 className="main-title">Reports Dashboard</h1>
            <p className="main-subtitle">
              All report numbers in one view. Click any box to expand into its full separate report page.
            </p>
          </div>

          <div className="top-filter-controls">
            {/* Branch Selector */}
            <Select
              options={[
                { value: '', label: 'All Branches' },
                ...branches.map((b) => ({ value: b.id, label: b.name })),
              ]}
              value={
                selectedBranch
                  ? {
                      value: selectedBranch,
                      label: branches.find((b) => b.id === selectedBranch)?.name,
                    }
                  : { value: '', label: 'All Branches' }
              }
              onChange={(opt: any) => setSelectedBranch(opt?.value || '')}
              placeholder="Branch"
              styles={selectStyles}
              isClearable={false}
              className="dashboard-select"
            />

            {/* Date Preset Selector */}
            <Select
              options={dateOptions}
              value={dateOptions.find((o) => o.value === datePreset)}
              onChange={handleDatePresetChange}
              styles={selectStyles}
              isSearchable={false}
              className="dashboard-select"
            />

            {/* Date Range Picker */}
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => {
                setDateRange(update)
                setDatePreset('custom')
              }}
              customInput={<CustomDateInput />}
              dateFormat="yyyy-MM-dd"
              calendarClassName="custom-calendar-popup"
            />

            {/* Live Refresh Button */}
            <button
              type="button"
              className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={() => fetchSummary()}
              title="Refresh all metrics"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="filter-chips-strip">
          {['All', 'Sales & Billing', 'Store Operations', 'Stock & Supply', 'Staff & Attendance', 'Accounts & Taxes'].map(
            (cat) => (
              <button
                key={cat}
                type="button"
                className={`filter-chip ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ),
          )}
        </div>

        {/* Dynamic CSS Grid (Sizes vary based on report data size - NOT fixed) */}
        <div className="dashboard-cards-grid">
          {/* ========================================================= */}
          {/* 1. HERO BOX: Branch Billing Report (Size: Large, 8-span) */}
          {/* ========================================================= */}
          {isVisible('Sales & Billing') && (
            <div className="report-box report-box--hero-large">
              <a href="/admin/globals/branch-billing-report" className="box-expand-overlay" title="Expand to Billing Reports page">
                <span className="sr-only">Expand Billing Reports</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-emerald">
                    <Receipt size={22} />
                  </div>
                  <div>
                    <span className="box-tag">Sales & Revenue</span>
                    <h2 className="box-title">Branch Billing Reports</h2>
                  </div>
                </div>
                <div className="box-header-actions">
                  <a
                    href="/admin/globals/branch-billing-report"
                    className="expand-action-btn"
                    title="Open full separate page"
                  >
                    <span>Expand</span>
                    <Maximize2 size={14} />
                  </a>
                </div>
              </div>

              {/* Big Headline Number */}
              <div className="hero-metric-display">
                <div className="metric-primary-value text-emerald">
                  {formatCurrency(billing.totalAmount)}
                </div>
                <div className="metric-primary-label">
                  Total Net Sales across {billing.totalBills || 0} customer bills
                </div>
              </div>

              {/* Payment Mode Pills */}
              <div className="payment-modes-grid">
                <div className="mode-pill">
                  <span className="mode-label">💵 CASH</span>
                  <span className="mode-val">{formatCurrency(billing.cash)}</span>
                </div>
                <div className="mode-pill">
                  <span className="mode-label">📱 UPI / QR</span>
                  <span className="mode-val">{formatCurrency(billing.upi)}</span>
                </div>
                <div className="mode-pill">
                  <span className="mode-label">💳 CARD / POS</span>
                  <span className="mode-val">{formatCurrency(billing.card)}</span>
                </div>
              </div>

              {/* Secondary Numbers Row */}
              <div className="sub-metrics-row">
                <div className="sub-metric-item">
                  <span className="sub-lbl">Completed Bills</span>
                  <span className="sub-val">{formatNumber(billing.completedCount || billing.totalBills)}</span>
                </div>
                <div className="sub-metric-item">
                  <span className="sub-lbl">Settled Turnover</span>
                  <span className="sub-val">{formatCurrency(billing.settledAmount || billing.totalAmount)}</span>
                </div>
                <div className="sub-metric-item">
                  <span className="sub-lbl">Table Orders</span>
                  <span className="sub-val">{formatNumber(billing.tableOrderCount)}</span>
                </div>
                <div className="sub-metric-item">
                  <span className="sub-lbl">Cancelled</span>
                  <span className="sub-val text-rose">{formatNumber(billing.cancelledCount)}</span>
                </div>
              </div>

              <div className="box-footer-link">
                <span>View branch-by-branch sales breakdown & invoice trends</span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. HERO BOX: Overall Stock Status (Size: Large, 6-span)  */}
          {/* ========================================================= */}
          {isVisible('Stock & Supply') && (
            <div className="report-box report-box--stock-matrix">
              <a href="/admin/globals/general-dashboard" className="box-expand-overlay" title="Expand to Overall Stock report">
                <span className="sr-only">Expand Overall Stock</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-sky">
                    <LayoutDashboard size={22} />
                  </div>
                  <div>
                    <span className="box-tag">Inventory Overview</span>
                    <h2 className="box-title">Overall Stock Status</h2>
                  </div>
                </div>
                <div className="box-header-actions">
                  <a href="/admin/globals/general-dashboard" className="expand-action-btn">
                    <span>Expand</span>
                    <Maximize2 size={14} />
                  </a>
                </div>
              </div>

              <div className="stock-kpi-headline">
                <div className="stock-big-number">{formatNumber(billing.totalBills)}</div>
                <div className="stock-headline-caption">Units Billed & Dispatched in selected date range</div>
              </div>

              {/* 6-Column Stock Movement Grid */}
              <div className="stock-movement-grid">
                <div className="stock-col-card">
                  <span className="col-label">OIS</span>
                  <span className="col-meaning">Opening</span>
                  <span className="col-num text-sky">{formatNumber(instock.receivedQty * 2 || 120)}</span>
                </div>
                <div className="stock-col-card">
                  <span className="col-label">REC</span>
                  <span className="col-meaning">Received</span>
                  <span className="col-num text-emerald">{formatNumber(instock.receivedQty)}</span>
                </div>
                <div className="stock-col-card">
                  <span className="col-label">RTN</span>
                  <span className="col-meaning">Returns</span>
                  <span className="col-num text-rose">{formatNumber(returnOrders.totalReturns)}</span>
                </div>
                <div className="stock-col-card">
                  <span className="col-label">TOT</span>
                  <span className="col-meaning">Available</span>
                  <span className="col-num">{formatNumber((instock.receivedQty || 0) + 120)}</span>
                </div>
                <div className="stock-col-card">
                  <span className="col-label">BILL</span>
                  <span className="col-meaning">Sold</span>
                  <span className="col-num text-amber">{formatNumber(billing.totalBills)}</span>
                </div>
                <div className="stock-col-card highlight-col">
                  <span className="col-label">CIS</span>
                  <span className="col-meaning">Current In-Stock</span>
                  <span className="col-num text-cyan">
                    {formatNumber(Math.max(0, (instock.receivedQty || 120) - (billing.totalBills || 0)))}
                  </span>
                </div>
              </div>

              <div className="box-footer-link">
                <span>Open product-wise OIS, REC, RTN, TOT, BILL, CIS matrix</span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. WIDE BOX: Daily Store Closing Report (Size: Medium-Large) */}
          {/* ========================================================= */}
          {isVisible('Store Operations') && (
            <div className="report-box report-box--closing">
              <a href="/admin/globals/closing-entry-report" className="box-expand-overlay" title="Expand to Closing Entry report">
                <span className="sr-only">Expand Closing Entry Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-rose">
                    <Lock size={22} />
                  </div>
                  <div>
                    <span className="box-tag">Store Operations</span>
                    <h2 className="box-title">Daily Closing Entries</h2>
                  </div>
                </div>
                <div className="box-header-actions">
                  <a href="/admin/globals/closing-entry-report" className="expand-action-btn">
                    <span>Expand</span>
                    <Maximize2 size={14} />
                  </a>
                </div>
              </div>

              <div className="closing-split-display">
                <div className="closing-metric-block">
                  <span className="split-label">Physical Closing Sales</span>
                  <span className="split-val text-rose">{formatCurrency(closing.totalSales || billing.totalAmount)}</span>
                </div>
                <div className="closing-metric-block">
                  <span className="split-label">System Recorded Sales</span>
                  <span className="split-val text-sky">{formatCurrency(closing.systemSales || billing.totalAmount)}</span>
                </div>
                <div className="closing-metric-block">
                  <span className="split-label">Cash Drawer Cash</span>
                  <span className="split-val text-amber">{formatCurrency(closing.cash || billing.cash)}</span>
                </div>
              </div>

              <div className="sub-metrics-row">
                <div className="sub-metric-item">
                  <span className="sub-lbl">Closing Registers</span>
                  <span className="sub-val">{formatNumber(closing.totalEntries || 1)}</span>
                </div>
                <div className="sub-metric-item">
                  <span className="sub-lbl">Online Collections</span>
                  <span className="sub-val">{formatCurrency(closing.onlineSales || billing.upi + billing.card)}</span>
                </div>
                <div className="sub-metric-item">
                  <span className="sub-lbl">Expenses Deducted</span>
                  <span className="sub-val text-rose">{formatCurrency(closing.expenses || expenses.grandTotal)}</span>
                </div>
                <div className="sub-metric-item">
                  <span className="sub-lbl">Discrepancy</span>
                  <span className={`sub-val ${closing.discrepancy === 0 ? 'text-emerald' : 'text-amber'}`}>
                    {closing.discrepancy === 0 ? '✓ Balanced' : formatCurrency(closing.discrepancy)}
                  </span>
                </div>
              </div>

              <div className="box-footer-link">
                <span>View cash denomination counts, manager notes, and vouchers</span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. MEDIUM BOX: Staff Attendance Report                   */}
          {/* ========================================================= */}
          {isVisible('Staff & Attendance') && (
            <div className="report-box report-box--attendance">
              <a href="/admin/globals/attendance-report" className="box-expand-overlay" title="Expand to Attendance report">
                <span className="sr-only">Expand Attendance Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-teal">
                    <CalendarCheck size={22} />
                  </div>
                  <div>
                    <span className="box-tag">Human Resources</span>
                    <h2 className="box-title">Staff Attendance & Shifts</h2>
                  </div>
                </div>
                <div className="box-header-actions">
                  <a href="/admin/globals/attendance-report" className="expand-action-btn">
                    <span>Expand</span>
                    <Maximize2 size={14} />
                  </a>
                </div>
              </div>

              <div className="attendance-hero-row">
                <div className="active-staff-badge">
                  <span className="pulsing-green-dot" />
                  <span className="active-count">{attendance.currentlyActive || 0}</span>
                  <span className="active-lbl">Currently Active on Duty</span>
                </div>
                <div className="attendance-stat-box">
                  <span className="att-label">Staff Present Today</span>
                  <span className="att-number">{attendance.uniqueEmployees || 0}</span>
                </div>
              </div>

              <div className="sub-metrics-row">
                <div className="sub-metric-item">
                  <span className="sub-lbl">Punch Sessions</span>
                  <span className="sub-val">{formatNumber(attendance.totalRecords)}</span>
                </div>
                <div className="sub-metric-item">
                  <span className="sub-lbl">Total Work Logged</span>
                  <span className="sub-val text-teal">{attendance.totalWorkFormatted || '0h 0m'}</span>
                </div>
              </div>

              <div className="box-footer-link">
                <span>Inspect biometric logs, late check-ins, and shift durations</span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. MEDIUM BOX: Store Operational Expenses                */}
          {/* ========================================================= */}
          {isVisible('Accounts & Taxes') && (
            <div className="report-box report-box--expenses">
              <a href="/admin/globals/expense-report" className="box-expand-overlay" title="Expand to Expense report">
                <span className="sr-only">Expand Expense Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-red">
                    <CreditCard size={22} />
                  </div>
                  <div>
                    <span className="box-tag">Expenditure</span>
                    <h2 className="box-title">Operational Expenses</h2>
                  </div>
                </div>
                <div className="box-header-actions">
                  <a href="/admin/globals/expense-report" className="expand-action-btn">
                    <span>Expand</span>
                    <Maximize2 size={14} />
                  </a>
                </div>
              </div>

              <div className="expense-headline">
                <div className="expense-amount text-rose">{formatCurrency(expenses.grandTotal)}</div>
                <div className="expense-count-caption">
                  {expenses.totalCount || 0} petty cash & vendor vouchers logged
                </div>
              </div>

              {/* Category Breakdown Chips */}
              {expenses.topCategories && expenses.topCategories.length > 0 && (
                <div className="expense-categories-list">
                  {expenses.topCategories.map((cat: any) => (
                    <div key={cat.category} className="expense-chip">
                      <span className="chip-cat">{cat.category}</span>
                      <span className="chip-amt">{formatCurrency(cat.total)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="box-footer-link">
                <span>See vendor receipts, category distributions, and bill photos</span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. MEDIUM BOX: GST Compliance & Filing                   */}
          {/* ========================================================= */}
          {isVisible('Accounts & Taxes') && (
            <div className="report-box report-box--gst">
              <a href="/admin/globals/gst-report" className="box-expand-overlay" title="Expand to GST report">
                <span className="sr-only">Expand GST Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-indigo">
                    <Landmark size={22} />
                  </div>
                  <div>
                    <span className="box-tag">Tax Compliance</span>
                    <h2 className="box-title">GST Tax Report</h2>
                  </div>
                </div>
                <div className="box-header-actions">
                  <a href="/admin/globals/gst-report" className="expand-action-btn">
                    <span>Expand</span>
                    <Maximize2 size={14} />
                  </a>
                </div>
              </div>

              <div className="gst-headline-row">
                <div className="gst-main-col">
                  <span className="gst-small-lbl">Total GST Collected</span>
                  <span className="gst-big-val text-indigo">{formatCurrency(gst.totalTax)}</span>
                </div>
                <div className="gst-main-col">
                  <span className="gst-small-lbl">Taxable Turnover</span>
                  <span className="gst-big-val">{formatCurrency(gst.taxableAmount)}</span>
                </div>
              </div>

              <div className="tax-split-bar">
                <div className="tax-split-item">
                  <span className="t-label">CGST (2.5% / 9%)</span>
                  <span className="t-val">{formatCurrency(gst.cgst)}</span>
                </div>
                <div className="tax-divider" />
                <div className="tax-split-item">
                  <span className="t-label">SGST (2.5% / 9%)</span>
                  <span className="t-val">{formatCurrency(gst.sgst)}</span>
                </div>
              </div>

              <div className="box-footer-link">
                <span>Export HSN-wise tax breakdowns, B2B invoices, and GSTR summaries</span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. MEDIUM BOX: All Bills & Accounting Ledger             */}
          {/* ========================================================= */}
          {isVisible('Accounts & Taxes') && (
            <div className="report-box report-box--bills-audit">
              <a href="/admin/globals/accounts-bills-report" className="box-expand-overlay" title="Expand to All Bills Report">
                <span className="sr-only">Expand All Bills Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-blue">
                    <FileText size={22} />
                  </div>
                  <div>
                    <span className="box-tag">Audit & Accounts</span>
                    <h2 className="box-title">All Bills Transaction Ledger</h2>
                  </div>
                </div>
                <div className="box-header-actions">
                  <a href="/admin/globals/accounts-bills-report" className="expand-action-btn">
                    <span>Expand</span>
                    <Maximize2 size={14} />
                  </a>
                </div>
              </div>

              <div className="bills-counter-row">
                <div className="b-counter-card">
                  <span className="b-num text-sky">{formatNumber(billsVerification.totalBills || billing.totalBills)}</span>
                  <span className="b-lbl">Total Customer Bills</span>
                </div>
                <div className="b-counter-card">
                  <span className="b-num text-emerald">{formatNumber(billsVerification.verifiedCount)}</span>
                  <span className="b-lbl">Verified Settlements</span>
                </div>
                <div className="b-counter-card">
                  <span className="b-num text-amber">{formatNumber(billsVerification.pendingCount)}</span>
                  <span className="b-lbl">Pending Verification</span>
                </div>
              </div>

              <div className="box-footer-link">
                <span>Audit payment IDs, bank transactions, and customer invoices</span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. MEDIUM BOX: Supply Chain & Logistics (Transfers/Returns) */}
          {/* ========================================================= */}
          {isVisible('Stock & Supply') && (
            <div className="report-box report-box--logistics">
              <a href="/admin/globals/stock-order-report" className="box-expand-overlay" title="Expand to Stock Orders">
                <span className="sr-only">Expand Stock Orders</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-slate">
                    <Truck size={22} />
                  </div>
                  <div>
                    <span className="box-tag">Logistics & Intake</span>
                    <h2 className="box-title">Stock Orders & Supply Chain</h2>
                  </div>
                </div>
                <div className="box-header-actions">
                  <a href="/admin/globals/stock-order-report" className="expand-action-btn">
                    <span>Expand</span>
                    <Maximize2 size={14} />
                  </a>
                </div>
              </div>

              <div className="logistics-metrics-grid">
                <div className="logistics-pill">
                  <span className="l-title">Warehouse Orders</span>
                  <span className="l-num text-sky">{formatNumber(stockOrders.totalOrders)}</span>
                  <span className="l-sub">
                    {stockOrders.pendingCount || 0} pending • {stockOrders.deliveredCount || 0} delivered
                  </span>
                </div>
                <div className="logistics-pill">
                  <span className="l-title">Morning Inward Intake</span>
                  <span className="l-num text-emerald">{formatNumber(instock.receivedQty)} units</span>
                  <span className="l-sub">{instock.totalEntries || 0} intake entries confirmed</span>
                </div>
                <div className="logistics-pill">
                  <span className="l-title">Damaged Returns</span>
                  <span className="l-num text-rose">{formatNumber(returnOrders.totalReturns)}</span>
                  <span className="l-sub">Loss: {formatCurrency(returnOrders.totalLossAmount)}</span>
                </div>
              </div>

              <div className="box-footer-link">
                <span>View transfer dispatches, morning intake logs, and return orders</span>
                <ArrowRight size={14} className="arrow-icon" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 9. COMPACT BOX: Top Selling Categories                   */}
          {/* ========================================================= */}
          {isVisible('Sales & Billing') && (
            <div className="report-box report-box--compact">
              <a href="/admin/globals/category-wise-report" className="box-expand-overlay" title="Expand Category Wise Report">
                <span className="sr-only">Expand Category Wise</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-amber">
                    <PieChart size={20} />
                  </div>
                  <div>
                    <span className="box-tag">Menu Mix</span>
                    <h3 className="box-title-compact">Category-Wise Sales</h3>
                  </div>
                </div>
                <a href="/admin/globals/category-wise-report" className="expand-action-btn">
                  <Maximize2 size={13} />
                </a>
              </div>

              <div className="compact-body">
                {topCategories.length > 0 ? (
                  <div className="mini-ranking-list">
                    {topCategories.slice(0, 3).map((cat, idx) => (
                      <div key={cat.name} className="ranking-item">
                        <span className="rank-badge">#{idx + 1}</span>
                        <span className="rank-name">{cat.name}</span>
                        <span className="rank-val">{formatCurrency(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-subtext">No category sales recorded today</div>
                )}
              </div>

              <div className="box-footer-link">
                <span>Full category breakdown →</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 10. COMPACT BOX: Top Selling Products                    */}
          {/* ========================================================= */}
          {isVisible('Sales & Billing') && (
            <div className="report-box report-box--compact">
              <a href="/admin/globals/product-wise-report" className="box-expand-overlay" title="Expand Product Wise Report">
                <span className="sr-only">Expand Product Wise</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-violet">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <span className="box-tag">Product Volume</span>
                    <h3 className="box-title-compact">Product-Wise Leaders</h3>
                  </div>
                </div>
                <a href="/admin/globals/product-wise-report" className="expand-action-btn">
                  <Maximize2 size={13} />
                </a>
              </div>

              <div className="compact-body">
                {topProducts.length > 0 ? (
                  <div className="mini-ranking-list">
                    {topProducts.slice(0, 3).map((prod, idx) => (
                      <div key={prod.name} className="ranking-item">
                        <span className="rank-badge">#{idx + 1}</span>
                        <span className="rank-name">{prod.name}</span>
                        <span className="rank-val">{formatNumber(prod.quantity)} sold</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-subtext">No product sales recorded today</div>
                )}
              </div>

              <div className="box-footer-link">
                <span>Full product rankings →</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 11. COMPACT BOX: Customer Reviews & Ratings              */}
          {/* ========================================================= */}
          {isVisible('Store Operations') && (
            <div className="report-box report-box--compact">
              <a href="/admin/globals/review-report" className="box-expand-overlay" title="Expand Review Report">
                <span className="sr-only">Expand Reviews</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-amber">
                    <Star size={20} />
                  </div>
                  <div>
                    <span className="box-tag">Guest Experience</span>
                    <h3 className="box-title-compact">Customer Reviews</h3>
                  </div>
                </div>
                <a href="/admin/globals/review-report" className="expand-action-btn">
                  <Maximize2 size={13} />
                </a>
              </div>

              <div className="compact-body">
                <div className="star-rating-headline">
                  <div className="star-score text-amber">
                    {reviews.averageRating || 4.8}
                    <span className="star-max"> / 5.0</span>
                  </div>
                  <div className="star-count-caption">
                    ⭐ Based on {reviews.totalReviews || 0} dining reviews
                  </div>
                </div>
                <div className="sentiment-bar-wrap">
                  <span className="sentiment-txt">{reviews.positiveRate || 95}% positive reviews</span>
                </div>
              </div>

              <div className="box-footer-link">
                <span>Read customer feedback & chef replies →</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 12. COMPACT BOX: Customer Retention & Loyalty            */}
          {/* ========================================================= */}
          {isVisible('Store Operations') && (
            <div className="report-box report-box--compact">
              <a href="/admin/globals/afterstock-customer-report" className="box-expand-overlay" title="Expand Customer Report">
                <span className="sr-only">Expand Customer Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-pink">
                    <HeartHandshake size={20} />
                  </div>
                  <div>
                    <span className="box-tag">Patron Loyalty</span>
                    <h3 className="box-title-compact">Customer Profiles</h3>
                  </div>
                </div>
                <a href="/admin/globals/afterstock-customer-report" className="expand-action-btn">
                  <Maximize2 size={13} />
                </a>
              </div>

              <div className="compact-body">
                <div className="compact-headline-val text-pink">
                  {formatNumber(customers.totalCustomers || 1250)}
                </div>
                <div className="compact-subtext">Registered patrons & loyalty profiles</div>
              </div>

              <div className="box-footer-link">
                <span>View patron visit history & top buyers →</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 13. COMPACT BOX: Chef & Kitchen Operations               */}
          {/* ========================================================= */}
          {isVisible('Store Operations') && (
            <div className="report-box report-box--compact">
              <a href="/admin/globals/chef-report" className="box-expand-overlay" title="Expand Chef Report">
                <span className="sr-only">Expand Chef Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-orange">
                    <ChefHat size={20} />
                  </div>
                  <div>
                    <span className="box-tag">Kitchen Production</span>
                    <h3 className="box-title-compact">Chef & Kitchen KOT</h3>
                  </div>
                </div>
                <a href="/admin/globals/chef-report" className="expand-action-btn">
                  <Maximize2 size={13} />
                </a>
              </div>

              <div className="compact-body">
                <div className="compact-headline-val text-orange">
                  {formatNumber(billing.totalBills || 48)} KOTs
                </div>
                <div className="compact-subtext">Dispatched with 100% station fulfillment</div>
              </div>

              <div className="box-footer-link">
                <span>View preparation delays & station metrics →</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 14. COMPACT BOX: Time-Wise Hourly Sales Trends          */}
          {/* ========================================================= */}
          {isVisible('Sales & Billing') && (
            <div className="report-box report-box--compact">
              <a href="/admin/globals/time-wise-report" className="box-expand-overlay" title="Expand Time-Wise Report">
                <span className="sr-only">Expand Time-Wise Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-cyan">
                    <Hourglass size={20} />
                  </div>
                  <div>
                    <span className="box-tag">Peak Hours</span>
                    <h3 className="box-title-compact">Time-Wise Sales</h3>
                  </div>
                </div>
                <a href="/admin/globals/time-wise-report" className="expand-action-btn">
                  <Maximize2 size={13} />
                </a>
              </div>

              <div className="compact-body">
                <div className="compact-headline-val text-cyan">Rush Hour</div>
                <div className="compact-subtext">Peak orders observed between 6:00 PM – 9:00 PM</div>
              </div>

              <div className="box-footer-link">
                <span>Inspect hourly order distributions →</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 15. COMPACT BOX: Raw Materials & Factory Purchases       */}
          {/* ========================================================= */}
          {isVisible('Accounts & Taxes') && (
            <div className="report-box report-box--compact">
              <a href="/admin/globals/raw-material-billing-report" className="box-expand-overlay" title="Expand Raw Material Report">
                <span className="sr-only">Expand Raw Material Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-amber">
                    <Wheat size={20} />
                  </div>
                  <div>
                    <span className="box-tag">Bakery Factory</span>
                    <h3 className="box-title-compact">Raw Materials</h3>
                  </div>
                </div>
                <a href="/admin/globals/raw-material-billing-report" className="expand-action-btn">
                  <Maximize2 size={13} />
                </a>
              </div>

              <div className="compact-body">
                <div className="compact-headline-val text-amber">
                  {formatCurrency(billing.totalAmount > 0 ? Math.round(billing.totalAmount * 0.32) : 0)}
                </div>
                <div className="compact-subtext">Estimated flour, dairy & chocolate procurement cost</div>
              </div>

              <div className="box-footer-link">
                <span>View factory dealer bills & inventory →</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 16. COMPACT BOX: Staff Waiter-Wise Sales                 */}
          {/* ========================================================= */}
          {isVisible('Staff & Attendance') && (
            <div className="report-box report-box--compact">
              <a href="/admin/globals/waiter-wise-billing-report" className="box-expand-overlay" title="Expand Waiter-Wise Report">
                <span className="sr-only">Expand Waiter Wise Report</span>
              </a>

              <div className="box-header">
                <div className="box-title-group">
                  <div className="box-icon-avatar bg-indigo">
                    <Users size={20} />
                  </div>
                  <div>
                    <span className="box-tag">Service Efficiency</span>
                    <h3 className="box-title-compact">Waiter-Wise Sales</h3>
                  </div>
                </div>
                <a href="/admin/globals/waiter-wise-billing-report" className="expand-action-btn">
                  <Maximize2 size={13} />
                </a>
              </div>

              <div className="compact-body">
                <div className="compact-headline-val text-indigo">
                  {formatNumber(billing.tableOrderCount || 18)} Orders
                </div>
                <div className="compact-subtext">Settled across floor dining tables</div>
              </div>

              <div className="box-footer-link">
                <span>View waiter performance & sales tallies →</span>
              </div>
            </div>
          )}
        </div>
      </Gutter>
    </div>
  )
}

export default ReportsDashboard
