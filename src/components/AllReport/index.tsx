'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import dayjs from 'dayjs'
import './index.scss'
import { fetchCachedBranches, fetchCachedFirstBillDate } from '@/lib/reportCache'

export type BranchTheme = {
  name: string
  bg: string         // Filled background colour for slice
  activeBg: string   // Richer filled background colour on hover/active
  border: string     // Boundary stroke border
  dash: string       // Deep dashed line colour suitable for the background
  text: string       // Label text colour with high contrast
}

// Vibrant branch themes: Blue, Orange, Purple, Yellow, Green
export const BRANCH_THEMES: BranchTheme[] = [
  // 1. Blue
  {
    name: 'Blue',
    bg: '#dbeafe',       // Soft sky-blue fill
    activeBg: '#bfdbfe', // Rich blue fill on active
    border: '#93c5fd',   // Clean border
    dash: '#1d4ed8',     // Deep royal blue dashed line, highly visible
    text: '#1e40af',
  },
  // 2. Orange
  {
    name: 'Orange',
    bg: '#ffedd5',       // Soft orange fill
    activeBg: '#fed7aa', // Rich orange fill on active
    border: '#fdba74',   // Clean border
    dash: '#ea580c',     // Deep vibrant orange dashed line, highly visible
    text: '#c2410c',
  },
  // 3. Purple
  {
    name: 'Purple',
    bg: '#f3e8ff',       // Soft lavender/purple fill
    activeBg: '#e9d5ff', // Rich purple fill on active
    border: '#d8b4fe',   // Clean border
    dash: '#7c3aed',     // Deep royal purple dashed line, highly visible
    text: '#6d28d9',
  },
  // 4. Yellow
  {
    name: 'Yellow',
    bg: '#fef9c3',       // Soft golden yellow fill
    activeBg: '#fef08a', // Rich yellow fill on active
    border: '#fde047',   // Clean border
    dash: '#ca8a04',     // Deep golden amber dashed line, highly visible on yellow
    text: '#a16207',
  },
  // 5. Green
  {
    name: 'Green',
    bg: '#dcfce7',       // Soft mint/green fill
    activeBg: '#bbf7d0', // Rich green fill on active
    border: '#86efac',   // Clean border
    dash: '#16a34a',     // Deep emerald green dashed line, highly visible
    text: '#15803d',
  },
  // Fallbacks if more than 5 branches:
  {
    name: 'Sky Blue',
    bg: '#e0f2fe',
    activeBg: '#bae6fd',
    border: '#7dd3fc',
    dash: '#0284c7',
    text: '#0369a1',
  },
  {
    name: 'Amber',
    bg: '#fef3c7',
    activeBg: '#fde68a',
    border: '#fcd34d',
    dash: '#d97706',
    text: '#b45309',
  },
  {
    name: 'Rose',
    bg: '#ffe4e6',
    activeBg: '#fecdd3',
    border: '#fda4af',
    dash: '#e11d48',
    text: '#be123c',
  },
  {
    name: 'Violet',
    bg: '#ede9fe',
    activeBg: '#ddd6fe',
    border: '#c4b5fd',
    dash: '#8b5cf6',
    text: '#6d28d9',
  },
  {
    name: 'Teal',
    bg: '#ccfbf1',
    activeBg: '#99f6e4',
    border: '#5eead4',
    dash: '#0d9488',
    text: '#0f766e',
  },
]

type BranchOption = { id: string; name: string }

type TrendPointItem = {
  label: string
  fullLabel: string
  totalAmount: number
  totalBills: number
  normalAmount: number
  tableOrderAmount: number
  ratio: number
  totalExpense?: number
  totalReturn?: number
  totalStockOrder?: number
  totalDealerBilling?: number
}

type BranchSliceItem = {
  id: string
  code: string
  name: string
  amount: number
  percentage: number
  color: string
  theme: BranchTheme
  bills: number
  normalAmount: number
  tableAmount: number
}

export type FinancialStreamTheme = {
  name: string
  bg: string
  activeBg: string
  border: string
  dash: string
  text: string
}

export type FinancialStreamItem = {
  id: 'sales' | 'expense' | 'stock_order' | 'return_order' | 'salary' | 'other_products'
  name: string
  code: string
  amount: number
  percentage: number
  theme: FinancialStreamTheme
}

const ALL_REPORT_QUERY = `
  query AllReportWithComparison(
    $currentFilter: BranchBillingReportFilterInput
    $prevFilter: BranchBillingReportFilterInput
    $allFilter: BranchBillingReportFilterInput
    $expenseFilter: ExpenseReportFilterInput
    $hourlyFilter: BranchBillingReportFilterInput
  ) {
    current: branchBillingReport(filter: $currentFilter) {
      startDate
      endDate
      stats {
        branchId
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
        tableOrderCount
        tableOrderAmount
        nonTableOrderCount
        nonTableOrderAmount
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
        tableOrderCount
        tableOrderAmount
        nonTableOrderCount
        nonTableOrderAmount
        totalExpenses
        totalReturns
        totalClosingSales
        totalStockOrderReceivedAmount
        stockOrderOrderedAmount
        stockOrderChefPreparedAmount
        stockOrderSupervisorConfirmedAmount
        stockOrderDriverPickedAmount
        stockOrderIcingOrderedAmount
        stockOrderBakeryOrderedAmount
        stockOrderIcingChefPreparedAmount
        stockOrderBakeryChefPreparedAmount
        stockOrderIcingSupervisorConfirmedAmount
        stockOrderBakerySupervisorConfirmedAmount
        stockOrderIcingDriverPickedAmount
        stockOrderBakeryDriverPickedAmount
        stockOrderIcingReceivedAmount
        stockOrderBakeryReceivedAmount
        totalSalary
        totalDealerBillingAmount
        monthlySalary
        employeeCount
      }
      trendData {
        label
        fullLabel
        totalAmount
        totalBills
        totalExpense
        totalReturn
        totalStockOrder
        totalDealerBilling
        tableOrderAmount
        tableOrderBills
        nonTableOrderAmount
        nonTableOrderBills
      }
      summary {
        averageTrendAmount
        trendPercentage
        medianAmount
      }
    }
    previous: branchBillingReport(filter: $prevFilter) {
      totals {
        totalBills
        totalAmount
      }
    }
    allocation: branchBillingReport(filter: $allFilter) {
      totals {
        totalBills
        totalAmount
        totalDealerBillingAmount
      }
      stats {
        branchId
        branchName
        totalBills
        totalAmount
        tableOrderAmount
        nonTableOrderAmount
      }
    }
    expenses: expenseReport(filter: $expenseFilter) {
      startDate
      endDate
      meta {
        grandTotal
        totalCount
        categories
        categoryStats {
          category
          total
          count
          percentage
        }
      }
    }
    hourly: branchBillingReport(filter: $hourlyFilter) {
      trendData {
        label
        fullLabel
        totalAmount
        totalBills
      }
    }
  }
`

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatINR = (val: number | null | undefined): string => {
  if (val == null || isNaN(val)) return '₹0'
  return '₹' + Math.round(val).toLocaleString('en-IN')
}

