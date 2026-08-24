'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
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
}

export type AttendanceItem = {
  id: string
  date: string
  dateString: string
  userId: string
  userName: string
  userEmail: string
  userRole: string
  employeeId?: string
  employeeName: string
  employeeTeam?: string
  employeePhone?: string
  employeePhotoUrl?: string
  branchId?: string
  branchName: string
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
        employeeId
        employeeName
        employeeTeam
        employeePhone
        employeePhotoUrl
        branchId
        branchName
        firstPunchIn
        lastPunchOut
        totalWorkSeconds
        totalWorkFormatted
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
    if (!data || data.items.length === 0) return

    const csvRows: string[] = []
    const headers = [
      'S.NO',
      'DATE',
      'EMPLOYEE ID',
      'EMPLOYEE NAME',
      'ROLE',
      'BRANCH',
      'FIRST IN',
      'LAST OUT',
      'SESSIONS',
      'BREAK TIME',
      'TOTAL WORK HOURS',
      'STATUS',
    ]
    csvRows.push(headers.join(','))

    data.items.forEach((item, index) => {
      csvRows.push(
        [
          index + 1,
          `"${item.dateString}"`,
          `"${item.employeeId || ''}"`,
          `"${item.employeeName.replace(/"/g, '""')}"`,
          `"${(item.employeeTeam || item.userRole || '').toUpperCase()}"`,
          `"${item.branchName.replace(/"/g, '""')}"`,
          `"${formatTime(item.firstPunchIn)}"`,
          `"${formatTime(item.lastPunchOut)}"`,
          item.sessionCount,
          `"${item.totalBreakFormatted}"`,
          `"${item.totalWorkFormatted}"`,
          `"${item.status.toUpperCase()}"`,
        ].join(','),
      )
    })

    // Totals row
    csvRows.push(
      [
        '',
        '"TOTAL"',
        '',
        `"${data.totals.uniqueEmployees} Unique Staff"`,
        '',
        '',
        '',
        '',
        '',
        `"${data.totals.totalBreakFormatted}"`,
        `"${data.totals.totalWorkFormatted}"`,
        `"${data.totals.currentlyActive} Active Now"`,
      ].join(','),
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
                <th>DATE</th>
                <th>EMPLOYEE</th>
                <th>ROLE</th>
                <th>BRANCH</th>
                <th className="text-center">FIRST IN</th>
                <th className="text-center">LAST OUT</th>
                <th className="text-center">BREAKS</th>
                <th className="text-center">WORK HOURS</th>
                <th className="text-center">STATUS</th>
                <th className="text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length > 0 ? (
                data.items.map((item, idx) => {
                  const roleClass = `role-${(item.employeeTeam || item.userRole || 'other').toLowerCase()}`
                  const initials = item.employeeName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <tr
                      key={item.id || idx}
                      className="clickable-row"
                      onClick={() => setSelectedItemForModal(item)}
                    >
                      <td>{idx + 1}</td>
                      <td>{formatDate(item.date)}</td>
                      <td>
                        <div className="employee-cell">
                          {item.employeePhotoUrl ? (
                            <img src={item.employeePhotoUrl} alt={item.employeeName} className="avatar-thumb" />
                          ) : (
                            <div className="avatar-thumb">{initials}</div>
                          )}
                          <div className="employee-meta">
                            <span className="emp-name">{item.employeeName}</span>
                            {item.employeeId && <span className="emp-id">{item.employeeId}</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${roleClass}`}>
                          {item.employeeTeam || item.userRole || 'STAFF'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--theme-text-secondary)' }}>{item.branchName}</strong>
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
                      <td className="text-center work-hours-cell">{item.totalWorkFormatted}</td>
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
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={11} className="no-data">
                    No attendance records found for the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
            {data.items.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>TOTAL</td>
                  <td>{data.totals.uniqueEmployees} Unique Employees</td>
                  <td colSpan={4}></td>
                  <td className="text-center">{data.totals.totalBreakFormatted}</td>
                  <td className="text-center work-hours-cell" style={{ color: '#56cfe1' }}>
                    {data.totals.totalWorkFormatted}
                  </td>
                  <td className="text-center">
                    <span style={{ color: '#10b981' }}>{data.totals.currentlyActive} Active</span>
                  </td>
                  <td></td>
                </tr>
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
                  <h3>{selectedItemForModal.employeeName}</h3>
                  <div className="header-sub">
                    {selectedItemForModal.employeeId ? `${selectedItemForModal.employeeId} • ` : ''}
                    {(selectedItemForModal.employeeTeam || selectedItemForModal.userRole || '').toUpperCase()} •{' '}
                    {selectedItemForModal.branchName}
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
