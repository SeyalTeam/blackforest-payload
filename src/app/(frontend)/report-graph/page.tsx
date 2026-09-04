'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Menu, Home as HomeIcon, FileText, BarChart2, TrendingUp, MousePointerClick, CheckCircle, Settings, ChevronDown, Check, X, CheckSquare, Square } from 'lucide-react'
import Link from 'next/link'
import { GoogleDateRangePicker, getPresetDates } from '../../../components/RawMaterialBillingReport/GoogleDateRangePicker'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ComposedChart } from 'recharts'
import dayjs from 'dayjs'

const GRAPH_PRESETS = [
  { label: 'Today', key: 'today' },
  { label: 'Yesterday', key: 'yesterday' },
  { label: '7 Days', key: 'last7Days' },
  { label: 'This Month', key: 'thisMonth' },
  { label: 'Last Month', key: 'lastMonth' },
  { label: 'Last 30 Days', key: 'last30Days' },
  { label: '3 Months', key: 'last90Days' },
  { label: 'YTD', key: 'thisYear' },
  { label: '1 Year', key: 'lastYear' },
  { label: 'All', key: 'all' },
]

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
const toLocalDateStr = (d: Date) => dayjs(d).format('YYYY-MM-DD')

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const duration = 800 // 800ms
    const startValue = displayValue

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      
      setDisplayValue(Math.floor(startValue + (value - startValue) * easeProgress))
      
      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setDisplayValue(value)
      }
    }
    
    window.requestAnimationFrame(step)
  }, [value])

  return <>{displayValue.toLocaleString('en-IN')}</>
}

export default function ReportGraphPage() {
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const [activeMenu, setActiveMenu] = useState('branch-billing')
  const [startDate, setStartDate] = useState<Date | null>(new Date())
  const [endDate, setEndDate] = useState<Date | null>(new Date())
  const [presetKey, setPresetKey] = useState<string>('today')
  const [branches, setBranches] = useState<{ id: string, name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')

  const [loading, setLoading] = useState(false)
  const [chartData, setChartData] = useState<any[]>([])
  const [totals, setTotals] = useState({ totalAmount: 0, nonTableOrderAmount: 0, tableOrderAmount: 0, cancelledAmount: 0 })
  const [activeLegendBranch, setActiveLegendBranch] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [activeMetricFilter, setActiveMetricFilter] = useState<'total' | 'counter' | 'table' | 'cancelled'>('total')
  const [visibleMetrics, setVisibleMetrics] = useState({ total: true, counter: true, table: true, cancelled: true })

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

  const [graphType, setGraphType] = useState<'line' | 'bar'>('line')
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealer, setSelectedDealer] = useState<string>('all')
  const [isDealerDropdownOpen, setIsDealerDropdownOpen] = useState(false)
  const [dealerSearchQuery, setDealerSearchQuery] = useState('')
  const [visibleLines, setVisibleLines] = useState({ total: true, paid: true, pending: true, cancelled: false })



  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches?limit=1000')
        const json = await response.json()
        if (json?.docs) {
          setBranches(json.docs.map((b: any) => ({ id: b.id, name: b.name })))
        }
      } catch (err) {
        console.error('Error fetching branches:', err)
      }
    }
    const fetchDealers = async () => {
      try {
        const response = await fetch('/api/raw-material-dealers?limit=1000&sort=companyName')
        const json = await response.json()
        if (json?.docs) {
          setDealers(json.docs.map((d: any) => ({ id: d.id, name: d.companyName || d.name })))
        }
      } catch (err) {
        console.error('Error fetching dealers:', err)
      }
    }
    fetchBranches()
    fetchDealers()
  }, [])

  const fetchBranchBillingData = useCallback(async (start: Date, end: Date, currentPreset: string, branch: string, metricFilter: string, isBackground: boolean = false) => {
    if (!isBackground) {
      setActiveLegendBranch(null)
      setLoading(true)
    }
    const isHourly = toLocalDateStr(start) === toLocalDateStr(end)
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: BRANCH_BILLING_REPORT_QUERY,
          variables: { 
            filter: { 
              startDate: toLocalDateStr(start), 
              endDate: toLocalDateStr(end), 
              trendPeriod: 'hourly', 
              branch: branch === 'all' ? '' : branch,
              trendMetricFilter: metricFilter === 'total' ? null : metricFilter
            } 
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
            pt.branchesData.forEach((bd: any) => allBranchIds.add(bd.branchId))
          }
        })
        
        const isToday = toLocalDateStr(start) === toLocalDateStr(new Date())
        const currentHour = new Date().getHours()

        const mappedData = rawData.map((pt: any) => {
          let isFuture = false
          if (isHourly && isToday && pt.label) {
            const match = pt.label.match(/(\d+) (AM|PM)/)
            if (match) {
              let h = parseInt(match[1])
              if (match[2] === 'PM' && h !== 12) h += 12
              if (match[2] === 'AM' && h === 12) h = 0
              if (h > currentHour) isFuture = true
            }
          }

          const point: any = { label: pt.label, totalAmount: isFuture ? null : pt.totalAmount, totalBills: isFuture ? null : pt.totalBills }
          allBranchIds.forEach(id => {
            const bd = pt.branchesData?.find((b: any) => b.branchId === id)
            point[id] = isFuture ? null : (bd ? bd.amount : 0)
            point[`${id}_count`] = isFuture ? null : (bd ? bd.billCount : 0)
          })
          return point
        })

        let trimmedData = mappedData
        if (trimmedData.length > 0) {
          const firstValidIndex = trimmedData.findIndex(pt => pt.totalAmount > 0 || pt.totalBills > 0)
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
        setLoading(false)
      }
    }
  }, [])

  const [rawMaterialData, setRawMaterialData] = useState<any[]>([])
  const [rawMaterialLoading, setRawMaterialLoading] = useState(false)

  useEffect(() => {
    if (activeMenu === 'raw-material' && rawMaterialData.length > 0) {
      const hasCancelled = rawMaterialData.some(d => d.cancelledTotal > 0)
      setVisibleLines(prev => ({ ...prev, cancelled: hasCancelled }))
    }
  }, [rawMaterialData, activeMenu])

  const fetchRawMaterialData = useCallback(async (start: Date, end: Date) => {
    setRawMaterialLoading(true)
    try {
      const startStr = [start.getFullYear(), String(start.getMonth() + 1).padStart(2, '0'), String(start.getDate()).padStart(2, '0')].join('-')
      const endStr = [end.getFullYear(), String(end.getMonth() + 1).padStart(2, '0'), String(end.getDate()).padStart(2, '0')].join('-')
      const res = await fetch(`/api/reports/raw-material-billing?startDate=${startStr}&endDate=${endStr}&company=all&dealer=${selectedDealer}`)
      if (!res.ok) throw new Error('Failed to fetch raw material')
      const reportData = await res.json()
      
      const isSingleDay = startStr === endStr
      
      let data: any[] = []
      
      const getActiveDates = (item: any, status: string, isSingleDay: boolean) => {
        const results: { bin: string; matchedDate: string; matchedReason: 'creation' | 'payment'; matchedAmount: number }[] = []
        
        const startDay = dayjs(startStr).startOf('day')
        const endDay = dayjs(endStr).endOf('day')
        const isValidDate = (dateStr: string) => {
          if (!dateStr) return false;
          const d = dayjs(dateStr);
          return (d.isAfter(startDay) || d.isSame(startDay, 'day')) && (d.isBefore(endDay) || d.isSame(endDay, 'day'));
        }

        const creationAmt = item.amount || 0;
        const paymentFallbackAmt = item.paidAmount || item.amount || 0;

        if (status === 'all' || status === 'pending' || status === 'cancelled' || status === 'paid') {
          // ALWAYS bucket by creation time if it falls in the date range, so 'Total Bill' is correct
          if (item.time && isValidDate(item.time)) {
            const bin = isSingleDay ? dayjs(item.time).hour().toString() : dayjs(item.time).format('YYYY-MM-DD')
            results.push({ bin, matchedDate: item.time, matchedReason: 'creation', matchedAmount: creationAmt })
          }
        }
        
        if (status === 'all' || status === 'paid') {
          // Bucket by payment times
          if (item.payments && item.payments.length > 0) {
            item.payments.forEach((p: any) => {
              if (p.date && isValidDate(p.date)) {
                const bin = isSingleDay ? dayjs(p.date).hour().toString() : dayjs(p.date).format('YYYY-MM-DD')
                results.push({ bin, matchedDate: p.date, matchedReason: 'payment', matchedAmount: p.amount || paymentFallbackAmt })
              }
            })
          } else if (item.status === 'paid' && item.time && isValidDate(item.time)) {
            // Fallback if marked paid but has no payments array
            const bin = isSingleDay ? dayjs(item.time).hour().toString() : dayjs(item.time).format('YYYY-MM-DD')
            // Only add if we didn't already add it for creation (avoid duplicate if we just added it)
            if (!results.some(r => r.bin === bin && r.matchedReason === 'payment')) {
              results.push({ bin, matchedDate: item.time, matchedReason: 'payment', matchedAmount: paymentFallbackAmt })
            }
          }
        }
        return results
      }

      if (isSingleDay) {
        let minHour = 24
        let maxHour = -1
        const hourlyItems: Record<string, any[]> = {}

        if (reportData && reportData.groups) {
          reportData.groups.forEach((group: any) => {
            if (group.items) {
              group.items.forEach((item: any) => {
                if (selectedStatus !== 'all' && item.status !== selectedStatus) return;
                const activeHours = getActiveDates(item, selectedStatus, true)
                activeHours.forEach(({ bin: hourStrVal, matchedDate, matchedReason, matchedAmount }) => {
                  const h = parseInt(hourStrVal, 10)
                  if (isNaN(h)) return
                  if (h < minHour) minHour = h
                  if (h > maxHour) maxHour = h
                  const hourStr = `${h.toString().padStart(2, '0')}:00`
                  if (!hourlyItems[hourStr]) hourlyItems[hourStr] = []
                  hourlyItems[hourStr].push({ ...item, matchedDate, matchedReason, matchedAmount, companyName: group.companyName || 'Unknown Company' })
                })
              })
            }
          })
        }
        
        if (minHour <= maxHour) {
          for (let h = minHour; h <= maxHour; h++) {
            const hourStr = `${h.toString().padStart(2, '0')}:00`
            const items = hourlyItems[hourStr] || []
            const total = items.filter(i => i.matchedReason === 'creation').reduce((acc, item) => acc + item.matchedAmount, 0)
            const pendingTotal = items.filter(i => i.matchedReason === 'creation' && i.status === 'pending').reduce((acc, item) => acc + item.matchedAmount, 0)
            const cancelledTotal = items.filter(i => i.matchedReason === 'creation' && i.status === 'cancelled').reduce((acc, item) => acc + item.matchedAmount, 0)
            const paidTotal = items.filter(i => i.matchedReason === 'payment').reduce((acc, item) => acc + item.matchedAmount, 0)
            
            // Get unique dealer names
            const dealerSet = new Set(items.map(i => i.dealerName || 'Unknown'))
        const dealerNames = dealerSet.size > 0 ? Array.from(dealerSet).join(', ') : 'No Bills'
            
            data.push({
              sortKey: hourStr,
              label: hourStr,
              dealer: dealerNames,
              timeStr: hourStr,
              totalPaid: selectedStatus === 'paid' ? paidTotal : selectedStatus === 'pending' ? pendingTotal : selectedStatus === 'cancelled' ? cancelledTotal : total,
              pendingTotal,
              paidTotal,
              cancelledTotal,
              rawItems: items,
              timeRangeStr: `${hourStr} - ${(h + 1).toString().padStart(2, '0')}:00`
            })
          }
        }
      } else {
        const dailyItems: Record<string, any[]> = {}
        if (reportData && reportData.groups) {
          reportData.groups.forEach((group: any) => {
            if (group.items) {
              group.items.forEach((item: any) => {
                if (selectedStatus !== 'all' && item.status !== selectedStatus) return;
                const activeDates = getActiveDates(item, selectedStatus, false)
                if (activeDates.length === 0) activeDates.push({ bin: 'Unknown', matchedDate: item.time || '', matchedReason: 'creation', matchedAmount: item.amount || 0 })
                
                activeDates.forEach(({ bin: key, matchedDate, matchedReason, matchedAmount }) => {
                  if (!dailyItems[key]) dailyItems[key] = []
                  dailyItems[key].push({ ...item, matchedDate, matchedReason, matchedAmount, companyName: group.companyName || 'Unknown Company' })
                })
              })
            }
          })
        }
        const sortedKeys = Object.keys(dailyItems).sort((a, b) => a.localeCompare(b))
        const uniqueMonths = new Set(
          sortedKeys.filter(k => k !== 'Unknown').map(k => dayjs(k).format('YYYY-MM'))
        )
        const isSingleMonth = uniqueMonths.size === 1
        
        let prevMonth = ''
        
        data = sortedKeys.map(key => {
          const items = dailyItems[key] || [];
          const total = items.filter(i => i.matchedReason === 'creation').reduce((acc, item) => acc + item.matchedAmount, 0)
          const pendingTotal = items.filter(i => i.matchedReason === 'creation' && i.status === 'pending').reduce((acc, item) => acc + item.matchedAmount, 0)
          const cancelledTotal = items.filter(i => i.matchedReason === 'creation' && i.status === 'cancelled').reduce((acc, item) => acc + item.matchedAmount, 0)
          const paidTotal = items.filter(i => i.matchedReason === 'payment').reduce((acc, item) => acc + item.matchedAmount, 0)

          if (key === 'Unknown') {
            return { 
              sortKey: key, 
              label: 'Unknown', 
              fullDate: 'Unknown', 
              totalPaid: selectedStatus === 'paid' ? paidTotal : selectedStatus === 'pending' ? pendingTotal : selectedStatus === 'cancelled' ? cancelledTotal : total, 
              pendingTotal,
              paidTotal,
              cancelledTotal,
              rawItems: items 
            }
          }
          
          const d = dayjs(key)
          const currentMonth = d.format('YYYY-MM')
          
          let label = ''
          if (isSingleMonth) {
            label = d.format('DD')
          } else {
            if (currentMonth !== prevMonth) {
              label = d.format('MMM DD')
              prevMonth = currentMonth
            } else {
              label = d.format('DD')
            }
          }

          return {
            sortKey: key,
            label,
            fullDate: d.format('MMM DD, YYYY'),
            totalPaid: selectedStatus === 'paid' ? paidTotal : selectedStatus === 'pending' ? pendingTotal : selectedStatus === 'cancelled' ? cancelledTotal : total,
            pendingTotal,
            paidTotal,
            cancelledTotal,
            rawItems: items
          }
        })
      }
      setRawMaterialData(data)
    } catch (err) {
      console.error(err)
    } finally {
      setRawMaterialLoading(false)
    }
  }, [selectedStatus, selectedDealer])

  useEffect(() => {
    if (activeMenu === 'raw-material' && startDate && endDate) {
      fetchRawMaterialData(startDate, endDate)
    }
  }, [activeMenu, startDate, endDate, fetchRawMaterialData])

  useEffect(() => {
    if (activeMenu === 'branch-billing' && startDate && endDate) {
      fetchBranchBillingData(startDate, endDate, presetKey, selectedBranch, activeMetricFilter, false)
      
      let intervalId: NodeJS.Timeout
      if (isLive) {
        intervalId = setInterval(() => {
          fetchBranchBillingData(startDate, endDate, presetKey, selectedBranch, activeMetricFilter, true)
        }, 10000) // Poll every 10 seconds
      }
      return () => {
        if (intervalId) clearInterval(intervalId)
      }
    }
  }, [activeMenu, startDate, endDate, presetKey, selectedBranch, activeMetricFilter, isLive, fetchBranchBillingData])

  const handleDateApply = (start: Date, end: Date, preset: string) => {
    setStartDate(start)
    setEndDate(end)
    setPresetKey(preset)
  }
  const branchesWithTotals = branches.map((b, i) => {
    let color = ''
    let isLight = false

    if (b.name.toUpperCase().includes('THOOTHUKUDI HOTEL')) {
      color = '#f97316' // Orange
      isLight = false // White text
    } else {
      const hue = Math.round(i * (360 / branches.length))
      color = `hsl(${hue}, 75%, 55%)`
      isLight = hue > 35 && hue < 200
    }
    
    const textColor = isLight ? '#1f2937' : '#ffffff'
    const total = chartData.reduce((acc, point) => acc + (point[b.id] || 0), 0)
    return { ...b, color, textColor, total }
  }).filter((b) => b.total > 0).sort((a, b) => b.total - a.total)

  let splitOffset = 0
  let average = 0
  if (selectedBranch !== 'all' && chartData.length > 0) {
    const dataKey = 'totalAmount'
    const validData = chartData.filter(i => i[dataKey] !== null)
    const dataMax = validData.length > 0 ? Math.max(...validData.map(i => i[dataKey])) : 0
    const dataMin = validData.length > 0 ? Math.min(...validData.map(i => i[dataKey])) : 0
    average = validData.length > 0 ? validData.reduce((acc, i) => acc + i[dataKey], 0) / validData.length : 0
    if (dataMax !== dataMin) {
      splitOffset = (dataMax - average) / (dataMax - dataMin)
      splitOffset = Math.max(0, Math.min(1, splitOffset))
    }
  }

  const validBranches = branchesWithTotals.filter(b => b.total > 0)
  
  let heatmapMax = 0
  let totalHeatmapMax = 0
  if (selectedBranch === 'all' && chartData.length > 0) {
    chartData.forEach(pt => {
      let currentHourTotal = 0
      validBranches.forEach(b => {
        if (pt[b.id]) {
          if (pt[b.id] > heatmapMax) heatmapMax = pt[b.id]
          currentHourTotal += pt[b.id]
        }
      })
      if (currentHourTotal > totalHeatmapMax) totalHeatmapMax = currentHourTotal
    })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const sortedPayload = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
      const totalHourAmount = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
      return (
        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px 16px', minWidth: '220px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px' }}>
            <span style={{ color: '#374151', fontWeight: 700, fontSize: '14px' }}>{label}</span>
            {selectedBranch === 'all' && (
              <span style={{ color: '#111827', fontWeight: 800, fontSize: '14px' }}>₹{totalHourAmount.toLocaleString('en-IN')}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedPayload.map((entry: any, index: number) => {
              const val = entry.value || 0
              if (val === 0 && sortedPayload.length > 1) return null // Hide zero values in tooltip for multiple branches
              
              let branchName = ''
              if (selectedBranch === 'all') {
                const branch = branches.find(b => b.id === (entry.dataKey || entry.name))
                branchName = branch ? branch.name : entry.name
              } else {
                branchName = activeMetricFilter === 'total' ? 'Total Amount' : activeMetricFilter === 'counter' ? 'Counter Sales' : activeMetricFilter === 'table' ? 'Table Order' : 'Cancelled Bill'
              }

              return (
                <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: entry.color || '#9333ea' }}></div>
                    <span style={{ color: '#4b5563', fontWeight: 500, maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{branchName}</span>
                  </div>
                  <span style={{ color: '#111827', fontWeight: 700, paddingLeft: '16px' }}>₹{val.toLocaleString('en-IN')}</span>
                </div>
              )
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const dealerSummary = useMemo(() => {
    if (activeMenu !== 'raw-material' || !rawMaterialData.length) return [];
    
    const map: Record<string, number> = {};

    rawMaterialData.forEach(d => {
      if (d.rawItems) {
        d.rawItems.forEach((item: any) => {
          let shouldInclude = false;
          if (visibleLines.total) {
            shouldInclude = item.matchedReason === 'creation';
          } else {
            if (visibleLines.paid && item.matchedReason === 'payment') shouldInclude = true;
            if (visibleLines.pending && item.matchedReason === 'creation' && item.status === 'pending') shouldInclude = true;
            if (visibleLines.cancelled && item.matchedReason === 'creation' && item.status === 'cancelled') shouldInclude = true;
          }
          
          if (shouldInclude) {
            const name = item.dealerName || 'Unknown';
            const amt = item.matchedAmount || 0;
            map[name] = (map[name] || 0) + amt;
          }
        });
      }
    });

    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [rawMaterialData, activeMenu, selectedStatus, visibleLines]);

  const dealerBills = useMemo(() => {
    if (activeMenu !== 'raw-material' || selectedDealer === 'all' || !rawMaterialData.length) return [];
    
    const bills: any[] = [];

    rawMaterialData.forEach(d => {
      if (d.rawItems) {
        d.rawItems.forEach((item: any) => {
          let shouldInclude = false;
          if (visibleLines.total) {
            shouldInclude = item.matchedReason === 'creation';
          } else {
            if (visibleLines.paid && item.matchedReason === 'payment') shouldInclude = true;
            if (visibleLines.pending && item.matchedReason === 'creation' && item.status === 'pending') shouldInclude = true;
            if (visibleLines.cancelled && item.matchedReason === 'creation' && item.status === 'cancelled') shouldInclude = true;
          }
          
          if (shouldInclude) {
            bills.push(item);
          }
        });
      }
    });

    return bills.sort((a, b) => new Date(b.matchedDate || b.date || b.time || 0).getTime() - new Date(a.matchedDate || a.date || a.time || 0).getTime());
  }, [rawMaterialData, activeMenu, selectedDealer, selectedStatus, visibleLines]);

  const totalDealerAmount = useMemo(() => {
    if (selectedDealer !== 'all') {
      return dealerBills.reduce((acc, b) => acc + (b.matchedAmount || 0), 0);
    }
    return dealerSummary.reduce((acc, d) => acc + d.amount, 0);
  }, [dealerSummary, dealerBills, selectedDealer]);

  return (
    <div style={{ backgroundColor: '#f0f4f9', minHeight: '100vh', width: '100vw', margin: 0, padding: 0, overflowX: 'hidden' }}>
      
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        height: '64px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        padding: '0 20px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40
      }}>
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginRight: '16px', display: 'flex', alignItems: 'center' }}
        >
          <Menu size={24} color="#5f6368" />
        </button>
        
        <div style={{ fontSize: '22px', color: '#5f6368', marginRight: '40px', display: 'flex', alignItems: 'center', letterSpacing: '-0.5px' }}>
          <span style={{ fontWeight: 600, color: '#4285f4' }}>Report</span>
          <span style={{ marginLeft: '4px', color: '#5f6368' }}>Graph</span>
        </div>



        {/* Date Picker on the right */}
        <div 
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }} 
          data-theme="light"
        >
          <style dangerouslySetInnerHTML={{__html: `
            .google-daterange-popover {
              left: auto !important;
              right: 0 !important;
            }
            .google-sidebar {
              position: fixed;
              top: 64px;
              left: 0;
              width: 72px;
              height: calc(100vh - 64px);
              background-color: #f8f9fa;
              z-index: 50;
              padding-top: 12px;
              transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s;
              overflow: hidden;
              white-space: nowrap;
              border-right: 1px solid #e8eaed;
              display: flex;
              flex-direction: column;
            }
            .google-sidebar:hover {
              width: 256px;
              background-color: #ffffff;
              box-shadow: 1px 0 2px 0 rgba(60,64,67,.1), 2px 0 6px 2px rgba(60,64,67,.05);
            }
            .google-nav-item {
              display: flex;
              align-items: center;
              height: 48px;
              width: 48px;
              border-radius: 24px;
              text-decoration: none;
              font-weight: 500;
              color: #3c4043;
              margin-bottom: 8px;
              transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s, color 0.2s;
              overflow: hidden;
              cursor: pointer;
            }
            .google-sidebar:hover .google-nav-item {
              width: 100%;
            }
            .google-nav-item.active {
              background-color: #9333ea;
              color: #ffffff;
            }
            .google-nav-item:not(.active):hover {
              background-color: #f1f3f4;
            }
            .google-nav-icon {
              width: 48px;
              height: 48px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .google-nav-label {
              padding-left: 12px;
              opacity: 0;
              transition: opacity 0.2s;
            }
            .google-sidebar:hover .google-nav-label {
              opacity: 1;
              transition-delay: 0.1s;
            }
          `}} />
          <GoogleDateRangePicker
            startDate={startDate}
            endDate={endDate}
            presetKey={presetKey}
            onApply={handleDateApply}
            isFilterActive={presetKey !== 'today'}
          />
        </div>
      </header>

      {/* Left Sidebar Overlay */}
      <aside className="google-sidebar">
        <div style={{ padding: '0 12px', flex: 1 }}>
          <Link href="/admin" className={`google-nav-item ${activeMenu === 'home' ? 'active' : ''}`}>
            <div className="google-nav-icon">
              <HomeIcon size={22} />
            </div>
            <span className="google-nav-label">Home</span>
          </Link>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveMenu('branch-billing'); }} className={`google-nav-item ${activeMenu === 'branch-billing' ? 'active' : ''}`}>
            <div className="google-nav-icon">
              <BarChart2 size={22} />
            </div>
            <span className="google-nav-label">Branch Billings</span>
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveMenu('raw-material'); }} className={`google-nav-item ${activeMenu === 'raw-material' ? 'active' : ''}`}>
            <div className="google-nav-icon">
              <FileText size={22} />
            </div>
            <span className="google-nav-label">Raw Material</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ 
        paddingTop: '64px', 
        paddingLeft: '72px', 
        minHeight: '100vh',
      }}>
        <div style={{ padding: '24px' }}>
          
          {/* Toolbar Container */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            padding: '16px 24px',
            width: '100%',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                  style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: isPresetDropdownOpen ? '#f3e8ff' : '#faf5ff',
                  color: '#9333ea',
                  border: '1px solid #e9d5ff',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
              >
                {GRAPH_PRESETS.find(p => p.key === (presetKey === 'custom' ? 'all' : presetKey))?.label || 'Timeframe'}
                <ChevronDown size={16} />
              </button>

              {isPresetDropdownOpen && (
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                    onClick={() => setIsPresetDropdownOpen(false)} 
                  />
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    padding: '8px 0',
                    minWidth: '180px',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {GRAPH_PRESETS.map((preset) => {
                      const isSelected = presetKey === preset.key || (presetKey === 'custom' && preset.key === 'all');
                      return (
                        <button
                          key={preset.key}
                          onClick={() => {
                            if (preset.key === 'all') {
                              handleDateApply(new Date('2020-01-01'), new Date(), 'custom');
                            } else {
                              const [s, e] = getPresetDates(preset.key, 'past');
                              handleDateApply(s, e, preset.key);
                            }
                            setIsPresetDropdownOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '8px 16px',
                            backgroundColor: isSelected ? '#faf5ff' : 'transparent',
                            color: isSelected ? '#9333ea' : '#374151',
                            border: 'none',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: isSelected ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'background-color 0.1s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#faf5ff' : '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#faf5ff' : 'transparent'}
                        >
                          {preset.label}
                          {isSelected && <Check size={16} color="#9333ea" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {activeMenu === 'raw-material' && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    backgroundColor: isStatusDropdownOpen ? '#f3f4f6' : '#ffffff',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {selectedStatus === 'all' ? 'All Status' : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
                  <ChevronDown size={16} color="#6b7280" />
                </button>

                {isStatusDropdownOpen && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                      onClick={() => setIsStatusDropdownOpen(false)} 
                    />
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      padding: '8px 0',
                      minWidth: '140px',
                      zIndex: 50,
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      {[
                        { value: 'all', label: 'All Status' },
                        { value: 'pending', label: 'Pending' },
                        { value: 'paid', label: 'Paid' },
                        { value: 'cancelled', label: 'Cancelled' }
                      ].map((status) => {
                        const isSelected = selectedStatus === status.value;
                        return (
                          <button
                            key={status.value}
                            onClick={() => {
                              setSelectedStatus(status.value);
                              setIsStatusDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              padding: '8px 16px',
                              backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
                              color: isSelected ? '#111827' : '#374151',
                              border: 'none',
                              textAlign: 'left',
                              fontSize: '13px',
                              fontWeight: isSelected ? 600 : 500,
                              cursor: 'pointer',
                              transition: 'background-color 0.1s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#f3f4f6' : '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#f3f4f6' : 'transparent'}
                          >
                            {status.label}
                            {isSelected && <Check size={16} color="#374151" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeMenu === 'raw-material' && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    if (!isDealerDropdownOpen) setDealerSearchQuery('');
                    setIsDealerDropdownOpen(!isDealerDropdownOpen);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    backgroundColor: isDealerDropdownOpen ? '#f3f4f6' : '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {selectedDealer === 'all' ? 'All Dealers' : dealers.find(d => d.id === selectedDealer)?.name || 'All Dealers'}
                  <ChevronDown size={14} color="#6b7280" />
                </button>

                {isDealerDropdownOpen && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                      onClick={() => setIsDealerDropdownOpen(false)} 
                    />
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      width: '240px',
                      maxHeight: '350px',
                      overflowY: 'auto',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      zIndex: 50,
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '8px 0'
                    }}>
                      <div style={{ padding: '0 12px 8px 12px', borderBottom: '1px solid #f3f4f6', marginBottom: '4px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search dealer..."
                            value={dealerSearchQuery}
                            onChange={(e) => setDealerSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '6px 28px 6px 12px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '13px',
                              outline: 'none'
                            }}
                          />
                          {dealerSearchQuery && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDealerSearchQuery('');
                                setSelectedDealer('all');
                              }}
                              style={{
                                position: 'absolute',
                                right: '6px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#9ca3af'
                              }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {[{ id: 'all', name: 'All Dealers' }, ...dealers.filter(d => d.name.toLowerCase().includes(dealerSearchQuery.toLowerCase()))].map((dealer) => {
                        const isSelected = selectedDealer === dealer.id;
                        return (
                          <button
                            key={dealer.id}
                            onClick={() => {
                              setSelectedDealer(dealer.id);
                              setIsDealerDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              padding: '8px 16px',
                              backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
                              color: isSelected ? '#111827' : '#374151',
                              border: 'none',
                              textAlign: 'left',
                              fontSize: '13px',
                              fontWeight: isSelected ? 600 : 500,
                              cursor: 'pointer',
                              transition: 'background-color 0.1s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#f3f4f6' : '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#f3f4f6' : 'transparent'}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                              {dealer.name}
                            </span>
                            {isSelected && <Check size={16} color="#374151" flexShrink={0} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            </div>
            
            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
               {activeMenu === 'branch-billing' && (
                 <>
                   <div style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '20px' }}>
                     <button onClick={() => setGraphType('line')} style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '16px', border: 'none', backgroundColor: graphType === 'line' ? '#fff' : 'transparent', color: graphType === 'line' ? '#374151' : '#6b7280', boxShadow: graphType === 'line' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>Line</button>
                     <button onClick={() => setGraphType('bar')} style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '16px', border: 'none', backgroundColor: graphType === 'bar' ? '#fff' : 'transparent', color: graphType === 'bar' ? '#374151' : '#6b7280', boxShadow: graphType === 'bar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>Bar</button>
                   </div>
                   <button
                     onClick={() => {
                       const nextLive = !isLive
                       setIsLive(nextLive)
                       if (nextLive) {
                         setStartDate(new Date())
                         setEndDate(new Date())
                         setPresetKey('today')
                       }
                     }}
                     style={{
                       display: 'flex',
                       alignItems: 'center',
                       gap: '6px',
                       padding: '6px 16px',
                       background: isLive ? '#fef2f2' : '#ffffff',
                       border: `1px solid ${isLive ? '#ef4444' : '#e5e7eb'}`,
                       borderRadius: '20px',
                       color: isLive ? '#ef4444' : '#374151',
                       fontSize: '13px',
                       fontWeight: 600,
                       cursor: 'pointer',
                       transition: 'all 0.2s'
                     }}
                   >
                     <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLive ? '#ef4444' : '#9ca3af', boxShadow: isLive ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none' }}></div>
                     Live
                   </button>
                   <select 
                     value={selectedBranch}
                     onChange={(e) => setSelectedBranch(e.target.value)}
                     style={{ padding: '6px 28px 6px 12px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '20px', color: '#374151', fontSize: '13px', fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23374151%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                   >
                     <option value="all">All Branches</option>
                     {branches.map(b => (
                       <option key={b.id} value={b.id}>{b.name}</option>
                     ))}
                   </select>
                 </>
               )}
            </div>
          </div>

          {/* Main Content Layout */}
          <div style={{ display: 'flex', gap: '20px', width: '100%', alignItems: 'flex-start' }}>
            {/* Graph Container */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              padding: '20px 24px',
              flex: activeMenu === 'raw-material' ? '0 0 calc(75% - 10px)' : '1',
              margin: '0',
              height: '520px',
              display: 'flex',
              flexDirection: 'column'
            }}>
            {/* Graph Area */}
            <div style={{ flex: 1, border: '1px dashed #e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', backgroundColor: '#fafafa', position: 'relative' }}>
              {activeMenu === 'raw-material' ? (
                rawMaterialLoading ? (
                  <div style={{ color: '#9ca3af' }}>Loading raw material data...</div>
                ) : rawMaterialData.length > 0 ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    {true && (
                      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, display: 'flex', borderRadius: '8px 0 8px 0', overflow: 'hidden', boxShadow: '2px 2px 10px rgba(0, 0, 0, 0.05)' }}>
                        <div 
                          onClick={() => setVisibleLines(prev => ({ ...prev, total: !prev.total }))}
                          style={{ backgroundColor: '#9333ea', padding: '12px 16px', color: '#fff', minWidth: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', opacity: visibleLines.total ? 1 : 0.6, transition: 'all 0.2s' }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.9, marginBottom: '6px' }}>
                            {visibleLines.total ? <CheckSquare size={12} /> : <Square size={12} />} TOTAL BILL
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 500 }}>₹{rawMaterialData.reduce((acc, d) => acc + (d.totalPaid || 0), 0).toLocaleString('en-IN')}</div>
                        </div>

                        <div 
                          onClick={() => setVisibleLines(prev => ({ ...prev, paid: !prev.paid }))}
                          style={{ backgroundColor: '#16a34a', padding: '12px 16px', color: '#fff', minWidth: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', opacity: visibleLines.paid ? 1 : 0.6, transition: 'all 0.2s' }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.9, marginBottom: '6px' }}>
                            {visibleLines.paid ? <CheckSquare size={12} /> : <Square size={12} />} PAID
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 500 }}>₹{rawMaterialData.reduce((acc, d) => acc + (d.paidTotal || 0), 0).toLocaleString('en-IN')}</div>
                        </div>

                        <div 
                          onClick={() => setVisibleLines(prev => ({ ...prev, pending: !prev.pending }))}
                          style={{ backgroundColor: '#ca8a04', padding: '12px 16px', color: '#fff', minWidth: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', opacity: visibleLines.pending ? 1 : 0.6, transition: 'all 0.2s' }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.9, marginBottom: '6px' }}>
                            {visibleLines.pending ? <CheckSquare size={12} /> : <Square size={12} />} PENDING
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 500 }}>₹{rawMaterialData.reduce((acc, d) => acc + (d.pendingTotal || 0), 0).toLocaleString('en-IN')}</div>
                        </div>

                        <div 
                          onClick={() => setVisibleLines(prev => ({ ...prev, cancelled: !prev.cancelled }))}
                          style={{ backgroundColor: '#ef4444', padding: '12px 16px', color: '#fff', minWidth: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', opacity: visibleLines.cancelled ? 1 : 0.6, transition: 'all 0.2s' }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.9, marginBottom: '6px' }}>
                            {visibleLines.cancelled ? <CheckSquare size={12} /> : <Square size={12} />} CANCELLED
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 500 }}>₹{rawMaterialData.reduce((acc, d) => acc + (d.cancelledTotal || 0), 0).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ flex: 1, minHeight: 0, marginTop: '20px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={rawMaterialData} margin={{ top: 85, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => val >= 1000 ? `₹${(val / 1000).toFixed(1)}K` : `₹${val}`} orientation="left" />
                        <Tooltip 
                          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                          position={{ y: 0 }}
                          allowEscapeViewBox={{ x: true, y: true }}
                          wrapperStyle={{ zIndex: 100 }}
                          content={(props: any) => {
                            const { active, payload } = props;
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const label = data.label;
                              
                              let filteredItems = [];
                              if (data.rawItems && data.rawItems.length > 0) {
                                filteredItems = data.rawItems.filter((item: any) => {
                                  if (visibleLines.total) {
                                    return item.matchedReason === 'creation';
                                  }
                                  if (visibleLines.paid && item.matchedReason === 'payment') return true;
                                  if (visibleLines.pending && item.matchedReason === 'creation' && item.status === 'pending') return true;
                                  if (visibleLines.cancelled && item.matchedReason === 'creation' && item.status === 'cancelled') return true;
                                  return false;
                                });
                              }
                              const tooltipTotal = filteredItems.reduce((acc: number, item: any) => acc + (item.matchedAmount || 0), 0);

                              return (
                                <div style={{ backgroundColor: '#fff', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', minWidth: '150px' }}>
                                  {filteredItems.length > 0 ? (
                                    <>
                                      <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                                        {data.timeStr ? 'Time: ' : 'Date: '}
                                        <span style={{ color: '#111827', fontWeight: 600 }}>{data.timeRangeStr || data.timeStr || data.fullDate || label}</span>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {filteredItems.map((item: any, i: number) => (
                                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                            <div>
                                              <div style={{ color: '#111827', fontWeight: 600, fontSize: '13px' }}>{item.dealerName || 'Unknown'}</div>
                                              <div style={{ color: '#9ca3af', fontSize: '11px' }}>
                                                {item.companyName && <span style={{ marginRight: '4px' }}>{item.companyName} •</span>}
                                                {(() => {
                                                  if (item.matchedReason === 'payment') return item.matchedDate ? dayjs(item.matchedDate).format('HH:mm') : '';
                                                  if (item.status === 'cancelled' || item.status === 'paid') return dayjs(item.updatedAt || item.time).format('HH:mm');
                                                  return item.time ? dayjs(item.time).format('HH:mm') : '';
                                                })()}
                                              </div>
                                            </div>
                                            <div style={{ color: '#111827', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.status === 'paid' ? '#16a34a' : item.status === 'pending' ? '#ca8a04' : item.status === 'cancelled' ? '#ef4444' : '#60a5fa' }}></div>
                                              ₹{(item.matchedAmount || 0).toLocaleString('en-IN')}
                                              {item.status && (
                                                <span style={{ 
                                                  fontSize: '10px', 
                                                  padding: '2px 6px', 
                                                  borderRadius: '12px', 
                                                  backgroundColor: item.status === 'paid' ? '#dcfce7' : item.status === 'pending' ? '#fef9c3' : '#fee2e2', 
                                                  color: item.status === 'paid' ? '#166534' : item.status === 'pending' ? '#854d0e' : '#991b1b',
                                                  marginLeft: '4px',
                                                  textTransform: 'capitalize',
                                                  fontWeight: 500
                                                }}>
                                                  {item.status}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #f3f4f6', paddingTop: '6px' }}>
                                        {visibleLines.total && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>Total Bill:</span>
                                            <span style={{ color: '#9333ea', fontWeight: 700, fontSize: '13px' }}>₹{(data.totalPaid || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.paid && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>Paid:</span>
                                            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '13px' }}>₹{(data.paidTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.pending && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>Pending:</span>
                                            <span style={{ color: '#ca8a04', fontWeight: 700, fontSize: '13px' }}>₹{(data.pendingTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.cancelled && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>Cancelled:</span>
                                            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '13px' }}>₹{(data.cancelledTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div style={{ color: '#111827', fontWeight: 'bold', marginBottom: '4px' }}>
                                        {data.fullDate || label}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {visibleLines.total && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9333ea' }}></div>
                                            <span style={{ color: '#6b7280', fontSize: '12px' }}>Total Bill:</span>
                                            <span style={{ color: '#111827', fontWeight: 600 }}>₹{(data.totalPaid || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.paid && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }}></div>
                                            <span style={{ color: '#6b7280', fontSize: '12px' }}>Paid:</span>
                                            <span style={{ color: '#111827', fontWeight: 600 }}>₹{(data.paidTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.pending && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ca8a04' }}></div>
                                            <span style={{ color: '#6b7280', fontSize: '12px' }}>Pending:</span>
                                            <span style={{ color: '#111827', fontWeight: 600 }}>₹{(data.pendingTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.cancelled && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                            <span style={{ color: '#6b7280', fontSize: '12px' }}>Cancelled:</span>
                                            <span style={{ color: '#111827', fontWeight: 600 }}>₹{(data.cancelledTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        {visibleLines.total && (
                          <Bar dataKey="totalPaid" fill="#9333ea" fillOpacity={(visibleLines.paid || visibleLines.pending || visibleLines.cancelled) ? 0.2 : 1} radius={[4, 4, 0, 0]} barSize={16} name="Total Bill" />
                        )}
                        {!visibleLines.total && visibleLines.paid && (
                          <Bar dataKey="paidTotal" fill="#16a34a" fillOpacity={(visibleLines.pending || visibleLines.cancelled) ? 0.2 : 1} radius={[4, 4, 0, 0]} barSize={16} name="Paid" />
                        )}
                        {!visibleLines.total && !visibleLines.paid && visibleLines.pending && (
                          <Bar dataKey="pendingTotal" fill="#ca8a04" fillOpacity={(visibleLines.cancelled) ? 0.2 : 1} radius={[4, 4, 0, 0]} barSize={16} name="Pending" />
                        )}
                        {!visibleLines.total && !visibleLines.paid && !visibleLines.pending && visibleLines.cancelled && (
                          <Bar dataKey="cancelledTotal" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} name="Cancelled" />
                        )}
                        
                        {visibleLines.paid && visibleLines.total && rawMaterialData.some(d => d.paidTotal > 0) && <Line type="monotone" dataKey="paidTotal" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Paid" />}
                        {visibleLines.pending && (visibleLines.total || visibleLines.paid) && rawMaterialData.some(d => d.pendingTotal > 0) && <Line type="monotone" dataKey="pendingTotal" stroke="#ca8a04" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Pending" />}
                        {visibleLines.cancelled && (visibleLines.total || visibleLines.paid || visibleLines.pending) && rawMaterialData.some(d => d.cancelledTotal > 0) && <Line type="monotone" dataKey="cancelledTotal" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Cancelled" />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  </div>
                ) : (
                  <div style={{ color: '#9ca3af' }}>No raw material data available</div>
                )
              ) : activeMenu !== 'branch-billing' ? (
                <div style={{ color: '#9ca3af' }}>Select a report from the menu</div>
              ) : (loading && chartData.length === 0) ? (
                <div style={{ color: '#9ca3af' }}>Loading chart data...</div>
              ) : chartData.length > 0 ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, display: 'flex', borderRadius: '8px 0 8px 0', overflow: 'hidden', boxShadow: '2px 2px 10px rgba(0, 0, 0, 0.05)' }}>
                    <div onClick={() => setVisibleMetrics({ total: true, counter: true, table: true, cancelled: true })} style={{ cursor: 'pointer', opacity: visibleMetrics.counter && visibleMetrics.table ? 1 : 0.6, backgroundColor: '#9333ea', color: '#fff', padding: '12px 16px', minWidth: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9, marginBottom: '6px' }}>
                        {visibleMetrics.counter && visibleMetrics.table ? <CheckSquare size={12} /> : <Square size={12} />} TOTAL BILL
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 500 }}>₹<AnimatedNumber value={totals.totalAmount} /></div>
                    </div>
                    <div onClick={() => setVisibleMetrics(prev => ({ ...prev, counter: !prev.counter }))} style={{ cursor: 'pointer', opacity: visibleMetrics.counter ? 1 : 0.6, backgroundColor: '#ec4899', color: '#fff', padding: '12px 16px', minWidth: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9, marginBottom: '6px' }}>
                        {visibleMetrics.counter ? <CheckSquare size={12} /> : <Square size={12} />} COUNTER SALES
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 500 }}>₹<AnimatedNumber value={totals.nonTableOrderAmount} /></div>
                    </div>
                    <div onClick={() => setVisibleMetrics(prev => ({ ...prev, table: !prev.table }))} style={{ cursor: 'pointer', opacity: visibleMetrics.table ? 1 : 0.6, backgroundColor: '#009688', color: '#fff', padding: '12px 16px', minWidth: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9, marginBottom: '6px' }}>
                        {visibleMetrics.table ? <CheckSquare size={12} /> : <Square size={12} />} TABLE ORDER
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 500 }}>₹<AnimatedNumber value={totals.tableOrderAmount} /></div>
                    </div>
                    <div onClick={() => setVisibleMetrics(prev => ({ ...prev, cancelled: !prev.cancelled }))} style={{ cursor: 'pointer', opacity: visibleMetrics.cancelled ? 1 : 0.6, backgroundColor: '#EF4444', color: '#fff', padding: '12px 16px', minWidth: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9, marginBottom: '6px' }}>
                        {visibleMetrics.cancelled ? <CheckSquare size={12} /> : <Square size={12} />} CANCELLED BILL
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 500 }}>₹<AnimatedNumber value={totals.cancelledAmount} /></div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, marginTop: '20px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {selectedBranch === 'all' ? (
                        graphType === 'bar' ? (
                          <BarChart data={chartData} margin={{ top: 85, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} minTickGap={30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} orientation="right" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                            {branchesWithTotals
                              .filter(b => activeLegendBranch === null || activeLegendBranch === b.id)
                              .map(b => (
                              <Bar key={b.id} dataKey={b.id} fill={b.color} radius={[4, 4, 0, 0]} />
                            ))}
                          </BarChart>
                        ) : (
                        <AreaChart data={chartData} margin={{ top: 85, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            {branchesWithTotals.map(b => (
                              <linearGradient key={`grad-${b.id}`} id={`color-${b.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={b.color} stopOpacity={0.4}/>
                                <stop offset="95%" stopColor={b.color} stopOpacity={0}/>
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} minTickGap={30} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} orientation="right" />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                          {branchesWithTotals
                            .filter(b => activeLegendBranch === null || activeLegendBranch === b.id)
                            .map(b => (
                            <Area key={b.id} type="linear" dataKey={b.id} stroke={b.color} strokeWidth={2} fillOpacity={1} fill={`url(#color-${b.id})`} activeDot={{ r: 4, strokeWidth: 0, fill: b.color }} />
                          ))}
                        </AreaChart>
                        )
                      ) : (
                        graphType === 'bar' ? (
                          <BarChart data={chartData} margin={{ top: 85, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} minTickGap={30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} orientation="right" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                            <ReferenceLine y={average} stroke="#d1d5db" strokeDasharray="3 3" />
                            <Bar dataKey="totalAmount" fill="url(#splitColor)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        ) : (
                        <AreaChart data={chartData} margin={{ top: 85, right: 0, left: 0, bottom: 0 }}>
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
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} minTickGap={30} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} orientation="right" />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                          <ReferenceLine y={average} stroke="#d1d5db" strokeDasharray="3 3" />
                          <Area type="linear" dataKey="totalAmount" stroke="url(#splitColor)" strokeWidth={2} fillOpacity={1} fill="url(#splitFill)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                        </AreaChart>
                        )
                      )}
                    </ResponsiveContainer>
                  </div>
                  {selectedBranch === 'all' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px 20px', justifyContent: 'center', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb', maxHeight: '120px', overflowY: 'auto' }}>
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
                              padding: '6px 12px', 
                              backgroundColor: isActive ? b.color : '#f3f4f6', 
                              borderRadius: '16px', 
                              fontSize: '12px', 
                              fontWeight: 600, 
                              color: isActive ? b.textColor : '#9ca3af', 
                              textShadow: isActive && b.textColor === '#ffffff' ? '0px 1px 1px rgba(0,0,0,0.2)' : 'none',
                              opacity: isActive ? 1 : 0.6,
                              transition: 'all 0.2s ease-in-out'
                            }}
                          >
                            {b.name.trim().substring(0, 3).toUpperCase()} <span style={{ color: isActive ? (b.textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(31, 41, 55, 0.8)') : '#9ca3af', fontWeight: 500 }}>₹<AnimatedNumber value={b.total} /></span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#9ca3af' }}>No data available for this date range</div>
              )}
            </div>
          </div>
          
          {/* Right Side Panel: Dealers Summary */}
          {activeMenu === 'raw-material' && (
             <div style={{
               backgroundColor: '#ffffff',
               borderRadius: '12px',
               boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
               padding: '20px 24px',
               flex: '0 0 calc(25% - 10px)',
               height: '520px',
               display: 'flex',
               flexDirection: 'column'
             }}>
                <div style={{ paddingBottom: '16px', borderBottom: '1px solid #f3f4f6', marginBottom: '12px' }}>
                  <h3 style={{ margin: '0', color: '#111827', fontSize: '16px', fontWeight: 600 }}>
                    {selectedDealer === 'all' ? 'Dealers Summary' : 'Bills Summary'}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    {selectedDealer === 'all' ? 'Total across selected date range' : (dealers.find(d => d.id === selectedDealer)?.name || 'Unknown Dealer')}
                  </div>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
                  {selectedDealer === 'all' ? (
                    dealerSummary.length > 0 ? (
                      dealerSummary.map((dealer, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: idx < dealerSummary.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                              {idx + 1}
                            </div>
                            <span style={{ color: '#374151', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={dealer.name}>
                              {dealer.name}
                            </span>
                          </div>
                          <span style={{ color: '#111827', fontSize: '13px', fontWeight: 600, paddingLeft: '8px' }}>
                            ₹{dealer.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>No dealers found</div>
                    )
                  ) : (
                    dealerBills.length > 0 ? (
                      dealerBills.map((bill, idx) => {
                        const isSameDayPaid = bill.status === 'paid' && (
                          (bill.payments && bill.payments.length > 0 && bill.payments.some((p: any) => p.date && dayjs(p.date).isSame(bill.time, 'day'))) ||
                          (!bill.payments || bill.payments.length === 0)
                        );
                        
                        return (
                        <div key={bill.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', marginBottom: '4px', borderRadius: '8px', backgroundColor: isSameDayPaid ? '#f0fdf4' : 'transparent', borderBottom: (!isSameDayPaid && idx < dealerBills.length - 1) ? '1px solid #f9fafb' : 'none' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                            <span style={{ color: '#374151', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {bill.companyName && <span style={{ marginRight: '4px', color: '#6b7280' }}>{bill.companyName} •</span>}
                              {(() => {
                                if (bill.matchedReason === 'payment') return bill.matchedDate ? dayjs(bill.matchedDate).format('MMM DD, YYYY - HH:mm') : '';
                                if (bill.status === 'cancelled' || bill.status === 'paid') return dayjs(bill.updatedAt || bill.time).format('MMM DD, YYYY - HH:mm');
                                return dayjs(bill.time || bill.date).format('MMM DD, YYYY - HH:mm');
                              })()}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {bill.status && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '12px', 
                                  backgroundColor: bill.status === 'paid' ? '#dcfce7' : bill.status === 'pending' ? '#fef9c3' : '#fee2e2', 
                                  color: bill.status === 'paid' ? '#166534' : bill.status === 'pending' ? '#854d0e' : '#991b1b',
                                  textTransform: 'capitalize',
                                  fontWeight: 500,
                                  width: 'fit-content'
                                }}>
                                  {bill.status}
                                </span>
                              )}
                              {isSameDayPaid && (
                                <span style={{ fontSize: '10px', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <CheckSquare size={10} /> Same Day Paid
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ color: '#111827', fontSize: '13px', fontWeight: 600, paddingLeft: '8px' }}>
                            ₹{(bill.matchedAmount || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      );
                      })
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>No bills found</div>
                    )
                  )}
                </div>
                
                <div style={{ paddingTop: '16px', borderTop: '1px solid #e5e7eb', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#4b5563', fontSize: '14px', fontWeight: 600 }}>Total Amount</span>
                  <span style={{ color: '#111827', fontSize: '16px', fontWeight: 700 }}>
                    ₹{totalDealerAmount.toLocaleString('en-IN')}
                  </span>
                </div>
             </div>
          )}
        </div>
          {/* Heatmap Container */}
          {activeMenu === 'branch-billing' && chartData.length > 0 && selectedBranch === 'all' && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              padding: '20px 24px',
              width: '100%',
              marginTop: '20px',
              overflowX: 'auto'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>Branch Performance Heatmap</h3>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '2px', fontSize: '12px', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280', fontWeight: 600, position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 2, borderBottom: '2px solid #f3f4f6', borderRight: '2px solid #f3f4f6', maxWidth: '120px', whiteSpace: 'normal', lineHeight: '1.3' }}>Branch Name</th>
                    {chartData.filter(pt => validBranches.some(b => pt[b.id] !== null)).map((pt, i) => (
                      <th key={i} style={{ textAlign: 'center', padding: '8px 4px', color: '#374151', fontWeight: 600, borderBottom: '2px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                        {pt.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validBranches.map(b => (
                    <tr key={b.id}>
                      <td style={{ padding: '8px', color: '#1f2937', fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 1, whiteSpace: 'normal', maxWidth: '120px', borderRight: '2px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', lineHeight: '1.3' }}>
                        {b.name}
                      </td>
                      {chartData.filter(pt => validBranches.some(b2 => pt[b2.id] !== null)).map((pt, i) => {
                        const val = pt[b.id]
                        const isNull = val === null
                        const intensity = (!isNull && heatmapMax > 0) ? val / heatmapMax : 0
                        
                        const opacity = isNull ? 0 : Math.max(0.04, intensity)
                        const bgColor = `rgba(147, 51, 234, ${opacity})` // Tailwind purple-600
                        const textColor = intensity > 0.4 ? '#ffffff' : '#000000'

                        return (
                          <td key={i} style={{ padding: '8px 4px', textAlign: 'center', backgroundColor: bgColor, color: textColor, borderRadius: '4px', fontWeight: isNull ? 400 : 500, borderBottom: '1px solid #f3f4f6' }}>
                            {isNull ? '-' : `₹${val.toLocaleString('en-IN')}`}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <td style={{ padding: '8px', color: '#1f2937', fontWeight: 700, position: 'sticky', left: 0, backgroundColor: '#f9fafb', zIndex: 1, whiteSpace: 'nowrap', borderRight: '2px solid #f3f4f6', borderTop: '2px solid #e5e7eb' }}>
                      TOTAL
                    </td>
                    {chartData.filter(pt => validBranches.some(b2 => pt[b2.id] !== null)).map((pt, i) => {
                      const totalVal = validBranches.reduce((acc, b) => acc + (pt[b.id] || 0), 0)
                      const intensity = (totalVal > 0 && totalHeatmapMax > 0) ? totalVal / totalHeatmapMax : 0
                      
                      const opacity = totalVal === 0 ? 0 : Math.max(0.04, intensity)
                      const bgColor = `rgba(21, 128, 61, ${opacity})` // Tailwind green-700
                      const textColor = intensity > 0.4 ? '#ffffff' : '#000000'

                      return (
                        <td key={i} style={{ padding: '8px 4px', textAlign: 'center', backgroundColor: bgColor, color: textColor, borderRadius: '4px', fontWeight: totalVal === 0 ? 400 : 700, borderTop: '2px solid #e5e7eb' }}>
                          {totalVal === 0 ? '-' : `₹${totalVal.toLocaleString('en-IN')}`}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>

    </div>
  )
}
