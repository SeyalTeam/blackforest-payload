'use client'

import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import Select, { OptionProps, ValueContainerProps, GroupBase, components } from 'react-select'
import './index.scss'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  SkipForward,
  Mail,
} from 'lucide-react'

type ReportStats = {
  branchName: string
  totalEntries: number
  systemSales: number
  totalBills: number
  manualSales: number
  onlineSales: number
  totalSales: number
  expenses: number
  cash: number
  upi: number
  card: number
  systemCash: number
  systemUpi: number
  systemCard: number
  closingNumbers: string[]
  lastUpdated: string
  entries: ClosingEntryDetail[]
  sNo?: number
  expenseDetails?: ExpenseDetail[]
  count2000?: number
  count500?: number
  count200?: number
  count10?: number
  count5?: number
  count100?: number
  count50?: number
}

type ExpenseDetail = {
  category: string
  reason: string
  amount: number
  imageUrl?: string
  date: string
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

type ClosingEntryDetail = {
  id: string
  closingNumber: string
  createdAt: string
  systemSales: number
  totalBills: number
  manualSales: number
  onlineSales: number
  totalSales: number
  expenses: number
  cash: number
  upi: number
  card: number
  systemCash: number
  systemUpi: number
  systemCard: number
  notes: string
  verificationJson?: string
  verification?: BillVerificationData
  expenseDetails?: ExpenseDetail[]
  denominations?: Denominations
}

type Denominations = {
  count2000: number
  count500: number
  count200: number
  count100: number
  count50: number
  count10: number
  count5: number
}

type Branch = {
  id: string
  name: string
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: Omit<ReportStats, 'branchName' | 'sNo' | 'entries' | 'closingNumbers' | 'lastUpdated'>
}

type ClosingEntryReportQueryResponse = {
  data?: {
    closingEntryReport?: ReportData
  }
  errors?: {
    message?: string
  }[]
}

interface BranchOption {
  value: string
  label: string
}

const CLOSING_ENTRY_REPORT_QUERY = `
  query ClosingEntryReport($filter: ClosingEntryReportFilterInput) {
    closingEntryReport(filter: $filter) {
      startDate
      endDate
      stats {
        _id
        branchName
        totalEntries
        closingNumbers
        lastUpdated
        sNo
        systemSales
        totalBills
        manualSales
        onlineSales
        totalSales
        expenses
        returnTotal
        stockOrders
        net
        cash
        upi
        card
        systemCash
        systemUpi
        systemCard
        count2000
        count500
        count200
        count100
        count50
        count10
        count5
        expenseDetails {
          category
          reason
          amount
          imageUrl
          date
        }
        entries {
          id
          closingNumber
          createdAt
          systemSales
          totalBills
          manualSales
          onlineSales
          totalSales
          expenses
          cash
          upi
          card
          systemCash
          systemUpi
          systemCard
          notes
          verificationJson
          denominations {
            count2000
            count500
            count200
            count100
            count50
            count10
            count5
          }
          expenseDetails {
            category
            reason
            amount
            imageUrl
            date
          }
        }
      }
      totals {
        totalEntries
        systemSales
        totalBills
        manualSales
        onlineSales
        totalSales
        expenses
        returnTotal
        stockOrders
        net
        cash
        upi
        card
        systemCash
        systemUpi
        systemCard
      }
    }
  }
`

const columnOptions = [
  { value: 'branchName', label: 'Branch Name' },
  { value: 'verification', label: 'Verification' },
  { value: 'systemSales', label: 'System Bills' },
  { value: 'manualSales', label: 'Manual Bills' },
  { value: 'onlineSales', label: 'Online Bills' },
  { value: 'totalSales', label: 'Total Sales' },
  { value: 'salesDiff', label: 'Sales Dif' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'totalCollection', label: 'Total Collection' },
  { value: 'netAmount', label: 'Net Amount' },
]

const ColumnCheckboxOption = (props: OptionProps<any>) => {
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

const ColumnValueContainer = ({ children, ...props }: ValueContainerProps<any, true>) => {
  const { getValue, selectProps } = props
  const selected = getValue()
  const total = selectProps.options ? (selectProps.options as any[]).length : 13
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

const ColumnMultiValue = () => null

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

const ClosingEntryReport: React.FC = () => {
  const [pageSize, setPageSize] = useState<number>(50)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('closing_entry_visible_columns')
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
      localStorage.setItem('closing_entry_visible_columns', JSON.stringify(cols))
    } catch {
      // ignore
    }
  }

  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'combined' | 'detailed'>('combined')

  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [firstClosingDate, setFirstClosingDate] = useState<Date | null>(null)

  const [expensePopupData, setExpensePopupData] = useState<{
    title: string
    details: ExpenseDetail[]
  } | null>(null)

  const [cashPopupData, setCashPopupData] = useState<{
    title: string
    denominations: Denominations
  } | null>(null)

  const [notesPopupData, setNotesPopupData] = useState<{
    title: string
    entries: { id: string; closingNumber: string; notes: string; createdAt: string }[]
  } | null>(null)
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null)

  const [userRole, setUserRole] = useState<string>('')
  const isSuperAdmin = userRole === 'superadmin'
  const isAdmin = userRole === 'admin' || isSuperAdmin

  const [verificationSettings, setVerificationSettings] = useState<{
    effectiveFrom?: string | null
    flowType?: 'sequential' | 'any'
    requireAccountant: boolean
    requireWatcher: boolean
    requireManager: boolean
  }>({
    effectiveFrom: null,
    flowType: 'sequential',
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  })
  const [tempSettings, setTempSettings] = useState(verificationSettings)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // 3-Step Verification Modal State
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationModalEntry, setVerificationModalEntry] = useState<{
    entry: ClosingEntryDetail
    branchName: string
  } | null>(null)
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
    const fetchMetadata = async () => {
      try {
        const [branchesRes, closingRes, userRes, settingsRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/closing-entries?sort=createdAt&limit=1'),
          fetch('/api/users/me'),
          fetch('/api/reports/verification-settings'),
        ])
        const branchesJson = await branchesRes.json()
        setBranches(branchesJson.docs || [])

        const closingJson = await closingRes.json()
        if (closingJson.docs && closingJson.docs.length > 0) {
          setFirstClosingDate(new Date(closingJson.docs[0].createdAt))
        }

        if (userRes.ok) {
          const userJson = await userRes.json()
          if (userJson?.user?.role) {
            setUserRole(userJson.user.role)
          }
        }

        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json()
          if (settingsJson?.settings?.closingEntry) {
            setVerificationSettings(settingsJson.settings.closingEntry)
            setTempSettings(settingsJson.settings.closingEntry)
          }
        }
      } catch (err) {
        console.error('Error fetching metadata', err)
      }
    }
    fetchMetadata()
  }, [])

  const getQuarterDates = (date: Date) => {
    const currQuarter = Math.floor((date.getMonth() + 3) / 3)
    const prevQuarter = currQuarter - 1
    let startMonth = 0
    let year = date.getFullYear()

    if (prevQuarter === 0) {
      startMonth = 9 // Oct
      year -= 1
    } else {
      startMonth = (prevQuarter - 1) * 3
    }
    const endMonth = startMonth + 2

    // Start of quarter
    const start = new Date(year, startMonth, 1)
    // End of quarter (last day of endMonth)
    const end = new Date(year, endMonth + 1, 0)

    return { start, end }
  }

  const handleDatePresetChange = (value: string) => {
    setDateRangePreset(value)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let start: Date | null = null
    let end: Date | null = today

    switch (value) {
      case 'till_now':
        if (firstClosingDate) {
          start = firstClosingDate
        }
        break
      case 'today':
        start = today
        end = today
        break
      case 'yesterday': {
        const y = new Date(today)
        y.setDate(y.getDate() - 1)
        start = y
        end = y
        break
      }
      case 'last_7_days': {
        const d7 = new Date(today)
        d7.setDate(d7.getDate() - 6)
        start = d7
        break
      }
      case 'this_month': {
        const mStart = new Date(today.getFullYear(), today.getMonth(), 1)
        start = mStart
        break
      }
      case 'last_30_days': {
        const d30 = new Date(today)
        d30.setDate(d30.getDate() - 29)
        start = d30
        break
      }
      case 'last_month': {
        const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        start = lmStart
        end = lmEnd
        break
      }
      case 'last_quarter': {
        const { start: qStart, end: qEnd } = getQuarterDates(today)
        start = qStart
        end = qEnd
        break
      }
    }
    setDateRange([start, end])
  }

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  /* Helper to format date as YYYY-MM-DD using local time to avoid timezone shifts */
  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0') // Month is 0-indexed
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchReport = async (start: Date, end: Date) => {
    setLoading(true)
    setError('')
    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: CLOSING_ENTRY_REPORT_QUERY,
          variables: {
            filter: {
              startDate: startStr,
              endDate: endStr,
              branch: 'all',
            },
          },
        }),
      })
      if (!res.ok) throw new Error(`Failed to fetch report (HTTP ${res.status})`)

      const json = (await res.json()) as ClosingEntryReportQueryResponse
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || 'Failed to fetch report')
      }

      const report = json.data?.closingEntryReport
      if (!report) throw new Error('No report data returned from GraphQL')

      if (Array.isArray(report.stats)) {
        report.stats.forEach((st) => {
          if (Array.isArray(st.entries)) {
            st.entries.forEach((e: any) => {
              if (e.verificationJson && typeof e.verificationJson === 'string') {
                try {
                  e.verification = JSON.parse(e.verificationJson)
                } catch {
                  // ignore
                }
              }
            })
          }
        })
      }

      setData(report)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error loading report data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNote = async (entryId: string, notesText: string) => {
    setSavingNotesId(entryId)
    try {
      const res = await fetch(`/api/closing-entries/${entryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: notesText,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to save note (HTTP ${res.status})`)
      }

      // Update local state reactively
      setData((prevData) => {
        if (!prevData) return null
        const updatedStats = prevData.stats.map((stat) => {
          const updatedEntries = stat.entries.map((entry) => {
            if (entry.id === entryId) {
              return { ...entry, notes: notesText }
            }
            return entry
          })
          return { ...stat, entries: updatedEntries }
        })
        return { ...prevData, stats: updatedStats }
      })

      // Update the notesPopupData state so the popup text updates
      setNotesPopupData((prevPopup) => {
        if (!prevPopup) return null
        const updatedEntries = prevPopup.entries.map((entry) => {
          if (entry.id === entryId) {
            return { ...entry, notes: notesText }
          }
          return entry
        })
        return { ...prevPopup, entries: updatedEntries }
      })
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Error saving note')
    } finally {
      setSavingNotesId(null)
    }
  }

  const openVerificationModal = (entry: ClosingEntryDetail, branchName: string) => {
    setVerificationModalEntry({ entry, branchName })
    setStepNotes({
      accountant: entry.verification?.accountant?.notes || '',
      watcher: entry.verification?.watcher?.notes || '',
      manager: entry.verification?.manager?.notes || '',
    })
    setStepSkipReason({
      accountant: '',
      watcher: '',
      manager: '',
    })

    if (userRole === 'manager') {
      setActiveStepTab('manager')
    } else if (userRole === 'account') {
      setActiveStepTab('accountant')
    } else if (userRole === 'watcher') {
      setActiveStepTab('watcher')
    } else {
      const ver = entry.verification
      if (!ver?.manager?.status || ver.manager.status === 'pending') {
        setActiveStepTab('manager')
      } else if (!ver?.accountant?.status || ver.accountant.status === 'pending') {
        setActiveStepTab('accountant')
      } else {
        setActiveStepTab('watcher')
      }
    }
    setShowVerificationModal(true)
  }

  const handleVerificationSubmit = async (
    entryId: string,
    step: 'accountant' | 'watcher' | 'manager',
    status: 'verified' | 'rejected' | 'skipped',
  ) => {
    setIsSubmittingVerification(true)
    try {
      const notesText = stepNotes[step]
      const skipReasonText = stepSkipReason[step]
      const res = await fetch('/api/closing-entries/update-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId,
          step,
          status,
          notes: notesText,
          skipReason: skipReasonText,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Failed to update verification (${res.status})`)
      }

      const json = await res.json()
      const newVerification = json.verification

      // Update local state reactively
      setData((prevData) => {
        if (!prevData) return null
        const updatedStats = prevData.stats.map((stat) => {
          const updatedEntries = stat.entries.map((entry) => {
            if (entry.id === entryId) {
              return {
                ...entry,
                verification: newVerification,
                notes: typeof json.notes === 'string' ? json.notes : '',
              }
            }
            return entry
          })
          return { ...stat, entries: updatedEntries }
        })
        return { ...prevData, stats: updatedStats }
      })

      if (verificationModalEntry && verificationModalEntry.entry.id === entryId) {
        setVerificationModalEntry({
          ...verificationModalEntry,
          entry: {
            ...verificationModalEntry.entry,
            verification: newVerification,
            notes: typeof json.notes === 'string' ? json.notes : '',
          },
        })
      }

      setShowVerificationModal(false)
    } catch (err: any) {
      alert(err.message || 'Error submitting verification')
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
          closingEntry: tempSettings,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save verification settings')
      }
      setVerificationSettings(tempSettings)
      setShowSettingsModal(false)
      alert('Verification rules saved successfully!')
    } catch (err: any) {
      alert(err.message || 'Error saving settings')
    } finally {
      setIsSavingSettings(false)
    }
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  // Initial load: set default date range (Today)
  useEffect(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setDateRange([today, today])
  }, [])

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      // split the value "YYYY-MM-DD - YYYY-MM-DD"
      const [start, end] = value ? value.split(' - ') : ['', '']

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref}>
          <span className="date-text">{start}</span>
          <span className="separator" style={{ color: 'var(--theme-text-primary)' }}>
            →
          </span>
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

  const filteredStats = React.useMemo(
    () =>
      (data?.stats || []).filter((row) => {
        if (selectedBranch.includes('all')) return true
        return selectedBranch.includes(row.branchName)
      }),
    [data?.stats, selectedBranch],
  )

  const filteredTotals = React.useMemo(() => {
    if (!data)
      return {
        systemSales: 0,
        totalBills: 0,
        manualSales: 0,
        onlineSales: 0,
        totalSales: 0,
        expenses: 0,
        cash: 0,
        upi: 0,
        card: 0,
        systemCash: 0,
        systemUpi: 0,
        systemCard: 0,
      }

    if (selectedBranch.includes('all')) {
      return {
        ...data.totals,
        systemCash: data.totals.systemCash || 0,
        systemUpi: data.totals.systemUpi || 0,
        systemCard: data.totals.systemCard || 0,
      }
    }

    return (filteredStats || []).reduce(
      (acc, row) => ({
        systemSales: acc.systemSales + row.systemSales,
        totalBills: acc.totalBills + row.totalBills,
        manualSales: acc.manualSales + row.manualSales,
        onlineSales: acc.onlineSales + row.onlineSales,
        totalSales: acc.totalSales + row.totalSales,
        expenses: acc.expenses + row.expenses,
        cash: acc.cash + row.cash,
        upi: acc.upi + row.upi,
        card: acc.card + row.card,
        systemCash: acc.systemCash + (row.systemCash || 0),
        systemUpi: acc.systemUpi + (row.systemUpi || 0),
        systemCard: acc.systemCard + (row.systemCard || 0),
      }),
      {
        systemSales: 0,
        totalBills: 0,
        manualSales: 0,
        onlineSales: 0,
        totalSales: 0,
        expenses: 0,
        cash: 0,
        upi: 0,
        card: 0,
        systemCash: 0,
        systemUpi: 0,
        systemCard: 0,
      },
    )
  }, [data, filteredStats, selectedBranch])

  const displayStats = React.useMemo<ReportStats[]>(() => {
    return filteredStats || []
  }, [filteredStats])

  const handleExportExcel = () => {
    if (!data || filteredStats.length === 0) return
    const csvRows = []
    // Header
    const headers = [
      'S.No',
      'Branch Name',
      'System Bills',
      'Total Bills',
      'Manual Bills',
      'Online Bills',
      'Total Bills',
      'Expenses',
      'Cash',
      'UPI',
      'Card',
      'Total Sales',
      'Sales Dif',
    ]
    csvRows.push(headers.join(','))

    // Rows
    filteredStats.forEach((row, index) => {
      const calculatedTotal = row.expenses + row.cash + row.upi + row.card
      csvRows.push(
        [
          index + 1,
          `"${row.branchName}"`,
          formatValue(row.systemSales),
          row.totalBills,
          formatValue(row.manualSales),
          formatValue(row.onlineSales),
          formatValue(row.totalSales),
          formatValue(row.expenses),
          formatValue(row.cash),
          formatValue(row.upi),
          formatValue(row.card),
          formatValue(calculatedTotal),
          formatValue(calculatedTotal - row.totalSales),
        ].join(','),
      )
    })

    // Total Row
    csvRows.push(
      [
        '',
        'TOTAL',
        formatValue(filteredTotals.systemSales),
        filteredTotals.totalBills,
        formatValue(filteredTotals.manualSales),
        formatValue(filteredTotals.onlineSales),
        formatValue(filteredTotals.totalSales),
        formatValue(filteredTotals.expenses),
        formatValue(filteredTotals.cash),
        formatValue(filteredTotals.upi),
        formatValue(filteredTotals.card),
        formatValue(
          filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card,
        ),
      ].join(','),
    )

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `closing_entry_report_${startDate ? toLocalDateStr(startDate) : ''}_${endDate ? toLocalDateStr(endDate) : ''}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Specific style for System Sales to handle stacked content

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

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.name, label: b.name })),
  ]

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
      borderRadius: '8px',
      height: '42px', // Match fixed height of datepicker
      minHeight: '42px',
      boxShadow: 'none',
      '&:hover': {
        borderColor: 'var(--theme-info-500)',
      },
      width: '180px', // Uniform width for dropdowns
    }),
    singleValue: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary, #fff)',
    }),
    placeholder: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-secondary, #888)',
    }),
    menu: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: 'var(--theme-elevation-100)',
      border: '1px solid var(--theme-elevation-300)',
      zIndex: 9999,
    }),
    option: (
      base: Record<string, unknown>,
      state: { isFocused: boolean; isSelected: boolean },
    ) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--theme-info-500)'
        : state.isFocused
          ? 'var(--theme-elevation-200)'
          : 'transparent',
      color: 'var(--theme-text-primary, #fff)',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: 'var(--theme-info-600)',
      },
    }),
    input: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary, #fff)',
    }),
    multiValue: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: 'var(--theme-elevation-200)',
      borderRadius: '4px',
    }),
    multiValueLabel: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary, #fff)',
    }),
    multiValueRemove: (base: Record<string, unknown>) => ({
      ...base,
      color: 'var(--theme-text-primary, #fff)',
      ':hover': {
        backgroundColor: 'var(--theme-error-500)',
        color: 'white',
      },
    }),
  }

  const CheckboxOption = (props: OptionProps<BranchOption, true, GroupBase<BranchOption>>) => {
    return (
      <components.Option {...props}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'var(--theme-text-primary)',
          }}
        >
          <input
            type="checkbox"
            checked={props.isSelected}
            readOnly
            style={{
              marginRight: '10px',
              accentColor: 'var(--theme-info-500)',
              cursor: 'pointer',
            }}
          />
          <label style={{ cursor: 'pointer', flex: 1 }}>{props.label}</label>
        </div>
      </components.Option>
    )
  }

  const CustomValueContainer = (
    props: ValueContainerProps<BranchOption, true, GroupBase<BranchOption>>,
  ) => {
    const selected = props.getValue()
    const selectedCount = Array.isArray(selected) ? selected.length : selected ? 1 : 0
    const allSelected = Array.isArray(selected) && selected.some((v) => v?.value === 'all')
    const { children, ...rest } = props

    const input = React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && child.key && String(child.key).includes('input'),
    )

    return (
      <div
        {...rest.innerProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          color: 'var(--theme-text-primary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {allSelected ? (
          'All Branches'
        ) : selectedCount > 0 ? (
          `${selectedCount} Selected`
        ) : (
          <span style={{ color: 'var(--theme-text-secondary, #888)' }}>Select Branch...</span>
        )}
        <div style={{ margin: 0, padding: 0, visibility: 'visible', width: 0, height: 0 }}>
          {input}
        </div>
      </div>
    )
  }

  return (
    <div className="branch-report-container">
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Closing Entry Report</h1>
        </div>
        <div className="date-filter">
          {/* View Mode Toggle */}
          <button
            className="view-mode-toggle"
            onClick={() => setViewMode(viewMode === 'combined' ? 'detailed' : 'combined')}
            title={viewMode === 'combined' ? 'Switch to Detailed Table View' : 'Switch to Combined Table View'}
            style={{
              background: 'none',
              border: '1px solid var(--theme-elevation-300)',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: 'var(--theme-text-primary, var(--theme-text))',
              marginRight: '1rem',
              height: '42px',
            }}
          >
            {viewMode === 'combined' ? (
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
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            ) : (
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
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            )}
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              {viewMode === 'combined' ? 'Combined Table' : 'Detailed Table'}
            </span>
          </button>

          {/* Admin Verification Rules Button */}
          {isAdmin && (
            <button
              type="button"
              className="rules-settings-btn"
              onClick={() => {
                setTempSettings(verificationSettings)
                setShowSettingsModal(true)
              }}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                borderRadius: '6px',
                color: '#10b981',
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '42px',
                marginRight: '1rem',
              }}
              title="Configure 3-Step Verification Rules for Closing Entry Report"
            >
              <span>⚙️</span>
              <span>Verification Rules</span>
            </button>
          )}

          <div className="filter-group">
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
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
            />
          </div>

          <div className="filter-group">
            <Select<BranchOption, true, GroupBase<BranchOption>>
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
              closeMenuOnSelect={true}
              blurInputOnSelect={true}
              hideSelectedOptions={false}
              components={{
                Option: CheckboxOption,
                ValueContainer: CustomValueContainer,
              }}
            />
          </div>

          <div className="filter-group">
            <button className="export-btn" onClick={handleExportExcel} title="Export to Excel">
              Export Excel
              <span className="icon">↓</span>
            </button>
          </div>

          <div className="filter-group">
            <button
              onClick={() => {
                setDateRangePreset('today')
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                setDateRange([today, today])
                setSelectedBranch(['all'])
                setViewMode('combined')
              }}
              title="Reset Filters"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 0 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--theme-text-primary)',
              }}
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
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="table-header-controls" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            <div className="limit-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <span>Show </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="page-size-select"
                style={{
                  background: 'var(--theme-elevation-100)',
                  border: '1px solid var(--theme-elevation-200)',
                  color: 'var(--theme-text-primary)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
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
                  const selected = newValue ? (newValue as any[]).map((x) => x.value) : []
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
                  Option: ColumnCheckboxOption,
                  ValueContainer: ColumnValueContainer,
                  MenuList: ColumnMenuList,
                  MultiValue: ColumnMultiValue,
                }}
              />
            </div>
          </div>

          {viewMode === 'combined' ? (
            <div className="table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }} className="center-cell">S.NO</th>
                    {visibleColumns.includes('branchName') && <th>BRANCH NAME</th>}
                    {visibleColumns.includes('verification') && <th className="center-cell" style={{ textAlign: 'center', minWidth: '130px' }}>VERIFICATION</th>}
                    {visibleColumns.includes('systemSales') && <th className="text-right">SYSTEM BILLS</th>}
                    {visibleColumns.includes('manualSales') && <th className="text-right">MANUAL BILLS</th>}
                    {visibleColumns.includes('onlineSales') && <th className="text-right">ONLINE BILLS</th>}
                    {visibleColumns.includes('totalSales') && <th className="text-right">TOTAL SALES</th>}
                    {visibleColumns.includes('salesDiff') && <th className="text-right">SALES DIF</th>}
                    {visibleColumns.includes('expenses') && <th className="text-right">EXPENSES</th>}
                    {visibleColumns.includes('cash') && <th className="text-right">CASH</th>}
                    {visibleColumns.includes('upi') && <th className="text-right">UPI</th>}
                    {visibleColumns.includes('card') && <th className="text-right">CARD</th>}
                    {visibleColumns.includes('totalCollection') && <th className="text-right">TOTAL COLLECTION</th>}
                    {visibleColumns.includes('netAmount') && <th className="text-right">NET AMOUNT</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayStats.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="center-cell" style={{ padding: '24px', opacity: 0.6 }}>
                        No closing entries found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    displayStats.slice(0, pageSize).map((row, index) => {
                      const calculatedTotal = row.expenses + row.cash + row.upi + row.card
                      const salesDiff = calculatedTotal - row.totalSales
                      const hasAnyNegativeEntry = (row.entries || []).some((entry) => {
                        const entryCollectionTotal =
                          (entry.expenses || 0) +
                          (entry.cash || 0) +
                          (entry.upi || 0) +
                          (entry.card || 0)
                        return entryCollectionTotal - (entry.totalSales || 0) < 0
                      })
                      const isNegativeDiffRow = salesDiff < 0 || hasAnyNegativeEntry
                      const isPositiveDiffRow = !isNegativeDiffRow && salesDiff > 0

                      const showClosingIds = ['today', 'yesterday'].includes(dateRangePreset)

                      const closingIds = showClosingIds
                        ? row.closingNumbers?.map((num) => {
                            const parts = num.split('-')
                            if (parts.length >= 4) {
                              return `${parts[0]}-${parts[parts.length - 1]}`
                            }
                            return num
                          }) || []
                        : []
                      const uniqueClosingIds = Array.from(new Set(closingIds))
                      const closingIdStr = uniqueClosingIds.join(', ')

                      const timeStr = row.lastUpdated
                        ? new Date(row.lastUpdated).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : ''

                      const netAmount = salesDiff

                      return (
                        <tr
                          key={row.branchName}
                          className={`${isNegativeDiffRow ? 'negative-diff-row' : ''} ${isPositiveDiffRow ? 'positive-diff-row' : ''}`}
                        >
                          <td className="center-cell">{index + 1}</td>
                          {visibleColumns.includes('branchName') && (
                            <td
                              className="clickable-branch"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setSelectedBranch([row.branchName])
                                setViewMode('detailed')
                              }}
                              title="Click to view detailed entries"
                            >
                              <div className="branch-title">{row.branchName.toUpperCase()}</div>
                              {(closingIdStr || timeStr) && (
                                <div className="branch-subtext">
                                  {closingIdStr && <span>#{closingIdStr} </span>}
                                  {timeStr && <span>• {timeStr}</span>}
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.includes('verification') && (
                            <td className="center-cell" style={{ textAlign: 'center' }}>
                              {(() => {
                                const totalEntries = row.entries?.length || 0
                                const verifiedEntriesCount = (row.entries || []).filter(
                                  (e) => e.verification?.overallStatus === 'verified'
                                ).length
                                const hasAnyRejected = (row.entries || []).some(
                                  (e) => e.verification?.overallStatus === 'rejected'
                                )
                                const hasAnyNotes = (row.entries || []).some(
                                  (e) =>
                                    e.verification?.accountant?.notes ||
                                    e.verification?.watcher?.notes ||
                                    e.verification?.manager?.notes ||
                                    e.notes
                                )

                                return (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '3px',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                      setSelectedBranch([row.branchName])
                                      setViewMode('detailed')
                                    }}
                                    title="Click to view detailed closing entries for this branch"
                                  >
                                    {hasAnyRejected ? (
                                      <span className="ver-chip ver-rejected">✕ Rejected</span>
                                    ) : verifiedEntriesCount === totalEntries && totalEntries > 0 ? (
                                      <span className="ver-chip ver-verified">✓ Verified ({totalEntries})</span>
                                    ) : verifiedEntriesCount > 0 ? (
                                      <span className="ver-chip ver-partially_verified">
                                        ⏳ Partial ({verifiedEntriesCount}/{totalEntries})
                                      </span>
                                    ) : (
                                      <span className="ver-chip ver-pending">
                                        ○ Pending ({totalEntries})
                                      </span>
                                    )}
                                    {hasAnyNotes && (
                                      <span
                                        className="ver-note-icon-btn"
                                        title="Branch has verification notes. Click to view detailed entries."
                                      >
                                        <Mail size={13} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                      </span>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                          )}
                          {visibleColumns.includes('systemSales') && (
                            <td className="text-right">
                              <div className="bill-amount">₹{formatValue(row.systemSales)}</div>
                              <div className="bill-count">({row.totalBills} Bills)</div>
                            </td>
                          )}
                          {visibleColumns.includes('manualSales') && (
                            <td className="text-right">₹{formatValue(row.manualSales)}</td>
                          )}
                          {visibleColumns.includes('onlineSales') && (
                            <td className="text-right">₹{formatValue(row.onlineSales)}</td>
                          )}
                          {visibleColumns.includes('totalSales') && (
                            <td className="text-right bill-amount">₹{formatValue(row.totalSales)}</td>
                          )}
                          {visibleColumns.includes('salesDiff') && (
                            <td className="text-right">
                              <span className={`sales-diff-value ${salesDiff >= 0 ? 'positive' : 'negative'}`}>
                                {salesDiff > 0 ? '↑' : salesDiff < 0 ? '↓' : ''} ₹{formatValue(salesDiff)}
                              </span>
                            </td>
                          )}
                          {visibleColumns.includes('expenses') && (
                            <td
                              className="text-right clickable"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpensePopupData({
                                  title: `Expenses - ${row.branchName}`,
                                  details: row.expenseDetails || [],
                                })
                              }}
                              title="Click to view expenses breakdown"
                            >
                              ₹{formatValue(row.expenses)}
                            </td>
                          )}
                          {visibleColumns.includes('cash') && (
                            <td
                              className="text-right clickable"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCashPopupData({
                                  title: `Cash Denominations - ${row.branchName}`,
                                  denominations: {
                                    count2000: row.count2000 || 0,
                                    count500: row.count500 || 0,
                                    count200: row.count200 || 0,
                                    count100: row.count100 || 0,
                                    count50: row.count50 || 0,
                                    count10: row.count10 || 0,
                                    count5: row.count5 || 0,
                                  },
                                })
                              }}
                              title="Click to view cash denominations"
                            >
                              ₹{formatValue(row.cash)}
                            </td>
                          )}
                          {visibleColumns.includes('upi') && (
                            <td className="text-right">₹{formatValue(row.upi)}</td>
                          )}
                          {visibleColumns.includes('card') && (
                            <td className="text-right">₹{formatValue(row.card)}</td>
                          )}
                          {visibleColumns.includes('totalCollection') && (
                            <td className="text-right bill-amount">₹{formatValue(calculatedTotal)}</td>
                          )}
                          {visibleColumns.includes('netAmount') && (
                            <td className="text-right bill-amount">₹{formatValue(netAmount)}</td>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td className="text-left" style={{ fontWeight: 'bold' }}>
                      TOTAL
                    </td>
                    {visibleColumns.includes('branchName') && <td></td>}
                    {visibleColumns.includes('verification') && <td></td>}
                    {visibleColumns.includes('systemSales') && (
                      <td className="text-right">
                        <div className="bill-amount">₹{formatValue(filteredTotals.systemSales)}</div>
                        <div className="bill-count">({filteredTotals.totalBills} Bills)</div>
                      </td>
                    )}
                    {visibleColumns.includes('manualSales') && (
                      <td className="text-right">₹{formatValue(filteredTotals.manualSales)}</td>
                    )}
                    {visibleColumns.includes('onlineSales') && (
                      <td className="text-right">₹{formatValue(filteredTotals.onlineSales)}</td>
                    )}
                    {visibleColumns.includes('totalSales') && (
                      <td className="text-right bill-amount">₹{formatValue(filteredTotals.totalSales)}</td>
                    )}
                    {visibleColumns.includes('salesDiff') && (
                      <td className="text-right">
                        {(() => {
                          const diff = filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card - filteredTotals.totalSales
                          return (
                            <span className={`sales-diff-value ${diff >= 0 ? 'positive' : 'negative'}`}>
                              {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(diff)}
                            </span>
                          )
                        })()}
                      </td>
                    )}
                    {visibleColumns.includes('expenses') && (
                      <td className="text-right">₹{formatValue(filteredTotals.expenses)}</td>
                    )}
                    {visibleColumns.includes('cash') && (
                      <td className="text-right">₹{formatValue(filteredTotals.cash)}</td>
                    )}
                    {visibleColumns.includes('upi') && (
                      <td className="text-right">₹{formatValue(filteredTotals.upi)}</td>
                    )}
                    {visibleColumns.includes('card') && (
                      <td className="text-right">₹{formatValue(filteredTotals.card)}</td>
                    )}
                    {visibleColumns.includes('totalCollection') && (
                      <td className="text-right bill-amount">
                        ₹{formatValue(filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card)}
                      </td>
                    )}
                    {visibleColumns.includes('netAmount') && (
                      <td className="text-right bill-amount">
                        ₹{formatValue(filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card - filteredTotals.totalSales)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
              {displayStats.length > pageSize && (
                <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)', textAlign: 'right' }}>
                  Showing {pageSize} of {displayStats.length} entries
                </div>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }} className="center-cell">S.NO</th>
                    {visibleColumns.includes('branchName') && <th>BRANCH</th>}
                    {visibleColumns.includes('verification') && <th className="center-cell" style={{ textAlign: 'center', minWidth: '150px' }}>VERIFICATION</th>}
                    <th>CLOSING NO</th>
                    <th>DATE & TIME</th>
                    {visibleColumns.includes('systemSales') && <th className="text-right">SYSTEM BILLS</th>}
                    {visibleColumns.includes('manualSales') && <th className="text-right">MANUAL BILLS</th>}
                    {visibleColumns.includes('onlineSales') && <th className="text-right">ONLINE BILLS</th>}
                    {visibleColumns.includes('totalSales') && <th className="text-right">TOTAL SALES</th>}
                    {visibleColumns.includes('salesDiff') && <th className="text-right">SALES DIF</th>}
                    {visibleColumns.includes('expenses') && <th className="text-right">EXPENSES</th>}
                    {visibleColumns.includes('cash') && <th className="text-right">CASH</th>}
                    {visibleColumns.includes('upi') && <th className="text-right">UPI</th>}
                    {visibleColumns.includes('card') && <th className="text-right">CARD</th>}
                    {visibleColumns.includes('totalCollection') && <th className="text-right">TOTAL COLLECTION</th>}
                    {visibleColumns.includes('netAmount') && <th className="text-right">NET AMOUNT</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let entryIndex = 0
                    const rows: React.ReactNode[] = []

                    filteredStats?.forEach((row) => {
                      if (!row.entries || row.entries.length === 0) return

                      row.entries.forEach((entry, i) => {
                        entryIndex++
                        const entryCollectionTotal =
                          (entry.expenses || 0) + (entry.cash || 0) + (entry.upi || 0) + (entry.card || 0)
                        const salesDiff = entryCollectionTotal - entry.totalSales
                        const isNegativeDiffEntryRow = salesDiff < 0
                        const isPositiveDiffEntryRow = salesDiff > 0

                        const parts = entry.closingNumber.split('-')
                        const displayNo =
                          parts.length >= 4
                            ? `${parts[0]}-${parts[parts.length - 1]}`
                            : entry.closingNumber

                        const entryDate = new Date(entry.createdAt)

                        rows.push(
                          <tr
                            key={`${row.branchName}-entry-${i}`}
                            className={`${isNegativeDiffEntryRow ? 'negative-diff-row' : ''} ${isPositiveDiffEntryRow ? 'positive-diff-row' : ''}`}
                          >
                            <td className="center-cell">{entryIndex}</td>
                            {visibleColumns.includes('branchName') && (
                              <td>
                                <div className="branch-title">{row.branchName.toUpperCase()}</div>
                              </td>
                            )}
                            {visibleColumns.includes('verification') && (
                              <td className="center-cell" style={{ textAlign: 'center' }}>
                                {userRole === 'account' ? (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <button
                                      type="button"
                                      className={`ver-role-action-btn ver-${entry.verification?.accountant?.status || 'pending'}`}
                                      onClick={() => openVerificationModal(entry, row.branchName)}
                                      title={entry.verification?.accountant?.notes ? `Accountant Note: ${entry.verification.accountant.notes}` : 'Click to Verify (Accountant)'}
                                    >
                                      {entry.verification?.accountant?.status === 'verified' ? '✓ Verified (Acc)' :
                                       entry.verification?.accountant?.status === 'rejected' ? '✕ Rejected (Acc)' :
                                       entry.verification?.accountant?.status === 'skipped' ? '↷ Skipped (Acc)' : 'Verify (Acc)'}
                                    </button>
                                    {entry.verification?.accountant?.notes && (
                                      <span
                                        className="ver-note-icon-btn"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openVerificationModal(entry, row.branchName)
                                        }}
                                        title={`Accountant Note: ${entry.verification.accountant.notes}`}
                                      >
                                        <Mail size={14} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                      </span>
                                    )}
                                  </div>
                                ) : userRole === 'watcher' ? (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <button
                                      type="button"
                                      className={`ver-role-action-btn ver-${entry.verification?.watcher?.status || 'pending'}`}
                                      onClick={() => openVerificationModal(entry, row.branchName)}
                                      title={entry.verification?.watcher?.notes ? `Watcher Note: ${entry.verification.watcher.notes}` : 'Click to Verify (Watcher)'}
                                    >
                                      {entry.verification?.watcher?.status === 'verified' ? '✓ Verified (Wat)' :
                                       entry.verification?.watcher?.status === 'rejected' ? '✕ Rejected (Wat)' :
                                       entry.verification?.watcher?.status === 'skipped' ? '↷ Skipped (Wat)' : 'Verify (Wat)'}
                                    </button>
                                    {entry.verification?.watcher?.notes && (
                                      <span
                                        className="ver-note-icon-btn"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openVerificationModal(entry, row.branchName)
                                        }}
                                        title={`Watcher Note: ${entry.verification.watcher.notes}`}
                                      >
                                        <Mail size={14} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                      </span>
                                    )}
                                  </div>
                                ) : userRole === 'manager' ? (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <button
                                      type="button"
                                      className={`ver-role-action-btn ver-${entry.verification?.manager?.status || 'pending'}`}
                                      onClick={() => openVerificationModal(entry, row.branchName)}
                                      title={entry.verification?.manager?.notes ? `Manager Note: ${entry.verification.manager.notes}` : 'Click to Verify (Manager)'}
                                    >
                                      {entry.verification?.manager?.status === 'verified' ? '✓ Verified (Mgr)' :
                                       entry.verification?.manager?.status === 'rejected' ? '✕ Rejected (Mgr)' :
                                       entry.verification?.manager?.status === 'skipped' ? '↷ Skipped (Mgr)' : 'Verify (Mgr)'}
                                    </button>
                                    {entry.verification?.manager?.notes && (
                                      <span
                                        className="ver-note-icon-btn"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openVerificationModal(entry, row.branchName)
                                        }}
                                        title={`Manager Note: ${entry.verification.manager.notes}`}
                                      >
                                        <Mail size={14} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    className="verification-cell-container"
                                    onClick={() => openVerificationModal(entry, row.branchName)}
                                    title="Click to view/update 3-Step Verification details"
                                  >
                                    <div className="verification-chips" style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', justifyContent: 'center' }}>
                                      {/* Step 1: Manager */}
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <span
                                          className={`ver-chip ver-${entry.verification?.manager?.status || 'pending'} ${!verificationSettings.requireManager ? 'ver-disabled' : ''}`}
                                          title={`Manager Step: ${entry.verification?.manager?.status || 'pending'}${entry.verification?.manager?.notes ? ` - ${entry.verification.manager.notes}` : ''}`}
                                        >
                                          {entry.verification?.manager?.status === 'verified' ? '✓' : entry.verification?.manager?.status === 'rejected' ? '✕' : entry.verification?.manager?.status === 'skipped' ? '↷' : '○'} Mgr
                                        </span>
                                        {Boolean(entry.verification?.manager?.notes?.trim()) && (
                                          <span
                                            className="ver-note-icon-btn"
                                            title={`Manager Note: ${entry.verification?.manager?.notes}`}
                                          >
                                            <Mail size={12} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                          </span>
                                        )}
                                      </div>
                                      {/* Step 2: Accountant */}
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <span
                                          className={`ver-chip ver-${entry.verification?.accountant?.status || 'pending'} ${!verificationSettings.requireAccountant ? 'ver-disabled' : ''}`}
                                          title={`Accountant Step: ${entry.verification?.accountant?.status || 'pending'}${entry.verification?.accountant?.verifiedByName ? ` (${entry.verification.accountant.verifiedByName})` : ''}`}
                                        >
                                          {entry.verification?.accountant?.status === 'verified' ? '✓' : entry.verification?.accountant?.status === 'rejected' ? '✕' : entry.verification?.accountant?.status === 'skipped' ? '↷' : '○'} Acc
                                        </span>
                                        {Boolean(entry.verification?.accountant?.notes?.trim()) && (
                                          <span
                                            className="ver-note-icon-btn"
                                            title={`Accountant Note: ${entry.verification?.accountant?.notes}`}
                                          >
                                            <Mail size={12} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                          </span>
                                        )}
                                      </div>
                                      {/* Step 3: Watcher */}
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <span
                                          className={`ver-chip ver-${entry.verification?.watcher?.status || 'pending'} ${!verificationSettings.requireWatcher ? 'ver-disabled' : ''}`}
                                          title={`Watcher Step: ${entry.verification?.watcher?.status || 'pending'}${entry.verification?.watcher?.notes ? ` - ${entry.verification.watcher.notes}` : ''}`}
                                        >
                                          {entry.verification?.watcher?.status === 'verified' ? '✓' : entry.verification?.watcher?.status === 'rejected' ? '✕' : entry.verification?.watcher?.status === 'skipped' ? '↷' : '○'} Wat
                                        </span>
                                        {Boolean(entry.verification?.watcher?.notes?.trim()) && (
                                          <span
                                            className="ver-note-icon-btn"
                                            title={`Watcher Note: ${entry.verification?.watcher?.notes}`}
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
                            <td className="center-cell">
                              <span className="closing-tag">#{displayNo}</span>
                            </td>
                            <td>
                              <div>{entryDate.toLocaleDateString()}</div>
                              <div className="bill-count">
                                {entryDate.toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </div>
                            </td>
                            {visibleColumns.includes('systemSales') && (
                              <td className="text-right">₹{formatValue(entry.systemSales)}</td>
                            )}
                            {visibleColumns.includes('manualSales') && (
                              <td className="text-right">₹{formatValue(entry.manualSales)}</td>
                            )}
                            {visibleColumns.includes('onlineSales') && (
                              <td className="text-right">₹{formatValue(entry.onlineSales)}</td>
                            )}
                            {visibleColumns.includes('totalSales') && (
                              <td className="text-right bill-amount">₹{formatValue(entry.totalSales)}</td>
                            )}
                            {visibleColumns.includes('salesDiff') && (
                              <td className="text-right">
                                <span className={`sales-diff-value ${salesDiff >= 0 ? 'positive' : 'negative'}`}>
                                  {salesDiff > 0 ? '↑' : salesDiff < 0 ? '↓' : ''} ₹{formatValue(salesDiff)}
                                </span>
                              </td>
                            )}
                            {visibleColumns.includes('expenses') && (
                              <td
                                className="text-right clickable"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpensePopupData({
                                    title: `Expenses - ${displayNo}`,
                                    details: entry.expenseDetails || [],
                                  })
                                }}
                                title="Click to view expenses breakdown"
                              >
                                ₹{formatValue(entry.expenses)}
                              </td>
                            )}
                            {visibleColumns.includes('cash') && (
                              <td
                                className="text-right clickable"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCashPopupData({
                                    title: `Cash Denominations - ${displayNo}`,
                                    denominations: entry.denominations || {
                                      count2000: 0,
                                      count500: 0,
                                      count200: 0,
                                      count100: 0,
                                      count50: 0,
                                      count10: 0,
                                      count5: 0,
                                    },
                                  })
                                }}
                                title="Click to view cash denominations"
                              >
                                ₹{formatValue(entry.cash)}
                              </td>
                            )}
                            {visibleColumns.includes('upi') && (
                              <td className="text-right">₹{formatValue(entry.upi)}</td>
                            )}
                            {visibleColumns.includes('card') && (
                              <td className="text-right">₹{formatValue(entry.card)}</td>
                            )}
                            {visibleColumns.includes('totalCollection') && (
                              <td className="text-right bill-amount">₹{formatValue(entryCollectionTotal)}</td>
                            )}
                            {visibleColumns.includes('netAmount') && (
                              <td className="text-right bill-amount">₹{formatValue(salesDiff)}</td>
                            )}
                          </tr>
                        )
                      })
                    })

                    if (rows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={16} className="center-cell" style={{ padding: '24px', opacity: 0.6 }}>
                            No detailed closing entries found for the selected filters.
                          </td>
                        </tr>
                      )
                    }

                    return rows.slice(0, pageSize)
                  })()}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td colSpan={3} className="text-left" style={{ fontWeight: 'bold' }}>
                      TOTAL
                    </td>
                    <td></td>
                    <td></td>
                    {visibleColumns.includes('systemSales') && (
                      <td className="text-right">₹{formatValue(filteredTotals.systemSales)}</td>
                    )}
                    {visibleColumns.includes('manualSales') && (
                      <td className="text-right">₹{formatValue(filteredTotals.manualSales)}</td>
                    )}
                    {visibleColumns.includes('onlineSales') && (
                      <td className="text-right">₹{formatValue(filteredTotals.onlineSales)}</td>
                    )}
                    {visibleColumns.includes('totalSales') && (
                      <td className="text-right bill-amount">₹{formatValue(filteredTotals.totalSales)}</td>
                    )}
                    {visibleColumns.includes('salesDiff') && (
                      <td className="text-right">
                        {(() => {
                          const diff = filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card - filteredTotals.totalSales
                          return (
                            <span className={`sales-diff-value ${diff >= 0 ? 'positive' : 'negative'}`}>
                              {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(diff)}
                            </span>
                          )
                        })()}
                      </td>
                    )}
                    {visibleColumns.includes('expenses') && (
                      <td className="text-right">₹{formatValue(filteredTotals.expenses)}</td>
                    )}
                    {visibleColumns.includes('cash') && (
                      <td className="text-right">₹{formatValue(filteredTotals.cash)}</td>
                    )}
                    {visibleColumns.includes('upi') && (
                      <td className="text-right">₹{formatValue(filteredTotals.upi)}</td>
                    )}
                    {visibleColumns.includes('card') && (
                      <td className="text-right">₹{formatValue(filteredTotals.card)}</td>
                    )}
                    {visibleColumns.includes('totalCollection') && (
                      <td className="text-right bill-amount">
                        ₹{formatValue(filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card)}
                      </td>
                    )}
                    {visibleColumns.includes('netAmount') && (
                      <td className="text-right bill-amount">
                        ₹{formatValue(filteredTotals.expenses + filteredTotals.cash + filteredTotals.upi + filteredTotals.card - filteredTotals.totalSales)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
              {(() => {
                let totalCount = 0
                filteredStats?.forEach((r) => { totalCount += r.entries?.length || 0 })
                return totalCount > pageSize ? (
                  <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)', textAlign: 'right' }}>
                    Showing {pageSize} of {totalCount} entries
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* Comparison Table Section */}
          <div className="comparison-section" style={{ marginTop: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, color: 'var(--theme-text-primary)' }}>
                  Payment Method Comparison (System vs Manual)
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--theme-text-secondary)', margin: '4px 0 0 0' }}>
                  Compare system-tracked payments from customer bills against the manual entry provided by the branch staff.
                </p>
              </div>
            </div>

            <div className="table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '50px' }} className="center-cell">S.NO</th>
                    <th rowSpan={2}>BRANCH / CLOSING</th>
                    <th colSpan={3} className="center-cell text-center" style={{ textAlign: 'center', background: 'rgba(22, 163, 74, 0.05)', color: '#4caf50', borderBottom: '2px solid rgba(22, 163, 74, 0.2)' }}>CASH</th>
                    <th colSpan={3} className="center-cell text-center" style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)', color: '#2196f3', borderBottom: '2px solid rgba(59, 130, 246, 0.2)' }}>UPI</th>
                    <th colSpan={3} className="center-cell text-center" style={{ textAlign: 'center', background: 'rgba(139, 92, 246, 0.05)', color: '#9c27b0', borderBottom: '2px solid rgba(139, 92, 246, 0.2)' }}>CARD</th>
                  </tr>
                  <tr>
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>SYSTEM</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>MANUAL</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>DIFF</th>
                    
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>SYSTEM</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>MANUAL</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>DIFF</th>
                    
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>SYSTEM</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', opacity: 0.8 }}>MANUAL</th>
                    <th className="text-right" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>DIFF</th>
                  </tr>
                </thead>
                <tbody>
                  {viewMode === 'combined' ? (
                    displayStats.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="center-cell" style={{ padding: '24px', opacity: 0.6, textAlign: 'center' }}>
                          No branch comparison data available.
                        </td>
                      </tr>
                    ) : (
                      displayStats.map((row, index) => {
                        const cashDiff = row.cash - row.systemCash
                        const upiDiff = row.upi - row.systemUpi
                        const cardDiff = row.card - row.systemCard

                        return (
                          <tr key={row.branchName}>
                            <td className="center-cell">{index + 1}</td>
                            <td>
                              <div className="branch-title">{row.branchName.toUpperCase()}</div>
                            </td>
                            {/* Cash column block */}
                            <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(row.systemCash)}</td>
                            <td className="text-right">₹{formatValue(row.cash)}</td>
                            <td className="text-right" style={{ fontWeight: 'bold' }}>
                              <span className={cashDiff === 0 ? 'text-muted' : cashDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                {cashDiff > 0 ? '↑' : cashDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(cashDiff))}
                              </span>
                            </td>
                            {/* UPI column block */}
                            <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(row.systemUpi)}</td>
                            <td className="text-right">₹{formatValue(row.upi)}</td>
                            <td className="text-right" style={{ fontWeight: 'bold' }}>
                              <span className={upiDiff === 0 ? 'text-muted' : upiDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                {upiDiff > 0 ? '↑' : upiDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(upiDiff))}
                              </span>
                            </td>
                            {/* Card column block */}
                            <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(row.systemCard)}</td>
                            <td className="text-right">₹{formatValue(row.card)}</td>
                            <td className="text-right" style={{ fontWeight: 'bold' }}>
                              <span className={cardDiff === 0 ? 'text-muted' : cardDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                {cardDiff > 0 ? '↑' : cardDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(cardDiff))}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )
                  ) : (
                    (() => {
                      let entryIndex = 0
                      const rows: React.ReactNode[] = []

                      filteredStats?.forEach((row) => {
                        if (!row.entries || row.entries.length === 0) return

                        row.entries.forEach((entry, i) => {
                          entryIndex++
                          const cashDiff = entry.cash - entry.systemCash
                          const upiDiff = entry.upi - entry.systemUpi
                          const cardDiff = entry.card - entry.systemCard

                          const parts = entry.closingNumber.split('-')
                          const displayNo = parts.length >= 4 ? `${parts[0]}-${parts[parts.length - 1]}` : entry.closingNumber

                          rows.push(
                            <tr key={`${row.branchName}-comp-entry-${i}`}>
                              <td className="center-cell">{entryIndex}</td>
                              <td>
                                <div className="branch-title">{row.branchName.toUpperCase()}</div>
                                <div className="branch-subtext">#{displayNo}</div>
                              </td>
                              {/* Cash column block */}
                              <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(entry.systemCash)}</td>
                              <td className="text-right">₹{formatValue(entry.cash)}</td>
                              <td className="text-right" style={{ fontWeight: 'bold' }}>
                                <span className={cashDiff === 0 ? 'text-muted' : cashDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                  {cashDiff > 0 ? '↑' : cashDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(cashDiff))}
                                </span>
                              </td>
                              {/* UPI column block */}
                              <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(entry.systemUpi)}</td>
                              <td className="text-right">₹{formatValue(entry.upi)}</td>
                              <td className="text-right" style={{ fontWeight: 'bold' }}>
                                <span className={upiDiff === 0 ? 'text-muted' : upiDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                  {upiDiff > 0 ? '↑' : upiDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(upiDiff))}
                                </span>
                              </td>
                              {/* Card column block */}
                              <td className="text-right" style={{ color: 'var(--theme-text-secondary)' }}>₹{formatValue(entry.systemCard)}</td>
                              <td className="text-right">₹{formatValue(entry.card)}</td>
                              <td className="text-right" style={{ fontWeight: 'bold' }}>
                                <span className={cardDiff === 0 ? 'text-muted' : cardDiff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                                  {cardDiff > 0 ? '↑' : cardDiff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(cardDiff))}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      })

                      if (rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={11} className="center-cell" style={{ padding: '24px', opacity: 0.6, textAlign: 'center' }}>
                              No detailed comparison data available.
                            </td>
                          </tr>
                        )
                      }
                      return rows
                    })()
                  )}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td colSpan={2} className="text-left" style={{ fontWeight: 'bold' }}>TOTAL</td>
                    <td></td>
                    {/* Cash totals */}
                    <td className="text-right">₹{formatValue(filteredTotals.systemCash)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.cash)}</td>
                    <td className="text-right" style={{ fontWeight: 'bold' }}>
                      {(() => {
                        const diff = filteredTotals.cash - filteredTotals.systemCash
                        return (
                          <span className={diff === 0 ? '' : diff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(diff))}
                          </span>
                        )
                      })()}
                    </td>
                    {/* UPI totals */}
                    <td className="text-right">₹{formatValue(filteredTotals.systemUpi)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.upi)}</td>
                    <td className="text-right" style={{ fontWeight: 'bold' }}>
                      {(() => {
                        const diff = filteredTotals.upi - filteredTotals.systemUpi
                        return (
                          <span className={diff === 0 ? '' : diff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(diff))}
                          </span>
                        )
                      })()}
                    </td>
                    {/* Card totals */}
                    <td className="text-right">₹{formatValue(filteredTotals.systemCard)}</td>
                    <td className="text-right">₹{formatValue(filteredTotals.card)}</td>
                    <td className="text-right" style={{ fontWeight: 'bold' }}>
                      {(() => {
                        const diff = filteredTotals.card - filteredTotals.systemCard
                        return (
                          <span className={diff === 0 ? '' : diff > 0 ? 'sales-diff-value positive' : 'sales-diff-value negative'}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ₹{formatValue(Math.abs(diff))}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
      {expensePopupData && (
        <div
          className="expense-popup-overlay"
          onClick={() => setExpensePopupData(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            className="expense-popup-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--theme-elevation-50)',
              padding: '24px',
              borderRadius: '12px',
              minWidth: '400px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--theme-elevation-200)',
                paddingBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0 }}>{expensePopupData.title}</h3>
              <button
                onClick={() => setExpensePopupData(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                marginBottom: '16px',
                fontSize: '1.1rem',
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
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
              <span>
                {startDate ? startDate.toLocaleDateString() : ''} -{' '}
                {endDate ? endDate.toLocaleDateString() : ''}
              </span>
            </div>
            <div
              style={{
                maxHeight: '60vh',
                overflowY: 'auto',
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: '8px',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--theme-elevation-100)',
                    zIndex: 1,
                  }}
                >
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-200)',
                      }}
                    >
                      Category
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-200)',
                      }}
                    >
                      Reason
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-200)',
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        textAlign: 'center',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-200)',
                        width: '60px',
                      }}
                    >
                      IMG
                    </th>
                    <th style={{ textAlign: 'center', padding: '12px', width: '80px' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {expensePopupData.details.length > 0 ? (
                    expensePopupData.details.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--theme-elevation-250)' }}>
                        <td
                          style={{
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          {d.category}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          {d.reason}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          ₹{formatValue(d.amount)}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          {d.imageUrl ? (
                            <a
                              href={d.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#3b82f6',
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                              title="View Proof"
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
                            </a>
                          ) : (
                            <div
                              style={{
                                color: 'var(--theme-elevation-400)',
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                              title="No Proof"
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
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                              </svg>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px' }}>
                          {new Date(d.date).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}
                      >
                        No detailed expenses recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
                {expensePopupData.details.length > 0 && (
                  <tfoot
                    style={{
                      position: 'sticky',
                      bottom: 0,
                      backgroundColor: 'var(--theme-elevation-100)',
                      zIndex: 1,
                    }}
                  >
                    <tr style={{ fontWeight: 'bold' }}>
                      <td
                        colSpan={2}
                        style={{
                          padding: '12px',
                          borderRight: '1px solid var(--theme-elevation-250)',
                          borderTop: '1px solid var(--theme-elevation-250)',
                        }}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--theme-elevation-250)',
                          borderTop: '1px solid var(--theme-elevation-250)',
                        }}
                      >
                        ₹{formatValue(expensePopupData.details.reduce((s, d) => s + d.amount, 0))}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          borderTop: '1px solid var(--theme-elevation-250)',
                          borderRight: '1px solid var(--theme-elevation-250)',
                        }}
                      ></td>
                      <td
                        style={{
                          padding: '12px',
                          borderTop: '1px solid var(--theme-elevation-250)',
                        }}
                      ></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {cashPopupData && (
        <div
          className="modal-overlay"
          onClick={() => setCashPopupData(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--theme-elevation-100)',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              color: 'var(--theme-elevation-800)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ margin: 0 }}>{cashPopupData.title}</h3>
              <button
                onClick={() => setCashPopupData(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                marginBottom: '16px',
                fontSize: '1.1rem',
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
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
              <span>
                {startDate ? startDate.toLocaleDateString() : ''} -{' '}
                {endDate ? endDate.toLocaleDateString() : ''}
              </span>
            </div>
            <div
              style={{
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead
                  style={{
                    backgroundColor: 'var(--theme-elevation-100)',
                    borderBottom: '1px solid var(--theme-elevation-250)',
                  }}
                >
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-250)',
                      }}
                    >
                      Denomination
                    </th>
                    <th
                      style={{
                        textAlign: 'center',
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-250)',
                      }}
                    >
                      Count
                    </th>
                    <th style={{ textAlign: 'right', padding: '12px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[2000, 500, 200, 100, 50, 10, 5].map((val) => {
                    const count =
                      cashPopupData.denominations[`count${val}` as keyof Denominations] || 0

                    if (count === 0) return null
                    return (
                      <tr
                        key={val}
                        style={{ borderBottom: '1px solid var(--theme-elevation-250)' }}
                      >
                        <td
                          style={{
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-250)',
                          }}
                        >
                          ₹{val}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '12px',
                            borderRight: '1px solid var(--theme-elevation-200)',
                          }}
                        >
                          {count}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px', fontWeight: 'bold' }}>
                          ₹{formatValue(val * count)}
                        </td>
                      </tr>
                    )
                  })}
                  {!Object.values(cashPopupData.denominations).some((v) => v > 0) && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}
                      >
                        No denominations recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot
                  style={{ backgroundColor: 'var(--theme-elevation-100)', fontWeight: 'bold' }}
                >
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: '12px',
                        borderRight: '1px solid var(--theme-elevation-250)',
                        borderTop: '1px solid var(--theme-elevation-250)',
                      }}
                    >
                      Total Cash
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '12px',
                        borderTop: '1px solid var(--theme-elevation-250)',
                      }}
                    >
                      ₹
                      {formatValue(
                        ([2000, 500, 200, 100, 50, 10, 5] as const).reduce(
                          (sum, val) =>
                            sum +
                            val *
                              (cashPopupData.denominations[`count${val}` as keyof Denominations] ||
                                0),
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}



      {notesPopupData && (
        <div
          className="modal-overlay"
          onClick={() => setNotesPopupData(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--theme-elevation-100)',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              color: 'var(--theme-text-primary, #fff)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid var(--theme-elevation-200)',
                paddingBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0 }}>{notesPopupData.title}</h3>
              <button
                onClick={() => setNotesPopupData(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                maxHeight: '60vh',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {notesPopupData.entries.map((entry) => {
                const parts = entry.closingNumber.split('-')
                const displayNo = parts.length >= 4 ? `${parts[0]}-${parts[parts.length - 1]}` : entry.closingNumber
                const dateStr = new Date(entry.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <div
                    key={entry.id}
                    style={{
                      marginBottom: '20px',
                      padding: '12px',
                      background: 'var(--theme-elevation-50)',
                      borderRadius: '8px',
                      border: '1px solid var(--theme-elevation-200)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
                      <span style={{ fontWeight: 600 }}>#{displayNo}</span>
                      <span>{dateStr}</span>
                    </div>
                    <textarea
                      defaultValue={entry.notes}
                      placeholder="Write notes about this closing entry here..."
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--theme-elevation-0)',
                        border: '1px solid var(--theme-elevation-250)',
                        color: 'var(--theme-text-primary, #fff)',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        outline: 'none',
                      }}
                      onBlur={(e) => {
                        // Optimistically store updated text locally on blur so we can read it on save
                        entry.notes = e.target.value
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        onClick={() => handleSaveNote(entry.id, entry.notes)}
                        disabled={savingNotesId === entry.id}
                        style={{
                          backgroundColor: '#2e7d32',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {savingNotesId === entry.id ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--theme-elevation-200)', paddingTop: '12px' }}>
              <button
                onClick={() => setNotesPopupData(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--theme-elevation-300)',
                  color: 'var(--theme-text-secondary)',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Step Verification Dialog Modal */}
      {showVerificationModal && verificationModalEntry && (
        <div className="materials-modal-overlay" onClick={() => setShowVerificationModal(false)} role="presentation" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Closing Entry 3-Step Verification</h3>
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

            {/* Entry Info Summary */}
            <div style={{ background: 'var(--theme-elevation-50)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Branch:</span>
                <strong>{verificationModalEntry.branchName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Closing No:</span>
                <strong>{verificationModalEntry.entry.closingNumber}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Total Sales:</span>
                <strong style={{ color: '#10b981' }}>₹{formatValue(verificationModalEntry.entry.totalSales)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Overall Status:</span>
                <strong style={{ textTransform: 'capitalize' }}>{verificationModalEntry.entry.verification?.overallStatus || 'Pending'}</strong>
              </div>
            </div>

            {/* Step Selection Tabs (Admins or Multi-step overview) */}
            {isAdmin && (
              <div className="verification-step-tabs">
                {(['manager', 'accountant', 'watcher'] as const).map((stepKey) => {
                  const stepLabel = stepKey === 'manager' ? '1. Manager' : stepKey === 'accountant' ? '2. Accountant' : '3. Watcher'
                  const stepData = verificationModalEntry.entry.verification?.[stepKey]
                  const status = stepData?.status || 'pending'
                  const isRequired = stepKey === 'manager' ? verificationSettings.requireManager : stepKey === 'accountant' ? verificationSettings.requireAccountant : verificationSettings.requireWatcher

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
            {(['manager', 'accountant', 'watcher'] as const).map((stepKey) => {
              if (isAdmin && activeStepTab !== stepKey) return null
              if (!isAdmin) {
                if (userRole === 'manager' && stepKey !== 'manager') return null
                if (userRole === 'account' && stepKey !== 'accountant') return null
                if (userRole === 'watcher' && stepKey !== 'watcher') return null
              }

              const stepTitle = stepKey === 'manager' ? 'Step 1: Manager Approval & Verification' :
                                stepKey === 'accountant' ? 'Step 2: Accountant / Office Admin Verification' : 'Step 3: Watcher Verification'
              const stepData = verificationModalEntry.entry.verification?.[stepKey]
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
                      Updated by <strong>{stepData.verifiedByName}</strong> ({stepData.verifiedByRole || 'Admin'}) on {new Date(stepData.verifiedAt || '').toLocaleString()}
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
                        Skip Reason (required if skipping step):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Approved directly by management"
                        value={stepSkipReason[stepKey]}
                        onChange={(e) => setStepSkipReason({ ...stepSkipReason, [stepKey]: e.target.value })}
                        disabled={isSubmittingVerification}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--theme-elevation-250)',
                          background: 'var(--theme-elevation-0)',
                          color: 'var(--theme-text-primary)',
                          fontSize: '0.85rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}

                  {canEditThisStep && (
                    <div className="step-actions">
                      <button
                        type="button"
                        className="ver-btn ver-btn--reject"
                        disabled={isSubmittingVerification}
                        onClick={() => handleVerificationSubmit(verificationModalEntry.entry.id, stepKey, 'rejected')}
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="ver-btn ver-btn--skip"
                          disabled={isSubmittingVerification || !stepSkipReason[stepKey].trim()}
                          onClick={() => handleVerificationSubmit(verificationModalEntry.entry.id, stepKey, 'skipped')}
                          title={!stepSkipReason[stepKey].trim() ? 'Please provide a skip reason above' : 'Skip this verification step'}
                        >
                          <SkipForward size={14} />
                          Skip Step
                        </button>
                      )}
                      <button
                        type="button"
                        className="ver-btn ver-btn--approve"
                        disabled={isSubmittingVerification}
                        onClick={() => handleVerificationSubmit(verificationModalEntry.entry.id, stepKey, 'verified')}
                      >
                        <CheckCircle2 size={14} />
                        Verify & Sign Off
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--theme-elevation-200)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowVerificationModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--theme-elevation-250)',
                  color: 'var(--theme-text-secondary)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Verification Rules Settings Modal */}
      {showSettingsModal && (
        <div
          className="materials-modal-overlay"
          onClick={() => setShowSettingsModal(false)}
          role="presentation"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="modal-content"
            style={{
              padding: '2rem',
              background: 'var(--theme-elevation-100)',
              width: '90%',
              maxWidth: '520px',
              borderRadius: '12px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
              border: '1px solid var(--theme-elevation-200)',
              color: 'var(--theme-text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--theme-elevation-200)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚙️</span> Closing Entry Verification Rules
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowSettingsModal(false)}
                style={{ position: 'static', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--theme-text-secondary)' }}
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--theme-text-secondary)', marginBottom: '1.25rem' }}>
              Configure which verification steps are mandatory for closing entries.
            </p>

            {/* Effective From Date & Verification Flow */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'var(--theme-elevation-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--theme-elevation-200)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--theme-text-primary)', marginBottom: '6px' }}>
                  📅 Effective From Date:
                </label>
                <input
                  type="date"
                  value={tempSettings.effectiveFrom ? dayjs(tempSettings.effectiveFrom).format('YYYY-MM-DD') : ''}
                  onChange={(e) => setTempSettings({ ...tempSettings, effectiveFrom: e.target.value || null })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--theme-elevation-250)',
                    background: 'var(--theme-elevation-0)',
                    color: 'var(--theme-text-primary)',
                    fontSize: '0.9rem',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ background: 'var(--theme-elevation-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--theme-elevation-200)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--theme-text-primary)', marginBottom: '6px' }}>
                  🔀 Verification Flow:
                </label>
                <select
                  value={tempSettings.flowType || 'sequential'}
                  onChange={(e) => setTempSettings({ ...tempSettings, flowType: e.target.value as 'sequential' | 'any' })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--theme-elevation-250)',
                    background: 'var(--theme-elevation-0)',
                    color: 'var(--theme-text-primary)',
                    fontSize: '0.9rem',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="sequential">Sequential Order (Step 1 → 2 → 3)</option>
                  <option value="any">Any Order / Parallel</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '1.75rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  cursor: 'pointer',
                  background: 'var(--theme-elevation-50)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--theme-elevation-200)',
                }}
              >
                <input
                  type="checkbox"
                  checked={tempSettings.requireManager}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireManager: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--theme-text-primary)' }}>
                    Step 1: Manager Approval & Verification
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                    Requires final review and sign-off by Branch / Office Manager.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  cursor: 'pointer',
                  background: 'var(--theme-elevation-50)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--theme-elevation-200)',
                }}
              >
                <input
                  type="checkbox"
                  checked={tempSettings.requireAccountant}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireAccountant: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--theme-text-primary)' }}>
                    Step 2: Accountant / Office Admin Verification
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                    Requires verification by Accountant / Office Admin team.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  cursor: 'pointer',
                  background: 'var(--theme-elevation-50)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--theme-elevation-200)',
                }}
              >
                <input
                  type="checkbox"
                  checked={tempSettings.requireWatcher}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireWatcher: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--theme-text-primary)' }}>
                    Step 3: Watcher Verification
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                    Requires verification and audit sign-off by the Watcher team.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                disabled={isSavingSettings}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--theme-elevation-200)',
                  color: 'var(--theme-text-secondary)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVerificationSettings}
                disabled={isSavingSettings}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {isSavingSettings ? 'Saving...' : 'Save Verification Rules'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClosingEntryReport
