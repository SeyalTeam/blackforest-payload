'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import dayjs from 'dayjs'
import './GoogleDateRangePicker.scss'

export interface PresetOption {
  key: string
  label: string
}

export const PAST_PRESETS: PresetOption[] = [
  { key: 'custom', label: 'Custom' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This week (Sun - Today)' },
  { key: 'last7Days', label: 'Last 7 days' },
  { key: 'lastWeek', label: 'Last week (Sun - Sat)' },
  { key: 'last28Days', label: 'Last 28 days' },
  { key: 'last30Days', label: 'Last 30 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'last90Days', label: 'Last 90 days' },
  { key: 'quarterToDate', label: 'Quarter to date' },
  { key: 'thisYear', label: 'This year (Jan – Today)' },
  { key: 'lastYear', label: 'Last calendar year' },
]

export const FUTURE_PRESETS: PresetOption[] = [
  { key: 'custom', label: 'Custom Range' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'next7Days', label: 'Next 7 days' },
  { key: 'next10Days', label: 'Next 10 days' },
  { key: 'next14Days', label: 'Next 14 days' },
  { key: 'next30Days', label: 'Next 30 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'nextMonth', label: 'Next month' },
  { key: 'overdue', label: 'Overdue (Past Due)' },
]

export const getPresetDates = (key: string, mode: 'past' | 'future' = 'past'): [Date, Date] => {
  const today = dayjs()

  if (mode === 'future') {
    switch (key) {
      case 'today':
        return [today.startOf('day').toDate(), today.endOf('day').toDate()]
      case 'tomorrow': {
        const tom = today.add(1, 'day')
        return [tom.startOf('day').toDate(), tom.endOf('day').toDate()]
      }
      case 'next7Days':
        return [today.startOf('day').toDate(), today.add(6, 'day').endOf('day').toDate()]
      case 'next10Days':
        return [today.startOf('day').toDate(), today.add(9, 'day').endOf('day').toDate()]
      case 'next14Days':
        return [today.startOf('day').toDate(), today.add(13, 'day').endOf('day').toDate()]
      case 'next30Days':
        return [today.startOf('day').toDate(), today.add(29, 'day').endOf('day').toDate()]
      case 'thisMonth':
        return [today.startOf('month').toDate(), today.endOf('month').toDate()]
      case 'nextMonth': {
        const nextM = today.add(1, 'month')
        return [nextM.startOf('month').toDate(), nextM.endOf('month').toDate()]
      }
      case 'overdue':
        return [today.subtract(1, 'year').startOf('day').toDate(), today.subtract(1, 'day').endOf('day').toDate()]
      case 'custom':
      default:
        return [today.startOf('day').toDate(), today.endOf('day').toDate()]
    }
  }

  switch (key) {
    case 'today':
      return [today.startOf('day').toDate(), today.endOf('day').toDate()]
    case 'yesterday': {
      const y = today.subtract(1, 'day')
      return [y.startOf('day').toDate(), y.endOf('day').toDate()]
    }
    case 'thisWeek':
      return [today.startOf('week').toDate(), today.endOf('day').toDate()]
    case 'last7Days':
      return [today.subtract(6, 'day').startOf('day').toDate(), today.endOf('day').toDate()]
    case 'lastWeek': {
      const lastW = today.subtract(1, 'week')
      return [lastW.startOf('week').toDate(), lastW.endOf('week').toDate()]
    }
    case 'last28Days':
      return [today.subtract(27, 'day').startOf('day').toDate(), today.endOf('day').toDate()]
    case 'last30Days':
      return [today.subtract(29, 'day').startOf('day').toDate(), today.endOf('day').toDate()]
    case 'thisMonth':
      return [today.startOf('month').toDate(), today.endOf('day').toDate()]
    case 'lastMonth': {
      const lastM = today.subtract(1, 'month')
      return [lastM.startOf('month').toDate(), lastM.endOf('month').toDate()]
    }
    case 'last90Days':
      return [today.subtract(89, 'day').startOf('day').toDate(), today.endOf('day').toDate()]
    case 'quarterToDate':
      return [today.startOf('quarter').toDate(), today.endOf('day').toDate()]
    case 'thisYear':
      return [today.startOf('year').toDate(), today.endOf('day').toDate()]
    case 'lastYear': {
      const lastY = today.subtract(1, 'year')
      return [lastY.startOf('year').toDate(), lastY.endOf('year').toDate()]
    }
    case 'custom':
    default:
      return [today.startOf('day').toDate(), today.endOf('day').toDate()]
  }
}

interface GoogleDateRangePickerProps {
  startDate: Date | null
  endDate: Date | null
  presetKey?: string
  presetMode?: 'past' | 'future'
  placeholder?: string
  isFilterActive?: boolean
  highlightedDates?: string[] // YYYY-MM-DD date strings that have planned bills
  onApply: (start: Date, end: Date, presetKey: string) => void
  onClear?: () => void
}

export const GoogleDateRangePicker: React.FC<GoogleDateRangePickerProps> = ({
  startDate,
  endDate,
  presetKey = 'today',
  presetMode = 'past',
  placeholder,
  isFilterActive,
  highlightedDates = [],
  onApply,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>(presetKey || 'today')

  const presets = presetMode === 'future' ? FUTURE_PRESETS : PAST_PRESETS

  const [tempStart, setTempStart] = useState<Date>(startDate || new Date())
  const [tempEnd, setTempEnd] = useState<Date>(endDate || new Date())
  const [selectingStep, setSelectingStep] = useState<'start' | 'end'>('start')

  const [viewMonth, setViewMonth] = useState<dayjs.Dayjs>(dayjs(startDate || new Date()).startOf('month'))

  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (startDate) setTempStart(startDate)
    if (endDate) setTempEnd(endDate)
    if (presetKey) setSelectedPreset(presetKey)
  }, [startDate, endDate, presetKey])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key)
    if (key !== 'custom') {
      const [s, e] = getPresetDates(key, presetMode)
      setTempStart(s)
      setTempEnd(e)
      setViewMonth(dayjs(e).startOf('month'))
    }
  }

  const handleDayClick = (date: Date) => {
    setSelectedPreset('custom')
    if (selectingStep === 'start') {
      setTempStart(date)
      setTempEnd(date)
      setSelectingStep('end')
    } else {
      if (dayjs(date).isBefore(dayjs(tempStart))) {
        setTempStart(date)
        setTempEnd(date)
        setSelectingStep('end')
      } else {
        setTempEnd(date)
        setSelectingStep('start')
      }
    }
  }

  const handleApply = () => {
    const finalStart = dayjs(tempStart).isAfter(dayjs(tempEnd)) ? tempEnd : tempStart
    const finalEnd = dayjs(tempEnd).isBefore(dayjs(tempStart)) ? tempStart : tempEnd
    onApply(finalStart, finalEnd, selectedPreset)
    setIsOpen(false)
  }

  const handleCancel = () => {
    if (startDate) setTempStart(startDate)
    if (endDate) setTempEnd(endDate)
    if (presetKey) setSelectedPreset(presetKey)
    setIsOpen(false)
  }

  const month1 = viewMonth

  const renderMonthCalendar = (m: dayjs.Dayjs) => {
    const startOfMonth = m.startOf('month')
    const daysInMonth = m.daysInMonth()
    
    let startDayOfWeek = startOfMonth.day() - 1
    if (startDayOfWeek < 0) startDayOfWeek = 6

    const days: (dayjs.Dayjs | null)[] = []
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(m.date(d))
    }

    const todayObj = dayjs()

    return (
      <div className="calendar-month-block" key={m.format('YYYY-MM')}>
        <div className="calendar-month-title">{m.format('MMM YYYY').toUpperCase()}</div>
        <div className="calendar-weekdays-row">
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span>F</span>
          <span>S</span>
          <span>S</span>
        </div>
        <div className="calendar-days-grid">
          {days.map((dayObj, idx) => {
            if (!dayObj) return <div key={`empty-${idx}`} className="day-cell-wrapper empty" />

            const colIndex = idx % 7
            const dayDate = dayObj.toDate()
            const isStart = Boolean(tempStart && dayjs(dayObj).isSame(dayjs(tempStart), 'day'))
            const isEnd = Boolean(tempEnd && dayjs(dayObj).isSame(dayjs(tempEnd), 'day'))
            const isSingleDay = isStart && isEnd
            const isToday = dayjs(dayObj).isSame(todayObj, 'day')

            const formattedDay = dayObj.format('YYYY-MM-DD')
            const hasPlannedBill = highlightedDates.includes(formattedDay)

            let inRange = false
            if (tempStart && tempEnd && !isSingleDay) {
              const startMs = dayjs(tempStart).startOf('day').valueOf()
              const endMs = dayjs(tempEnd).startOf('day').valueOf()
              const curMs = dayObj.startOf('day').valueOf()
              inRange = curMs > startMs && curMs < endMs
            }

            return (
              <div key={dayObj.format('YYYY-MM-DD')} className="day-cell-wrapper">
                {/* Background range highlight band */}
                {inRange && (
                  <div
                    className={`range-bg full ${colIndex === 0 ? 'row-first' : ''} ${
                      colIndex === 6 ? 'row-last' : ''
                    }`}
                  />
                )}
                {isStart && !isSingleDay && <div className="range-bg start" />}
                {isEnd && !isSingleDay && <div className="range-bg end" />}

                {/* Day Circle Button */}
                <button
                  type="button"
                  className={`day-circle ${isStart ? 'start-circle' : ''} ${isEnd ? 'end-circle' : ''} ${
                    inRange ? 'in-range-circle' : ''
                  } ${isToday && !isStart && !isEnd ? 'today-circle' : ''} ${
                    hasPlannedBill && !isStart && !isEnd ? 'planned-bill-circle' : ''
                  }`}
                  onClick={() => handleDayClick(dayDate)}
                  title={hasPlannedBill ? `Payment scheduled on ${dayObj.format('DD MMM YYYY')}` : undefined}
                >
                  {dayObj.date()}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const labelText = useMemo(() => {
    if (!startDate && !endDate && placeholder) {
      return placeholder
    }

    const startFmt = dayjs(tempStart).format('DD MMM YYYY')
    const endFmt = dayjs(tempEnd).format('DD MMM YYYY')
    const isSingleDay = startFmt === endFmt

    if (selectedPreset !== 'custom') {
      const opt = presets.find((p) => p.key === selectedPreset)
      if (opt) {
        return isSingleDay ? `${opt.label}: ${startFmt}` : `${opt.label}: ${startFmt} – ${endFmt}`
      }
    }
    return isSingleDay ? startFmt : `${startFmt} – ${endFmt}`
  }, [startDate, endDate, placeholder, selectedPreset, tempStart, tempEnd, presets])

  return (
    <div className="google-daterange-picker-wrapper">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          ref={triggerRef}
          type="button"
          className={`google-daterange-trigger-btn ${isOpen ? 'active' : ''} ${
            isFilterActive ? 'filter-active' : ''
          }`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="trigger-icon">📅</span>
          <span className="trigger-label">{labelText}</span>
          <span className="trigger-arrow">▼</span>
        </button>

        {onClear && isFilterActive && (
          <button
            type="button"
            className="daterange-clear-btn"
            onClick={onClear}
            title="Clear date filter"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="google-daterange-popover" ref={popoverRef}>
          <div className="popover-body">
            {/* Sidebar Presets */}
            <div className="popover-sidebar">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`preset-item ${selectedPreset === p.key ? 'active' : ''}`}
                  onClick={() => handleSelectPreset(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Main Calendar View */}
            <div className="popover-main">
              {/* Top Date Inputs */}
              <div className="top-inputs-row">
                <div className="input-group-outlined focused">
                  <span className="floating-label">Start date</span>
                  <input
                    type="text"
                    readOnly
                    value={dayjs(tempStart).format('DD MMM YYYY')}
                    className="date-read-input"
                  />
                </div>
                <span className="inputs-dash">–</span>
                <div className="input-group-outlined">
                  <span className="floating-label">End date</span>
                  <input
                    type="text"
                    readOnly
                    value={dayjs(tempEnd).format('DD MMM YYYY')}
                    className="date-read-input"
                  />
                </div>
              </div>

              {/* Month Navigation & Calendars */}
              <div className="month-nav-header">
                <button
                  type="button"
                  className="month-nav-btn"
                  onClick={() => setViewMonth(viewMonth.subtract(1, 'month'))}
                  title="Previous month"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="month-nav-btn"
                  onClick={() => setViewMonth(viewMonth.add(1, 'month'))}
                  title="Next month"
                >
                  ›
                </button>
              </div>

              <div className="calendars-scroll-container">
                {renderMonthCalendar(month1)}
              </div>

              {/* Action Buttons Footer */}
              <div className="popover-footer">
                <button type="button" className="action-btn cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="button" className="action-btn apply-btn" onClick={handleApply}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
