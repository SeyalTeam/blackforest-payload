'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { StylesConfig } from 'react-select'
import { Loader2 } from 'lucide-react'
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

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
  const [date, setDate] = useState<Date>(new Date())
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  
  const [data, setData] = useState<TimeWiseReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Slider state
  const [startTimeInSeconds, setStartTimeInSeconds] = useState<number>(0)
  const [endTimeInSeconds, setEndTimeInSeconds] = useState<number>(0)
  const requestIdRef = useRef(0)

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
          setBranches(json.docs)
        }
      } catch (err) {
        console.error('Error fetching branches:', err)
      }
    }
    fetchBranches()
  }, [])

  const fetchReport = useCallback(async (selectedDate: Date, branch: string) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const dateStr = toLocalDateStr(selectedDate)

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: TIME_WISE_REPORT_QUERY,
          variables: { filter: { startDate: dateStr, endDate: dateStr, branch: branch === 'all' ? null : branch } },
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
      const isToday = toLocalDateStr(new Date()) === dateStr
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
    fetchReport(date, selectedBranch)
  }, [date, selectedBranch, fetchReport])

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
          <label>Select Date</label>
          <div className="date-picker-wrapper">
            <DatePicker
              selected={date}
              onChange={(d: Date | null) => d && setDate(d)}
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

              <div className="banner-breakdown channels-breakdown">
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
            </div>
            <div className="banner-section closing-banner">
              <div className="banner-title">Closing Report ({formatTimeFromSeconds(startTimeInSeconds)} - {formatTimeFromSeconds(endTimeInSeconds)})</div>
              <h2 className="banner-amount">{formatCurrency(timelineData.closingStats.totalSales)}</h2>
              
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
        </>
      )}
    </div>
  )
}

export default TimeWiseReport
