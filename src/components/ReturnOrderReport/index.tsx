'use client'

import React, { useEffect, useRef, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import {
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  SkipForward,
  Mail,
} from 'lucide-react'
import Image from 'next/image'
import './index.scss'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type SelectOption = {
  value: string
  label: string
}

export type VerificationStepStatus = 'pending' | 'verified' | 'rejected' | 'skipped'
export type OverallVerificationStatus = 'pending' | 'partially_verified' | 'verified' | 'rejected'

export interface VerificationStepData {
  status?: VerificationStepStatus
  notes?: string
  verifiedByName?: string
  verifiedByRole?: string
  verifiedAt?: string
}

export interface BillVerificationData {
  overallStatus?: OverallVerificationStatus
  accountant?: VerificationStepData
  watcher?: VerificationStepData
  manager?: VerificationStepData
}

const CheckboxOption = (props: OptionProps<SelectOption>) => {
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

const ColumnValueContainer = ({ children, ...props }: ValueContainerProps<SelectOption, true>) => {
  const { getValue, selectProps } = props
  const selected = getValue()
  const total = selectProps.options ? (selectProps.options as any[]).length : 10
  const count = selected.length

  return (
    <components.ValueContainer {...props}>
      <div
        style={{
          paddingLeft: '4px',
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: 'var(--theme-text-primary)',
          fontSize: '0.84rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>Columns:</span>
        <span style={{ color: count === total ? '#10b981' : count === 0 ? '#ef4444' : '#3b82f6', fontWeight: 700 }}>
          {count === total ? 'All' : count === 0 ? 'None' : `${count}/${total}`}
        </span>
      </div>
      {children}
    </components.ValueContainer>
  )
}

const ColumnMenuList = (props: any) => {
  const { allSelected, onSelectAll, onDeselectAll } = props.selectProps
  return (
    <components.MenuList {...props}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          borderBottom: '1px solid var(--theme-elevation-200)',
          fontSize: '0.78rem',
          color: 'var(--theme-text-secondary)',
        }}
      >
        <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>Visible Columns</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (allSelected) {
              onDeselectAll()
            } else {
              onSelectAll()
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: 0,
            outline: 'none',
          }}
        >
          {allSelected ? 'Uncheck All' : 'Select All'}
        </button>
      </div>
      {props.children}
    </components.MenuList>
  )
}

const MultiValue = () => null

const customColumnStyles = {
  control: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-50)',
    borderColor: 'var(--theme-elevation-200)',
    borderRadius: '6px',
    padding: '0 4px',
    minWidth: '150px',
    minHeight: '34px',
    height: '34px',
    boxShadow: 'none',
    cursor: 'pointer',
    '&:hover': {
      borderColor: 'var(--theme-elevation-400)',
    },
  }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '0 4px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
  }),
  indicatorsContainer: (base: any) => ({
    ...base,
    height: '32px',
  }),
  menu: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-50)',
    border: '1px solid var(--theme-elevation-200)',
    zIndex: 9999,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? 'var(--theme-elevation-150)' : 'transparent',
    color: 'var(--theme-text-primary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  }),
}

type ReturnOrderItem = {
  id: string
  itemId?: string
  returnNumber: string
  status: string
  product: string
  quantity: number
  unitPrice: number
  subtotal: number
  notes?: string
  time: string
  imageUrl?: string
  verification?: BillVerificationData
  verificationJson?: string | null
}

type BranchGroup = {
  _id: string
  branchName: string
  totalAmount: number
  totalQuantity: number
  count: number
  orderCount: number
  items: ReturnOrderItem[]
}

type ReportStatusStat = {
  status: string
  total: number
  count: number
  percentage: number
}

type ReportData = {
  startDate: string
  endDate: string
  groups: BranchGroup[]
  meta: {
    grandTotal: number
    totalCount: number
    totalQuantity: number
    statuses: string[]
    statusStats: ReportStatusStat[]
  }
}

type ReturnOrderReportQueryResponse = {
  data?: {
    returnOrderReport?: ReportData
  }
  errors?: {
    message?: string
  }[]
}

const columnOptions: SelectOption[] = [
  { value: 'returnNumber', label: 'Return No' },
  { value: 'product', label: 'Product' },
  { value: 'quantity', label: 'Qty' },
  { value: 'unitPrice', label: 'Unit Price' },
  { value: 'amount', label: 'Amount' },
  { value: 'status', label: 'Status' },
  { value: 'time', label: 'Time' },
  { value: 'verification', label: 'Verification' },
  { value: 'image', label: 'Image' },
]