const formatCompactINR = (val: number | null | undefined): string => {
  if (val == null || isNaN(val) || val === 0) return '₹0'
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`
  return `₹${Math.round(val)}`
}

// Dynamic auto-scaling font size for large amounts (prevents overflowing in Lakhs/Crores)
const getDynamicAmountStyle = (val: number | null | undefined): React.CSSProperties => {
  const str = formatINR(val)
  let fontSize = '1.6rem'
  let letterSpacing = '-0.02em'

  if (str.length >= 13) {
    // ₹1,00,00,000+ (Crores / 8+ digits)
    fontSize = '0.92rem'
    letterSpacing = '-0.035em'
  } else if (str.length >= 11) {
    // ₹10,00,000 to ₹99,99,999 (10+ Lakhs)
    fontSize = '1.05rem'
    letterSpacing = '-0.03em'
  } else if (str.length >= 9) {
    // ₹1,00,000 to ₹9,99,999 (Lakhs)
    fontSize = '1.2rem'
    letterSpacing = '-0.025em'
  } else if (str.length >= 7) {
    // ₹10,000 to ₹99,999 (Thousands)
    fontSize = '1.38rem'
  }

  return {
    fontSize,
    letterSpacing,
  }
}

// Dynamic font scaling for Stock Order amounts (auto-scales down so it never overflows)
const getStockDynamicAmountStyle = (val: number | null | undefined): React.CSSProperties => {
  const str = formatINR(val)
  let fontSize = '2.25rem'
  let letterSpacing = '-0.03em'

  if (str.length >= 13) {
    // ₹1,00,00,000+ (Crores)
    fontSize = '1.30rem'
    letterSpacing = '-0.035em'
  } else if (str.length >= 11) {
    // ₹10,00,000+ (10+ Lakhs)
    fontSize = '1.50rem'
    letterSpacing = '-0.03em'
  } else if (str.length >= 9) {
    // ₹1,00,000+ (Lakhs)
    fontSize = '1.75rem'
    letterSpacing = '-0.025em'
  } else if (str.length >= 7) {
    fontSize = '2.05rem'
  }

  return {
    fontSize,
    letterSpacing,
  }
}

// Dynamic font scaling for Expense amounts (consistent 1.42rem, scales down on 7+ digits)
const getExpenseDynamicAmountStyle = (val: number | null | undefined): React.CSSProperties => {
  const str = formatINR(val)
  let fontSize = '1.42rem'
  let letterSpacing = '-0.025em'

  if (str.length >= 13) {
    // ₹1,00,00,000+ (Crores)
    fontSize = '0.90rem'
    letterSpacing = '-0.035em'
  } else if (str.length >= 11) {
    // ₹10,00,000+ (10+ Lakhs)
    fontSize = '1.05rem'
    letterSpacing = '-0.03em'
  } else if (str.length >= 9) {
    // ₹1,00,000 to ₹9,99,999 (Lakhs)
    fontSize = '1.20rem'
    letterSpacing = '-0.025em'
  }
  return {
    fontSize,
    letterSpacing,
  }
}

// Map 12-hour label (e.g. '12 AM', '6 AM', '11 PM') to 0..23 hour number
const parseHourFromLabel = (label: string): number => {
  const match = (label || '').trim().match(/^(\d+)\s*(AM|PM)$/i)
  if (!match) return -1
  const rawH = parseInt(match[1], 10)
  const meridiem = match[2].toUpperCase()
  if (meridiem === 'AM') {
    return rawH === 12 ? 0 : rawH
  } else {
    return rawH === 12 ? 12 : rawH + 12
  }
}

// Convert 0..23 hour number to 12-hour format string (e.g. 0 -> '12 AM', 13 -> '1 PM')
const getHourLabel = (h: number): string => {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

// Dynamic font scaling for Heatmap values to maximize visibility without clipping
const getHeatmapValStyle = (
  val: number | null | undefined,
  timeRange: 'day' | 'night',
): React.CSSProperties => {
  const str = formatINR(val)
  if (timeRange === 'night') {
    // 6 columns across row -> generous space
    if (str.length >= 13) {
      return { fontSize: '1.15rem', letterSpacing: '-0.03em' }
    }
    if (str.length >= 11) {
      return { fontSize: '1.30rem', letterSpacing: '-0.025em' }
    }
    if (str.length >= 9) {
      return { fontSize: '1.45rem', letterSpacing: '-0.02em' }
    }
    return { fontSize: '1.70rem' }
  } else {
    // 18 columns across single row
    if (str.length >= 13) {
      return { fontSize: '0.70rem', letterSpacing: '-0.035em' }
    }
    if (str.length >= 11) {
      return { fontSize: '0.80rem', letterSpacing: '-0.035em' }
    }
    if (str.length >= 9) {
      return { fontSize: '0.90rem', letterSpacing: '-0.025em' }
    }
    if (str.length >= 7) {
      return { fontSize: '1.02rem', letterSpacing: '-0.015em' }
    }
    return { fontSize: '1.15rem' }
  }
}

const EXPENSE_PALETTES: Record<string, { color: string; bg: string; border: string }> = {
  MAINTENANCE: { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  TRANSPORT: { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  FUEL: { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  PACKING: { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  'STAFF WELFARE': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  SUPPLIES: { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  ADVERTISEMENT: { color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
  ADVANCE: { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  COMPLEMENTARY: { color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
  'RAW MATERIAL': { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  SALARY: { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  'OC PRODUCTS': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  OTHERS: { color: '#475569', bg: '#f8fafc', border: '#cbd5e1' },
}

const DEFAULT_EXPENSE_PALETTES = [
  { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
  { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
]

const getExpenseTheme = (category: string, idx: number) => {
  const normalized = (category || '').trim().toUpperCase()
  for (const [key, val] of Object.entries(EXPENSE_PALETTES)) {
    if (key.toUpperCase() === normalized) return val
  }
  return DEFAULT_EXPENSE_PALETTES[idx % DEFAULT_EXPENSE_PALETTES.length]
}

export default function AllReport() {
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedPreset, setSelectedPreset] = useState<string>('this_month')
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshSpin, setRefreshSpin] = useState<boolean>(false)
  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [hoveredStream, setHoveredStream] = useState<string | null>(null)
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null)
  const [activeFutureTab, setActiveFutureTab] = useState<string>('stock_order')

  // Real report data from DB
  const [reportData, setReportData] = useState<any>(null)
  const [prevTotals, setPrevTotals] = useState<any>(null)
  const [allocationData, setAllocationData] = useState<any>(null)
  const [expenseData, setExpenseData] = useState<any>(null)
  const [hourlyTrendData, setHourlyTrendData] = useState<any[]>([])
  const [heatmapTimeRange, setHeatmapTimeRange] = useState<'day' | 'night'>('day')

  // Fetch branches and first bill date once
  useEffect(() => {
    Promise.all([fetchCachedBranches(), fetchCachedFirstBillDate()])
      .then(([bList, fDate]) => {
        if (bList) setBranches(bList)
        if (fDate) setFirstBillDate(fDate)
      })
      .catch((err) => console.warn('Could not fetch metadata:', err))
  }, [])

  // Calculate dates based on selected preset with period-over-period comparison
  const dateParams = useMemo(() => {
    const today = dayjs()
    let start = today
    let end = today
    let period = 'hourly'
    let label = today.format('D MMM YYYY')

    let prevStart = today.subtract(1, 'day')
    let prevEnd = today.subtract(1, 'day')
    let prevPeriod = 'hourly'
    let prevLabel = 'yesterday'

    switch (selectedPreset) {
      case 'today':
        start = today
        end = today
        period = 'hourly'
        label = today.format('D MMM YYYY')

        prevStart = today.subtract(1, 'day')
        prevEnd = today.subtract(1, 'day')
        prevPeriod = 'hourly'
        prevLabel = 'yesterday'
        break

      case 'yesterday': {
        const y = today.subtract(1, 'day')
        start = y
        end = y
        period = 'hourly'
        label = y.format('D MMM YYYY')

        prevStart = y.subtract(1, 'day')
        prevEnd = y.subtract(1, 'day')
        prevPeriod = 'hourly'
        prevLabel = 'day before'
        break
      }

      case 'last_7_days': {
        start = today.subtract(6, 'day')
        end = today
        period = 'daily'
        label = `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`

        prevEnd = start.subtract(1, 'day')
        prevStart = prevEnd.subtract(6, 'day')
        prevPeriod = 'daily'
        prevLabel = 'prior 7 days'
        break
      }

      case 'this_month': {
        start = today.startOf('month')
        end = today
        period = 'daily'
        label = today.format('MMMM YYYY')

        const prevMonth = today.subtract(1, 'month')
        prevStart = prevMonth.startOf('month')
        const dayOfMonth = today.date()
        prevEnd = prevStart.add(dayOfMonth - 1, 'day')
        prevPeriod = 'daily'
        prevLabel = 'same period last mo'
        break
      }

      case 'last_month': {
        const lm = today.subtract(1, 'month')
        start = lm.startOf('month')
        end = lm.endOf('month')
        period = 'daily'
        label = start.format('MMMM YYYY')

        const monthBefore = lm.subtract(1, 'month')
        prevStart = monthBefore.startOf('month')
        prevEnd = monthBefore.endOf('month')
        prevPeriod = 'daily'
        prevLabel = 'prior month'
        break
      }

      case 'till_now': {
        const fb = firstBillDate ? dayjs(firstBillDate) : today.subtract(1, 'year').startOf('year')
        start = fb
        end = today
        period = 'monthly'
        label = 'All Time'

        const daysSpan = end.diff(start, 'day')
        prevEnd = start.subtract(1, 'day')
        prevStart = prevEnd.subtract(daysSpan, 'day')
        prevPeriod = 'monthly'
        prevLabel = 'prior period'
        break
      }

      default:
        start = today.startOf('month')
        end = today
        period = 'daily'
        label = today.format('MMMM YYYY')

        prevStart = today.subtract(1, 'month').startOf('month')
        prevEnd = prevStart.add(today.date() - 1, 'day')
        prevPeriod = 'daily'
        prevLabel = 'last month'
        break
    }

    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      trendPeriod: period,
      label,
      prevStartDate: prevStart.format('YYYY-MM-DD'),
      prevEndDate: prevEnd.format('YYYY-MM-DD'),
      prevPeriod,
      prevLabel,
    }
  }, [selectedPreset, firstBillDate])

  // Fetch real report from GraphQL with comparison
  const fetchReport = useCallback(async () => {
    setLoading(true)
    setRefreshSpin(true)

    try {
      const branchId = selectedBranch === 'all' ? null : selectedBranch
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: ALL_REPORT_QUERY,
          variables: {
            currentFilter: {
              startDate: dateParams.startDate,
              endDate: dateParams.endDate,
              trendPeriod: dateParams.trendPeriod,
              branch: branchId,
            },
            prevFilter: {
              startDate: dateParams.prevStartDate,
              endDate: dateParams.prevEndDate,
              trendPeriod: dateParams.prevPeriod,
              branch: branchId,
            },
            allFilter: {
              startDate: dateParams.startDate,
              endDate: dateParams.endDate,
              trendPeriod: dateParams.trendPeriod,
              branch: null,
            },
            expenseFilter: {
              startDate: dateParams.startDate,
              endDate: dateParams.endDate,
              branch: branchId,
            },
            hourlyFilter: {
              startDate: dateParams.startDate,
              endDate: dateParams.endDate,
              trendPeriod: 'hourly',
              branch: branchId,
            },
          },
        }),
      })

      if (!response.ok) throw new Error('Failed to fetch billing report')
      const json = await response.json()
      const current = json.data?.current
      const previous = json.data?.previous
      const alloc = json.data?.allocation
      const exp = json.data?.expenses
      const hourly = json.data?.hourly

      if (current) {
        setReportData(current)
        setPrevTotals(previous?.totals || null)
        if (alloc) {
          setAllocationData(alloc)
        }
        setExpenseData(exp || null)
        setHourlyTrendData(hourly?.trendData || [])
      } else {
        setReportData(null)
        setPrevTotals(null)
        setAllocationData(null)
        setExpenseData(null)
        setHourlyTrendData([])
      }
    } catch (err) {
      console.error('Error fetching billing report:', err)
      setReportData(null)
      setPrevTotals(null)
      setAllocationData(null)
      setExpenseData(null)
      setHourlyTrendData([])
    } finally {
      setLoading(false)
      setTimeout(() => setRefreshSpin(false), 500)
    }
  }, [dateParams, selectedBranch])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // Extract totals directly from DB
  const totals = useMemo(() => {
    if (!reportData?.totals) {
      return {
        totalAmount: 0,
        normalAmount: 0,
        tableOrderAmount: 0,
        totalBills: 0,
        normalBills: 0,
        tableBills: 0,
        avgBill: 0,
        normalPct: '0',
        tablePct: '0',
      }
    }

    const t = reportData.totals
    const totalAmount = t.totalAmount || 0
    const tableOrderAmount = t.tableOrderAmount || 0
    const normalAmount =
      t.nonTableOrderAmount != null
        ? t.nonTableOrderAmount
        : Math.max(0, totalAmount - tableOrderAmount)

    const totalBills = t.totalBills || 0
    const tableBills = t.tableOrderCount || 0
    const normalBills =
      t.nonTableOrderCount != null
        ? t.nonTableOrderCount
        : Math.max(0, totalBills - tableBills)

    const avgBill = totalBills > 0 ? Math.round(totalAmount / totalBills) : 0
    const normalPct = totalAmount > 0 ? ((normalAmount / totalAmount) * 100).toFixed(1) : '0.0'
    const tablePct = totalAmount > 0 ? ((tableOrderAmount / totalAmount) * 100).toFixed(1) : '0.0'

    const totalExpenses = t.totalExpenses || 0
    const totalReturns = t.totalReturns || 0
    const totalStockOrderReceivedAmount = t.totalStockOrderReceivedAmount || 0
    const stockOrderOrderedAmount = t.stockOrderOrderedAmount || 0
    const stockOrderChefPreparedAmount = t.stockOrderChefPreparedAmount || 0
    const stockOrderSupervisorConfirmedAmount = t.stockOrderSupervisorConfirmedAmount || 0
    const stockOrderDriverPickedAmount = t.stockOrderDriverPickedAmount || 0
    const stockOrderIcingOrderedAmount = t.stockOrderIcingOrderedAmount || 0
    const stockOrderBakeryOrderedAmount = t.stockOrderBakeryOrderedAmount || 0
    const stockOrderIcingChefPreparedAmount = t.stockOrderIcingChefPreparedAmount || 0
    const stockOrderBakeryChefPreparedAmount = t.stockOrderBakeryChefPreparedAmount || 0
    const stockOrderIcingSupervisorConfirmedAmount = t.stockOrderIcingSupervisorConfirmedAmount || 0
    const stockOrderBakerySupervisorConfirmedAmount = t.stockOrderBakerySupervisorConfirmedAmount || 0
    const stockOrderIcingDriverPickedAmount = t.stockOrderIcingDriverPickedAmount || 0
    const stockOrderBakeryDriverPickedAmount = t.stockOrderBakeryDriverPickedAmount || 0
    const stockOrderIcingReceivedAmount = t.stockOrderIcingReceivedAmount || 0
    const stockOrderBakeryReceivedAmount = t.stockOrderBakeryReceivedAmount || 0
    const totalSalary = t.totalSalary || 0
    const totalDealerBillingAmount = t.totalDealerBillingAmount || 0
    const monthlySalary = t.monthlySalary || 0
    const employeeCount = t.employeeCount || 0

    return {
      totalAmount,
      normalAmount,
      tableOrderAmount,
      totalBills,
      normalBills,
      tableBills,
      avgBill,
      normalPct,
      tablePct,
      totalExpenses,
      totalReturns,
      totalStockOrderReceivedAmount,
      stockOrderOrderedAmount,
      stockOrderChefPreparedAmount,
      stockOrderSupervisorConfirmedAmount,
      stockOrderDriverPickedAmount,
      stockOrderIcingOrderedAmount,
      stockOrderBakeryOrderedAmount,
      stockOrderIcingChefPreparedAmount,
      stockOrderBakeryChefPreparedAmount,
      stockOrderIcingSupervisorConfirmedAmount,
      stockOrderBakerySupervisorConfirmedAmount,
      stockOrderIcingDriverPickedAmount,
      stockOrderBakeryDriverPickedAmount,
      stockOrderIcingReceivedAmount,
      stockOrderBakeryReceivedAmount,
      totalSalary,
      totalDealerBillingAmount,
      monthlySalary,
      employeeCount,
    }
  }, [reportData])

  // Comparison metrics vs previous period (e.g. today vs yesterday, 7 days vs prior 7 days, this month vs last month)
  const comparison = useMemo(() => {
    const curTotal = totals.totalAmount || 0
    const prevTotal = prevTotals?.totalAmount || 0
    const diff = curTotal - prevTotal

    let pct = 0
    if (prevTotal > 0) {
      pct = Number(((diff / prevTotal) * 100).toFixed(1))
    } else if (curTotal > 0) {
      pct = 100
    } else {
      pct = 0
    }

    const isPositive = diff >= 0
    const formattedDiff =
      (isPositive ? '+₹' : '-₹') + Math.round(Math.abs(diff)).toLocaleString('en-IN')

    return {
      curTotal,
      prevTotal,
      diff,
      pct: Math.abs(pct),
      isPositive,
      formattedDiff,
      hasData: curTotal > 0 || prevTotal > 0,
      prevLabel: dateParams.prevLabel,
    }
  }, [totals.totalAmount, prevTotals, dateParams.prevLabel])

  // Trend points directly from DB
  const trendPoints: TrendPointItem[] = useMemo(() => {
    if (!reportData?.trendData || reportData.trendData.length === 0) {
      return []
    }

    return reportData.trendData.map((item: any) => {
      const tot = item.totalAmount || 0
      const tbl = item.tableOrderAmount || 0
      const nrm =
        item.nonTableOrderAmount != null
          ? item.nonTableOrderAmount
          : Math.max(0, tot - tbl)
      const ratio = tot > 0 ? Number(((tbl / tot) * 100).toFixed(1)) : 0

      return {
        label: item.label,
        fullLabel: item.fullLabel || item.label,
        totalAmount: tot,
        totalBills: item.totalBills || 0,
        normalAmount: nrm,
        tableOrderAmount: tbl,
        ratio,
        totalExpense: item.totalExpense || 0,
        totalReturn: item.totalReturn || 0,
        totalStockOrder: item.totalStockOrder || 0,
        totalDealerBilling: item.totalDealerBilling || 0,
      }
    })
  }, [reportData])

  // Peak point in the trend
  const peakPoint = useMemo(() => {
    if (trendPoints.length === 0) return null
    return [...trendPoints].sort((a, b) => b.totalAmount - a.totalAmount)[0]
  }, [trendPoints])

  // Hourly Trend data for Heatmap (strictly HOURLY calculation, matching TimeWiseReport)
  const displayedHourlyPoints = useMemo(() => {
    const hourMap = new Map<number, { totalAmount: number; totalBills: number; fullLabel?: string }>()
    if (hourlyTrendData && hourlyTrendData.length > 0) {
      hourlyTrendData.forEach((item) => {
        const h = parseHourFromLabel(item.label)
        if (h >= 0 && h < 24) {
          hourMap.set(h, {
            totalAmount: item.totalAmount || 0,
            totalBills: item.totalBills || 0,
            fullLabel: item.fullLabel || item.label,
          })
        }
      })
    }

    const targetHours =
      heatmapTimeRange === 'night'
        ? [0, 1, 2, 3, 4, 5] // 12 AM to 5 AM (covers 12 AM - 6 AM)
        : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] // 6 AM to 11 PM (covers 6 AM - 12 AM)

    return targetHours.map((h) => {
      const existing = hourMap.get(h)
      const lbl = getHourLabel(h)
      return {
        hour: h,
        label: lbl,
        fullLabel: existing?.fullLabel || `${lbl} (NO SALES RECORDED)`,
        totalAmount: existing?.totalAmount || 0,
        totalBills: existing?.totalBills || 0,
      }
    })
  }, [hourlyTrendData, heatmapTimeRange])

  // Hourly Heatmap Maximum for intensity calculation
  const displayedHeatmapMax = useMemo(() => {
    if (!displayedHourlyPoints || displayedHourlyPoints.length === 0) return 0
    return Math.max(...displayedHourlyPoints.map((pt) => pt.totalAmount || 0), 0)
  }, [displayedHourlyPoints])

  // Hourly Peak point
  const displayedPeakPoint = useMemo(() => {
    if (displayedHourlyPoints.length === 0) return null
    const withSales = displayedHourlyPoints.filter((pt) => pt.totalAmount > 0)
    if (withSales.length === 0) return null
    return [...withSales].sort((a, b) => b.totalAmount - a.totalAmount)[0]
  }, [displayedHourlyPoints])

  // 6 Financial Streams: Sales, Expense, Stock Order, Return Order, Salary, Other Products
  const financialStreams: FinancialStreamItem[] = useMemo(() => {
    const salesAmt = totals.totalAmount || 0
    const expenseAmt = totals.totalExpenses || 0
    const stockOrderAmt = totals.totalStockOrderReceivedAmount || 0
    const returnAmt = totals.totalReturns || 0
    const salaryAmt = totals.totalSalary || 0
    const otherProductAmt = totals.totalDealerBillingAmount || 0

    const totalFlow =
      salesAmt + expenseAmt + stockOrderAmt + returnAmt + salaryAmt + otherProductAmt

    const rawStreams: Array<{
      id: 'sales' | 'expense' | 'stock_order' | 'return_order' | 'salary' | 'other_products'
      name: string
      code: string
      amount: number
      theme: FinancialStreamTheme
    }> = [
      {
        id: 'sales',
        name: 'Sales',
        code: 'SALE',
        amount: salesAmt,
        theme: {
          name: 'Emerald Sales',
          bg: 'rgba(5, 150, 105, 0.04)',
          activeBg: 'rgba(5, 150, 105, 0.16)',
          border: '#10b981',
          dash: '#059669', // Dark Forest Emerald
          text: '#047857',
        },
      },
      {
        id: 'expense',
        name: 'Expense',
        code: 'EXPN',
        amount: expenseAmt,
        theme: {
          name: 'Crimson Expense',
          bg: 'rgba(220, 38, 38, 0.04)',
          activeBg: 'rgba(220, 38, 38, 0.16)',
          border: '#ef4444',
          dash: '#dc2626', // Dark Crimson
          text: '#b91c1c',
        },
      },
      {
        id: 'stock_order',
        name: 'Stock Order',
        code: 'STCK',
        amount: stockOrderAmt,
        theme: {
          name: 'Royal Blue Stock Order',
          bg: 'rgba(37, 99, 235, 0.04)',
          activeBg: 'rgba(37, 99, 235, 0.16)',
          border: '#3b82f6',
          dash: '#2563eb', // Royal Navy Blue
          text: '#1d4ed8',
        },
      },
      {
        id: 'other_products',
        name: 'Other Products',
        code: 'OTHR',
        amount: otherProductAmt,
        theme: {
          name: 'Amber Other Products',
          bg: 'rgba(217, 119, 6, 0.04)',
          activeBg: 'rgba(217, 119, 6, 0.16)',
          border: '#f59e0b',
          dash: '#d97706', // Vibrant Amber Gold
          text: '#b45309',
        },
      },
      {
        id: 'return_order',
        name: 'Return Order',
        code: 'RETN',
        amount: returnAmt,
        theme: {
          name: 'Rust Orange Return',
          bg: 'rgba(234, 88, 12, 0.04)',
          activeBg: 'rgba(234, 88, 12, 0.16)',
          border: '#f97316',
          dash: '#ea580c', // Dark Rust Orange
          text: '#c2410c',
        },
      },
      {
        id: 'salary',
        name: 'Salary',
        code: 'SALR',
        amount: salaryAmt,
        theme: {
          name: 'Royal Violet Salary',
          bg: 'rgba(124, 58, 237, 0.04)',
          activeBg: 'rgba(124, 58, 237, 0.16)',
          border: '#8b5cf6',
          dash: '#7c3aed', // Deep Royal Violet / Purple
          text: '#6d28d9',
        },
      },
    ]

    return rawStreams.map((item) => {
      const pct = totalFlow > 0 ? Number(((item.amount / totalFlow) * 100).toFixed(1)) : 0
      return {
        ...item,
        percentage: pct,
      }
    })
  }, [
    totals.totalAmount,
    totals.totalExpenses,
    totals.totalStockOrderReceivedAmount,
    totals.totalReturns,
    totals.totalSalary,
    totals.totalDealerBillingAmount,
  ])

  // Total Turnover / Flow
  const totalFinancialFlow = useMemo(() => {
    return financialStreams.reduce((acc, s) => acc + s.amount, 0)
  }, [financialStreams])

  // Active Streams that have non-zero amounts
  const activeStreamSlices = useMemo(() => {
    return financialStreams.filter((s) => s.amount > 0)
  }, [financialStreams])

  // 5 Stock Order Workflow Stages: Order Placed, Chef Prepared, Supervisor Confirmed, Driver Picked, Branch Received
  const stockOrderStages = useMemo(() => {
    const baseOrdered = totals.stockOrderOrderedAmount || 0

    const calcVariance = (amount: number, isBase: boolean = false) => {
      if (isBase) {
        return null
      }
      if (baseOrdered === 0) {
        if (amount === 0) {
          return {
            status: 'match',
            arrow: '',
            pctText: '0%',
          }
        }
        return {
          status: 'up',
          arrow: '▲',
          pctText: '+100%',
        }
      }
      const diff = amount - baseOrdered
      const pct = (diff / baseOrdered) * 100
      if (Math.abs(pct) < 0.05) {
        return {
          status: 'match',
          arrow: '',
          pctText: '0%',
        }
      }
      if (pct < 0) {
        return {
          status: 'down',
          arrow: '▼',
          pctText: `${Math.abs(pct).toFixed(1)}%`,
        }
      }
      return {
        status: 'up',
        arrow: '▲',
        pctText: `${pct.toFixed(1)}%`,
      }
    }

    const orderAmount = totals.stockOrderOrderedAmount || 0
    const chefAmount = totals.stockOrderChefPreparedAmount || 0
    const supervisorAmount = totals.stockOrderSupervisorConfirmedAmount || 0
    const driverAmount = totals.stockOrderDriverPickedAmount || 0
    const receivedAmount = totals.totalStockOrderReceivedAmount || 0

    return [
      {
        id: 'order',
        title: 'ORDER PLACED',
        amount: orderAmount,
        icingAmount: totals.stockOrderIcingOrderedAmount || 0,
        bakeryAmount: totals.stockOrderBakeryOrderedAmount || 0,
        variance: calcVariance(orderAmount, true),
      },
      {
        id: 'chef_prepared',
        title: 'CHEF PREPARED',
        amount: chefAmount,
        icingAmount: totals.stockOrderIcingChefPreparedAmount || 0,
        bakeryAmount: totals.stockOrderBakeryChefPreparedAmount || 0,
        variance: calcVariance(chefAmount),
      },
      {
        id: 'supervisor_confirmed',
        title: 'SUPERVISOR CONFIRMED',
        amount: supervisorAmount,
        icingAmount: totals.stockOrderIcingSupervisorConfirmedAmount || 0,
        bakeryAmount: totals.stockOrderBakerySupervisorConfirmedAmount || 0,
        variance: calcVariance(supervisorAmount),
      },
      {
        id: 'driver_picked',
        title: 'DRIVER PICKED',
        amount: driverAmount,
        icingAmount: totals.stockOrderIcingDriverPickedAmount || 0,
        bakeryAmount: totals.stockOrderBakeryDriverPickedAmount || 0,
        variance: calcVariance(driverAmount),
      },
      {
        id: 'branch_received',
        title: 'BRANCH RECEIVED',
        amount: receivedAmount,
        icingAmount: totals.stockOrderIcingReceivedAmount || 0,
        bakeryAmount: totals.stockOrderBakeryReceivedAmount || 0,
        variance: calcVariance(receivedAmount),
      },
    ]
  }, [
    totals.stockOrderOrderedAmount,
    totals.stockOrderChefPreparedAmount,
    totals.stockOrderSupervisorConfirmedAmount,
    totals.stockOrderDriverPickedAmount,
    totals.totalStockOrderReceivedAmount,
    totals.stockOrderIcingOrderedAmount,
    totals.stockOrderBakeryOrderedAmount,
    totals.stockOrderIcingChefPreparedAmount,
    totals.stockOrderBakeryChefPreparedAmount,
    totals.stockOrderIcingSupervisorConfirmedAmount,
    totals.stockOrderBakerySupervisorConfirmedAmount,
    totals.stockOrderIcingDriverPickedAmount,
    totals.stockOrderBakeryDriverPickedAmount,
    totals.stockOrderIcingReceivedAmount,
    totals.stockOrderBakeryReceivedAmount,
  ])

  // Real Expense Categories from Expense Report
  const expenseCategories = useMemo(() => {
    const list: Array<{ category: string; total: number; count: number; percentage: number }> =
      expenseData?.meta?.categoryStats || []
    return list
  }, [expenseData])

  // Branch breakdown: Only active branches where sales occurred (totalAmount > 0), excluding offline/zero branches
  const branchBreakdown = useMemo(() => {
    const statsList: any[] = allocationData?.stats?.length
      ? allocationData.stats
      : reportData?.stats?.length
      ? reportData.stats
      : []

    const statsMap = new Map<string, any>()
    statsList.forEach((st) => {
      if (st.branchId) statsMap.set(String(st.branchId), st)
    })

    const seenIds = new Set<string>()
    const list: Array<{ id: string; name: string; totalAmount: number; totalBills: number }> = []

    if (branches.length > 0) {
      branches.forEach((b) => {
        const st = statsMap.get(String(b.id))
        const totalAmount = st?.totalAmount || 0
        const totalBills = st?.totalBills || 0
        if (totalAmount > 0) {
          seenIds.add(String(b.id))
          list.push({
            id: String(b.id),
            name: b.name,
            totalAmount,
            totalBills,
          })
        }
      })
    }

    statsList.forEach((st) => {
      const id = String(st.branchId)
      const totalAmount = st.totalAmount || 0
      const totalBills = st.totalBills || 0
      if (!seenIds.has(id) && totalAmount > 0) {
        seenIds.add(id)
        list.push({
          id,
          name: st.branchName || 'Branch',
          totalAmount,
          totalBills,
        })
      }
    })

    // Sort by sales amount descending (highest sales first)
    return list.sort((a, b) => b.totalAmount - a.totalAmount)
  }, [allocationData, reportData, branches])

  const handleStreamToggle = useCallback((streamId: string) => {
    setSelectedStream((prev) => (prev === streamId ? null : streamId))
  }, [])

  // Grand circle size (R_out = 185, R_in = 134 to fill available card space)
  const cx = 420
  const cy = 280
  const R_in = 134
  const R_out = 185

  const getBoxIntersection = (lx: number, ly: number, hw: number, hh: number, cX: number, cY: number) => {
    const dx = cX - lx
    const dy = cY - ly
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return { x: lx, y: ly }
    const scaleX = Math.abs(hw / dx)
    const scaleY = Math.abs(hh / dy)
    if (scaleX < scaleY) {
      return { x: lx + Math.sign(dx) * hw, y: ly + dy * scaleX }
    } else {
      return { x: lx + dx * scaleY, y: ly + Math.sign(dy) * hh }
    }
  }

  const getSlicePath = (startAngle: number, endAngle: number) => {
    const span = endAngle - startAngle
    if (span >= 2 * Math.PI - 0.05) {
      // Full circle donut
      return `M ${cx - R_out} ${cy} A ${R_out} ${R_out} 0 1 0 ${cx + R_out} ${cy} A ${R_out} ${R_out} 0 1 0 ${cx - R_out} ${cy} M ${cx - R_in} ${cy} A ${R_in} ${R_in} 0 1 1 ${cx + R_in} ${cy} A ${R_in} ${R_in} 0 1 1 ${cx - R_in} ${cy} Z`
    }

    const pad = span > 0.15 ? 0.025 : 0.005
    const a1 = startAngle + pad
    const a2 = endAngle - pad
    if (a2 <= a1) return ''

    const x1_in = cx + R_in * Math.cos(a1)
    const y1_in = cy + R_in * Math.sin(a1)
    const x1_out = cx + R_out * Math.cos(a1)
    const y1_out = cy + R_out * Math.sin(a1)

    const x2_out = cx + R_out * Math.cos(a2)
    const y2_out = cy + R_out * Math.sin(a2)
    const x2_in = cx + R_in * Math.cos(a2)
    const y2_in = cy + R_in * Math.sin(a2)

    const largeArc = a2 - a1 > Math.PI ? 1 : 0

    return `M ${x1_in} ${y1_in} L ${x1_out} ${y1_out} A ${R_out} ${R_out} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${R_in} ${R_in} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`
  }

  // Concentric dashed lines suitable for the filled background color
  const getDashedTracks = (startAngle: number, endAngle: number) => {
    const span = endAngle - startAngle
    const isFull = span >= 2 * Math.PI - 0.05
    const radii = [142, 151, 160, 169, 178] // 5 concentric tracks inside the 51px wide slice (134 to 185)

    if (isFull) {
      return radii.map((r) => {
        return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`
      })
    }

    const pad = span > 0.2 ? 0.035 : 0.008
    const a1 = startAngle + pad
    const a2 = endAngle - pad
    if (a2 <= a1) return []

    const largeArc = a2 - a1 > Math.PI ? 1 : 0

    return radii.map((r) => {
      const x1 = cx + r * Math.cos(a1)
      const y1 = cy + r * Math.sin(a1)
      const x2 = cx + r * Math.cos(a2)
      const y2 = cy + r * Math.sin(a2)
      return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
    })
  }

  // Precompute angles: guarantee Return Order and Expense are NEVER adjacent, and position labels cleanly
  const streamSliceAngles = useMemo(() => {
    if (totalFinancialFlow <= 0 || activeStreamSlices.length === 0) return []

    // If only 1 slice has all amounts, it spans full 360 circle
    if (activeStreamSlices.length === 1) {
      const s = activeStreamSlices[0]
      const cX = cx
      const cY = cy - R_out
      const lx = cx
      const ly = cy - R_out - 50
      const lineEnd = getBoxIntersection(lx, ly, 74, 30, cX, cY)
      return [
        {
          ...s,
          start: -Math.PI / 2,
          end: (3 * Math.PI) / 2,
          mid: -Math.PI / 2,
          span: 2 * Math.PI,
          lx,
          ly,
          cX,
          cY,
          lineEndX: lineEnd.x,
          lineEndY: lineEnd.y,
          anchor: 'middle' as const,
        },
      ]
    }

    // 1. Arrange slices so Return Order and Expense are NEVER adjacent in the circular flow
    const byId: Record<string, FinancialStreamItem> = {}
    activeStreamSlices.forEach((s) => {
      byId[s.id] = s
    })

    let orderedSlices: FinancialStreamItem[]
    if (byId.sales && byId.return_order && byId.expense && !byId.stock_order && !byId.other_products) {
      // If neither stock order nor other products exist to separate return_order & expense, place salary between them
      orderedSlices = [byId.sales, byId.return_order, byId.salary, byId.expense].filter(Boolean)
    } else {
      const template = [
        'sales',
        'return_order',
        'stock_order',
        'expense',
        'other_products',
        'salary',
      ]
      orderedSlices = template.map((id) => byId[id]).filter(Boolean)
      activeStreamSlices.forEach((s) => {
        if (!orderedSlices.includes(s)) orderedSlices.push(s)
      })
    }

    // 2. Start from top (-Math.PI / 2) and distribute slices
    const hw = 76
    const hh = 32
    const gap = 32
    let currentAngle = -Math.PI / 2
    const rawList = orderedSlices.map((slice) => {
      const span = (slice.amount / totalFinancialFlow) * (2 * Math.PI)
      const start = currentAngle
      const end = currentAngle + span
      const mid = (start + end) / 2
      currentAngle = end

      const cosM = Math.cos(mid)
      const sinM = Math.sin(mid)
      const dist = R_out + Math.abs(cosM) * hw + Math.abs(sinM) * hh + gap

      const lx = cx + dist * cosM
      const ly = cy + dist * sinM

      const cX = cx + R_out * cosM
      const cY = cy + R_out * sinM

      return {
        ...slice,
        start,
        end,
        mid,
        span,
        lx,
        ly,
        cX,
        cY,
        anchor: 'middle' as const,
      }
    })

    // 3. Collision resolution pass between all labels: gently nudge overlapping labels without pulling them far away
    for (let iter = 0; iter < 5; iter++) {
      for (let i = 0; i < rawList.length; i++) {
        for (let j = i + 1; j < rawList.length; j++) {
          const a = rawList[i]
          const b = rawList[j]
          const dx = Math.abs(a.lx - b.lx)
          const dy = Math.abs(a.ly - b.ly)
          if (dx < 136 && dy < 58) {
            const overlap = 58 - dy + 2
            if (a.ly < b.ly) {
              a.ly = Math.max(hh + 14, a.ly - overlap / 2)
              b.ly += overlap / 2
            } else {
              b.ly = Math.max(hh + 14, b.ly - overlap / 2)
              a.ly += overlap / 2
            }
          }
        }
      }
    }

    // 4. Compute dashed line end coordinates touching the text boundary
    return rawList.map((item) => {
      const lineEnd = getBoxIntersection(item.lx, item.ly, 74, 30, item.cX, item.cY)
      return {
        ...item,
        lineEndX: lineEnd.x,
        lineEndY: lineEnd.y,
      }
    })
  }, [activeStreamSlices, totalFinancialFlow, cx, cy, R_out])

  return (
    <div className="all-report-page">
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="ar-top-bar">
        <div className="ar-header-left">
          <div className="ar-page-tag">
            <Sparkles size={12} />
            <span>Executive Analytics</span>
          </div>
          <h1 className="ar-page-title">
            All Reports Dashboard
            <span className="ar-live-pill">● DB LIVE</span>
          </h1>
          <p className="ar-page-subtitle">
            Real-time billing distribution, counter vs table orders, and branch sales from database
          </p>
        </div>

        <div className="ar-header-controls">
          {/* Preset Buttons */}
          <div className="ar-preset-group">
            {[
              { key: 'today', label: 'TODAY' },
              { key: 'yesterday', label: 'YESTERDAY' },
              { key: 'last_7_days', label: '7 DAYS' },
              { key: 'this_month', label: 'THIS MONTH' },
              { key: 'last_month', label: 'LAST MONTH' },
              { key: 'till_now', label: 'TILL NOW' },
            ].map((p) => (
              <button
                key={p.key}
                className={`ar-preset-btn ${selectedPreset === p.key ? 'active' : ''}`}
                onClick={() => setSelectedPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Branch Filter */}
          <div className="ar-branch-select-wrap">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="all">ALL BRANCHES</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            className={`ar-refresh-btn ${refreshSpin ? 'spinning' : ''}`}
            onClick={fetchReport}
            title="Refresh Data from DB"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 2. MAIN SHOWCASE GRID (COMPACT TWO CARDS) */}
      <div className="ar-showcase-grid">
        {/* LEFT CARD: BILLINGS (COMPACT - TWO LINES: NORMAL BILLING & TABLE ORDER) */}
        <div className="ar-card ar-card-billings">
          {/* Header */}
          <div className="ar-card-header">
            <div className="ar-title-group">
              <h2 className="ar-card-title">TOTAL BILLINGS</h2>
              <span className="ar-model-badge">
                {selectedBranch === 'all'
                  ? 'CONSOLIDATED'
                  : (branches.find((b) => b.id === selectedBranch)?.name || 'FILTERED').toUpperCase()}
              </span>
            </div>

            {/* Top-Right Legend */}
            <div className="ar-legend-group">
              <div className="ar-legend-item normal">
                <span className="ar-legend-swatch" />
                <span>NORMAL BILLING</span>
              </div>
              <div className="ar-legend-item table">
                <span className="ar-legend-swatch" />
                <span>TABLE ORDER</span>
              </div>
            </div>
          </div>

          {/* Metric Amount Row */}
          <div className="ar-metric-row">
            <div className="ar-huge-amount">{formatINR(totals.totalAmount)}</div>

            {comparison.hasData && (
              <div className="ar-growth-badges-group">
                {/* 1. Percentage Badge (Separate) */}
                <div className={`ar-growth-pct-badge ${comparison.isPositive ? 'positive' : 'negative'}`}>
                  {comparison.isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <span>
                    {comparison.isPositive ? '+' : '-'}
                    {comparison.pct}%
                  </span>
                </div>

                {/* 2. Amount Difference Badge (Separate with distinct background) */}
                <div className={`ar-growth-amount-badge ${comparison.isPositive ? 'positive' : 'negative'}`}>
                  <span>{comparison.formattedDiff}</span>
                </div>
              </div>
            )}

            <span className="ar-period-subtext">vs {comparison.prevLabel}</span>
          </div>

          {/* Subtitle details */}
          <div className="ar-subtitle-strip">
            <div className="ar-left-desc">
              <span>
                Normal: <strong className="ar-highlight-text">{formatINR(totals.normalAmount)}</strong> ({totals.normalPct}%)
              </span>
              <span className="ar-dot-sep">·</span>
              <span>
                Table: <strong className="ar-highlight-text" style={{ color: '#ef4444' }}>{formatINR(totals.tableOrderAmount)}</strong> ({totals.tablePct}%)
              </span>
              <span className="ar-dot-sep">·</span>
              <span>
                Total Bills: <strong className="ar-highlight-text">{totals.totalBills.toLocaleString('en-IN')}</strong>
              </span>
            </div>

            <div className="ar-right-target">
              <span>Avg / Bill: {formatINR(totals.avgBill)}</span>
            </div>
          </div>

          {/* Compact Chart Area (Height: 200px) */}
          <div className="ar-main-chart-wrapper">
            {/* Peak Callout pill if peak exists and totalAmount > 0 */}
            {peakPoint && peakPoint.totalAmount > 0 && (
              <div className="ar-floating-callout">
                <span>{peakPoint.label}</span>
                <span className="ar-callout-pill">Peak {formatCompactINR(peakPoint.totalAmount)}</span>
              </div>
            )}

            {/* Y-Axis Pills on right side */}
            <div className="ar-yaxis-pills">
              <span className="ar-ypill-max">
                {formatCompactINR(peakPoint ? peakPoint.totalAmount : totals.totalAmount)}
              </span>
              <span className="ar-ypill-current">{formatCompactINR(totals.totalAmount)}</span>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendPoints} margin={{ top: 8, right: 55, left: 24, bottom: 20 }}>
                <defs>
                  <linearGradient id="purpleAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b50e6" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#5b50e6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="redAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: '#f1f5f9' }}
                  dy={6}
                  padding={{ left: 26, right: 26 }}
                  interval={
                    selectedPreset === 'last_7_days' || selectedPreset === 'today' || selectedPreset === 'yesterday' || trendPoints.length <= 12
                      ? 0
                      : 'preserveStartEnd'
                  }
                  minTickGap={14}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TrendPointItem
                      return (
                        <div className="ar-custom-tooltip">
                          <div className="ar-tt-title">{data.fullLabel}</div>
                          <div className="ar-tt-row">
                            <span className="ar-tt-lbl">
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }} />
                              Normal Billing:
                            </span>
                            <span className="ar-tt-val">{formatINR(data.normalAmount)}</span>
                          </div>
                          <div className="ar-tt-row">
                            <span className="ar-tt-lbl">
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                              Table Order:
                            </span>
                            <span className="ar-tt-val" style={{ color: '#ef4444' }}>{formatINR(data.tableOrderAmount)}</span>
                          </div>
                          <div className="ar-tt-row">
                            <span className="ar-tt-lbl">Total Sales:</span>
                            <span className="ar-tt-val" style={{ color: '#38bdf8' }}>
                              {formatINR(data.totalAmount)}
                            </span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />

                {/* Line 1: Normal Billing (Solid Purple Line with Filled Area & Clear Dots) */}
                <Area
                  type="monotone"
                  dataKey="normalAmount"
                  stroke="#5b50e6"
                  strokeWidth={2.4}
                  fill="url(#purpleAreaGrad)"
                  dot={{ r: 3.5, fill: '#5b50e6', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#5b50e6', stroke: '#ffffff', strokeWidth: 2 }}
                />

                {/* Line 2: Table Order (Dashed Red Line with Filled Area & Clear Dots) */}
                <Area
                  type="monotone"
                  dataKey="tableOrderAmount"
                  stroke="#ef4444"
                  strokeWidth={2.2}
                  strokeDasharray="4 4"
                  fill="url(#redAreaGrad)"
                  dot={{ r: 3.5, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Lower Ratio Strip */}
          <div className="ar-drawdown-section">
            <div className="ar-drawdown-header">
              <span className="ar-dd-title">
                Table Order Ratio: <span className="ar-dd-val" style={{ color: '#ef4444' }}>{totals.tablePct}%</span>
              </span>
              <div className="ar-dd-scales">
                <span>Normal: {totals.normalPct}%</span>
                <span>Total: {totals.totalBills} bills</span>
              </div>
            </div>

            {/* Branch-wise Billing Cards: Curved rectangular buttons from first to last */}
            {branchBreakdown.length > 0 && (
              <div className="ar-branch-buttons-strip">
                {branchBreakdown.map((b) => {
                  const isSelected = selectedBranch === b.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`ar-branch-pill-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedBranch((prev) => (prev === b.id ? 'all' : b.id))}
                      title={`Filter by ${b.name}`}
                    >
                      <span className="ar-bp-name">{b.name}</span>
                      <span className="ar-bp-amount">{formatINR(b.totalAmount)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CARD: FINANCIAL ALLOCATION (SALES, EXPENSE, STOCK ORDER, RETURN ORDER, SALARY) */}
        <div className="ar-card ar-card-allocation">
          {/* Header */}
          <div className="ar-card-header">
            <div className="ar-title-group">
              <h2 className="ar-card-title">FINANCIAL ALLOCATION</h2>
              {selectedStream && (
                <span
                  className="ar-filter-active-pill"
                  onClick={() => setSelectedStream(null)}
                  title="Click to reset filter"
                  style={{ cursor: 'pointer' }}
                >
                  {(financialStreams.find((s) => s.id === selectedStream)?.name || '').toUpperCase()} (RESET ✕)
                </span>
              )}
            </div>
            <span className="ar-date-pill">{dateParams.label.toUpperCase()}</span>
          </div>

          {/* Zoomed-in Center Donut Area */}
          <div className="ar-circle-wrap">
            <svg viewBox="0 0 840 560">
              {/* If no stream has amount > 0 recorded for this period */}
              {activeStreamSlices.length === 0 ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={R_out}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              ) : (
                <>
                  {/* Outer subtle guide track */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={R_out + 2}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={1}
                  />

                  {/* Render Each Real Financial Stream Slice */}
                  {streamSliceAngles.map((slice) => {
                    const isHovered = hoveredStream === slice.id
                    const isAnyStreamFiltered = selectedStream !== null
                    const isThisStreamActive = selectedStream === slice.id
                    const isInactive = isAnyStreamFiltered && !isThisStreamActive

                    const slicePath = getSlicePath(slice.start, slice.end)
                    const dashedTracks = getDashedTracks(slice.start, slice.end)
                    const theme = slice.theme

                    return (
                      <g
                        key={slice.id}
                        onClick={() => handleStreamToggle(slice.id)}
                        onMouseEnter={() => setHoveredStream(slice.id)}
                        onMouseLeave={() => setHoveredStream(null)}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.25s ease',
                          opacity: isInactive ? 0.22 : 1,
                          filter: isInactive ? 'grayscale(60%)' : 'none',
                          transformOrigin: `${cx}px ${cy}px`,
                          transform: isThisStreamActive ? 'scale(1.03)' : isHovered ? 'scale(1.015)' : 'scale(1)',
                        }}
                      >
                        {/* 1. Translucent/Clean Background (NOT filled fully with solid heavy color) */}
                        <path
                          d={slicePath}
                          fill={isThisStreamActive ? theme.activeBg : isHovered ? theme.activeBg : theme.bg}
                          stroke={isThisStreamActive ? theme.dash : theme.border}
                          strokeWidth={isThisStreamActive ? 2.5 : 1.2}
                          strokeLinejoin="round"
                          style={{
                            transition: 'all 0.25s ease',
                            filter: isThisStreamActive
                              ? `drop-shadow(0 4px 10px ${theme.dash}55)`
                              : isHovered
                              ? `drop-shadow(0 2px 6px ${theme.dash}33)`
                              : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.04))',
                          }}
                        />

                        {/* 2. Concentric Dashed Lines: Extra bold & highly visible */}
                        {dashedTracks.map((trackPath, tIdx) => (
                          <path
                            key={tIdx}
                            d={trackPath}
                            fill="none"
                            stroke={theme.dash}
                            strokeWidth={isThisStreamActive ? 4.5 : 3.8}
                            strokeDasharray="3 4.5"
                            strokeLinecap="round"
                            strokeOpacity={isThisStreamActive ? 1 : 0.98}
                            style={{
                              pointerEvents: 'none',
                              transition: 'all 0.25s ease',
                            }}
                          />
                        ))}

                        {/* 3. Grey dashed line touching the circle and connecting to label: High visibility */}
                        <line
                          x1={slice.cX}
                          y1={slice.cY}
                          x2={slice.lineEndX}
                          y2={slice.lineEndY}
                          stroke={isThisStreamActive ? theme.dash : isHovered ? theme.dash : '#64748b'}
                          strokeWidth={isThisStreamActive ? 2.4 : 1.8}
                          strokeDasharray="3.5 3.5"
                          strokeLinecap="round"
                          style={{
                            pointerEvents: 'none',
                            transition: 'all 0.25s ease',
                            opacity: isInactive ? 0.25 : 0.9,
                          }}
                        />
                        {/* Anchor dot touching the circle boundary */}
                        <circle
                          cx={slice.cX}
                          cy={slice.cY}
                          r={isThisStreamActive ? 3.8 : 3.0}
                          fill={isThisStreamActive ? theme.dash : isHovered ? theme.dash : '#64748b'}
                          style={{
                            pointerEvents: 'none',
                            transition: 'all 0.25s ease',
                            opacity: isInactive ? 0.25 : 1,
                          }}
                        />

                        {/* 4. Outer 3-Tier Label: Top: Percentage, Middle: Stream Name, Bottom: Amount */}
                        {/* 1. Top: Percentage */}
                        <text
                          x={slice.lx}
                          y={slice.ly - 20}
                          textAnchor="middle"
                          fill={isInactive ? '#94a3b8' : '#475569'}
                          fontSize={isThisStreamActive ? '19.5' : '18'}
                          fontWeight="900"
                          fontFamily="inherit"
                        >
                          {slice.percentage}%
                        </text>

                        {/* 2. Middle: Stream Name in Capital Letters, Bold, Black Color */}
                        <text
                          x={slice.lx}
                          y={slice.ly + 2}
                          textAnchor="middle"
                          fill={isInactive ? '#94a3b8' : '#0f172a'}
                          fontSize={isThisStreamActive ? '19.5' : '18'}
                          fontWeight="900"
                          fontFamily="inherit"
                          letterSpacing="0.04em"
                        >
                          {slice.name.toUpperCase()}
                          {isThisStreamActive && ' ✓'}
                        </text>

                        {/* 3. Bottom: Amount in Bold */}
                        <text
                          x={slice.lx}
                          y={slice.ly + 24}
                          textAnchor="middle"
                          fill={isInactive ? '#94a3b8' : theme.dash}
                          fontSize={isThisStreamActive ? '19.5' : '18'}
                          fontWeight="900"
                          fontFamily="inherit"
                        >
                          {formatINR(slice.amount)}
                        </text>
                      </g>
                    )
                  })}

                  {/* Inner ring border */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={R_in - 1}
                    fill="#ffffff"
                    stroke="#f1f5f9"
                    strokeWidth={1.5}
                  />

                  {/* Center Hole Content: Rendered directly inside SVG at (cx, cy) to guarantee 100% mathematical centering without touching circle boundaries */}
                  <g
                    onClick={() => setSelectedStream(null)}
                    style={{ cursor: selectedStream !== null ? 'pointer' : 'default' }}
                  >
                    {/* Transparent clickable hit circle */}
                    <circle cx={cx} cy={cy} r={R_in - 2} fill="#ffffff" />

                    {selectedStream !== null && financialStreams.find((s) => s.id === selectedStream) ? (
                      (() => {
                        const activeSl = financialStreams.find((s) => s.id === selectedStream)!
                        return (
                          <>
                            {/* Top Title: Black text with color bullet */}
                            <text
                              x={cx}
                              y={cy - 25}
                              textAnchor="middle"
                              fontWeight="800"
                              fontSize="13.5"
                              letterSpacing="0.08em"
                              fontFamily="inherit"
                            >
                              <tspan fill={activeSl.theme.dash}>● </tspan>
                              <tspan fill="#0f172a">{activeSl.name.toUpperCase()}</tspan>
                            </text>

                            {/* Middle Amount: Formatted INR in Black with generous margin from circle edge */}
                            <text
                              x={cx}
                              y={cy + 10}
                              textAnchor="middle"
                              fill="#0f172a"
                              fontWeight="900"
                              fontSize="30.5"
                              letterSpacing="-0.03em"
                              fontFamily="inherit"
                            >
                              {formatINR(activeSl.amount)}
                            </text>

                            {/* Bottom Info: Percentage of Flow */}
                            <text
                              x={cx}
                              y={cy + 36}
                              textAnchor="middle"
                              fill={activeSl.theme.dash}
                              fontWeight="700"
                              fontSize="12.5"
                              fontFamily="inherit"
                            >
                              {activeSl.percentage}% of Flow · Click to Reset
                            </text>
                          </>
                        )
                      })()
                    ) : (
                      <>
                        {/* Top Title: Black */}
                        <text
                          x={cx}
                          y={cy - 25}
                          textAnchor="middle"
                          fill="#0f172a"
                          fontWeight="800"
                          fontSize="13.5"
                          letterSpacing="0.08em"
                          fontFamily="inherit"
                        >
                          FINANCIAL FLOW
                        </text>

                        {/* Middle Amount: Formatted INR in Black, sized so it never collides */}
                        <text
                          x={cx}
                          y={cy + 10}
                          textAnchor="middle"
                          fill="#0f172a"
                          fontWeight="900"
                          fontSize="30.5"
                          letterSpacing="-0.03em"
                          fontFamily="inherit"
                        >
                          {formatINR(totalFinancialFlow)}
                        </text>

                        {/* Bottom Info */}
                        <text
                          x={cx}
                          y={cy + 36}
                          textAnchor="middle"
                          fill="#64748b"
                          fontWeight="700"
                          fontSize="12.5"
                          fontFamily="inherit"
                        >
                          {activeStreamSlices.length > 0
                            ? `${activeStreamSlices.length} Active Stream${activeStreamSlices.length > 1 ? 's' : ''}`
                            : '6 Financial Streams'}
                        </text>
                      </>
                    )}
                  </g>
                </>
              )}
            </svg>
          </div>

          {/* Financial Allocation Footer */}
          <div className="ar-allocation-footer">
            <div className="ar-drift-info">
              {selectedStream ? (
                <div className="ar-target-ring-info">
                  <span>
                    Focused:{' '}
                    <strong>{financialStreams.find((s) => s.id === selectedStream)?.name}</strong> (
                    {formatINR(financialStreams.find((s) => s.id === selectedStream)?.amount)} ·{' '}
                    {financialStreams.find((s) => s.id === selectedStream)?.percentage}%)
                  </span>
                  <button
                    type="button"
                    className="ar-clear-filter-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStream(null)
                    }}
                  >
                    Reset ✕
                  </button>
                </div>
              ) : (
                <span>Click any slice to focus · Total 6 operational streams</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. EXTENSIBLE SECTION FOR UPCOMING GRAPHS (STOCK ORDER & EXPENSE) */}
      <div className="ar-future-graphs-section">
        <div className="ar-section-header">
          <div className="ar-section-title-wrap">
            <h3>ADDITIONAL REPORT GRAPHS</h3>
            <p>
              {activeFutureTab === 'stock_order'
                ? 'STOCK ORDER LIFECYCLE & WORKFLOW STAGES'
                : activeFutureTab === 'expense'
                ? `OPERATIONAL EXPENSES: ${formatINR(expenseData?.meta?.grandTotal ?? totals.totalExpenses)} (${expenseCategories.length} CATEGORIES, ${expenseData?.meta?.totalCount ?? 0} ENTRIES)`
                : `BRANCH PERFORMANCE HEATMAP: HOURLY BREAKDOWN (${displayedHourlyPoints.length} HOURS - ${heatmapTimeRange === 'day' ? '6 AM TO 12 AM' : '12 AM TO 6 AM'})`}
            </p>
          </div>

          <div className="ar-graphs-tabs">
            <button
              type="button"
              className={`ar-tab-pill ${activeFutureTab === 'stock_order' ? 'active' : ''}`}
              onClick={() => setActiveFutureTab('stock_order')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span>STOCK ORDER</span>
            </button>
            <button
              type="button"
              className={`ar-tab-pill ${activeFutureTab === 'expense' ? 'active' : ''}`}
              onClick={() => setActiveFutureTab('expense')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>EXPENSE</span>
            </button>
            <button
              type="button"
              className={`ar-tab-pill ${activeFutureTab === 'heatmap' ? 'active' : ''}`}
              onClick={() => setActiveFutureTab('heatmap')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>HEATMAP</span>
            </button>
          </div>
        </div>

        {/* 1. STOCK ORDER STAGE CARDS */}
        {activeFutureTab === 'stock_order' && (
          <div className="ar-stock-stages-grid">
            {stockOrderStages.map((stage) => (
              <div key={stage.id} className="ar-stock-stage-card">
                {/* Centered Stage Title Banner */}
                <div className="ar-stock-stage-title-banner">
                  <span className="ar-stock-stage-title-text">{stage.title}</span>
                </div>

                {/* Big bold black number with percentage badge on the right side */}
                <div className="ar-stock-stage-amount-row">
                  <div
                    className="ar-stock-stage-amount"
                    style={getStockDynamicAmountStyle(stage.amount)}
                  >
                    {formatINR(stage.amount)}
                  </div>

                  {stage.variance && (
                    <div className={`ar-stock-variance-pill ${stage.variance.status}`}>
                      {stage.variance.arrow && (
                        <span className="ar-stock-variance-arrow">{stage.variance.arrow}</span>
                      )}
                      <span className="ar-stock-variance-pct">{stage.variance.pctText}</span>
                    </div>
                  )}
                </div>

                {/* Department breakdown row: ICING (left) and BAKERY (right) */}
                <div className="ar-stock-dept-row">
                  <div className="ar-stock-dept-col icing">
                    <span className="ar-stock-dept-label">ICING</span>
                    <span className="ar-stock-dept-val">{formatINR(stage.icingAmount)}</span>
                  </div>
                  <div className="ar-stock-dept-divider" />
                  <div className="ar-stock-dept-col bakery">
                    <span className="ar-stock-dept-label">BAKERY</span>
                    <span className="ar-stock-dept-val">{formatINR(stage.bakeryAmount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. EXPENSE CATEGORY SEPARATE BOXES (ALL IN ONE ROW - STRICTLY NO SCROLL) */}
        {activeFutureTab === 'expense' && (
          <div className="ar-stock-stages-grid ar-expense-single-row">
            {expenseCategories.length > 0 ? (
              expenseCategories.map((item) => {
                return (
                  <div key={item.category} className="ar-expense-col-wrapper">
                    <div
                      className="ar-stock-stage-card ar-expense-card"
                      title={`${item.category}: ${formatINR(item.total)} (${item.count} entries, ${item.percentage.toFixed(1)}%)`}
                    >
                      {/* Centered Title with Sky Blue Background Banner */}
                      <div className="ar-expense-title-banner">
                        <span className="ar-expense-title-text">{item.category.toUpperCase()}</span>
                      </div>

                      {/* Centered big bold black amount with auto-scaled font size */}
                      <div
                        className="ar-stock-stage-amount ar-expense-amount"
                        style={getExpenseDynamicAmountStyle(item.total)}
                      >
                        {formatINR(item.total)}
                      </div>

                      {/* Percentage inside the box below the total amount */}
                      <div className="ar-expense-inner-pct-badge">
                        <span>{item.percentage.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Outside Box at the Bottom: Entries count only */}
                    <div className="ar-expense-bottom-info">
                      <span className="ar-expense-bottom-entries">
                        {item.count} {item.count === 1 ? 'ENTRY' : 'ENTRIES'}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="ar-expense-empty-state">
                <span className="ar-empty-title">No Expense Records</span>
                <span className="ar-empty-subtitle">
                  There are no operational expense records found for {dateParams.label}
                  {selectedBranch !== 'all' ? ` in ${branches.find((b) => b.id === selectedBranch)?.name || 'this branch'}` : ''}.
                </span>
              </div>
            )}
          </div>
        )}

        {/* 3. PERFORMANCE HEATMAP (HOURLY ONLY, TOTAL ROW ONLY, NO METRIC COLUMN, SINGLE ROW WITHOUT SCROLL) */}
        {activeFutureTab === 'heatmap' && (
          <div className="ar-heatmap-container">
            <div className="ar-heatmap-card">
              {/* Header Bar */}
              <div className="ar-heatmap-card-header">
                <div className="ar-heatmap-header-left">
                  <h4 className="ar-heatmap-title">BRANCH PERFORMANCE HEATMAP</h4>
                  <span className="ar-heatmap-branch-badge">
                    {selectedBranch === 'all'
                      ? 'CONSOLIDATED (ALL BRANCHES)'
                      : `BRANCH: ${(branches.find((b) => b.id === selectedBranch)?.name || 'SELECTED BRANCH').toUpperCase()}`}
                  </span>
                  <span className="ar-heatmap-scope-badge">HOURLY DISTRIBUTION · TOTAL ONLY</span>
                </div>

                <div className="ar-heatmap-header-right">
                  {/* Two Circle Toggle Buttons: 6 AM - 12 AM (Default) and 12 AM - 6 AM */}
                  <div className="ar-heatmap-range-toggle" role="group" aria-label="Select Heatmap Time Range">
                    <button
                      type="button"
                      className={`ar-hm-circle-btn ${heatmapTimeRange === 'day' ? 'active' : ''}`}
                      onClick={() => setHeatmapTimeRange('day')}
                      title="View daytime & business sales (6 AM to 12 AM)"
                    >
                      <span className="ar-hm-circle-dot" />
                      <span>6 AM - 12 AM</span>
                    </button>
                    <button
                      type="button"
                      className={`ar-hm-circle-btn ${heatmapTimeRange === 'night' ? 'active' : ''}`}
                      onClick={() => setHeatmapTimeRange('night')}
                      title="View overnight & early morning sales (12 AM to 6 AM)"
                    >
                      <span className="ar-hm-circle-dot" />
                      <span>12 AM - 6 AM</span>
                    </button>
                  </div>

                  {displayedPeakPoint && displayedPeakPoint.totalAmount > 0 && (
                    <div className="ar-heatmap-peak-badge">
                      <span>PEAK HOUR:</span>
                      <strong>{displayedPeakPoint.label}</strong>
                      <span>({formatINR(displayedPeakPoint.totalAmount)})</span>
                    </div>
                  )}

                  {/* Gradient Legend: Low (0%) to High (100%) */}
                  <div className="ar-heatmap-legend">
                    <span className="ar-hm-legend-label">LOW (0%)</span>
                    <div className="ar-hm-legend-swatches">
                      <span style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)' }} />
                      <span style={{ backgroundColor: 'rgba(37, 99, 235, 0.35)' }} />
                      <span style={{ backgroundColor: 'rgba(37, 99, 235, 0.60)' }} />
                      <span style={{ backgroundColor: 'rgba(37, 99, 235, 0.90)' }} />
                    </div>
                    <span className="ar-hm-legend-label">PEAK (100%)</span>
                  </div>
                </div>
              </div>

              {/* Heatmap Single-Row Strip (Strictly All Time in One Row, NO METRIC/TIMELINE column, NO Scroll) */}
              {loading && hourlyTrendData.length === 0 ? (
                <div className="ar-heatmap-empty">
                  <span>LOADING HOURLY HEATMAP DATA...</span>
                </div>
              ) : displayedHourlyPoints.length === 0 ? (
                <div className="ar-heatmap-empty">
                  <span>NO HOURLY BILLING DATA RECORDED FOR {dateParams.label.toUpperCase()}</span>
                </div>
              ) : (
                <div className={`ar-heatmap-single-row ${heatmapTimeRange === 'night' ? 'range-night' : 'range-day'}`}>
                  {displayedHourlyPoints.map((pt, i) => {
                    const totalVal = pt.totalAmount || 0
                    const isNull = totalVal === 0
                    const intensity = totalVal > 0 && displayedHeatmapMax > 0 ? totalVal / displayedHeatmapMax : 0
                    const opacity = isNull ? 0 : Math.max(0.12, intensity)
                    const bgColor = isNull ? '#f8fafc' : `rgba(37, 99, 235, ${opacity})`
                    const textColor =
                      intensity > 0.45 ? '#ffffff' : totalVal > 0 ? '#0f172a' : '#94a3b8'

                    return (
                      <div
                        key={i}
                        className="ar-hm-time-col"
                        title={`${pt.fullLabel || pt.label}: ${formatINR(totalVal)} (${pt.totalBills || 0} bills)`}
                      >
                        {/* 1. Time / Hour Header */}
                        <div className="ar-hm-time-header">{pt.label}</div>

                        {/* 2. Total Amount Cell with Blue Intensity Heatmap Styling (ONLY AMOUNT INSIDE) */}
                        <div
                          className="ar-hm-time-cell"
                          style={{ backgroundColor: bgColor, color: textColor }}
                        >
                          <span
                            className="ar-hm-val"
                            style={getHeatmapValStyle(totalVal, heatmapTimeRange)}
                          >
                            {isNull ? '-' : formatINR(totalVal)}
                          </span>
                        </div>

                        {/* 3. Bill Counts OUTSIDE the Box at the Bottom */}
                        <div className="ar-hm-time-bottom-bills">
                          {pt.totalBills > 0
                            ? `${pt.totalBills} ${pt.totalBills === 1 ? 'BILL' : 'BILLS'}`
                            : '0 BILLS'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
