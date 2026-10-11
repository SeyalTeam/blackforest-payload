'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import './index.scss'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type AttendanceActivity = {
  id?: string
  type: 'session' | 'break'
  punchIn: string
  punchOut?: string
  status: 'active' | 'closed'
  durationSeconds: number
  durationFormatted: string
  ipAddress?: string
  device?: string
  capturedImageUrl?: string
  latitude?: number
  longitude?: number
  branchId?: string
  branchName?: string
}

export type AggregatedItem = {
  isAggregated: true
  id: string
  employeeName: string
  employeeIdStr: string
  employeePhotoUrl?: string
  employeeSalary?: number
  userRole: string
  employeeTeam: string
  branchName: string
  daysPresent: number
  daysLeave: number
  leaveDatesFormatted: string
  salaryAmount: number
  extraHoursFormatted: string
  branchCombined: string
  avgFirstInFormatted: string
  avgLastOutFormatted: string
  totalSessions: number
  totalBreakSeconds: number
  totalBreakFormatted: string
  totalWorkSeconds: number
  totalWorkFormatted: string
  avgWorkSeconds: number
  avgWorkFormatted: string
  originalItems: AttendanceItem[]
}

export type AttendanceItem = {
  id: string
  date: string
  dateString: string
  userId: string
  userName: string
  userEmail: string
  userRole: string
  employeeObjectId?: string
  employeeId?: string
  employeeName: string
  employeeTeam?: string
  employeePhone?: string
  employeePhotoUrl?: string
  employeeSalary?: number
  employeeWorkingHours?: number
  employeeLoginTime?: string
  employeeLogoutTime?: string
  branchId?: string
  branchName: string
  loginBranchId?: string
  loginBranchName?: string
  firstPunchIn?: string
  lastPunchOut?: string
  totalWorkSeconds: number
  totalWorkFormatted: string
  totalBreakSeconds: number
  totalBreakFormatted: string
  sessionCount: number
  breakCount: number
  status: 'active' | 'on_break' | 'closed'
  activities: AttendanceActivity[]
}

export type AttendanceTotals = {
  totalRecords: number
  uniqueEmployees: number
  currentlyActive: number
  totalWorkSeconds: number
  totalWorkFormatted: string
  totalBreakSeconds: number
  totalBreakFormatted: string
  avgWorkSecondsPerDay: number
  avgWorkFormatted: string
}

export type AttendanceRoleStat = {
  role: string
  count: number
  totalHours: number
}

export type AttendanceBranchStat = {
  branchId: string
  branchName: string
  presentCount: number
  activeCount: number
  totalHours: number
}

export type AttendanceReportData = {
  startDate: string
  endDate: string
  items: AttendanceItem[]
  totals: AttendanceTotals
  roleStats: AttendanceRoleStat[]
  branchStats: AttendanceBranchStat[]
}

type AttendanceReportQueryResponse = {
  data?: {
    attendanceReport?: AttendanceReportData
  }
  errors?: {
    message?: string
  }[]
}

type SelectOption = {
  value: string
  label: string
}

const ATTENDANCE_REPORT_QUERY = `
  query AttendanceReport($filter: AttendanceReportFilterInput) {
    attendanceReport(filter: $filter) {
      startDate
      endDate
      items {
        id
        date
        dateString
        userId
        userName
        userEmail
        userRole
        employeeObjectId
        employeeId
        employeeName
        employeeTeam
        employeePhone
        employeePhotoUrl
        employeeSalary
        employeeWorkingHours
        employeeLoginTime
        employeeLogoutTime
        branchId
        branchName
        loginBranchId
        loginBranchName
        firstPunchIn
        lastPunchOut
        totalWorkSeconds
        totalWorkFormatted
        extraSeconds
        extraHoursFormatted
        totalBreakSeconds
        totalBreakFormatted
        sessionCount
        breakCount
        status
        activities {
          id
          type
          punchIn
          punchOut
          status
          durationSeconds
          durationFormatted
          ipAddress
          device
          capturedImageUrl
          latitude
          longitude
          branchId
          branchName
        }
      }
      totals {
        totalRecords
        uniqueEmployees
        currentlyActive
        totalWorkSeconds
        totalWorkFormatted
        totalBreakSeconds
        totalBreakFormatted
        avgWorkSecondsPerDay
        avgWorkFormatted
      }
      roleStats {
        role
        count
        totalHours
      }
      branchStats {
        branchId
        branchName
        presentCount
        activeCount
        totalHours
      }
    }
  }
`

const CheckboxOption = (props: OptionProps<SelectOption, true>) => {
  return (
    <components.Option {...props}>
      <input
        type="checkbox"
        checked={props.isSelected}
        onChange={() => null}
        style={{ marginRight: 8 }}
      />
      {props.label}
    </components.Option>
  )
}

const CustomValueContainer = ({ children, ...props }: ValueContainerProps<SelectOption, true>) => {
  const { getValue, hasValue, selectProps } = props
  const selected = getValue()
  const count = selected ? selected.length : 0
  const isTyping = selectProps.inputValue && selectProps.inputValue.length > 0

  return (
    <components.ValueContainer {...props}>
      {hasValue && count > 0 && !isTyping && (
        <div style={{ paddingLeft: '8px', position: 'absolute', pointerEvents: 'none' }}>
          {count === 1 ? selected[0]?.label : `${count} Selected`}
        </div>
      )}
      {children}
    </components.ValueContainer>
  )
}

const MultiValue = () => null