const CustomValueContainer = ({ children, ...props }: ValueContainerProps<SelectOption, true>) => {
  const { getValue, hasValue, selectProps } = props
  const selected = getValue()
  const count = selected.length
  const isTyping = selectProps.inputValue && selectProps.inputValue.length > 0

  return (
    <components.ValueContainer {...props}>
      {hasValue && count > 0 && !isTyping && (
        <div style={{ paddingLeft: '8px', position: 'absolute', pointerEvents: 'none' }}>
          {count === 1 ? selected[0].label : `${count} Selected`}
        </div>
      )}
      {children}
    </components.ValueContainer>
  )
}

const RETURN_ORDER_REPORT_QUERY = `
  query ReturnOrderReport($filter: ReturnOrderReportFilterInput) {
    returnOrderReport(filter: $filter) {
      startDate
      endDate
      groups {
        _id
        branchName
        totalAmount
        totalQuantity
        count
        orderCount
        items {
          id
          itemId
          returnNumber
          status
          product
          quantity
          unitPrice
          subtotal
          notes
          time
          imageUrl
          verificationJson
        }
      }
      meta {
        grandTotal
        totalCount
        totalQuantity
        statuses
        statusStats {
          status
          total
          count
          percentage
        }
      }
    }
  }
`

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

const getStatusColor = (status: string): string => {
  const key = (status || '').toLowerCase()
  switch (key) {
    case 'pending':
      return '#f59e0b'
    case 'accepted':
      return '#06b6d4'
    case 'returned':
      return '#22c55e'
    case 'cancelled':
      return '#ef4444'
    default:
      return '#94a3b8'
  }
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

const ReturnOrderReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [activeStatus, setActiveStatus] = useState<string>('all')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')

  const [pageSize, setPageSize] = useState<number>(50)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('return_order_visible_columns')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch {
        // ignore
      }
    }
    return columnOptions.map((o) => o.value)
  })

  const handleVisibleColumnsChange = (cols: string[]) => {
    setVisibleColumns(cols)
    try {
      localStorage.setItem('return_order_visible_columns', JSON.stringify(cols))
    } catch {
      // ignore
    }
  }

  const [userRole, setUserRole] = useState<string>('')
  const isAdmin = ['superadmin', 'admin'].includes(userRole)
  const [verificationSettings, setVerificationSettings] = useState<{
    requireAccountant: boolean
    requireWatcher: boolean
    requireManager: boolean
  }>({
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  })
  const [tempSettings, setTempSettings] = useState(verificationSettings)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationModalItem, setVerificationModalItem] = useState<ReturnOrderItem | null>(null)
  const [activeStepTab, setActiveStepTab] = useState<'accountant' | 'watcher' | 'manager'>('accountant')
  const [stepNotes, setStepNotes] = useState<{ accountant: string; watcher: string; manager: string }>({
    accountant: '',
    watcher: '',
    manager: '',
  })
  const [stepSkipReason, setStepSkipReason] = useState<{ accountant: string; watcher: string; manager: string }>({
    accountant: '',
    watcher: '',
    manager: '',
  })
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false)

  useEffect(() => {
    const fetchUserAndSettings = async () => {
      try {
        const meRes = await fetch('/api/users/me')
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData?.user?.role) {
            setUserRole(meData.user.role)
          }
        }
      } catch (e) {
        console.error('Failed to fetch user', e)
      }

      try {
        const setRes = await fetch('/api/reports/verification-settings')
        if (setRes.ok) {
          const setData = await setRes.json()
          if (setData?.settings?.returnOrder) {
            setVerificationSettings(setData.settings.returnOrder)
            setTempSettings(setData.settings.returnOrder)
          }
        }
      } catch (e) {
        console.error('Failed to fetch verification settings', e)
      }
    }

    fetchUserAndSettings()
  }, [])

  const openVerificationModal = (item: ReturnOrderItem) => {
    setVerificationModalItem(item)
    setStepNotes({
      accountant: item.verification?.accountant?.notes || '',
      watcher: item.verification?.watcher?.notes || '',
      manager: item.verification?.manager?.notes || '',
    })
    setStepSkipReason({
      accountant: '',
      watcher: '',
      manager: '',
    })

    if (userRole === 'account') {
      setActiveStepTab('accountant')
    } else if (userRole === 'watcher') {
      setActiveStepTab('watcher')
    } else if (userRole === 'manager') {
      setActiveStepTab('manager')
    } else {
      const ver = item.verification
      if (!ver?.accountant?.status || ver.accountant.status === 'pending') {
        setActiveStepTab('accountant')
      } else if (!ver?.watcher?.status || ver.watcher.status === 'pending') {
        setActiveStepTab('watcher')
      } else {
        setActiveStepTab('manager')
      }
    }
    setShowVerificationModal(true)
  }

  const handleVerificationSubmit = async (
    targetId: string,
    step: 'accountant' | 'watcher' | 'manager',
    status: 'verified' | 'rejected' | 'skipped',
  ) => {
    setIsSubmittingVerification(true)
    try {
      const notesText = stepNotes[step]
      const skipReasonText = stepSkipReason[step]
      const res = await fetch('/api/return-orders/update-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnOrderId: targetId,
          step,
          status,
          notes: notesText,
          skipReason: skipReasonText,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `Failed to update verification (HTTP ${res.status})`)
      }

      const json = await res.json()

      if (data) {
        const updatedGroups = data.groups.map((group) => {
          const updatedItems = group.items.map((i) => {
            if (i.id === targetId) {
              return {
                ...i,
                verification: json.verification,
                notes: typeof json.notes === 'string' ? json.notes : '',
              }
            }
            return i
          })
          return { ...group, items: updatedItems }
        })
        setData({ ...data, groups: updatedGroups })
      }

      if (verificationModalItem && verificationModalItem.id === targetId) {
        setVerificationModalItem((prev) =>
          prev
            ? {
                ...prev,
                verification: json.verification,
                notes: typeof json.notes === 'string' ? json.notes : '',
              }
            : null,
        )
      }

      setShowVerificationModal(false)
    } catch (err: any) {
      alert(err.message || 'Error updating verification')
    } finally {
      setIsSubmittingVerification(false)
    }
  }

  const handleSaveVerificationSettings = async () => {
    setIsSavingSettings(true)
    try {
      const res = await fetch('/api/reports/verification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnOrder: tempSettings,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to save settings')
      }
      setVerificationSettings(tempSettings)
      setShowSettingsModal(false)
      alert('Verification rules updated successfully!')
    } catch (e: any) {
      alert(e.message || 'Failed to save verification rules')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])

  const [showScrollBottom, setShowScrollBottom] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrolledToBottom =
        window.innerHeight + currentScrollY >= document.documentElement.scrollHeight - 100
      const scrolledToTop = currentScrollY < 100

      if (scrolledToTop) {
        setShowScrollBottom(true)
      } else if (scrolledToBottom) {
        setShowScrollBottom(false)
      } else {
        if (currentScrollY > lastScrollY.current) {
          setShowScrollBottom(true)
        } else if (currentScrollY < lastScrollY.current) {
          setShowScrollBottom(false)
        }
      }
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToToggle = () => {
    if (showScrollBottom) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      })
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
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
        const farPast = new Date(today)
        farPast.setDate(farPast.getDate() - 365)
        start = farPast
        break
      case 'today':
        start = today
        end = today
        break
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        start = yesterday
        end = yesterday
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
      default:
        break
    }

    if (start && end) {
      setDateRange([start, end])
    }
  }

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
      borderRadius: '8px',
      height: '42px',
      minHeight: '42px',
      width: '180px',
      boxShadow: state.isFocused ? '0 0 0 1px var(--theme-info-500)' : 'none',
      color: 'var(--theme-text-primary)',
      '&:hover': {
        borderColor: 'var(--theme-info-750)',
      },
      flexWrap: 'nowrap' as const,
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
      minWidth: '220px',
    }),
    valueContainer: (base: Record<string, unknown>) => ({
      ...base,
      flexWrap: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  }

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const branchRes = await fetch('/api/reports/branches')
        if (branchRes.ok) {
          const json = await branchRes.json()
          setBranches(json.docs || [])
        }
      } catch (e) {
        console.error(e)
      }
    }

    fetchMetadata()
  }, [])

  const fetchReport = React.useCallback(
    async (start: Date, end: Date, status: string, branchIds: string[]) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const branchParam = branchIds.includes('all') ? 'all' : branchIds.join(',')

        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: RETURN_ORDER_REPORT_QUERY,
            variables: {
              filter: {
                startDate: startStr,
                endDate: endStr,
                status,
                branch: branchParam,
              },
            },
          }),
        })
        if (!res.ok) throw new Error(`Failed to fetch return order report (HTTP ${res.status})`)

        const json = (await res.json()) as ReturnOrderReportQueryResponse
        if (Array.isArray(json.errors) && json.errors.length > 0) {
          throw new Error(json.errors[0]?.message || 'Failed to fetch return order report')
        }

        const report = json.data?.returnOrderReport
        if (!report) throw new Error('No report data returned from GraphQL')

        if (Array.isArray(report.groups)) {
          report.groups.forEach((g: any) => {
            if (Array.isArray(g.items)) {
              g.items.forEach((it: any) => {
                if (it.verificationJson) {
                  try {
                    it.verification = JSON.parse(it.verificationJson)
                  } catch (e) {
                    it.verification = undefined
                  }
                }
              })
            }
          })
        }

        setData(report)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Error loading return order report')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, activeStatus, selectedBranch)
    }
  }, [startDate, endDate, activeStatus, selectedBranch, fetchReport])

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
    ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
  ]

  return (
    <div className="return-order-report-container-v2">
      <div className="report-header-v2">
        <div className="header-controls">
          <div className="date-controls">
            {isAdmin && (
              <button
                type="button"
                className="verification-settings-btn"
                onClick={() => {
                  setTempSettings(verificationSettings)
                  setShowSettingsModal(true)
                }}
                title="Configure 3-Step Verification Rules (Enable/Disable Steps)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'var(--theme-elevation-100)',
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: '6px',
                  color: 'var(--theme-text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  height: '38px',
                  whiteSpace: 'nowrap',
                }}
              >
                ⚙️ Verification Rules
              </button>
            )}
            <Select
              options={dateRangeOptions}
              value={dateRangeOptions.find((o) => o.value === dateRangePreset)}
              onChange={(option: { value: string; label: string } | null) => {
                if (option) handleDatePresetChange(option.value)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              isSearchable={false}
            />

            <div className="date-picker-wrapper">
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

            <Select
              options={branchOptions}
              isMulti
              value={branchOptions.filter((option) => selectedBranch.includes(option.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedBranch.includes('all')
                const hasAll = selected.includes('all')

                let final = selected
                if (hasAll && !wasAll) {
                  final = ['all']
                } else if (hasAll && wasAll && selected.length > 1) {
                  final = selected.filter((x) => x !== 'all')
                } else if (final.length === 0) {
                  final = ['all']
                }
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

          <div className="status-tabs">
            {STATUS_TABS.map((status) => (
              <button
                key={status.value}
                className={`status-tab ${activeStatus === status.value ? 'active' : ''}`}
                style={{
                  borderColor: activeStatus === status.value ? getStatusColor(status.value) : undefined,
                  color: activeStatus === status.value ? '#fff' : undefined,
                  backgroundColor:
                    activeStatus === status.value ? getStatusColor(status.value) : undefined,
                }}
                onClick={() => setActiveStatus(activeStatus === status.value ? 'all' : status.value)}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="report-content">
        {loading && <div className="loading-state">Loading...</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && data && (
          <div className="report-main-layout">
            <div className="branch-groups">
              {data.groups.length > 0 && (
                <div
                  className="overall-report-total"
                  style={{
                    borderColor: getStatusColor(activeStatus),
                    boxShadow: `0 4px 15px ${getStatusColor(activeStatus)}26`,
                  }}
                >
                  <div className="total-info">
                    <div className="total-label">OVERALL RETURN TOTAL</div>
                    <span className="total-count">
                      {data.meta.totalCount} items | {data.meta.totalQuantity.toFixed(2)} qty
                    </span>
                  </div>
                  <div className="total-amount" style={{ color: getStatusColor(activeStatus) }}>
                    ₹{data.meta.grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              )}

              {data.groups.length > 0 && (
                <div className="table-header-controls" style={{ marginBottom: '16px' }}>
                  <div className="limit-selector">
                    <span>Show </span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="page-size-select"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                    <span> entries</span>
                  </div>

                  <div className="table-column-filter">
                    <Select
                      options={columnOptions}
                      isMulti
                      value={columnOptions.filter((o) => visibleColumns.includes(o.value))}
                      onChange={(newValue) => {
                        const selected = newValue ? (newValue as SelectOption[]).map((x) => x.value) : []
                        handleVisibleColumnsChange(selected)
                      }}
                      styles={customColumnStyles}
                      classNamePrefix="react-select"
                      placeholder="Columns..."
                      isSearchable={false}
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      {...({
                        allSelected: visibleColumns.length === columnOptions.length,
                        onSelectAll: () => handleVisibleColumnsChange(columnOptions.map((o) => o.value)),
                        onDeselectAll: () => handleVisibleColumnsChange([]),
                      } as any)}
                      components={{
                        Option: CheckboxOption,
                        ValueContainer: ColumnValueContainer,
                        MenuList: ColumnMenuList,
                        MultiValue,
                      }}
                    />
                  </div>
                </div>
              )}

              {data.groups.map((group) => {
                const reversedItems = group.items.slice().reverse()
                const displayedItems = reversedItems.slice(0, pageSize)

                return (
                  <div key={group._id} className="branch-section">
                    <div className="branch-header">
                      <div className="branch-info">
                        <h2>{group.branchName}</h2>
                        <span className="item-count">
                          {group.count} items | {group.orderCount} orders | {group.totalQuantity.toFixed(2)} qty
                        </span>
                      </div>
                      <div className="branch-total" style={{ color: getStatusColor(activeStatus) }}>
                        ₹{group.totalAmount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="branch-items-table">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '4%' }}>S.NO</th>
                            {visibleColumns.includes('returnNumber') && <th style={{ width: '13%' }}>Return No</th>}
                            {visibleColumns.includes('product') && <th style={{ width: '15%' }}>Product</th>}
                            {visibleColumns.includes('quantity') && <th style={{ width: '8%', textAlign: 'right' }}>Qty</th>}
                            {visibleColumns.includes('unitPrice') && <th style={{ width: '10%', textAlign: 'right' }}>Unit Price</th>}
                            {visibleColumns.includes('amount') && <th style={{ width: '10%', textAlign: 'right' }}>Amount</th>}
                            {visibleColumns.includes('status') && <th style={{ width: '10%', textAlign: 'center' }}>Status</th>}
                            {visibleColumns.includes('time') && <th style={{ width: '12%', textAlign: 'right' }}>Time</th>}
                            {visibleColumns.includes('verification') && <th style={{ width: '16%', textAlign: 'center', minWidth: '130px' }}>VERIFICATION</th>}
                            {visibleColumns.includes('image') && <th style={{ width: '6%', textAlign: 'center' }}>Image</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {displayedItems.map((item, idx) => (
                            <tr key={`${item.returnNumber}-${idx}`}>
                              <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>{idx + 1}</td>
                              {visibleColumns.includes('returnNumber') && (
                                <td className="return-number-cell">{item.returnNumber}</td>
                              )}
                              {visibleColumns.includes('product') && (
                                <td className="product-cell">{item.product}</td>
                              )}
                              {visibleColumns.includes('quantity') && (
                                <td className="quantity-cell">{item.quantity.toFixed(2)}</td>
                              )}
                              {visibleColumns.includes('unitPrice') && (
                                <td className="price-cell">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                              )}
                              {visibleColumns.includes('amount') && (
                                <td className="amount-cell">₹{item.subtotal.toLocaleString('en-IN')}</td>
                              )}
                              {visibleColumns.includes('status') && (
                                <td className="status-cell">
                                  <span
                                    className="status-pill"
                                    style={{
                                      backgroundColor: `${getStatusColor(item.status)}22`,
                                      color: getStatusColor(item.status),
                                      borderColor: `${getStatusColor(item.status)}55`,
                                    }}
                                  >
                                    {item.status}
                                  </span>
                                </td>
                              )}
                              {visibleColumns.includes('time') && (
                                <td className="time-cell" title={item.time}>
                                  {dayjs.utc(item.time).format('DD-MM-YY hh:mm A')}
                                </td>
                              )}
                              {visibleColumns.includes('verification') && (
                                <td className="verification-cell" style={{ textAlign: 'center' }}>
                                  {userRole === 'account' ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                      <button
                                        type="button"
                                        className={`ver-role-action-btn ver-${item.verification?.accountant?.status || 'pending'}`}
                                        onClick={() => openVerificationModal(item)}
                                        title={item.verification?.accountant?.notes ? `Accountant Note: ${item.verification.accountant.notes}` : 'Click to Verify (Accountant)'}
                                      >
                                        {item.verification?.accountant?.status === 'verified' ? '✓ Verified (Acc)' :
                                         item.verification?.accountant?.status === 'rejected' ? '✕ Rejected (Acc)' :
                                         item.verification?.accountant?.status === 'skipped' ? '↷ Skipped (Acc)' : 'Verify (Acc)'}
                                      </button>
                                      {Boolean(item.verification?.accountant?.notes?.trim()) && (
                                        <span
                                          className="ver-note-icon-btn"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openVerificationModal(item)
                                          }}
                                          title={`Accountant Note: ${item.verification?.accountant?.notes}`}
                                        >
                                          <Mail size={14} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                        </span>
                                      )}
                                    </div>
                                  ) : userRole === 'watcher' ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                      <button
                                        type="button"
                                        className={`ver-role-action-btn ver-${item.verification?.watcher?.status || 'pending'}`}
                                        onClick={() => openVerificationModal(item)}
                                        title={item.verification?.watcher?.notes ? `Watcher Note: ${item.verification.watcher.notes}` : 'Click to Verify (Watcher)'}
                                      >
                                        {item.verification?.watcher?.status === 'verified' ? '✓ Verified (Wat)' :
                                         item.verification?.watcher?.status === 'rejected' ? '✕ Rejected (Wat)' :
                                         item.verification?.watcher?.status === 'skipped' ? '↷ Skipped (Wat)' : 'Verify (Wat)'}
                                      </button>
                                      {item.verification?.watcher?.notes && (
                                        <span
                                          className="ver-note-icon-btn"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openVerificationModal(item)
                                          }}
                                          title={`Watcher Note: ${item.verification.watcher.notes}`}
                                        >
                                          <Mail size={14} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                        </span>
                                      )}
                                    </div>
                                  ) : userRole === 'manager' ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                      <button
                                        type="button"
                                        className={`ver-role-action-btn ver-${item.verification?.manager?.status || 'pending'}`}
                                        onClick={() => openVerificationModal(item)}
                                        title={item.verification?.manager?.notes ? `Manager Note: ${item.verification.manager.notes}` : 'Click to Verify (Manager)'}
                                      >
                                        {item.verification?.manager?.status === 'verified' ? '✓ Verified (Mgr)' :
                                         item.verification?.manager?.status === 'rejected' ? '✕ Rejected (Mgr)' :
                                         item.verification?.manager?.status === 'skipped' ? '↷ Skipped (Mgr)' : 'Verify (Mgr)'}
                                      </button>
                                      {item.verification?.manager?.notes && (
                                        <span
                                          className="ver-note-icon-btn"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openVerificationModal(item)
                                          }}
                                          title={`Manager Note: ${item.verification.manager.notes}`}
                                        >
                                          <Mail size={14} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      className="verification-cell-container"
                                      onClick={() => openVerificationModal(item)}
                                      title="Click to view/update 3-Step Verification details"
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <div className="verification-chips" style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', justifyContent: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          <span
                                            className={`ver-chip ver-${item.verification?.accountant?.status || 'pending'} ${!verificationSettings.requireAccountant ? 'ver-disabled' : ''}`}
                                            title={`Accountant Step: ${item.verification?.accountant?.status || 'pending'}${item.verification?.accountant?.verifiedByName ? ` (${item.verification.accountant.verifiedByName})` : ''}`}
                                          >
                                            {item.verification?.accountant?.status === 'verified' ? '✓' : item.verification?.accountant?.status === 'rejected' ? '✕' : item.verification?.accountant?.status === 'skipped' ? '↷' : '○'} Acc
                                          </span>
                                          {Boolean(item.verification?.accountant?.notes?.trim()) && (
                                            <span
                                              className="ver-note-icon-btn"
                                              title={`Accountant Note: ${item.verification?.accountant?.notes}`}
                                            >
                                              <Mail size={12} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          <span
                                            className={`ver-chip ver-${item.verification?.watcher?.status || 'pending'} ${!verificationSettings.requireWatcher ? 'ver-disabled' : ''}`}
                                            title={`Watcher Step: ${item.verification?.watcher?.status || 'pending'}${item.verification?.watcher?.verifiedByName ? ` (${item.verification.watcher.verifiedByName})` : ''}`}
                                          >
                                            {item.verification?.watcher?.status === 'verified' ? '✓' : item.verification?.watcher?.status === 'rejected' ? '✕' : item.verification?.watcher?.status === 'skipped' ? '↷' : '○'} Wat
                                          </span>
                                          {item.verification?.watcher?.notes && (
                                            <span
                                              className="ver-note-icon-btn"
                                              title={`Watcher Note: ${item.verification.watcher.notes}`}
                                            >
                                              <Mail size={12} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          <span
                                            className={`ver-chip ver-${item.verification?.manager?.status || 'pending'} ${!verificationSettings.requireManager ? 'ver-disabled' : ''}`}
                                            title={`Manager Step: ${item.verification?.manager?.status || 'pending'}${item.verification?.manager?.verifiedByName ? ` (${item.verification.manager.verifiedByName})` : ''}`}
                                          >
                                            {item.verification?.manager?.status === 'verified' ? '✓' : item.verification?.manager?.status === 'rejected' ? '✕' : item.verification?.manager?.status === 'skipped' ? '↷' : '○'} Mgr
                                          </span>
                                          {item.verification?.manager?.notes && (
                                            <span
                                              className="ver-note-icon-btn"
                                              title={`Manager Note: ${item.verification.manager.notes}`}
                                            >
                                              <Mail size={12} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              )}
                              {visibleColumns.includes('image') && (
                                <td className="image-cell" style={{ textAlign: 'center' }}>
                                  <button
                                    className={`image-view-btn ${item.imageUrl ? 'active' : 'inactive'}`}
                                    disabled={!item.imageUrl}
                                    onClick={() => item.imageUrl && setPreviewImage(item.imageUrl)}
                                    title={item.imageUrl ? 'View Image' : 'No Image'}
                                  >
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
                                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                      <circle cx="12" cy="13" r="4"></circle>
                                    </svg>
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {reversedItems.length > pageSize && (
                        <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)', textAlign: 'right' }}>
                          Showing {pageSize} of {reversedItems.length} entries
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {data.groups.length === 0 && <div className="no-data">No return orders found.</div>}
            </div>

            <div className="status-summary">
              <div className="summary-title">Status Summary</div>
              <div className="stats-list">
                {data.meta.statusStats.map((stat) => (
                  <button
                    key={stat.status}
                    className={`stat-card ${activeStatus === stat.status ? 'active' : ''}`}
                    style={{
                      borderColor:
                        activeStatus === stat.status ? getStatusColor(stat.status) : 'transparent',
                    }}
                    onClick={() =>
                      setActiveStatus(activeStatus === stat.status ? 'all' : stat.status)
                    }
                  >
                    <div className="stat-top">
                      <span className="status-dot" style={{ backgroundColor: getStatusColor(stat.status) }} />
                      <span className="stat-name">{stat.status}</span>
                    </div>
                    <div className="stat-value">₹{stat.total.toLocaleString('en-IN')}</div>
                    <div className="stat-count">{stat.count} items</div>
                    <div className="stat-percentage">{Math.round(stat.percentage)}%</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3-Step Verification Dialog Modal */}
      {showVerificationModal && verificationModalItem && (
        <div className="image-preview-modal" onClick={() => setShowVerificationModal(false)}>
          <div
            className="modal-content"
            style={{
              padding: '2rem',
              background: 'var(--theme-elevation-100)',
              width: '90%',
              maxWidth: '650px',
              borderRadius: '12px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
              border: '1px solid var(--theme-elevation-200)',
              color: 'var(--theme-text-primary)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--theme-elevation-200)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={22} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>3-Step Verification & Remarks</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowVerificationModal(false)}
                style={{ position: 'static', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--theme-text-secondary)' }}
              >
                &times;
              </button>
            </div>

            {/* Return Order Info Summary */}
            <div style={{ background: 'var(--theme-elevation-50)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Return No:</span>
                <strong>#{verificationModalItem.returnNumber}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Product:</span>
                <strong>{verificationModalItem.product}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Amount:</span>
                <strong style={{ color: '#10b981' }}>₹{verificationModalItem.subtotal.toLocaleString('en-IN')} ({verificationModalItem.quantity} qty)</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Overall Status:</span>
                <strong style={{ textTransform: 'capitalize' }}>{verificationModalItem.verification?.overallStatus || 'Pending'}</strong>
              </div>
            </div>

            {/* Photo Preview inside modal */}
            {verificationModalItem.imageUrl && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewImage(verificationModalItem.imageUrl!)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-50)', color: 'var(--theme-text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  📸 View Proof Photo
                </button>
              </div>
            )}

            {/* Step Selection Tabs */}
            {isAdmin && (
              <div className="verification-step-tabs">
                {(['accountant', 'watcher', 'manager'] as const).map((stepKey) => {
                  const stepLabel = stepKey === 'accountant' ? '1. Accountant' : stepKey === 'watcher' ? '2. Watcher' : '3. Manager'
                  const stepData = verificationModalItem.verification?.[stepKey]
                  const status = stepData?.status || 'pending'
                  const isRequired = stepKey === 'accountant' ? verificationSettings.requireAccountant : stepKey === 'watcher' ? verificationSettings.requireWatcher : verificationSettings.requireManager

                  return (
                    <button
                      key={stepKey}
                      type="button"
                      className={`step-tab-btn ${activeStepTab === stepKey ? 'active' : ''}`}
                      onClick={() => setActiveStepTab(stepKey)}
                    >
                      <span className="step-status-icon">
                        {status === 'verified' ? '✓' : status === 'rejected' ? '✕' : status === 'skipped' ? '↷' : '○'}
                      </span>
                      <span>{stepLabel}</span>
                      {!isRequired && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>(Optional)</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step Card Content */}
            {(['accountant', 'watcher', 'manager'] as const).map((stepKey) => {
              if (isAdmin && activeStepTab !== stepKey) return null
              if (!isAdmin) {
                if (userRole === 'account' && stepKey !== 'accountant') return null
                if (userRole === 'watcher' && stepKey !== 'watcher') return null
                if (userRole === 'manager' && stepKey !== 'manager') return null
              }

              const stepTitle = stepKey === 'accountant' ? 'Step 1: Accountant / Office Admin Verification' :
                                stepKey === 'watcher' ? 'Step 2: Watcher (CCTV) Verification' : 'Step 3: Manager Approval & Verification'
              const stepData = verificationModalItem.verification?.[stepKey]
              const currentStatus = stepData?.status || 'pending'
              const canEditThisStep = isAdmin || (stepKey === 'accountant' && userRole === 'account') || (stepKey === 'watcher' && userRole === 'watcher') || (stepKey === 'manager' && userRole === 'manager')

              return (
                <div key={stepKey} className="verification-step-card">
                  <div className="step-card-header">
                    <span className="step-title">
                      {stepTitle}
                    </span>
                    <span className={`ver-chip ver-${currentStatus}`}>
                      {currentStatus}
                    </span>
                  </div>

                  {stepData?.verifiedByName && (
                    <div className="step-meta-info">
                      Updated by <strong>{stepData.verifiedByName}</strong> ({stepData.verifiedByRole || 'Admin'}) on {dayjs(stepData.verifiedAt).format('DD-MM-YYYY hh:mm A')}
                    </div>
                  )}

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                      Remarks / Notes for {stepKey}:
                    </label>
                    <textarea
                      className="step-textarea"
                      rows={3}
                      placeholder={`Enter ${stepKey} remarks, observations, or verification notes...`}
                      value={stepNotes[stepKey]}
                      onChange={(e) => setStepNotes({ ...stepNotes, [stepKey]: e.target.value })}
                      disabled={!canEditThisStep || isSubmittingVerification}
                    />
                  </div>

                  {/* Skip reason input for admins */}
                  {isAdmin && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--theme-text-secondary)' }}>
                        Skip Reason (required if skipping step, e.g. &quot;Manager on leave today&quot;):
                      </label>
                      <input
                        type="text"
                        placeholder="Reason for skipping this step..."
                        value={stepSkipReason[stepKey]}
                        onChange={(e) => setStepSkipReason({ ...stepSkipReason, [stepKey]: e.target.value })}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-0)', color: 'var(--theme-text-primary)', fontSize: '0.85rem' }}
                      />
                    </div>
                  )}

                  {canEditThisStep && (
                    <div className="step-actions">
                      <button
                        type="button"
                        className="ver-btn ver-btn--reject"
                        onClick={() => handleVerificationSubmit(verificationModalItem.id, stepKey, 'rejected')}
                        disabled={isSubmittingVerification}
                      >
                        <XCircle size={15} /> Flag / Reject
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          className="ver-btn ver-btn--skip"
                          onClick={() => {
                            if (!stepSkipReason[stepKey]?.trim()) {
                              alert('Please enter a skip reason first (e.g. "Manager not available today").')
                              return
                            }
                            handleVerificationSubmit(verificationModalItem.id, stepKey, 'skipped')
                          }}
                          disabled={isSubmittingVerification}
                        >
                          <SkipForward size={15} /> Skip Step
                        </button>
                      )}

                      <button
                        type="button"
                        className="ver-btn ver-btn--approve"
                        onClick={() => handleVerificationSubmit(verificationModalItem.id, stepKey, 'verified')}
                        disabled={isSubmittingVerification}
                      >
                        <CheckCircle2 size={15} /> Verify & Approve
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Verification Rules Setup Modal */}
      {showSettingsModal && (
        <div className="image-preview-modal" onClick={() => setShowSettingsModal(false)}>
          <div
            className="modal-content"
            style={{
              padding: '2rem',
              background: 'var(--theme-elevation-100)',
              width: '90%',
              maxWidth: '500px',
              borderRadius: '12px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
              border: '1px solid var(--theme-elevation-200)',
              color: 'var(--theme-text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--theme-elevation-200)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>⚙️</span>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Return Order Verification Rules</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowSettingsModal(false)}
                style={{ position: 'static', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--theme-text-secondary)' }}
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--theme-text-secondary)', marginBottom: '1.25rem' }}>
              Configure which verification steps are mandatory for return orders:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={tempSettings.requireAccountant}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireAccountant: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
                <span><strong>Step 1:</strong> Require Accountant / Office Admin Verification</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={tempSettings.requireWatcher}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireWatcher: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
                <span><strong>Step 2:</strong> Require Watcher (CCTV) Verification</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={tempSettings.requireManager}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireManager: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
                <span><strong>Step 3:</strong> Require Manager Verification</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--theme-elevation-200)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--theme-elevation-300)', background: 'transparent', color: 'var(--theme-text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVerificationSettings}
                disabled={isSavingSettings}
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
              >
                {isSavingSettings ? 'Saving...' : 'Save Rules'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <a
              href={previewImage}
              target="_blank"
              rel="noopener noreferrer"
              title="Click to open original image in new tab"
              style={{ display: 'block', cursor: 'zoom-in' }}
            >
              <Image
                src={previewImage}
                alt="Return Proof"
                width={1200}
                height={1200}
                style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
                unoptimized
              />
            </a>
            <button className="close-btn" onClick={() => setPreviewImage(null)}>
              &times;
            </button>
          </div>
        </div>
      )}

      <button
        className="floating-scroll-btn"
        onClick={scrollToToggle}
        title={showScrollBottom ? 'Scroll to Bottom' : 'Scroll to Top'}
      >
        {showScrollBottom ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
      </button>
    </div>
  )
}

export default ReturnOrderReport
