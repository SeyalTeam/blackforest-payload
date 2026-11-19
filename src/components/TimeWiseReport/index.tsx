'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { StylesConfig } from 'react-select'
import { Loader2, CheckSquare, Square } from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import './index.scss'

type TimeWiseHourlyStat = {
  hour: number
  totalAmount: number
  totalBills: number
  completedCount: number
  completedAmount: number
  settledCount: number
  settledAmount: number
  cancelledCount: number
  cancelledAmount: number
}

type TimeWiseBillDetail = {
  id: string
  createdAt: string
  totalAmount: number
  status: string
  paymentMethod: string
}

type TimeWiseReportTotals = {
  totalAmount: number
  totalBills: number
  completedCount: number
  completedAmount: number
  settledCount: number
  settledAmount: number
  cancelledCount: number
  cancelledAmount: number
}

type TimeWiseClosingEntry = {
  id: string
  createdAt: string
  totalSales: number
  cash: number
  upi: number
  card: number
  expenses: number
  systemSales: number
  manualSales: number
  onlineSales: number
}

type TimeWiseReportResult = {
  startDate: string
  endDate: string
  totals: TimeWiseReportTotals
  closingEntries: TimeWiseClosingEntry[]
  hourlyStats: TimeWiseHourlyStat[]
  bills: TimeWiseBillDetail[]
}

const TIME_WISE_REPORT_QUERY = `
  query TimeWiseReport($filter: TimeWiseReportFilterInput) {
    timeWiseReport(filter: $filter) {
      startDate
      endDate
      totals {
        totalAmount
        totalBills
        completedCount
        completedAmount
        settledCount
        settledAmount
        cancelledCount
        cancelledAmount
      }
      closingEntries {
        id
        createdAt
        totalSales
        cash
        upi
        card
        expenses
        systemSales
        manualSales
        onlineSales
      }
      hourlyStats {
        hour
        totalAmount
        totalBills
        completedCount
        completedAmount
        settledCount
        settledAmount
        cancelledCount
        cancelledAmount
      }
      bills {
        id
        createdAt
        totalAmount
        status
        paymentMethod
      }
    }
  }
`

const BRANCH_BILLING_REPORT_QUERY = `
  query BranchBillingReport($filter: BranchBillingReportFilterInput) {
    branchBillingReport(filter: $filter) {
      totals {
        totalAmount
        nonTableOrderAmount
        tableOrderAmount
        cancelledAmount
      }
      trendData {
        label
        totalAmount
        totalBills
        branchesData {
          branchId
          amount
          billCount
        }
      }
    }
  }
`

const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const start = displayValue
    const end = value || 0
    if (start === end) return

    const duration = 600
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(start + (end - start) * easeOut)
      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(end)
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  return <span>{displayValue.toLocaleString('en-IN')}</span>
}

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateRangeOptions = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom' },
]

const customBranchSelectStyles: StylesConfig<{ value: string; label: string }, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--theme-elevation-50, #ffffff)',
    borderColor: state.isFocused ? 'var(--theme-info-500, #38bdf8)' : 'var(--theme-elevation-200, #cbd5e1)',
    borderRadius: '8px',
    minHeight: '42px',
    height: '42px',
    minWidth: '200px',
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
    fontWeight: 500,
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
    fontWeight: 500,
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
}

const TimeWiseReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  
  const [data, setData] = useState<TimeWiseReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Slider state
  const [startTimeInSeconds, setStartTimeInSeconds] = useState<number>(0)
  const [endTimeInSeconds, setEndTimeInSeconds] = useState<number>(0)
  const requestIdRef = useRef(0)

  // Calendar controller preset handlers
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
        end = today
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
        end = today
        break
      }
      case 'last_month': {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
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

  // Graph and Heatmap state (from report-graph)
  const [chartData, setChartData] = useState<any[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line')
  const [isLive, setIsLive] = useState(false)
  const [activeLegendBranch, setActiveLegendBranch] = useState<string | null>(null)
  const [activeMetricFilter, setActiveMetricFilter] = useState<'total' | 'counter' | 'table' | 'cancelled'>('total')
  const [visibleMetrics, setVisibleMetrics] = useState({ total: true, counter: true, table: true, cancelled: true })
  const [totals, setTotals] = useState({
    totalAmount: 0,
    nonTableOrderAmount: 0,
    tableOrderAmount: 0,
    cancelledAmount: 0,
  })

  useEffect(() => {
    if (visibleMetrics.counter && visibleMetrics.table) {
      setActiveMetricFilter('total')
    } else if (visibleMetrics.counter) {
      setActiveMetricFilter('counter')
    } else if (visibleMetrics.table) {
      setActiveMetricFilter('table')
    } else if (visibleMetrics.cancelled) {
      setActiveMetricFilter('cancelled')
    } else {
      setActiveMetricFilter('total')
    }
  }, [visibleMetrics.counter, visibleMetrics.table, visibleMetrics.cancelled])

  const formatCurrency = (val: number) => {
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(val.toFixed(2)))}`
  }

  // Fetch branches for the selector
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch('/api/branches?limit=1000')
        if (!res.ok) return
        const json = await res.json()
        if (json.docs) {
          setBranches(
            json.docs.map((b: any) => ({
              id: String(b.id || b._id),
              name: String(b.name || 'Unknown Branch'),
            })),
          )
        }
      } catch (err) {
        console.error('Error fetching branches:', err)
      }
    }
    fetchBranches()
  }, [])

  const fetchReport = useCallback(async (startD: Date, endD: Date, branch: string) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const startDateStr = toLocalDateStr(startD)
      const endDateStr = toLocalDateStr(endD)

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: TIME_WISE_REPORT_QUERY,
          variables: { filter: { startDate: startDateStr, endDate: endDateStr, branch: branch === 'all' ? null : branch } },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch report')
      }

      const json = await response.json()

      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0].message || 'GraphQL Error in report')
      }

      const report: TimeWiseReportResult = json.data?.timeWiseReport
      
      if (!report) {
        throw new Error('No report data returned from GraphQL')
      }

      if (requestId !== requestIdRef.current) return

      setData(report)

      // Get hours from report
      let startHour = 8
      let endHour = 20
      if (report.hourlyStats && report.hourlyStats.length > 0) {
        const hours = report.hourlyStats.map(s => s.hour)
        const minHour = Math.min(...hours)
        const maxHour = Math.max(...hours)
        startHour = Math.min(8, minHour)
        endHour = Math.max(20, maxHour + 1)
      }
      const minSec = startHour * 3600
      const maxSec = endHour * 3600

      setStartTimeInSeconds(minSec)
      const isToday = toLocalDateStr(new Date()) === endDateStr
      if (isToday) {
        const now = new Date()
        const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
        setEndTimeInSeconds(Math.min(maxSec, Math.max(minSec + 60, currentSeconds)))
      } else {
        setEndTimeInSeconds(maxSec)
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return
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

  const fetchBranchBillingData = useCallback(
    async (
      startD: Date,
      endD: Date,
      branch: string,
      metricFilter: string,
      isBackground: boolean = false,
    ) => {
      if (!isBackground) {
        setActiveLegendBranch(null)
        setChartLoading(true)
      }
      try {
        const startDateStr = toLocalDateStr(startD)
        const endDateStr = toLocalDateStr(endD)
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: BRANCH_BILLING_REPORT_QUERY,
            variables: {
              filter: {
                startDate: startDateStr,
                endDate: endDateStr,
                trendPeriod: 'hourly',
                branch: branch === 'all' ? '' : branch,
                trendMetricFilter: metricFilter === 'total' ? null : metricFilter,
              },
            },
          }),
        })
        const json = await response.json()
        if (json.data?.branchBillingReport?.totals) {
          setTotals({
            totalAmount: json.data.branchBillingReport.totals.totalAmount,
            nonTableOrderAmount: json.data.branchBillingReport.totals.nonTableOrderAmount,
            tableOrderAmount: json.data.branchBillingReport.totals.tableOrderAmount,
            cancelledAmount: json.data.branchBillingReport.totals.cancelledAmount || 0,
          })
        } else {
          setTotals({ totalAmount: 0, nonTableOrderAmount: 0, tableOrderAmount: 0, cancelledAmount: 0 })
        }
        if (json.data?.branchBillingReport?.trendData) {
          const rawData = json.data.branchBillingReport.trendData
          const allBranchIds = new Set<string>()
          rawData.forEach((pt: any) => {
            if (pt.branchesData) {
              pt.branchesData.forEach((bd: any) => allBranchIds.add(String(bd.branchId)))
            }
          })
          branches.forEach((b) => {
            if (b.id) allBranchIds.add(String(b.id))
          })

          const isToday = toLocalDateStr(endD) === toLocalDateStr(new Date())
          const currentHour = new Date().getHours()

          const mappedData = rawData.map((pt: any) => {
            let isFuture = false
            if (isToday && pt.label && startDateStr === endDateStr) {
              const match = pt.label.match(/(\d+) (AM|PM)/)
              if (match) {
                let h = parseInt(match[1])
                if (match[2] === 'PM' && h !== 12) h += 12
                if (match[2] === 'AM' && h === 12) h = 0
                if (h > currentHour) isFuture = true
              }
            }

            const point: any = {
              label: pt.label,
              totalAmount: isFuture ? null : pt.totalAmount,
              totalBills: isFuture ? null : pt.totalBills,
            }
            allBranchIds.forEach((id) => {
              const bd = pt.branchesData?.find((b: any) => String(b.branchId) === String(id))
              point[id] = isFuture ? null : (bd ? bd.amount : 0)
              point[`${id}_count`] = isFuture ? null : (bd ? bd.billCount : 0)
            })
            return point
          })

          let trimmedData = mappedData
          if (trimmedData.length > 0 && startDateStr === endDateStr) {
            const firstValidIndex = trimmedData.findIndex(
              (pt: any) => pt.totalAmount > 0 || pt.totalBills > 0,
            )
            if (firstValidIndex > 0) {
              trimmedData = trimmedData.slice(firstValidIndex)
            }
          }

          setChartData(trimmedData)
        }
      } catch (err) {
        console.error('Error fetching branch billing data:', err)
      } finally {
        if (!isBackground) {
          setChartLoading(false)
        }
      }
    },
    [branches],
  )

  useEffect(() => {
    if (startDate && endDate) {
      fetchBranchBillingData(startDate, endDate, selectedBranch, activeMetricFilter)
    }
  }, [startDate, endDate, selectedBranch, activeMetricFilter, fetchBranchBillingData])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isLive && startDate && endDate) {
      interval = setInterval(() => {
        fetchBranchBillingData(startDate, endDate, selectedBranch, activeMetricFilter, true)
      }, 5000)
    }
    return () => clearInterval(interval)
  }, [isLive, startDate, endDate, selectedBranch, activeMetricFilter, fetchBranchBillingData])

  const branchesWithTotals = useMemo(() => {
    return branches
      .map((b, i) => {
        let color = ''
        let isLight = false

        if (b.name.toUpperCase().includes('THOOTHUKUDI HOTEL')) {
          color = '#f97316' // Orange
          isLight = false // White text
        } else {
          const hue = Math.round(i * (360 / Math.max(1, branches.length)))
          color = `hsl(${hue}, 75%, 55%)`
          isLight = hue > 35 && hue < 200
        }

        const textColor = isLight ? '#1f2937' : '#ffffff'
        const bId = String(b.id)
        const total = chartData.reduce((acc, point) => acc + (point[bId] || 0), 0)
        return { ...b, id: bId, color, textColor, total }
      })
      .sort((a, b) => b.total - a.total)
  }, [branches, chartData])

  const validBranches = useMemo(() => {
    return branchesWithTotals.filter((b) => b.total > 0)
  }, [branchesWithTotals])

  const displayBranches = useMemo(() => {
    if (selectedBranch !== 'all') {
      const selected = branchesWithTotals.find((b) => b.id === String(selectedBranch))
      if (selected) return [selected]
      const foundInBranches = branches.find((b) => String(b.id) === String(selectedBranch))
      if (foundInBranches) {
        return [{
          id: String(foundInBranches.id),
          name: foundInBranches.name,
          color: '#9333ea',
          textColor: '#ffffff',
          total: 0,
        }]
      }
    }
    if (validBranches.length > 0) {
      return validBranches
    }
    return branchesWithTotals.length > 0 ? branchesWithTotals : branches.map((b, i) => {
      const bId = String(b.id)
      const hue = Math.round(i * (360 / Math.max(1, branches.length)))
      return {
        id: bId,
        name: b.name,
        color: `hsl(${hue}, 75%, 55%)`,
        textColor: '#ffffff',
        total: 0,
      }
    })
  }, [selectedBranch, validBranches, branchesWithTotals, branches])

  const displayHours = useMemo(() => {
    if (!chartData || chartData.length === 0) return []
    const nonFuture = chartData.filter((pt) => {
      if (pt.totalAmount !== null && pt.totalAmount !== undefined) return true
      return displayBranches.some((b) => pt[b.id] !== null && pt[b.id] !== undefined)
    })
    return nonFuture.length > 0 ? nonFuture : chartData
  }, [chartData, displayBranches])

  const { heatmapMax, totalHeatmapMax } = useMemo(() => {
    let hMax = 0
    let tMax = 0
    if (displayHours.length > 0) {
      displayHours.forEach((pt) => {
        let currentHourTotal = 0
        displayBranches.forEach((b) => {
          const val = pt[b.id]
          if (val && val > 0) {
            if (val > hMax) hMax = val
            currentHourTotal += val
          }
        })
        if (currentHourTotal > tMax) tMax = currentHourTotal
      })
    }
    return { heatmapMax: hMax, totalHeatmapMax: tMax }
  }, [displayHours, displayBranches])

  const { splitOffset, average } = useMemo(() => {
    let offset = 0
    let avg = 0
    if (selectedBranch !== 'all' && chartData.length > 0) {
      const dataKey = 'totalAmount'
      const validData = chartData.filter((i) => i[dataKey] !== null)
      const dataMax = validData.length > 0 ? Math.max(...validData.map((i) => i[dataKey])) : 0
      const dataMin = validData.length > 0 ? Math.min(...validData.map((i) => i[dataKey])) : 0
      avg = validData.length > 0 ? validData.reduce((acc, i) => acc + i[dataKey], 0) / validData.length : 0
      if (dataMax !== dataMin) {
        offset = (dataMax - avg) / (dataMax - dataMin)
        offset = Math.max(0, Math.min(1, offset))
      }
    }
    return { splitOffset: offset, average: avg }
  }, [selectedBranch, chartData])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const sortedPayload = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
      const totalHourAmount = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0)
      return (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            padding: '12px 16px',
            minWidth: '220px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '6px',
            }}
          >
            <span style={{ color: '#374151', fontWeight: 700, fontSize: '14px' }}>{label}</span>
            {selectedBranch === 'all' && (
              <span style={{ color: '#111827', fontWeight: 800, fontSize: '14px' }}>
                ₹{totalHourAmount.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedPayload.map((entry: any, index: number) => {
              const val = entry.value || 0
              if (val === 0 && sortedPayload.length > 1) return null

              let branchName = ''
              if (selectedBranch === 'all') {
                const branch = branches.find((b) => b.id === (entry.dataKey || entry.name))
                branchName = branch ? branch.name : entry.name
              } else {
                branchName =
                  activeMetricFilter === 'total'
                    ? 'Total Amount'
                    : activeMetricFilter === 'counter'
                      ? 'Counter Sales'
                      : activeMetricFilter === 'table'
                        ? 'Table Order'
                        : 'Cancelled Bill'
              }

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '2px',
                        backgroundColor: entry.color || '#9333ea',
                      }}
                    />
                    <span
                      style={{
                        color: '#4b5563',
                        fontWeight: 500,
                        maxWidth: '160px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {branchName}
                    </span>
                  </div>
                  <span style={{ color: '#111827', fontWeight: 700, paddingLeft: '16px' }}>
                    ₹{val.toLocaleString('en-IN')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return null
  }

  // Compute timeline boundaries and calculated amount
  const timelineData = useMemo(() => {
    if (!data) return {
      startHour: 8,
      endHour: 20,
      filteredAmount: 0,
      filteredCash: 0,
      filteredUpi: 0,
      filteredCard: 0,
      closingStats: {
        totalSales: 0,
        cash: 0,
        upi: 0,
        card: 0,
        expenses: 0,
        systemSales: 0,
        manualSales: 0,
        onlineSales: 0
      }
    }
    
    // Find earliest and latest bills to determine timeline bounds
    // Default 8 to 20
    let startHour = 8
    let endHour = 20

    if (data.hourlyStats && data.hourlyStats.length > 0) {
      const hours = data.hourlyStats.map(s => s.hour)
      const minHour = Math.min(...hours)
      const maxHour = Math.max(...hours)
      startHour = Math.min(8, minHour)
      endHour = Math.max(20, maxHour + 1)
    }

    // Filter bills up to selected time
    // Create reference start of day in same timezone logic
    const [y, m, d] = data.startDate.split('-').map(Number)
    const startOfDayMs = new Date(y, m - 1, d).getTime()
    
    const minSecs = startHour * 3600

    const filteredStats = data.bills.reduce((acc, bill) => {
      if (bill.status !== 'completed' && bill.status !== 'settled') return acc
      
      const billDate = new Date(bill.createdAt)
      const secondsFromStart = billDate.getHours() * 3600 + billDate.getMinutes() * 60 + billDate.getSeconds()

      const isAtStart = startTimeInSeconds === minSecs
      const matches = isAtStart 
        ? (secondsFromStart >= startTimeInSeconds && secondsFromStart <= endTimeInSeconds)
        : (secondsFromStart > startTimeInSeconds && secondsFromStart <= endTimeInSeconds)

      if (matches) {
        acc.filteredAmount += bill.totalAmount
        
        if (bill.paymentMethod === 'cash') acc.filteredCash += bill.totalAmount
        else if (bill.paymentMethod === 'upi') acc.filteredUpi += bill.totalAmount
        else if (bill.paymentMethod === 'card') acc.filteredCard += bill.totalAmount
      }
      return acc
    }, {
      filteredAmount: 0,
      filteredCash: 0,
      filteredUpi: 0,
      filteredCard: 0
    })

    const filteredClosing = data.closingEntries.reduce((acc, entry) => {
      const entryDate = new Date(entry.createdAt)
      const secondsFromStart = entryDate.getHours() * 3600 + entryDate.getMinutes() * 60 + entryDate.getSeconds()

      const isAtStart = startTimeInSeconds === minSecs
      const matches = isAtStart 
        ? (secondsFromStart >= startTimeInSeconds && secondsFromStart <= endTimeInSeconds)
        : (secondsFromStart > startTimeInSeconds && secondsFromStart <= endTimeInSeconds)

      if (matches) {
        acc.totalSales += entry.totalSales
        acc.cash += entry.cash
        acc.upi += entry.upi
        acc.card += entry.card
        acc.expenses += entry.expenses
        acc.systemSales += entry.systemSales
        acc.manualSales += entry.manualSales
        acc.onlineSales += entry.onlineSales
      }
      return acc
    }, {
      totalSales: 0,
      cash: 0,
      upi: 0,
      card: 0,
      expenses: 0,
      systemSales: 0,
      manualSales: 0,
      onlineSales: 0
    })

    return { startHour, endHour, ...filteredStats, closingStats: filteredClosing }
  }, [data, startTimeInSeconds, endTimeInSeconds])

  const minSeconds = timelineData.startHour * 3600
  const maxSeconds = timelineData.endHour * 3600

  // Manual inputs conversion helpers
  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':')
    const hrs = parseInt(parts[0], 10) || 0
    const mins = parseInt(parts[1], 10) || 0
    const secs = parseInt(parts[2], 10) || 0
    return hrs * 3600 + mins * 60 + secs
  }

  const secondsToTimeInputStr = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Formatting helpers for the UI
  const formatTimeFromSeconds = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h = hours % 12 || 12
    const m = minutes.toString().padStart(2, '0')
    const s = seconds.toString().padStart(2, '0')

    return `${h}:${m}:${s} ${ampm}`
  }

  // Generate tick marks
  const ticks = []
  for (let h = timelineData.startHour; h <= timelineData.endHour; h++) {
    ticks.push(h)
  }

  return (
    <div className="time-wise-report">
      <div className="report-header">
        <h1>Time-Wise Report</h1>
      </div>

      <div className="controls-section">
        <div className="control-group">
          <label>Calendar Controller</label>
          <Select
            instanceId="date-preset-select"
            options={dateRangeOptions}
            value={dateRangeOptions.find((o) => o.value === dateRangePreset) || { value: 'custom', label: 'Custom' }}
            onChange={(opt) => {
              if (opt) handleDatePresetChange(opt.value)
            }}
            styles={customBranchSelectStyles}
            classNamePrefix="react-select"
            isSearchable={false}
          />
        </div>

        <div className="control-group">
          <label>Select Date</label>
          <div className="date-picker-wrapper">
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update: [Date | null, Date | null]) => {
                setDateRange(update)
                setDateRangePreset('custom')
              }}
              dateFormat="dd MMM yyyy"
              maxDate={new Date()}
            />
          </div>
        </div>

        <div className="control-group">
          <label>Select Branch</label>
          <Select
            instanceId="time-wise-branch-select"
            styles={customBranchSelectStyles}
            value={
              selectedBranch === 'all'
                ? { value: 'all', label: 'All Branches' }
                : {
                    value: selectedBranch,
                    label: branches.find((b) => b.id === selectedBranch)?.name || 'Unknown',
                  }
            }
            options={[
              { value: 'all', label: 'All Branches' },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
            onChange={(opt) => {
              if (opt) setSelectedBranch(opt.value)
            }}
          />
        </div>

        <div className="control-group time-picker-group">
          <label>From Time</label>
          <input
            type="time"
            step="1"
            className="time-input"
            value={secondsToTimeInputStr(startTimeInSeconds)}
            min={secondsToTimeInputStr(minSeconds)}
            max={secondsToTimeInputStr(endTimeInSeconds)}
            onChange={(e) => {
              const val = Math.min(timeToSeconds(e.target.value), endTimeInSeconds - 1)
              setStartTimeInSeconds(val)
            }}
          />
        </div>

        <div className="control-group time-picker-group">
          <label>To Time</label>
          <input
            type="time"
            step="1"
            className="time-input"
            value={secondsToTimeInputStr(endTimeInSeconds)}
            min={secondsToTimeInputStr(startTimeInSeconds)}
            max={secondsToTimeInputStr(maxSeconds)}
            onChange={(e) => {
              const val = Math.max(timeToSeconds(e.target.value), startTimeInSeconds + 1)
              setEndTimeInSeconds(val)
            }}
          />
        </div>
      </div>

      {loading && !data && (
        <div className="loading-state">
          <Loader2 className="spinner" size={40} />
          <span>Loading timeline data...</span>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>{error}</p>
        </div>
      )}

      {data && (
        <>
          <div className="timeline-section">
            <div className="timeline-header">
              <h2>Billing Timeline</h2>
              <div className="selected-time">
                {formatTimeFromSeconds(startTimeInSeconds)} - {formatTimeFromSeconds(endTimeInSeconds)}
              </div>
            </div>

            <div className="slider-container dual-range">
              <input
                type="range"
                min={minSeconds}
                max={maxSeconds}
                step={1}
                value={Math.min(Math.max(startTimeInSeconds, minSeconds), maxSeconds)}
                onChange={(e) => {
                  const val = Math.min(Number(e.target.value), endTimeInSeconds - 60)
                  setStartTimeInSeconds(val)
                }}
                className="thumb thumb-left"
                style={{ zIndex: startTimeInSeconds > maxSeconds - 2000 ? 5 : 3 }}
              />
              <input
                type="range"
                min={minSeconds}
                max={maxSeconds}
                step={1}
                value={Math.min(Math.max(endTimeInSeconds, minSeconds), maxSeconds)}
                onChange={(e) => {
                  const val = Math.max(Number(e.target.value), startTimeInSeconds + 60)
                  setEndTimeInSeconds(val)
                }}
                className="thumb thumb-right"
                style={{ zIndex: 4 }}
              />
              <div className="custom-track">
                <div 
                  className="custom-fill" 
                  style={{ 
                    left: `${((startTimeInSeconds - minSeconds) / (maxSeconds - minSeconds)) * 100}%`,
                    width: `${((endTimeInSeconds - startTimeInSeconds) / (maxSeconds - minSeconds)) * 100}%` 
                  }} 
                />
              </div>
              
              {/* Closing entry indicators (arrows below the track) */}
              {data.closingEntries.map((entry, idx) => {
                const entryDate = new Date(entry.createdAt)
                const seconds = entryDate.getHours() * 3600 + entryDate.getMinutes() * 60 + entryDate.getSeconds()
                if (seconds < minSeconds || seconds > maxSeconds) return null
                
                const pct = ((seconds - minSeconds) / (maxSeconds - minSeconds)) * 100
                
                // Get the previous closing entry's time (or minSeconds if it's the first one)
                let prevSeconds = minSeconds
                if (idx > 0) {
                  const prevEntry = data.closingEntries[idx - 1]
                  const prevDate = new Date(prevEntry.createdAt)
                  prevSeconds = prevDate.getHours() * 3600 + prevDate.getMinutes() * 60 + prevDate.getSeconds()
                }

                return (
                  <button
                    key={entry.id}
                    className="closing-indicator-arrow"
                    style={{ left: `calc(10px + (${pct} * (100% - 20px) / 100))` }}
                    onClick={() => {
                      setStartTimeInSeconds(prevSeconds)
                      setEndTimeInSeconds(seconds)
                    }}
                    title={`Click to see closing from ${formatTimeFromSeconds(prevSeconds)} to ${formatTimeFromSeconds(seconds)}`}
                    type="button"
                  >
                    ▲
                  </button>
                )
              })}
            </div>

            <div className="timeline-labels">
              {ticks.map((hour) => {
                const ampm = hour >= 12 ? 'PM' : 'AM'
                const h = hour % 12 || 12
                return (
                  <div key={hour} className="label-tick">
                    <div className="tick-mark" />
                    <span className="tick-time">{h} {ampm}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="banners-container">
            <div className="banner-section">
              <div className="banner-title">Total Amount ({formatTimeFromSeconds(startTimeInSeconds)} - {formatTimeFromSeconds(endTimeInSeconds)})</div>
              <h2 className="banner-amount">{formatCurrency(timelineData.filteredAmount)}</h2>
              
              <div className="banner-breakdown">
                <div className="breakdown-item">
                  <span className="breakdown-label">CASH</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.filteredCash)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">UPI</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.filteredUpi)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">CARD</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.filteredCard)}</span>
                </div>
              </div>
            </div>
            <div className="banner-section expenses-banner">
              <div className="banner-title">Expenses ({formatTimeFromSeconds(startTimeInSeconds)} - {formatTimeFromSeconds(endTimeInSeconds)})</div>
              <h2 className="banner-amount">{formatCurrency(timelineData.closingStats.expenses)}</h2>
            </div>
            <div className="banner-section closing-banner">
              <div className="banner-title">Closing Report ({formatTimeFromSeconds(startTimeInSeconds)} - {formatTimeFromSeconds(endTimeInSeconds)})</div>
              <h2 className="banner-amount">{formatCurrency(timelineData.closingStats.totalSales)}</h2>

              <div className="banner-breakdown channels-breakdown" style={{ marginBottom: '8px' }}>
                <div className="breakdown-item">
                  <span className="breakdown-label">SYSTEM</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.closingStats.systemSales)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">MANUAL</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.closingStats.manualSales)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">ONLINE</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.closingStats.onlineSales)}</span>
                </div>
              </div>

              <div className="banner-breakdown">
                <div className="breakdown-item">
                  <span className="breakdown-label">CASH</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.closingStats.cash)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">UPI</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.closingStats.upi)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">CARD</span>
                  <span className="breakdown-value">{formatCurrency(timelineData.closingStats.card)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Graph and Heatmap Sections from report-graph */}
          <div className="report-graph-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            {/* Graph Container */}
            <div className="report-graph-card" style={{
              backgroundColor: 'var(--theme-elevation-50)',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--theme-elevation-150)',
              padding: '20px 24px',
              width: '100%',
              minHeight: '520px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Header with Metric Boxes on Left and Actions on Right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                {/* 4 Metric Boxes */}
                <div style={{ display: 'flex', flexWrap: 'wrap', borderRadius: '8px', overflow: 'hidden', boxShadow: '2px 2px 10px rgba(0, 0, 0, 0.05)' }}>
                  <div
                    onClick={() => setVisibleMetrics({ total: true, counter: true, table: true, cancelled: true })}
                    style={{
                      cursor: 'pointer',
                      opacity: visibleMetrics.counter && visibleMetrics.table ? 1 : 0.6,
                      backgroundColor: '#9333ea',
                      color: '#fff',
                      padding: '10px 16px',
                      minWidth: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>
                      {visibleMetrics.counter && visibleMetrics.table ? <CheckSquare size={12} /> : <Square size={12} />} TOTAL BILL
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>₹<AnimatedNumber value={totals.totalAmount} /></div>
                  </div>
                  <div
                    onClick={() => setVisibleMetrics(prev => ({ ...prev, counter: !prev.counter }))}
                    style={{
                      cursor: 'pointer',
                      opacity: visibleMetrics.counter ? 1 : 0.6,
                      backgroundColor: '#ec4899',
                      color: '#fff',
                      padding: '10px 16px',
                      minWidth: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>
                      {visibleMetrics.counter ? <CheckSquare size={12} /> : <Square size={12} />} COUNTER SALES
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>₹<AnimatedNumber value={totals.nonTableOrderAmount} /></div>
                  </div>
                  <div
                    onClick={() => setVisibleMetrics(prev => ({ ...prev, table: !prev.table }))}
                    style={{
                      cursor: 'pointer',
                      opacity: visibleMetrics.table ? 1 : 0.6,
                      backgroundColor: '#009688',
                      color: '#fff',
                      padding: '10px 16px',
                      minWidth: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>
                      {visibleMetrics.table ? <CheckSquare size={12} /> : <Square size={12} />} TABLE ORDER
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>₹<AnimatedNumber value={totals.tableOrderAmount} /></div>
                  </div>
                  <div
                    onClick={() => setVisibleMetrics(prev => ({ ...prev, cancelled: !prev.cancelled }))}
                    style={{
                      cursor: 'pointer',
                      opacity: visibleMetrics.cancelled ? 1 : 0.6,
                      backgroundColor: '#EF4444',
                      color: '#fff',
                      padding: '10px 16px',
                      minWidth: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>
                      {visibleMetrics.cancelled ? <CheckSquare size={12} /> : <Square size={12} />} CANCELLED BILL
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>₹<AnimatedNumber value={totals.cancelledAmount} /></div>
                  </div>
                </div>

                {/* Controls: Line/Bar and Live button */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', backgroundColor: 'var(--theme-elevation-100)', padding: '4px', borderRadius: '20px' }}>
                    <button
                      type="button"
                      onClick={() => setGraphType('line')}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '16px',
                        border: 'none',
                        backgroundColor: graphType === 'line' ? 'var(--theme-elevation-50)' : 'transparent',
                        color: graphType === 'line' ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-500)',
                        boxShadow: graphType === 'line' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphType('bar')}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '16px',
                        border: 'none',
                        backgroundColor: graphType === 'bar' ? 'var(--theme-elevation-50)' : 'transparent',
                        color: graphType === 'bar' ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-500)',
                        boxShadow: graphType === 'bar' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Bar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextLive = !isLive
                      setIsLive(nextLive)
                      if (nextLive) {
                        const now = new Date()
                        setDateRange([now, now])
                        setDateRangePreset('today')
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 16px',
                      background: isLive ? 'rgba(239, 68, 68, 0.15)' : 'var(--theme-elevation-50)',
                      border: `1px solid ${isLive ? '#ef4444' : 'var(--theme-elevation-200)'}`,
                      borderRadius: '20px',
                      color: isLive ? '#ef4444' : 'var(--theme-elevation-800)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLive ? '#ef4444' : 'var(--theme-elevation-400)', boxShadow: isLive ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none' }}></div>
                    Live
                  </button>
                </div>
              </div>

              {/* Chart Body */}
              {chartLoading && chartData.length === 0 ? (
                <div style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--theme-elevation-400)' }}>
                  <Loader2 className="spinner" size={32} style={{ marginRight: '8px' }} />
                  Loading chart data...
                </div>
              ) : chartData.length > 0 ? (
                <div style={{ width: '100%', height: '380px', display: 'flex', flexDirection: 'column', position: 'relative', opacity: chartLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {selectedBranch === 'all' ? (
                        graphType === 'bar' ? (
                          <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-elevation-150)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} dy={10} minTickGap={30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} dx={-10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} orientation="right" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            {branchesWithTotals
                              .filter(b => activeLegendBranch === null || activeLegendBranch === b.id)
                              .map(b => (
                              <Bar key={b.id} dataKey={b.id} fill={b.color} radius={[4, 4, 0, 0]} />
                            ))}
                          </BarChart>
                        ) : (
                          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                              {branchesWithTotals.map(b => (
                                <linearGradient key={`grad-${b.id}`} id={`color-${b.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={b.color} stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor={b.color} stopOpacity={0}/>
                                </linearGradient>
                              ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-elevation-150)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} dy={10} minTickGap={30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} dx={-10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} orientation="right" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            {branchesWithTotals
                              .filter(b => activeLegendBranch === null || activeLegendBranch === b.id)
                              .map(b => (
                              <Area key={b.id} type="linear" dataKey={b.id} stroke={b.color} strokeWidth={2} fillOpacity={1} fill={`url(#color-${b.id})`} activeDot={{ r: 4, strokeWidth: 0, fill: b.color }} />
                            ))}
                          </AreaChart>
                        )
                      ) : (
                        graphType === 'bar' ? (
                          <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-elevation-150)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} dy={10} minTickGap={30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} dx={-10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} orientation="right" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <ReferenceLine y={average} stroke="var(--theme-elevation-300)" strokeDasharray="3 3" />
                            <Bar dataKey="totalAmount" fill="url(#splitColor)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        ) : (
                          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={splitOffset} stopColor="#10b981" stopOpacity={1} />
                                <stop offset={splitOffset} stopColor="#ef4444" stopOpacity={1} />
                              </linearGradient>
                              <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={0} stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset={splitOffset} stopColor="#10b981" stopOpacity={0} />
                                <stop offset={splitOffset} stopColor="#ef4444" stopOpacity={0} />
                                <stop offset={1} stopColor="#ef4444" stopOpacity={0.4} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-elevation-150)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} dy={10} minTickGap={30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} dx={-10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} orientation="right" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <ReferenceLine y={average} stroke="var(--theme-elevation-300)" strokeDasharray="3 3" />
                            <Area type="linear" dataKey="totalAmount" stroke="url(#splitColor)" strokeWidth={2} fillOpacity={1} fill="url(#splitFill)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                          </AreaChart>
                        )
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Branch Legend Pills */}
                  {selectedBranch === 'all' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', justifyContent: 'center', backgroundColor: 'var(--theme-elevation-50)', borderTop: '1px solid var(--theme-elevation-150)', maxHeight: '100px', overflowY: 'auto' }}>
                      {branchesWithTotals.filter(b => b.total > 0).map(b => {
                        const isActive = activeLegendBranch === null || activeLegendBranch === b.id;
                        return (
                          <div 
                            key={b.id} 
                            onClick={() => setActiveLegendBranch(activeLegendBranch === b.id ? null : b.id)}
                            style={{ 
                              cursor: 'pointer',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              padding: '5px 10px', 
                              backgroundColor: isActive ? b.color : 'var(--theme-elevation-100)', 
                              borderRadius: '16px', 
                              fontSize: '11px', 
                              fontWeight: 600, 
                              color: isActive ? b.textColor : 'var(--theme-elevation-400)', 
                              textShadow: isActive && b.textColor === '#ffffff' ? '0px 1px 1px rgba(0,0,0,0.2)' : 'none',
                              opacity: isActive ? 1 : 0.6,
                              transition: 'all 0.2s ease-in-out'
                            }}
                          >
                            {b.name.trim().substring(0, 3).toUpperCase()} <span style={{ color: isActive ? (b.textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(31, 41, 55, 0.8)') : 'var(--theme-elevation-400)', fontWeight: 500 }}>₹<AnimatedNumber value={b.total} /></span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--theme-elevation-400)' }}>
                  No billing data available for this date
                </div>
              )}
            </div>

            {/* Heatmap Container */}
            <div className="report-heatmap-card" style={{
              backgroundColor: 'var(--theme-elevation-50)',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--theme-elevation-150)',
              padding: '20px 24px',
              width: '100%',
              overflowX: 'auto',
              marginTop: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--theme-elevation-900)', margin: 0 }}>
                  Branch Performance Heatmap
                </h3>
                {selectedBranch !== 'all' && (
                  <span style={{ fontSize: '12px', color: 'var(--theme-elevation-700)', fontWeight: 500, backgroundColor: 'var(--theme-elevation-100)', padding: '4px 10px', borderRadius: '12px' }}>
                    Branch: {branches.find(b => b.id === selectedBranch)?.name || 'Selected Branch'}
                  </span>
                )}
              </div>

              {chartLoading && chartData.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--theme-elevation-400)' }}>
                  <Loader2 className="spinner" size={24} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
                  Loading heatmap data...
                </div>
              ) : displayBranches.length === 0 || displayHours.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--theme-elevation-400)' }}>
                  No heatmap data available for this date
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '2px', fontSize: '12px', tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px', color: 'var(--theme-elevation-700)', fontWeight: 600, position: 'sticky', left: 0, backgroundColor: 'var(--theme-elevation-50)', zIndex: 2, borderBottom: '2px solid var(--theme-elevation-150)', borderRight: '2px solid var(--theme-elevation-150)', maxWidth: '140px', whiteSpace: 'normal', lineHeight: '1.3' }}>
                        Branch Name
                      </th>
                      {displayHours.map((pt, i) => (
                        <th key={i} style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--theme-elevation-700)', fontWeight: 600, borderBottom: '2px solid var(--theme-elevation-150)', whiteSpace: 'nowrap' }}>
                          {pt.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayBranches.map((b) => (
                      <tr key={b.id}>
                        <td style={{ padding: '8px', color: 'var(--theme-elevation-900)', fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 0, backgroundColor: 'var(--theme-elevation-50)', zIndex: 1, whiteSpace: 'normal', maxWidth: '140px', borderRight: '2px solid var(--theme-elevation-150)', borderBottom: '1px solid var(--theme-elevation-150)', lineHeight: '1.3' }}>
                          {b.name}
                        </td>
                        {displayHours.map((pt, i) => {
                          const val = pt[b.id]
                          const isNull = val === null || val === undefined
                          const intensity = (!isNull && heatmapMax > 0 && val > 0) ? val / heatmapMax : 0
                          const opacity = isNull || val === 0 ? 0 : Math.max(0.06, intensity)
                          const bgColor = isNull || val === 0 ? 'transparent' : `rgba(147, 51, 234, ${opacity})`
                          const textColor = intensity > 0.4 ? '#ffffff' : (val > 0 ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-400)')

                          return (
                            <td key={i} style={{ padding: '8px 4px', textAlign: 'center', backgroundColor: bgColor, color: textColor, borderRadius: '4px', fontWeight: isNull || val === 0 ? 400 : 600, borderBottom: '1px solid var(--theme-elevation-150)' }}>
                              {isNull ? '-' : val === 0 ? '₹0' : `₹${Number(val).toLocaleString('en-IN')}`}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: 'var(--theme-elevation-100)' }}>
                      <td style={{ padding: '8px', color: 'var(--theme-elevation-900)', fontWeight: 700, position: 'sticky', left: 0, backgroundColor: 'var(--theme-elevation-100)', zIndex: 1, whiteSpace: 'nowrap', borderRight: '2px solid var(--theme-elevation-150)', borderTop: '2px solid var(--theme-elevation-200)' }}>
                        TOTAL
                      </td>
                      {displayHours.map((pt, i) => {
                        const totalVal = displayBranches.reduce((acc, b) => acc + (pt[b.id] || 0), 0)
                        const isNull = pt.totalAmount === null && totalVal === 0
                        const intensity = (totalVal > 0 && totalHeatmapMax > 0) ? totalVal / totalHeatmapMax : 0
                        const opacity = isNull || totalVal === 0 ? 0 : Math.max(0.06, intensity)
                        const bgColor = isNull || totalVal === 0 ? 'transparent' : `rgba(21, 128, 61, ${opacity})`
                        const textColor = intensity > 0.4 ? '#ffffff' : (totalVal > 0 ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-400)')

                        return (
                          <td key={i} style={{ padding: '8px 4px', textAlign: 'center', backgroundColor: bgColor, color: textColor, borderRadius: '4px', fontWeight: totalVal === 0 ? 400 : 700, borderTop: '2px solid var(--theme-elevation-200)' }}>
                            {isNull ? '-' : totalVal === 0 ? '₹0' : `₹${Number(totalVal).toLocaleString('en-IN')}`}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TimeWiseReport