const formatTime = (isoString?: string) => {
  if (!isoString) return '--'
  try {
    return dayjs.utc(isoString).tz('Asia/Kolkata').format('hh:mm A')
  } catch {
    return '--'
  }
}

const formatDate = (isoString?: string) => {
  if (!isoString) return '--'
  try {
    return dayjs.utc(isoString).tz('Asia/Kolkata').format('DD-MM-YYYY')
  } catch {
    return '--'
  }
}

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSecs = safeSeconds % 60
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  if (minutes > 0) return `${minutes}m ${remainingSecs}s`
  return `${remainingSecs}s`
}

const getAverageTime = (isoStrings: string[]) => {
  if (isoStrings.length === 0) return '--'
  let totalMinutes = 0
  let count = 0
  for (const iso of isoStrings) {
    if (iso) {
      const d = dayjs.utc(iso).tz('Asia/Kolkata')
      totalMinutes += d.hour() * 60 + d.minute()
      count++
    }
  }
  if (count === 0) return '--'
  const avg = Math.floor(totalMinutes / count)
  const h = Math.floor(avg / 60)
  const m = avg % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 || 12
  return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`
}

const AttendanceReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')

  const [data, setData] = useState<AttendanceReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['all'])
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('all')
  const [employees, setEmployees] = useState<{ id: string; name: string; team?: string }[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string[]>(['all'])
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedItemForModal, setSelectedItemForModal] = useState<AttendanceItem | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const { displayItems, isAggregatedView } = useMemo(() => {
    if (!data) return { displayItems: [], isAggregatedView: false }
    const startStr = startDate ? toLocalDateStr(startDate) : ''
    const endStr = endDate ? toLocalDateStr(endDate) : ''
    const isMulti = startStr && endStr && startStr !== endStr
    const isSingleEmployeeSelected = selectedEmployee.length === 1 && selectedEmployee[0] !== 'all'

    if (!isMulti || isSingleEmployeeSelected) {
      let items = data.items
      if (isSingleEmployeeSelected) {
        const empId = selectedEmployee[0]
        items = items.filter(item => item.employeeObjectId === empId || item.userId === empId)
      }
      return { displayItems: items, isAggregatedView: false }
    }

    const rangeDates = []
    if (startDate && endDate) {
      const current = new Date(startDate)
      current.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      const now = new Date()
      const effectiveEnd = end > now ? now : end
      while (current <= effectiveEnd) {
        // Exclude Sundays (0 = Sunday) from leave calculations if needed, but for now we count all valid working days up to today.
        if (current.getDay() !== 0) {
          rangeDates.push(toLocalDateStr(current))
        }
        current.setDate(current.getDate() + 1)
      }
    }

    const grouped: Record<string, AggregatedItem & { totalShiftSeconds: number; totalExtraSeconds: number }> = {}
    data.items.forEach(item => {
      const key = item.employeeId || item.userId || item.employeeName
      if (!grouped[key]) {
        grouped[key] = {
          isAggregated: true,
          id: key,
          employeeName: item.employeeName,
          employeeIdStr: item.employeeId || '',
          employeePhotoUrl: item.employeePhotoUrl,
          employeeSalary: item.employeeSalary || 0,
          employeeWorkingHours: item.employeeWorkingHours || 12,
          userRole: item.userRole,
          employeeTeam: item.employeeTeam || '',
          branchName: item.branchName,
          daysPresent: 0,
          daysLeave: 0,
          leaveDatesFormatted: '',
          salaryAmount: 0,
          extraHoursFormatted: '',
          totalExtraSeconds: 0,
          totalShiftSeconds: 0,
          branchCombined: '',
          avgFirstInFormatted: '',
          avgLastOutFormatted: '',
          totalSessions: 0,
          totalBreakSeconds: 0,
          totalBreakFormatted: '',
          totalWorkSeconds: 0,
          totalWorkFormatted: '',
          avgWorkSeconds: 0,
          avgWorkFormatted: '',
          originalItems: [],
        }
      }
      const g = grouped[key]
      g.daysPresent++
      g.totalSessions += item.sessionCount
      g.totalBreakSeconds += item.totalBreakSeconds || 0
      g.totalWorkSeconds += item.totalWorkSeconds || 0
      g.totalExtraSeconds += item.extraSeconds || 0
      g.originalItems.push(item)
      if (item.employeeSalary && g.employeeSalary === 0) g.employeeSalary = item.employeeSalary
      
      if (item.employeeWorkingHours && item.employeeWorkingHours > 0) {
        g.totalShiftSeconds += item.employeeWorkingHours * 3600
      } else if (item.employeeLoginTime && item.employeeLogoutTime) {
        const loginTimeStr = item.employeeLoginTime.replace('_', ':')
        const logoutTimeStr = item.employeeLogoutTime.replace('_', ':')
        
        const [inH, inM] = loginTimeStr.split(':').map(Number)
        const [outH, outM] = logoutTimeStr.split(':').map(Number)
        
        if (!isNaN(inH) && !isNaN(outH)) {
          let shiftSeconds = (outH * 3600 + (outM || 0) * 60) - (inH * 3600 + (inM || 0) * 60)
          if (shiftSeconds < 0) shiftSeconds += 24 * 3600 // Handle night shifts crossing midnight
          
          g.totalShiftSeconds += shiftSeconds
        }
      }
    })

    const aggregatedList = Object.values(grouped).map(g => {

      const firstIns = g.originalItems.map(i => i.firstPunchIn).filter(Boolean) as string[]
      const lastOuts = g.originalItems.map(i => i.lastPunchOut).filter(Boolean) as string[]
      const avgWork = g.daysPresent > 0 ? g.totalWorkSeconds / g.daysPresent : 0

      const presentDates = new Set(g.originalItems.map(i => i.dateString))
      const leaveDateStrings = rangeDates.filter(d => !presentDates.has(d))
      const leaveDaysNumbers = leaveDateStrings.map(d => parseInt(d.split('-')[2], 10))
      const leaveDatesFormatted = leaveDaysNumbers.length > 0 ? leaveDaysNumbers.join(',') : 'None'
      const daysLeave = leaveDateStrings.length

      const baseSalary = g.employeeSalary || 0
      // User explicitly requested: "BASED ON PRESNT CALCULATE SALARY"
      const salaryAmount = Math.round((baseSalary / 30) * g.daysPresent)

      const branchSet = new Set<string>()
      g.originalItems.forEach(i => {
        if (i.branchName) {
          const abbrev = i.branchName.substring(0, 3).toUpperCase()
          branchSet.add(abbrev)
        }
      })
      const branchCombined = Array.from(branchSet).join(',')

      return {
        ...g,
        daysLeave,
        leaveDatesFormatted,
        salaryAmount,
        branchCombined,
        extraHoursFormatted: g.totalExtraSeconds > 0 ? formatSeconds(g.totalExtraSeconds) : '-',
        avgFirstInFormatted: getAverageTime(firstIns),
        avgLastOutFormatted: getAverageTime(lastOuts),
        totalBreakFormatted: formatSeconds(g.totalBreakSeconds),
        totalWorkFormatted: formatSeconds(g.totalWorkSeconds),
        avgWorkSeconds: avgWork,
        avgWorkFormatted: formatSeconds(avgWork)
      }
    })

    aggregatedList.sort((a,b) => b.totalWorkSeconds - a.totalWorkSeconds)
    return { displayItems: aggregatedList, isAggregatedView: true }
  }, [data, startDate, endDate, selectedEmployee])

  const calcTotals = useMemo(() => {
    let totPresent = 0
    let totLeave = 0
    let totSalary = 0
    let totExtraSec = 0
    let totBreakSec = 0
    let totWorkSec = 0
    let totActive = 0
    
    displayItems.forEach((item: any) => {
      if (isAggregatedView) {
        totPresent += (item.daysPresent || 0)
        totLeave += (item.daysLeave || 0)
        totSalary += (item.salaryAmount || 0)
        totExtraSec += (item.totalExtraSeconds || 0)
        totBreakSec += (item.totalBreakSeconds || 0)
        totWorkSec += (item.totalWorkSeconds || 0)
      } else {
        const dutySec = (item.employeeWorkingHours || 12) * 3600
        const ws = item.totalWorkSeconds || 0
        if (ws > dutySec) {
          totExtraSec += (ws - dutySec)
        }
        totBreakSec += (item.totalBreakSeconds || 0)
        totWorkSec += ws
        if (item.status === 'active') totActive++
      }
    })

    return {
      totPresent,
      totLeave,
      totSalary,
      totExtraFormatted: totExtraSec > 0 ? formatSeconds(totExtraSec) : '-',
      totBreakFormatted: formatSeconds(totBreakSec),
      totWorkFormatted: formatSeconds(totWorkSec),
      totActive,
    }
  }, [displayItems, isAggregatedView])

  const roleOptions: SelectOption[] = [
    { value: 'all', label: 'All Roles' },
    { value: 'waiter', label: 'Waiter' },
    { value: 'chef', label: 'Chef' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'manager', label: 'Manager' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'driver', label: 'Driver' },
    { value: 'store_keeper', label: 'Store Keeper' },
    { value: 'account', label: 'Account' },
  ]

  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: '🟢 Active / Clocked In' },
    { value: 'on_break', label: '🟡 On Break' },
    { value: 'closed', label: '⚪ Clocked Out' },
  ]

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_month', label: 'Last Month' },
  ]

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
        break
      }
      case 'this_month': {
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        start = thisMonthStart
        end = today
        break
      }
      case 'last_30_days': {
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        start = last30
        break
      }
      case 'last_month': {
        const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        start = prevMonthStart
        end = prevMonthEnd
        break
      }
    }

    if (start && end) {
      setDateRange([start, end])
    }
  }

  // Fetch branches and employees metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchRes, empRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/employees?limit=1000&pagination=false&depth=0'),
        ])

        if (branchRes.ok) {
          const branchJson = await branchRes.json()
          setBranches(branchJson.docs || [])
        }

        if (empRes.ok) {
          const empJson = await empRes.json()
          setEmployees(
            (empJson.docs || []).map((e: any) => ({
              id: e.id,
              name: e.name,
              team: e.team,
            })),
          )
        }
      } catch (e) {
        console.error('Error fetching metadata:', e)
      }
    }

    fetchMetadata()
  }, [])

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    setError('')

    try {
      const startStr = toLocalDateStr(startDate)
      const endStr = toLocalDateStr(endDate)

      const branchParam = selectedBranch.includes('all') ? 'all' : selectedBranch.join(',')
      
      let effectiveRoles = selectedRoles
      if (activeRoleFilter !== 'all') {
        effectiveRoles = [activeRoleFilter]
      }
      const roleParam = effectiveRoles.includes('all') ? 'all' : effectiveRoles.join(',')
      const empParam = selectedEmployee.includes('all') ? 'all' : selectedEmployee.join(',')

      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: ATTENDANCE_REPORT_QUERY,
          variables: {
            filter: {
              startDate: startStr,
              endDate: endStr,
              branch: branchParam,
              role: roleParam,
              employee: empParam,
              status: selectedStatus === 'all' ? null : selectedStatus,
            },
          },
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch report (HTTP ${res.status})`)
      }

      const json = (await res.json()) as AttendanceReportQueryResponse
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || 'Failed to fetch attendance report')
      }

      const report = json.data?.attendanceReport
      if (!report) {
        throw new Error('No attendance report data returned')
      }

      setData(report)
    } catch (err) {
      console.error('Attendance report error:', err)
      setError(err instanceof Error ? err.message : 'Error loading attendance report')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedBranch, selectedRoles, activeRoleFilter, selectedEmployee, selectedStatus])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const branchOptions = useMemo<SelectOption[]>(
    () => [{ value: 'all', label: 'All Branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))],
    [branches],
  )

  const employeeOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'all', label: 'All Employees' },
      ...employees.map((e) => ({
        value: e.id,
        label: e.team ? `${e.name} (${e.team.toUpperCase()})` : e.name,
      })),
    ],
    [employees],
  )

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
      borderRadius: '8px',
      height: '42px',
      minHeight: '42px',
      minWidth: '180px',
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

  const handleExportCsv = () => {
    if (!displayItems || displayItems.length === 0) return

    const csvRows: string[] = []
    const headers = isAggregatedView ? [
      'S.NO', 'EMPLOYEE NAME (ID)', 'BRANCH', 'PRESENT', 'LEAVE', 'SALARY AMOUNT', 'DUTY HRS', 'TOTAL WORK HOURS', 'EXTRA HOURS',
      'AVG FIRST IN', 'AVG LAST OUT', 'TOTAL SESSIONS', 'TOTAL BREAK TIME', 'AVG WORK/DAY'
    ] : [
      'S.NO', 'EMPLOYEE NAME (ID)', 'ROLE', 'BRANCH',
      'FIRST IN', 'LAST OUT', 'SESSIONS', 'BREAK TIME', 'DUTY HRS', 'TOTAL WORK HOURS', 'EXTRA HOURS', 'STATUS'
    ]
    csvRows.push(headers.join(','))

    displayItems.forEach((item: any, index: number) => {
      const empNameId = (item.employeeIdStr || item.employeeId) 
        ? `${item.employeeName} (${item.employeeIdStr || item.employeeId})` 
        : item.employeeName

      if (isAggregatedView) {
        csvRows.push(
          [
            index + 1,
            `"${empNameId.replace(/"/g, '""')}"`,
            `"${item.branchCombined}"`,
            item.daysPresent,
            item.daysLeave,
            item.salaryAmount,
            `"${item.employeeWorkingHours || 12}h"`,
            `"${item.totalWorkFormatted}"`,
            `"${item.extraHoursFormatted}"`,
            `"${item.avgFirstInFormatted}"`,
            `"${item.avgLastOutFormatted}"`,
            item.totalSessions,
            `"${item.totalBreakFormatted}"`,
            `"${item.avgWorkFormatted}"`,
          ].join(',')
        )
      } else {
        csvRows.push(
          [
            index + 1,
            `"${empNameId.replace(/"/g, '""')}"`,
            `"${(item.employeeTeam || item.userRole || '').toUpperCase()}"`,
            `"${(item.branchName || '').substring(0, 3).toUpperCase()}"`,
            `"${formatTime(item.firstPunchIn)}"`,
            `"${formatTime(item.lastPunchOut)}"`,
            item.sessionCount,
            `"${item.totalBreakFormatted}"`,
            `"${item.employeeWorkingHours ? item.employeeWorkingHours + 'h' : '-'}"`,
            `"${item.totalWorkFormatted}"`,
            `"${item.extraHoursFormatted || '-'}"`,
            `"${item.status.toUpperCase()}"`,
          ].join(',')
        )
      }
    })

    // Totals row
    csvRows.push(
      [
        '',
        '"OVERALL TOTAL"',
        '',
        `"${data?.totals.uniqueEmployees || 0} Unique Staff"`,
        '',
        '',
        '',
        '',
        '',
        `"${data?.totals.totalBreakFormatted || ''}"`,
        `"${data?.totals.totalWorkFormatted || ''}"`,
        `"${data?.totals.currentlyActive || 0} Active Now"`,
      ].join(',')
    )

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  const handleExportRoleBasedCsv = () => {
    if (!displayItems || displayItems.length === 0) return

    const csvRows: string[] = []
    const headers = isAggregatedView ? [
      'S.NO', 'EMPLOYEE NAME (ID)', 'BRANCH', 'PRESENT', 'LEAVE', 'SALARY AMOUNT', 'DUTY HRS', 'TOTAL WORK HOURS', 'EXTRA HOURS',
      'AVG FIRST IN', 'AVG LAST OUT', 'TOTAL SESSIONS', 'TOTAL BREAK TIME', 'AVG WORK/DAY'
    ] : [
      'S.NO', 'EMPLOYEE NAME (ID)', 'ROLE', 'BRANCH',
      'FIRST IN', 'LAST OUT', 'SESSIONS', 'BREAK TIME', 'DUTY HRS', 'TOTAL WORK HOURS', 'EXTRA HOURS', 'STATUS'
    ]

    // Group items by role
    const itemsByRole: Record<string, any[]> = {}
    displayItems.forEach((item: any) => {
      const role = (item.employeeTeam || item.userRole || 'Unknown').toUpperCase()
      if (!itemsByRole[role]) {
        itemsByRole[role] = []
      }
      itemsByRole[role].push(item)
    })

    Object.keys(itemsByRole).sort().forEach((role) => {
      csvRows.push(`"ROLE: ${role}"`)
      csvRows.push(headers.join(','))
      
      itemsByRole[role].forEach((item: any, index: number) => {
        const empNameId = (item.employeeIdStr || item.employeeId) 
          ? `${item.employeeName} (${item.employeeIdStr || item.employeeId})` 
          : item.employeeName

        if (isAggregatedView) {
          csvRows.push(
            [
              index + 1,
              `"${empNameId.replace(/"/g, '""')}"`,
              `"${item.branchCombined}"`,
              item.daysPresent,
              item.daysLeave,
              item.salaryAmount,
              `"${item.employeeWorkingHours || 12}h"`,
              `"${item.totalWorkFormatted}"`,
              `"${item.extraHoursFormatted}"`,
              `"${item.avgFirstInFormatted}"`,
              `"${item.avgLastOutFormatted}"`,
              item.totalSessions,
              `"${item.totalBreakFormatted}"`,
              `"${item.avgWorkFormatted}"`,
            ].join(',')
          )
        } else {
          csvRows.push(
            [
              index + 1,
              `"${empNameId.replace(/"/g, '""')}"`,
              `"${role}"`,
              `"${(item.branchName || '').substring(0, 3).toUpperCase()}"`,
              `"${formatTime(item.firstPunchIn)}"`,
              `"${formatTime(item.lastPunchOut)}"`,
              item.sessionCount,
              `"${item.totalBreakFormatted}"`,
              `"${item.employeeWorkingHours ? item.employeeWorkingHours + 'h' : '-'}"`,
              `"${item.totalWorkFormatted}"`,
              `"${item.extraHoursFormatted || '-'}"`,
              `"${item.status.toUpperCase()}"`,
            ].join(',')
          )
        }
      })
      csvRows.push('')
    })

    // Totals row
    csvRows.push(
      [
        '',
        '"OVERALL TOTAL"',
        '',
        `"${data?.totals.uniqueEmployees || 0} Unique Staff"`,
        '',
        '',
        '',
        '',
        '',
        `"${data?.totals.totalBreakFormatted || ''}"`,
        `"${data?.totals.totalWorkFormatted || ''}"`,
        `"${data?.totals.currentlyActive || 0} Active Now"`,
      ].join(',')
    )

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_report_role_based_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  const resetFilters = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setDateRange([today, today])
    setDateRangePreset('today')
    setSelectedBranch(['all'])
    setSelectedRoles(['all'])
    setActiveRoleFilter('all')
    setSelectedEmployee(['all'])
    setSelectedStatus('all')
    setShowExportMenu(false)
  }

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      const [start, end] = value ? value.split(' - ') : ['', '']

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref} type="button">
          <span className="date-text">{start}</span>
          <span className="separator">→</span>
          <span className="date-text">{end || start}</span>
          <span className="icon">
            <svg
              width="18"
              height="18"
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

  const handleForcePunchOut = async () => {
    if (!selectedItemForModal || selectedItemForModal.status !== 'active') return
    if (!window.confirm(`Are you sure you want to force punch out ${selectedItemForModal.employeeName}?`)) return
    
    try {
      // First fetch the latest doc to get the full activities array
      const res = await fetch(`/api/attendance/${selectedItemForModal.id}`)
      if (!res.ok) throw new Error('Failed to fetch doc')
      const doc = await res.json()
      
      let updateData: any = {}
      if (doc.activities && doc.activities.length > 0) {
        let needsUpdate = false
        const updatedActivities = doc.activities.map((act: any) => {
          if (act.status === 'active') {
            needsUpdate = true
            const punchOut = new Date()
            let dur = 0
            if (act.punchIn) {
               dur = Math.floor((punchOut.getTime() - new Date(act.punchIn).getTime())/1000)
            }
            return {
              ...act,
              status: 'closed',
              punchOut: punchOut.toISOString(),
              durationSeconds: dur,
              punchOutType: 'auto'
            }
          }
          return act
        })
        if (needsUpdate) updateData.activities = updatedActivities
      }
      
      if (doc.status === 'active' && !doc.punchOut) {
        updateData.status = 'closed'
        updateData.punchOut = new Date().toISOString()
      }
      
      const updateRes = await fetch(`/api/attendance/${selectedItemForModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      if (!updateRes.ok) throw new Error('Failed to patch doc')
      
      alert('Punched out successfully!')
      setSelectedItemForModal(null)
      fetchReport()
    } catch (e) {
      console.error(e)
      alert('Failed to force punch out. Check console for details.')
    }
  }

  return (
    <div className="attendance-report-container">
      {/* Header & Filters */}
      <div className="report-header">
        <div className="title-row">
          <h1>
            👥 Attendance Report
            {data && <span className="title-badge">{data.items.length} Records</span>}
          </h1>
        </div>

        <div className="filters-bar">
          <div className="filter-group">
            <Select<SelectOption, false>
              instanceId="attendance-date-preset-select"
              options={dateRangeOptions}
              value={dateRangeOptions.find((o) => o.value === dateRangePreset)}
              onChange={(option) => {
                if (option) handleDatePresetChange(option.value)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              isSearchable={false}
            />
          </div>

          <div className="filter-group">
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update: [Date | null, Date | null]) => {
                setDateRange(update)
              }}
              monthsShown={1}
              dateFormat="yyyy-MM-dd"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
            />
          </div>

          <div className="filter-group select-group">
            <Select<SelectOption, true>
              instanceId="attendance-branch-select"
              options={branchOptions}
              isMulti
              value={branchOptions.filter((o) => selectedBranch.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedBranch.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
                else if (final.length === 0) final = ['all']
                setSelectedBranch(final)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Branch..."
              isSearchable={true}
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{
                Option: CheckboxOption,
                ValueContainer: CustomValueContainer,
                MultiValue,
              }}
            />
          </div>

          <div className="filter-group select-group">
            <Select<SelectOption, true>
              instanceId="attendance-role-select"
              options={roleOptions}
              isMulti
              value={roleOptions.filter((o) => selectedRoles.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedRoles.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
                else if (final.length === 0) final = ['all']
                setSelectedRoles(final)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Role..."
              isSearchable={true}
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{
                Option: CheckboxOption,
                ValueContainer: CustomValueContainer,
                MultiValue,
              }}
            />
          </div>

          <div className="filter-group select-group">
            <Select<SelectOption, true>
              instanceId="attendance-emp-select"
              options={employeeOptions}
              isMulti
              value={employeeOptions.filter((o) => selectedEmployee.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedEmployee.includes('all')
                const hasAll = selected.includes('all')
                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
                else if (final.length === 0) final = ['all']
                setSelectedEmployee(final)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Employee..."
              isSearchable={true}
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{
                Option: CheckboxOption,
                ValueContainer: CustomValueContainer,
                MultiValue,
              }}
            />
          </div>

          <div className="filter-group">
            <Select<SelectOption, false>
              instanceId="attendance-status-select"
              options={statusOptions}
              value={statusOptions.find((o) => o.value === selectedStatus)}
              onChange={(option) => {
                if (option) setSelectedStatus(option.value)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Status..."
              isSearchable={false}
            />
          </div>

          <div className="filter-group">
            <div className="export-container">
              <button
                className="export-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Report"
                type="button"
              >
                <span>Export</span>
                <span>↓</span>
              </button>

              {showExportMenu && (
                <div className="export-menu">
                  <button onClick={handleExportCsv}>Excel (CSV)</button>
                  <button onClick={handleExportRoleBasedCsv}>Role Based (CSV)</button>
                </div>
              )}
            </div>
            {showExportMenu && <div className="export-backdrop" onClick={() => setShowExportMenu(false)} />}
          </div>

          <div className="filter-group">
            <button className="reset-btn" onClick={resetFilters} title="Reset Filters" type="button">
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
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {data && (
        <div className="kpi-cards-grid">
          <div className="kpi-card">
            <div className="kpi-icon-wrap present">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total Present</span>
              <span className="kpi-value">{data.totals.uniqueEmployees}</span>
              <span className="kpi-sub">{data.totals.totalRecords} daily logs</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap active">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Active / Clocked-In</span>
              <span className="kpi-value" style={{ color: '#10b981' }}>
                {data.totals.currentlyActive}
              </span>
              <span className="kpi-sub">Currently on shift</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap hours">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total Work Logged</span>
              <span className="kpi-value">{data.totals.totalWorkFormatted}</span>
              <span className="kpi-sub">{data.totals.totalBreakFormatted} break time</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap avg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10"></path>
                <path d="M12 20V4"></path>
                <path d="M6 20v-6"></path>
              </svg>
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Avg Shift Duration</span>
              <span className="kpi-value">{data.totals.avgWorkFormatted}</span>
              <span className="kpi-sub">Per employee / day</span>
            </div>
          </div>
        </div>
      )}

      {/* Role Filter Chips */}
      {data && data.roleStats && data.roleStats.length > 0 && (
        <div className="role-chips-section">
          <span className="role-chips-label">Roles:</span>
          <button
            className={`role-chip ${activeRoleFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveRoleFilter('all')}
            type="button"
          >
            All <span className="chip-count">{data.totals.totalRecords}</span>
          </button>
          {data.roleStats.map((r) => (
            <button
              key={r.role}
              className={`role-chip ${activeRoleFilter.toLowerCase() === r.role.toLowerCase() ? 'active' : ''}`}
              onClick={() =>
                setActiveRoleFilter(activeRoleFilter.toLowerCase() === r.role.toLowerCase() ? 'all' : r.role.toLowerCase())
              }
              type="button"
            >
              {r.role} <span className="chip-count">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {loading && <div className="loading-state">Loading attendance report...</div>}
      {error && <div className="error-message">{error}</div>}

      {/* Main Attendance Table */}
      {!loading && data && (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                {isAggregatedView ? (
                  <>
                    <th>EMPLOYEE (ID)</th>
                    <th>BRANCH</th>
                    <th>PRESENT</th>
                    <th>LEAVE</th>
                    <th>SALARY</th>
                    <th className="text-center">DUTY HRS</th>
                    <th className="text-center">TOTAL WORK</th>
                    <th className="text-center">EXTRA HOURS</th>
                    <th className="text-center">AVG FIRST IN</th>
                    <th className="text-center">AVG LAST OUT</th>
                    <th className="text-center">TOTAL SESSIONS</th>
                    <th className="text-center">TOTAL BREAK</th>
                    <th className="text-center">AVG WORK/DAY</th>
                  </>
                ) : (
                  <>
                    <th style={{ width: '200px' }}>EMPLOYEE (ID)</th>
                    <th style={{ width: '100px' }}>ROLE</th>
                    <th style={{ width: '90px' }}>BRANCH</th>
                    <th className="text-center">FIRST IN</th>
                    <th className="text-center">LAST OUT</th>
                    <th className="text-center">BREAKS</th>
                    <th className="text-center">DUTY HRS</th>
                    <th className="text-center">WORK HOURS</th>
                    <th className="text-center">EXTRA HOURS</th>
                    <th className="text-center">STATUS</th>
                    <th className="text-center">ACTIONS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayItems.length > 0 ? (
                displayItems.map((item: any, idx: number) => {
                  const roleClass = `role-${(item.employeeTeam || item.userRole || 'other').toLowerCase()}`
                  const initials = item.employeeName
                    .split(' ')
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <tr
                      key={item.id || idx}
                      className={!isAggregatedView ? "clickable-row" : ""}
                      onClick={() => !isAggregatedView && setSelectedItemForModal(item)}
                    >
                      <td>{idx + 1}</td>
                      {isAggregatedView ? (
                        <>
                          <td>
                            <div className="employee-cell">
                              <div className="employee-meta">
                                <span className="emp-name">{item.employeeName}</span>
                                {(item.employeeId || item.employeeIdStr) && <span className="emp-id">{item.employeeId || item.employeeIdStr}</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>
                              {item.branchCombined}
                            </strong>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--theme-success-600)' }}>{item.daysPresent}</strong>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--theme-danger-600)' }}>{item.daysLeave}</strong>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--theme-text-primary)' }}>₹{item.salaryAmount}</strong>
                          </td>
                          <td className="text-center">
                            <strong style={{ color: 'var(--theme-text-primary)' }}>{item.employeeWorkingHours || 12}h</strong>
                          </td>
                          <td className="text-center work-hours-cell">
                            <strong style={{ color: 'var(--theme-success-600)' }}>
                              {item.totalWorkFormatted}
                            </strong>
                          </td>
                          <td className="text-center">
                            <strong style={{ color: 'var(--theme-warning-700)' }}>{item.extraHoursFormatted}</strong>
                          </td>
                          <td className="text-center">{item.avgFirstInFormatted}</td>
                          <td className="text-center">{item.avgLastOutFormatted}</td>
                          <td className="text-center">{item.totalSessions}</td>
                          <td className="text-center work-hours-cell" style={{ color: 'var(--theme-warning-700)' }}>
                            {item.totalBreakFormatted}
                          </td>
                          <td className="text-center">
                            <span style={{ fontWeight: 600, color: 'var(--theme-primary-600)' }}>
                              {item.avgWorkFormatted}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <div className="employee-cell">
                              <div className="employee-meta">
                                <span className="emp-name">{item.employeeName}</span>
                                {(item.employeeId || item.employeeIdStr) && <span className="emp-id">{item.employeeId || item.employeeIdStr}</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${roleClass}`}>
                              {item.employeeTeam || item.userRole || 'STAFF'}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>
                              {(item.branchName || '').substring(0, 3).toUpperCase()}
                            </strong>
                          </td>
                          <td className="text-center">{formatTime(item.firstPunchIn)}</td>
                          <td className="text-center">
                            {item.status === 'active' ? (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>Active Now</span>
                            ) : (
                              formatTime(item.lastPunchOut)
                            )}
                          </td>
                          <td className="text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                            {item.totalBreakFormatted}
                          </td>
                          <td className="text-center" style={{ fontWeight: 500, color: 'var(--theme-primary-600)' }}>
                            {item.employeeWorkingHours ? `${item.employeeWorkingHours}h` : '-'}
                          </td>
                          <td className="text-center work-hours-cell">{item.totalWorkFormatted}</td>
                          <td className="text-center">
                            <span style={{ fontWeight: 600, color: 'var(--theme-error-600)' }}>
                              {item.extraHoursFormatted || '-'}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className={`status-pill ${item.status}`}>
                              <span className="dot" />
                              {item.status === 'active'
                                ? 'Clocked In'
                                : item.status === 'on_break'
                                  ? 'On Break'
                                  : 'Clocked Out'}
                            </span>
                          </td>
                          <td className="text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="view-btn"
                              onClick={() => setSelectedItemForModal(item)}
                              title="View Attendance Timeline"
                              type="button"
                            >
                              <span>Timeline</span>
                              <span>→</span>
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={13} className="no-data">
                    No attendance records found for the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
            {data.items.length > 0 && (
              <tfoot>
                {isAggregatedView ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'right', paddingRight: '1rem' }}><strong>TOTAL ({displayItems.length} Employees)</strong></td>
                    <td><strong>{calcTotals.totPresent}</strong></td>
                    <td><strong>{calcTotals.totLeave}</strong></td>
                    <td><strong>₹{calcTotals.totSalary}</strong></td>
                    <td></td>
                    <td className="text-center work-hours-cell" style={{ color: 'var(--theme-success-600)' }}><strong>{calcTotals.totWorkFormatted}</strong></td>
                    <td className="text-center"><strong style={{ color: 'var(--theme-warning-700)' }}>{calcTotals.totExtraFormatted}</strong></td>
                    <td colSpan={3}></td>
                    <td className="text-center work-hours-cell" style={{ color: 'var(--theme-text-secondary)' }}><strong>{calcTotals.totBreakFormatted}</strong></td>
                    <td></td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'right', paddingRight: '1rem' }}><strong>TOTAL ({displayItems.length} Records)</strong></td>
                    <td className="text-center" style={{ color: 'var(--theme-text-secondary)' }}><strong>{calcTotals.totBreakFormatted}</strong></td>
                    <td></td>
                    <td className="text-center work-hours-cell" style={{ color: 'var(--theme-success-600)' }}><strong>{calcTotals.totWorkFormatted}</strong></td>
                    <td className="text-center"><strong style={{ color: 'var(--theme-error-600)' }}>{calcTotals.totExtraFormatted}</strong></td>
                    <td className="text-center"><strong style={{ color: '#10b981' }}>{calcTotals.totActive} Active</strong></td>
                    <td></td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Activity Timeline Modal */}
      {selectedItemForModal && (
        <div className="activity-modal-overlay" onClick={() => setSelectedItemForModal(null)}>
          <div className="activity-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-area">
                {selectedItemForModal.employeePhotoUrl && (
                  <img
                    src={selectedItemForModal.employeePhotoUrl}
                    alt={selectedItemForModal.employeeName}
                    className="header-avatar"
                  />
                )}
                <div className="header-text">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={{ margin: 0 }}>{selectedItemForModal.employeeName}</h3>
                    {selectedItemForModal.status === 'active' && (
                      <button 
                        onClick={handleForcePunchOut}
                        style={{
                          background: 'var(--theme-error-600)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Force Punch Out
                      </button>
                    )}
                  </div>
                  <div className="header-sub">
                    {selectedItemForModal.employeeId ? `${selectedItemForModal.employeeId} • ` : ''}
                    {(selectedItemForModal.employeeTeam || selectedItemForModal.userRole || '').toUpperCase()} •{' '}
                    {selectedItemForModal.branchName}
                    {selectedItemForModal.loginBranchName && selectedItemForModal.loginBranchName !== selectedItemForModal.branchName && (
                      <span style={{ fontSize: '0.8rem', opacity: 0.8 }}> (Login: {selectedItemForModal.loginBranchName})</span>
                    )}
                  </div>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedItemForModal(null)} type="button">
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="summary-banner">
                <div className="banner-item">
                  <span className="label">Date</span>
                  <span className="val">{selectedItemForModal.dateString}</span>
                </div>
                <div className="banner-item">
                  <span className="label">Total Work</span>
                  <span className="val" style={{ color: '#56cfe1' }}>
                    {selectedItemForModal.totalWorkFormatted}
                  </span>
                </div>
                <div className="banner-item">
                  <span className="label">Total Breaks</span>
                  <span className="val">{selectedItemForModal.totalBreakFormatted}</span>
                </div>
              </div>

              <div className="timeline-section-title">Session & Punch Activity Logs</div>

              <div className="activities-timeline">
                {selectedItemForModal.activities && selectedItemForModal.activities.length > 0 ? (
                  selectedItemForModal.activities.map((act, index) => {
                    const isSession = act.type === 'session'
                    return (
                      <div key={act.id || index} className={`activity-card type-${act.type}`}>
                        <div className="act-header">
                          <span
                            className="act-type-tag"
                            style={{ color: isSession ? '#3b82f6' : '#f59e0b' }}
                          >
                            {isSession ? '💼 Work Session' : '☕ Break'} #{index + 1}
                          </span>
                          <span className="act-duration">{act.durationFormatted}</span>
                        </div>

                        <div className="act-grid">
                          {act.capturedImageUrl ? (
                            <div
                              className="selfie-box"
                              onClick={() => setPreviewImageUrl(act.capturedImageUrl || null)}
                              title="Click to Enlarge Selfie"
                            >
                              <img src={act.capturedImageUrl} alt="Punch Selfie" />
                              <span className="zoom-icon">🔍 Zoom</span>
                            </div>
                          ) : (
                            <div
                              className="selfie-box"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.75rem' }}
                            >
                              No Photo
                            </div>
                          )}

                          <div className="act-details-list">
                            <div className="detail-row">
                              <span>Punch In:</span>
                              <strong>{formatTime(act.punchIn)}</strong>
                            </div>
                            <div className="detail-row">
                              <span>Punch Out:</span>
                              <strong>
                                {act.status === 'active' ? (
                                  <span style={{ color: '#10b981' }}>Active Now</span>
                                ) : (
                                  formatTime(act.punchOut)
                                )}
                              </strong>
                            </div>
                            {act.device && (
                              <div className="detail-row">
                                <span>Device:</span>
                                <span>{act.device}</span>
                              </div>
                            )}
                            {act.ipAddress && (
                              <div className="detail-row">
                                <span>IP:</span>
                                <span>{act.ipAddress}</span>
                              </div>
                            )}
                            {act.latitude && act.longitude && (
                              <div className="detail-row">
                                <span>GPS:</span>
                                <a
                                  href={`https://www.google.com/maps?q=${act.latitude},${act.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  📍 View Location ({act.latitude.toFixed(4)}, {act.longitude.toFixed(4)})
                                </a>
                              </div>
                            )}
                            {act.branchName && (
                              <div className="detail-row">
                                <span>Branch:</span>
                                <strong style={{ color: act.branchName === 'Outside Branch' ? '#f59e0b' : '#3b82f6' }}>
                                  🏢 {act.branchName}
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="no-data">No session activity logs recorded for this day.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selfie Image Enlarge Modal */}
      {previewImageUrl && (
        <div className="image-preview-modal" onClick={() => setPreviewImageUrl(null)}>
          <div className="image-preview-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="close-img-btn" onClick={() => setPreviewImageUrl(null)} type="button">
              &times;
            </button>
            <img src={previewImageUrl} alt="Enlarged Selfie Punch" />
          </div>
        </div>
      )}
    </div>
  )
}

export default AttendanceReport
