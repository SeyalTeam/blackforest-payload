'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import {
  ChevronDown,
  ChevronUp,
  Lock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  SkipForward,
  Mail,
} from 'lucide-react'
import { GoogleDateRangePicker } from '../RawMaterialBillingReport/GoogleDateRangePicker'
import './index.scss'
import Image from 'next/image'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type SelectOption = {
  value: string
  label: string
}

export type DealerReportProductItem = {
  name: string
  quantity?: number
  totalAmount?: number
  photoUrl?: string
}

export type DealerReportItem = {
  id: string
  dealerName: string
  dealerAccountNumber?: string
  branchName?: string
  amount: number
  paidAmount?: number
  payments?: { amount: number; date: string }[]
  billCopyUrl?: string
  productsUrl?: string
  productsPhotoUrls?: string[]
  deliveryPersonPhotoUrl?: string
  time: string
  status: string
  plannedPaymentDate?: string
  products?: DealerReportProductItem[]
  notes?: string
  verification?: {
    overallStatus: 'pending' | 'partially_verified' | 'verified' | 'rejected'
    accountant?: {
      status?: 'pending' | 'verified' | 'rejected' | 'skipped'
      notes?: string
      verifiedByName?: string
      verifiedByRole?: string
      verifiedAt?: string
    }
    watcher?: {
      status?: 'pending' | 'verified' | 'rejected' | 'skipped'
      notes?: string
      verifiedByName?: string
      verifiedByRole?: string
      verifiedAt?: string
    }
    manager?: {
      status?: 'pending' | 'verified' | 'rejected' | 'skipped'
      notes?: string
      verifiedByName?: string
      verifiedByRole?: string
      verifiedAt?: string
    }
  }
}

export type BranchGroup = {
  _id: string
  branchName: string
  total: number
  count: number
  items: DealerReportItem[]
}

type ReportData = {
  startDate: string
  endDate: string
  groups: BranchGroup[]
  meta: {
    grandTotal: number
    totalCount: number
    plannedDatesWithBills?: string[]
  }
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

const ColumnValueContainer = ({ children, ...props }: ValueContainerProps<SelectOption, true>) => {
  const { getValue, selectProps } = props
  const selected = getValue()
  const total = selectProps.options ? (selectProps.options as any[]).length : 7
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

const customStyles = {
  control: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-50)',
    borderColor: 'var(--theme-elevation-200)',
    borderRadius: '8px',
    padding: '0 6px',
    minWidth: '190px',
    minHeight: '38px',
    height: '38px',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'var(--theme-elevation-400)',
    },
  }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '0 6px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
  }),
  indicatorsContainer: (base: any) => ({
    ...base,
    height: '36px',
  }),
  container: (base: any) => ({
    ...base,
    minWidth: '190px',
  }),
  menu: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-100)',
    border: '1px solid var(--theme-elevation-200)',
    zIndex: 99999,
  }),
  option: (base: any, state: any) => ({
    ...base,
    background: state.isFocused ? 'var(--theme-elevation-150)' : 'transparent',
    color: 'var(--theme-text-primary)',
    cursor: 'pointer',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    '&:active': {
      background: 'var(--theme-elevation-200)',
    },
  }),
  singleValue: (base: any) => ({
    ...base,
    color: 'var(--theme-text-primary)',
  }),
  placeholder: (base: any) => ({
    ...base,
    color: 'var(--theme-text-secondary)',
    fontSize: '0.88rem',
  }),
  input: (base: any) => ({
    ...base,
    color: 'var(--theme-text-primary)',
    margin: 0,
    padding: 0,
  }),
}

const customStatusStyles = {
  ...customStyles,
  control: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-50)',
    borderColor: 'var(--theme-elevation-200)',
    borderRadius: '8px',
    padding: '0 6px',
    minWidth: '150px',
    minHeight: '38px',
    height: '38px',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'var(--theme-elevation-400)',
    },
  }),
  container: (base: any) => ({
    ...base,
    minWidth: '150px',
  }),
}

const customColumnStyles = {
  ...customStyles,
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
  container: (base: any) => ({
    ...base,
    minWidth: '150px',
  }),
  menu: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-100)',
    border: '1px solid var(--theme-elevation-200)',
    zIndex: 99999,
    minWidth: '185px',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  }),
}

const toLocalDateStr = (date: Date | null): string => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD')
}

const DealerReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewProducts, setPreviewProducts] = useState<DealerReportProductItem[] | null>(null)
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [plannedDateRange, setPlannedDateRange] = useState<[Date | null, Date | null]>([null, null])
  const [plannedDatePreset, setPlannedDatePreset] = useState<string>('')
  const [tempPlannedDates, setTempPlannedDates] = useState<Record<string, string>>({})

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealers, setSelectedDealers] = useState<string[]>(['all'])
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'single' | 'combined'>('single')
  const [selectedVerificationFilter, setSelectedVerificationFilter] = useState<string>('all')

  const [showScrollBottom, setShowScrollBottom] = useState(true)
  const lastScrollY = useRef(0)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentModalItem, setPaymentModalItem] = useState<DealerReportItem | null>(null)
  const [paymentAmountInput, setPaymentAmountInput] = useState('')
  const [historyModalItem, setHistoryModalItem] = useState<DealerReportItem | null>(null)

  // Current user role & permissions
  const [userRole, setUserRole] = useState<string>('')
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'
  const isStoreKeeper = userRole === 'store_keeper'

  // Verification Settings Global state
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
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [tempSettings, setTempSettings] = useState(verificationSettings)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // 3-Step Verification Modal State
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationModalItem, setVerificationModalItem] = useState<DealerReportItem | null>(null)
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

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('other_products_visible_columns')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) return parsed
        }
      } catch {
        // ignore
      }
    }
    return [
      'branch',
      'bankAccount',
      'plannedPaymentDate',
      'notes',
      'history',
      'billCopy',
      'photos',
    ]
  })

  const handleVisibleColumnsChange = (cols: string[]) => {
    setVisibleColumns(cols)
    try {
      localStorage.setItem('other_products_visible_columns', JSON.stringify(cols))
    } catch {
      // ignore
    }
  }

  const columnOptions: SelectOption[] = React.useMemo(() => [
    { value: 'branch', label: 'Branch' },
    { value: 'bankAccount', label: 'Bank Acc No' },
    { value: 'plannedPaymentDate', label: 'Planned Pay Date' },
    ...(!isStoreKeeper ? [{ value: 'notes', label: 'Verification & Notes' }] : []),
    { value: 'history', label: 'History' },
    { value: 'billCopy', label: 'Bill Copy' },
    { value: 'photos', label: 'Photos' },
  ], [isStoreKeeper])

  // Fetch current user and verification settings
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const userRes = await fetch('/api/users/me')
        if (userRes.ok) {
          const json = await userRes.json()
          if (json && json.user) {
            setUserRole(json.user.role || '')
          }
        }
      } catch {
        // ignore
      }

      try {
        const sRes = await fetch('/api/reports/verification-settings')
        if (sRes.ok) {
          const sJson = await sRes.json()
          if (sJson.settings?.otherProducts) {
            setVerificationSettings(sJson.settings.otherProducts)
            setTempSettings(sJson.settings.otherProducts)
          }
        }
      } catch {
        // ignore
      }
    }
    fetchInitialData()
  }, [])

  const isBillFullyVerified = (item: DealerReportItem) => {
    if (verificationSettings.effectiveFrom) {
      const billDate = dayjs(item.time).tz('Asia/Kolkata').format('YYYY-MM-DD')
      const effDate = dayjs(verificationSettings.effectiveFrom).format('YYYY-MM-DD')
      if (billDate < effDate) {
        return true
      }
    }
    const ver = item.verification
    const reqAcc = verificationSettings.requireAccountant
    const reqWat = verificationSettings.requireWatcher
    const reqMgr = verificationSettings.requireManager

    const accOk = !reqAcc || ver?.accountant?.status === 'verified' || ver?.accountant?.status === 'skipped'
    const watOk = !reqWat || ver?.watcher?.status === 'verified' || ver?.watcher?.status === 'skipped'
    const mgrOk = !reqMgr || ver?.manager?.status === 'verified' || ver?.manager?.status === 'skipped'

    return accOk && watOk && mgrOk
  }

  const getPendingVerificationSteps = (item: DealerReportItem) => {
    if (verificationSettings.effectiveFrom) {
      const billDate = dayjs(item.time).tz('Asia/Kolkata').format('YYYY-MM-DD')
      const effDate = dayjs(verificationSettings.effectiveFrom).format('YYYY-MM-DD')
      if (billDate < effDate) {
        return []
      }
    }
    const pending: string[] = []
    const ver = item.verification
    if (verificationSettings.requireManager && ver?.manager?.status !== 'verified' && ver?.manager?.status !== 'skipped') {
      pending.push('Manager')
    }
    if (verificationSettings.requireAccountant && ver?.accountant?.status !== 'verified' && ver?.accountant?.status !== 'skipped') {
      pending.push('Accountant')
    }
    if (verificationSettings.requireWatcher && ver?.watcher?.status !== 'verified' && ver?.watcher?.status !== 'skipped') {
      pending.push('Watcher')
    }
    return pending
  }

  const openVerificationModal = (item: DealerReportItem) => {
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

    if (userRole === 'manager') {
      setActiveStepTab('manager')
    } else if (userRole === 'account') {
      setActiveStepTab('accountant')
    } else if (userRole === 'watcher') {
      setActiveStepTab('watcher')
    } else {
      const ver = item.verification
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
    billId: string,
    step: 'accountant' | 'watcher' | 'manager',
    status: 'verified' | 'rejected' | 'skipped',
  ) => {
    setIsSubmittingVerification(true)
    try {
      const notesText = stepNotes[step]
      const skipReasonText = stepSkipReason[step]
      const res = await fetch('/api/dealer-billings/update-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
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
            if (i.id === billId) {
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

      if (verificationModalItem && verificationModalItem.id === billId) {
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
          otherProducts: tempSettings,
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

  const handlePaymentUpdate = async (id: string, newPaidAmount: number, targetItem?: DealerReportItem) => {
    try {
      const item = targetItem || allItems.find((x) => x.id === id)
      if (!item) throw new Error('Item not found')

      const fullyVerified = isBillFullyVerified(item)
      if (!fullyVerified && !isAdmin) {
        const pendingSteps = getPendingVerificationSteps(item)
        alert(
          `Payment cannot be processed. The following verification steps are pending: ${pendingSteps.join(
            ', ',
          )}. Please complete them or have an admin skip them.`,
        )
        return
      }

      const itemTotal = item.amount
      const currentPaid = item.paidAmount || 0
      const amountToRecord = newPaidAmount - currentPaid

      if (amountToRecord <= 0) {
        throw new Error('Recorded amount must be greater than zero')
      }

      const newStatus = newPaidAmount >= itemTotal ? 'paid' : 'pending'

      // Construct new payments array
      let currentPayments = item.payments || []
      if (currentPayments.length === 0 && currentPaid > 0) {
        currentPayments = [{ amount: currentPaid, date: item.time || new Date().toISOString() }]
      }
      const newPaymentEntry = {
        amount: amountToRecord,
        date: new Date().toISOString(),
      }
      const updatedPayments = [...currentPayments, newPaymentEntry]

      const res = await fetch(`/api/dealer-billings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payments: updatedPayments,
          paidAmount: newPaidAmount,
          status: newStatus,
        }),
      })
      if (!res.ok) throw new Error(`Failed to update payment (HTTP ${res.status})`)

      if (data) {
        const updatedGroups = data.groups.map((group) => {
          const updatedItems = group.items.map((i) => {
            if (i.id === id) {
              return {
                ...i,
                paidAmount: newPaidAmount,
                status: newStatus,
                payments: updatedPayments,
              }
            }
            return i
          })
          return { ...group, items: updatedItems }
        })
        setData({ ...data, groups: updatedGroups })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update payment')
      throw err
    }
  }

  const handlePlannedDateUpdate = async (id: string, dateStr: string) => {
    try {
      const res = await fetch(`/api/dealer-billings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plannedPaymentDate: dateStr || null,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errMsg = errData.errors?.[0]?.message || errData.message || `HTTP ${res.status}`
        throw new Error(`Failed to update planned date: ${errMsg}`)
      }

      if (data) {
        const updatedGroups = data.groups.map((group) => {
          const updatedItems = group.items.map((i) => {
            if (i.id === id) {
              return {
                ...i,
                plannedPaymentDate: dateStr || undefined,
              }
            }
            return i
          })
          return { ...group, items: updatedItems }
        })
        setData({ ...data, groups: updatedGroups })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update planned date')
    }
  }

  const allItems = useMemo(() => {
    if (!data) return []
    const items: (DealerReportItem & { branchName: string })[] = []
    data.groups.forEach((group) => {
      group.items.forEach((item) => {
        if (selectedStatus !== 'all' && item.status !== selectedStatus) {
          return
        }

        // Verification filter logic
        if (selectedVerificationFilter !== 'all') {
          const ver = item.verification
          const overall = ver?.overallStatus || 'pending'
          const acc = ver?.accountant?.status || 'pending'
          const wat = ver?.watcher?.status || 'pending'
          const mgr = ver?.manager?.status || 'pending'

          if (selectedVerificationFilter === 'verified') {
            if (!isBillFullyVerified(item)) return
          } else if (selectedVerificationFilter === 'partially_verified') {
            if (overall !== 'partially_verified') return
          } else if (selectedVerificationFilter === 'pending') {
            if (isBillFullyVerified(item) || overall === 'rejected') return
          } else if (selectedVerificationFilter === 'accountant_pending') {
            if (acc === 'verified' || acc === 'skipped') return
          } else if (selectedVerificationFilter === 'watcher_pending') {
            if (wat === 'verified' || wat === 'skipped') return
          } else if (selectedVerificationFilter === 'manager_pending') {
            if (mgr === 'verified' || mgr === 'skipped') return
          } else if (selectedVerificationFilter === 'rejected') {
            if (overall !== 'rejected' && acc !== 'rejected' && wat !== 'rejected' && mgr !== 'rejected') return
          } else if (selectedVerificationFilter === 'skipped') {
            if (acc !== 'skipped' && wat !== 'skipped' && mgr !== 'skipped') return
          }
        }

        items.push({
          ...item,
          branchName: group.branchName,
        })
      })
    })
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [data, selectedStatus, selectedVerificationFilter, verificationSettings])

  const plannedDatesWithBills = useMemo(() => {
    const dates = new Set<string>()

    if (data?.meta?.plannedDatesWithBills) {
      data.meta.plannedDatesWithBills.forEach((d) => dates.add(d))
    }

    if (data?.groups) {
      data.groups.forEach((group) => {
        group.items.forEach((item) => {
          if (item.plannedPaymentDate) {
            dates.add(dayjs(item.plannedPaymentDate).format('YYYY-MM-DD'))
          }
        })
      })
    }

    return Array.from(dates)
  }, [data])

  const totalItems = allItems.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const activePage = Math.min(currentPage, totalPages)

  const itemsWithBalance = useMemo(() => {
    const len = allItems.length
    const result = new Array(len)
    let runningBalance = 0

    for (let i = len - 1; i >= 0; i--) {
      const item = allItems[i]
      let debit = 0
      let credit = 0

      if (item.status !== 'cancelled') {
        credit = item.amount
        debit = item.status === 'paid' ? item.amount : (item.paidAmount || 0)
        runningBalance += (credit - debit)
      }

      result[i] = {
        ...item,
        debit,
        credit,
        balance: runningBalance,
      }
    }

    return result
  }, [allItems])

  const paginatedItems = useMemo(() => {
    const start = (activePage - 1) * pageSize
    return itemsWithBalance.slice(start, start + pageSize)
  }, [itemsWithBalance, activePage, pageSize])

  const statusTotals = useMemo(() => {
    let pending = 0
    let paid = 0
    let cancelled = 0
    let total = 0

    allItems.forEach((item) => {
      total += item.amount
      if (item.status === 'cancelled') {
        cancelled += item.amount
      } else {
        const itemPaid = item.status === 'paid' ? item.amount : (item.paidAmount || 0)
        paid += itemPaid
        pending += (item.amount - itemPaid)
      }
    })

    return { pending, paid, cancelled, total }
  }, [allItems])

  const statusCounts = useMemo(() => {
    let pending = 0
    let paid = 0
    let cancelled = 0
    const total = allItems.length

    allItems.forEach((item) => {
      if (item.status === 'paid') {
        paid++
      } else if (item.status === 'cancelled') {
        cancelled++
      } else {
        pending++
      }
    })

    return { pending, paid, cancelled, total }
  }, [allItems])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrolledToBottom =
        window.innerHeight + currentScrollY >= document.documentElement.scrollHeight - 100
      setShowScrollBottom(!scrolledToBottom && currentScrollY >= lastScrollY.current)
      lastScrollY.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const fetchReport = React.useCallback(
    async (
      start: Date,
      end: Date,
      branchIds: string[],
      dealerIds: string[],
      pStart?: Date | null,
      pEnd?: Date | null,
      mode?: string,
    ) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const branchParam = branchIds.includes('all') ? 'all' : branchIds.join(',')
        const dealerParam = dealerIds.includes('all') ? 'all' : dealerIds.join(',')

        let url = `/api/reports/dealer?startDate=${startStr}&endDate=${endStr}&branch=${branchParam}&dealer=${dealerParam}&viewMode=${mode || 'single'}`

        if (pStart && pEnd) {
          const pStartStr = toLocalDateStr(pStart)
          const pEndStr = toLocalDateStr(pEnd)
          url += `&plannedStartDate=${pStartStr}&plannedEndDate=${pEndStr}`
        }

        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch report (HTTP ${res.status})`)

        const reportData = (await res.json()) as ReportData
        setData(reportData)
      } catch (err: any) {
        setError(err.message || 'Something went wrong')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await fetch('/api/reports/branches')
        if (res.ok) {
          const list = await res.json()
          setBranches(list.docs || [])
        }
      } catch (e) {
        console.error('Failed to load branches', e)
      }
    }
    const loadDealers = async () => {
      try {
        const res = await fetch('/api/dealers?limit=1000&sort=companyName')
        if (res.ok) {
          const list = await res.json()
          setDealers(
            (list.docs || []).map((d: any) => ({
              id: d.id,
              name: d.companyName || d.name,
            })),
          )
        }
      } catch (e) {
        console.error('Failed to load dealers', e)
      }
    }
    loadBranches()
    loadDealers()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      void fetchReport(
        startDate,
        endDate,
        selectedBranch,
        selectedDealers,
        plannedDateRange[0],
        plannedDateRange[1],
        viewMode,
      )
    }
  }, [startDate, endDate, selectedBranch, selectedDealers, plannedDateRange, viewMode, fetchReport])

  useEffect(() => {
    setCurrentPage(1)
  }, [startDate, endDate, selectedBranch, selectedDealers, plannedDateRange, viewMode])

  const scrollToToggle = () => {
    if (showScrollBottom) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const dealerOptions = [
    { value: 'all', label: 'All Dealers' },
    ...dealers.map((d) => ({ value: d.id, label: d.name })),
  ]

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const verificationFilterOptions = [
    { value: 'all', label: 'All Verifications' },
    { value: 'verified', label: 'Fully Verified' },
    { value: 'partially_verified', label: 'Partially Verified' },
    { value: 'pending', label: 'Pending Verification' },
    { value: 'accountant_pending', label: 'Accountant Pending' },
    { value: 'watcher_pending', label: 'Watcher Pending' },
    { value: 'manager_pending', label: 'Manager Pending' },
    { value: 'rejected', label: 'Rejected / Flagged' },
    { value: 'skipped', label: 'Skipped Steps' },
  ]

  return (
    <div className="dealer-report-container-v2">
      <h1 className="report-page-title">OTHER PRODUCTS REPORT</h1>
      <div className="report-header-v2">
        <div className="header-controls">
          {/* Row 1: Billing Mode & Verification Rules & Date Pickers */}
          <div className="filter-row top-filter-row">
            <div className="filter-item filter-item--mode">
              <label className="filter-label">Billing Mode</label>
              <div className="billing-view-toggle">
                <button
                  type="button"
                  className={`billing-view-toggle-btn ${viewMode === 'single' ? 'active' : ''}`}
                  onClick={() => {
                    setViewMode('single')
                    setCurrentPage(1)
                  }}
                  title="Single: Show only bills submitted on the selected dates"
                >
                  Single
                </button>
                <button
                  type="button"
                  className={`billing-view-toggle-btn ${viewMode === 'combined' ? 'active' : ''}`}
                  onClick={() => {
                    setViewMode('combined')
                    setCurrentPage(1)
                  }}
                  title="Combined: Show bills submitted and older bills with payments on the selected dates"
                >
                  Combined
                </button>
              </div>
            </div>

            {isAdmin && (
              <div className="filter-item filter-item--verification-rules" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="filter-label" style={{ visibility: 'hidden' }}>&nbsp;</label>
                <button
                  type="button"
                  className="verification-settings-btn"
                  onClick={() => {
                    setTempSettings(verificationSettings)
                    setShowSettingsModal(true)
                  }}
                  title="Configure 3-Step Verification Rules (Enable/Disable Steps)"
                >
                  ⚙️ Verification Rules
                </button>
              </div>
            )}

            <div className="filter-item filter-item--date">
              <label className="filter-label">Billing Date</label>
              <GoogleDateRangePicker
                startDate={startDate}
                endDate={endDate}
                presetKey={dateRangePreset}
                onApply={(newStart, newEnd, presetKey) => {
                  setDateRange([newStart, newEnd])
                  setDateRangePreset(presetKey)
                }}
              />
            </div>

            <div className="filter-item filter-item--date">
              <label className="filter-label">Planned Payment Date</label>
              <GoogleDateRangePicker
                startDate={plannedDateRange[0]}
                endDate={plannedDateRange[1]}
                presetKey={plannedDatePreset}
                presetMode="future"
                placeholder="All Planned Dates"
                isFilterActive={Boolean(plannedDateRange[0] || plannedDateRange[1])}
                highlightedDates={plannedDatesWithBills}
                onApply={(newStart, newEnd, presetKey) => {
                  setPlannedDateRange([newStart, newEnd])
                  setPlannedDatePreset(presetKey)
                }}
                onClear={() => {
                  setPlannedDateRange([null, null])
                  setPlannedDatePreset('')
                }}
              />
            </div>
          </div>

          {/* Row 2: Dropdowns & Clear Button */}
          <div className="filter-row dropdown-filters">
            <div className="filter-item filter-item--select">
              <label className="filter-label">Branch</label>
              <Select
                options={branchOptions}
                isMulti
                value={branchOptions.filter((o) => selectedBranch.includes(o.value))}
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

            <div className="filter-item filter-item--select">
              <label className="filter-label">Dealer</label>
              <Select
                options={dealerOptions}
                isMulti
                value={dealerOptions.filter((o) => selectedDealers.includes(o.value))}
                onChange={(newValue) => {
                  const selected = newValue ? newValue.map((x) => x.value) : []
                  const wasAll = selectedDealers.includes('all')
                  const hasAll = selected.includes('all')

                  let final = selected
                  if (hasAll && !wasAll) {
                    final = ['all']
                  } else if (hasAll && wasAll && selected.length > 1) {
                    final = selected.filter((x) => x !== 'all')
                  } else if (final.length === 0) {
                    final = ['all']
                  }
                  setSelectedDealers(final)
                }}
                styles={customStyles}
                classNamePrefix="react-select"
                placeholder="Select Dealer..."
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

            <div className="filter-item filter-item--status">
              <label className="filter-label">Status</label>
              <Select
                options={statusOptions}
                value={statusOptions.find((o) => o.value === selectedStatus)}
                onChange={(newValue) => {
                  setSelectedStatus(newValue ? newValue.value : 'all')
                  setCurrentPage(1)
                }}
                styles={customStatusStyles}
                classNamePrefix="react-select"
                placeholder="Select Status..."
                isSearchable={false}
              />
            </div>

            <div className="filter-item filter-item--status">
              <label className="filter-label">Verification</label>
              <Select
                options={verificationFilterOptions}
                value={verificationFilterOptions.find((o) => o.value === selectedVerificationFilter)}
                onChange={(newValue) => {
                  setSelectedVerificationFilter(newValue ? newValue.value : 'all')
                  setCurrentPage(1)
                }}
                styles={customStatusStyles}
                classNamePrefix="react-select"
                placeholder="Select Verification..."
                isSearchable={false}
              />
            </div>

            {(dateRangePreset !== 'today' || plannedDateRange[0] !== null || plannedDateRange[1] !== null || !selectedBranch.includes('all') || !selectedDealers.includes('all') || selectedStatus !== 'all' || selectedVerificationFilter !== 'all' || viewMode !== 'single') && (
              <div className="filter-item filter-item--clear">
                <label className="filter-label" style={{ visibility: 'hidden' }}>&nbsp;</label>
                <button
                  type="button"
                  className="clear-all-filters-btn"
                  title="Clear all filters"
                  onClick={() => {
                    setDateRange([new Date(), new Date()])
                    setDateRangePreset('today')
                    setPlannedDateRange([null, null])
                    setPlannedDatePreset('')
                    setSelectedBranch(['all'])
                    setSelectedDealers(['all'])
                    setSelectedStatus('all')
                    setSelectedVerificationFilter('all')
                    setViewMode('single')
                    setCurrentPage(1)
                  }}
                >
                  ✕ Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="report-content">
        {loading && <div className="loading-state">Loading...</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && data && (
          <div className="report-table-container">
              {/* Summary Cards: The 4 Boxes */}
              {allItems.length > 0 && (
                <div className="summary-cards-grid">
                  <div className="stock-summary-card stock-summary-card--total">
                    <div className="stock-summary-title">OVERALL TOTAL</div>
                    <div className="stock-summary-amount">
                      ₹{statusTotals.total.toLocaleString('en-IN')}
                    </div>
                    <div className="stock-summary-ref">
                      {statusCounts.total} entries
                    </div>
                  </div>

                  <div className="stock-summary-card stock-summary-card--existing">
                    <div className="stock-summary-title">PAID TOTAL</div>
                    <div className="stock-summary-amount">
                      ₹{statusTotals.paid.toLocaleString('en-IN')}
                    </div>
                    <div className="stock-summary-ref">
                      {statusCounts.paid} entries
                    </div>
                  </div>

                  <div className="stock-summary-card stock-summary-card--new">
                    <div className="stock-summary-title">PENDING TOTAL</div>
                    <div className="stock-summary-amount">
                      ₹{statusTotals.pending.toLocaleString('en-IN')}
                    </div>
                    <div className="stock-summary-ref">
                      {statusCounts.pending} entries
                    </div>
                  </div>

                  <div className="stock-summary-card stock-summary-card--billing">
                    <div className="stock-summary-title">CANCELLED TOTAL</div>
                    <div className="stock-summary-amount">
                      ₹{statusTotals.cancelled.toLocaleString('en-IN')}
                    </div>
                    <div className="stock-summary-ref">
                      {statusCounts.cancelled} entries
                    </div>
                  </div>
                </div>
              )}

              {allItems.length > 0 ? (
                <div className="report-table-section">
                  <div className="table-header-controls">
                    <div className="limit-selector">
                      <span>Show </span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value))
                          setCurrentPage(1)
                        }}
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

                    {/* Column Selection Dropdown */}
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

                  <div className="report-items-table">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '2%' }}>S.NO</th>
                          <th style={{ width: '15%' }}>Dealer</th>
                          {visibleColumns.includes('branch') && (
                            <th style={{ width: '10%' }}>Branch</th>
                          )}
                          <th style={{ width: '7%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '7%', textAlign: 'right' }}>Paid</th>
                          <th style={{ width: '7%', textAlign: 'right' }}>Balance</th>
                          <th style={{ width: '7%', textAlign: 'center' }}>Status</th>
                          {visibleColumns.includes('bankAccount') && (
                            <th style={{ width: '10%', textAlign: 'center' }}>Bank Acc No</th>
                          )}
                          {visibleColumns.includes('plannedPaymentDate') && (
                            <th style={{ width: '10%', textAlign: 'center' }}>Planned Pay Date</th>
                          )}
                          {!isStoreKeeper && visibleColumns.includes('notes') && (
                            <th style={{ width: '10%', textAlign: 'center' }}>Verification & Notes</th>
                          )}
                          {visibleColumns.includes('history') && (
                            <th style={{ width: '5%', textAlign: 'center' }}>History</th>
                          )}
                          {visibleColumns.includes('billCopy') && (
                            <th style={{ width: '5%', textAlign: 'center' }}>Bill Copy</th>
                          )}
                          {visibleColumns.includes('photos') && (
                            <th style={{ width: '5%', textAlign: 'center' }}>Photos</th>
                          )}
                          <th style={{ width: '10%', textAlign: 'right' }}>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item, idx) => {
                          const remaining = item.amount - (item.paidAmount || 0)
                          const hasPlannedDate = Boolean(item.plannedPaymentDate)
                          const fullyVerified = isBillFullyVerified(item)

                          return (
                            <tr key={item.id} className={hasPlannedDate ? 'has-planned-date-row' : ''}>
                              <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                                {(activePage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="dealer-cell">
                                {item.products && item.products.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewProducts(item.products || [])}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      margin: 0,
                                      font: 'inherit',
                                      color: 'inherit',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      fontWeight: 600,
                                      textDecoration: 'underline',
                                    }}
                                    title="Click to view products list"
                                  >
                                    {item.dealerName}
                                  </button>
                                ) : (
                                  <span style={{ fontWeight: 600 }}>{item.dealerName}</span>
                                )}
                              </td>
                              {visibleColumns.includes('branch') && (
                                <td className="company-cell">
                                  {item.branchName}
                                </td>
                              )}
                              <td className="amount-cell">₹{item.amount.toLocaleString('en-IN')}</td>
                              <td className="paid-cell" style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                ₹{(item.paidAmount || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="balance-cell" style={{ textAlign: 'right', color: remaining > 0 ? '#f59e0b' : 'inherit', fontWeight: 700 }}>
                                ₹{remaining.toLocaleString('en-IN')}
                              </td>
                              <td className="status-cell" style={{ textAlign: 'center' }}>
                                {item.status === 'pending' ? (
                                  !fullyVerified ? (
                                    <button
                                      type="button"
                                      className="pay-now-btn pay-now-btn-locked"
                                      onClick={() => {
                                        const pendingSteps = getPendingVerificationSteps(item)
                                        alert(
                                          `Cannot Pay: Required verification steps (${pendingSteps.join(
                                            ', ',
                                          )}) must be completed or skipped first.`,
                                        )
                                      }}
                                      title={`🔒 Verification Required: ${getPendingVerificationSteps(item).join(', ')} pending`}
                                    >
                                      <Lock size={12} style={{ marginRight: '4px' }} />
                                      Pay Now
                                    </button>
                                  ) : (
                                    <button
                                      className="pay-now-btn"
                                      onClick={async () => {
                                        if (window.confirm(`Are you sure you want to mark the remaining ₹${remaining.toLocaleString('en-IN')} for this bill from ${item.dealerName} as Paid?`)) {
                                          await handlePaymentUpdate(item.id, item.amount, item)
                                        }
                                      }}
                                    >
                                      Pay Now
                                    </button>
                                  )
                                ) : item.status === 'paid' ? (
                                  <span className="status-paid-badge">Paid ✓</span>
                                ) : (
                                  <span className="status-cancelled-badge">Cancelled</span>
                                )}
                              </td>
                              {visibleColumns.includes('bankAccount') && (
                                <td className="bank-account-cell" style={{ textAlign: 'center' }}>
                                  {item.dealerAccountNumber ? (
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.dealerAccountNumber}</span>
                                  ) : (
                                    <span style={{ opacity: 0.5 }}>-</span>
                                  )}
                                </td>
                              )}
                              {visibleColumns.includes('plannedPaymentDate') && (
                                <td className="planned-date-cell" style={{ textAlign: 'center' }}>
                                  {item.status === 'pending' ? (
                                    (() => {
                                      const currentValue = tempPlannedDates[item.id] !== undefined
                                        ? tempPlannedDates[item.id]
                                        : (item.plannedPaymentDate ? dayjs(item.plannedPaymentDate).format('YYYY-MM-DD') : '')
                                      const isModified = tempPlannedDates[item.id] !== undefined && tempPlannedDates[item.id] !== (item.plannedPaymentDate ? dayjs(item.plannedPaymentDate).format('YYYY-MM-DD') : '')
                                      
                                      return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                          <input
                                            type="date"
                                            className={`planned-date-picker ${currentValue ? 'has-date' : ''}`}
                                            value={currentValue}
                                            onChange={(e) => {
                                              setTempPlannedDates({
                                                ...tempPlannedDates,
                                                [item.id]: e.target.value,
                                              })
                                            }}
                                          />
                                          {isModified && (
                                            <button
                                              type="button"
                                              className="planned-date-save-btn"
                                              onClick={async () => {
                                                await handlePlannedDateUpdate(item.id, currentValue)
                                                const updated = { ...tempPlannedDates }
                                                delete updated[item.id]
                                                setTempPlannedDates(updated)
                                              }}
                                              title="Save planned payment date"
                                              style={{
                                                background: '#10b981',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                              }}
                                            >
                                              ✓
                                            </button>
                                          )}
                                        </div>
                                      )
                                    })()
                                  ) : (
                                    item.plannedPaymentDate ? (
                                      <span className="planned-date-badge">
                                        📅 {dayjs(item.plannedPaymentDate).format('DD-MM-YYYY')}
                                      </span>
                                    ) : '-'
                                  )}
                                </td>
                              )}

                              {/* 3-Step Verification & Notes Cell */}
                              {!isStoreKeeper && visibleColumns.includes('notes') && (
                                <td className="notes-cell" style={{ textAlign: 'center' }}>
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
                                    >
                                      <div className="verification-chips" style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', justifyContent: 'center' }}>
                                        {/* Step 1: Manager */}
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
                                        {/* Step 2: Accountant */}
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
                                        {/* Step 3: Watcher */}
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
                                      </div>
                                    </div>
                                  )}
                                </td>
                              )}

                              {visibleColumns.includes('history') && (
                                <td className="history-cell" style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    {item.status === 'pending' && (
                                      <button
                                        className={`payment-edit-btn ${!fullyVerified ? 'payment-edit-btn-locked' : ''}`}
                                        type="button"
                                        onClick={() => {
                                          if (!fullyVerified && !isAdmin) {
                                            const pendingSteps = getPendingVerificationSteps(item)
                                            alert(
                                              `Cannot Record Payment: Verification steps (${pendingSteps.join(
                                                ', ',
                                              )}) are pending.`,
                                            )
                                            return
                                          }
                                          setPaymentModalItem(item)
                                          setPaymentAmountInput('')
                                          setShowPaymentModal(true)
                                        }}
                                        title={fullyVerified ? 'Record partial payment' : '🔒 Verification required to record payment'}
                                      >
                                        📝
                                      </button>
                                    )}
                                    {item.payments && item.payments.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setHistoryModalItem(item)}
                                        title="View Payment History"
                                        className="history-view-btn"
                                      >
                                        ⏱️
                                      </button>
                                    ) : (
                                      item.status !== 'pending' && '-'
                                    )}
                                  </div>
                                </td>
                              )}
                              {visibleColumns.includes('billCopy') && (
                                <td className="image-cell" style={{ textAlign: 'center' }}>
                                  <button
                                    className={`image-view-btn ${item.billCopyUrl ? 'active' : 'inactive'}`}
                                    disabled={!item.billCopyUrl}
                                    onClick={() => item.billCopyUrl && setPreviewImage(item.billCopyUrl)}
                                    title={item.billCopyUrl ? 'View Bill Photo' : 'No Photo'}
                                  >
                                    📄
                                  </button>
                                </td>
                              )}
                              {visibleColumns.includes('photos') && (
                                <td className="image-cell" style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    {item.productsPhotoUrls && item.productsPhotoUrls.length > 0 ? (
                                      <button
                                        className="image-view-btn active"
                                        onClick={() => {
                                          if (item.productsPhotoUrls?.[0]) setPreviewImage(item.productsPhotoUrls[0])
                                        }}
                                        title={`View Product Photos (${item.productsPhotoUrls.length})`}
                                      >
                                        📦
                                      </button>
                                    ) : item.productsUrl ? (
                                      <button
                                        className="image-view-btn active"
                                        onClick={() => item.productsUrl && setPreviewImage(item.productsUrl)}
                                        title="View Product Photo"
                                      >
                                        📦
                                      </button>
                                    ) : (
                                      <span style={{ opacity: 0.3 }}>-</span>
                                    )}
                                    {item.deliveryPersonPhotoUrl ? (
                                      <button
                                        className="image-view-btn active"
                                        onClick={() => item.deliveryPersonPhotoUrl && setPreviewImage(item.deliveryPersonPhotoUrl)}
                                        title="View Delivery Person Photo"
                                      >
                                        👤
                                      </button>
                                    ) : (
                                      <span style={{ opacity: 0.3 }}>-</span>
                                    )}
                                  </div>
                                </td>
                              )}
                              <td className="time-cell" title={item.time} style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
                                {dayjs(item.time).tz('Asia/Kolkata').format('DD-MM-YY hh:mm A')}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="pagination-wrapper">
                      <div className="pagination-info">
                        Showing {Math.min(totalItems, (activePage - 1) * pageSize + 1)} to{' '}
                        {Math.min(totalItems, activePage * pageSize)} of {totalItems} entries
                      </div>
                      <div className="pagination-buttons">
                        <button
                          disabled={activePage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="pagination-btn"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalPages || Math.abs(p - activePage) <= 2)
                          .map((p, idx, arr) => {
                            const prev = arr[idx - 1]
                            const showEllipsis = prev && p - prev > 1
                            return (
                              <React.Fragment key={p}>
                                {showEllipsis && <span className="ellipsis">...</span>}
                                <button
                                  onClick={() => setCurrentPage(p)}
                                  className={`pagination-btn ${activePage === p ? 'active' : ''}`}
                                >
                                  {p}
                                </button>
                              </React.Fragment>
                            )
                          })}
                        <button
                          disabled={activePage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="pagination-btn"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-data">No other product / dealer billings found.</div>
              )}
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

            {/* Bill Info Summary */}
            <div style={{ background: 'var(--theme-elevation-50)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Dealer:</span>
                <strong>{verificationModalItem.dealerName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Branch:</span>
                <strong>{verificationModalItem.branchName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Bill Amount:</span>
                <strong style={{ color: '#10b981' }}>₹{verificationModalItem.amount.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>Overall Status:</span>
                <strong style={{ textTransform: 'capitalize' }}>{verificationModalItem.verification?.overallStatus || 'Pending'}</strong>
              </div>
            </div>

            {/* Photo Previews inside modal */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {verificationModalItem.billCopyUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewImage(verificationModalItem.billCopyUrl!)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-50)', color: 'var(--theme-text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  📄 View Bill Copy
                </button>
              )}
              {verificationModalItem.productsPhotoUrls && verificationModalItem.productsPhotoUrls.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewImage(verificationModalItem.productsPhotoUrls![0])}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-50)', color: 'var(--theme-text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  📦 View Products Photo
                </button>
              )}
              {verificationModalItem.deliveryPersonPhotoUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewImage(verificationModalItem.deliveryPersonPhotoUrl!)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-50)', color: 'var(--theme-text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  👤 View Delivery Person
                </button>
              )}
            </div>

            {/* Step Selection Tabs (Admins or Multi-step overview) */}
            {isAdmin && (
              <div className="verification-step-tabs">
                {(['manager', 'accountant', 'watcher'] as const).map((stepKey) => {
                  const stepLabel = stepKey === 'manager' ? '1. Manager' : stepKey === 'accountant' ? '2. Accountant' : '3. Watcher'
                  const stepData = verificationModalItem.verification?.[stepKey]
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
                if (userRole === 'account' && stepKey !== 'accountant') return null
                if (userRole === 'watcher' && stepKey !== 'watcher') return null
                if (userRole === 'manager' && stepKey !== 'manager') return null
              }

              const stepTitle = stepKey === 'manager' ? 'Step 1: Manager Approval & Verification' :
                                stepKey === 'accountant' ? 'Step 2: Accountant / Office Admin Verification' : 'Step 3: Watcher Verification'
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
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Other Products Verification Rules</h3>
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
              Configure which verification steps are mandatory before payments can be processed for other products / dealer bills:
            </p>

            {/* Effective From Date & Verification Flow */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'var(--theme-elevation-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--theme-elevation-200)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--theme-text-primary)', marginBottom: '6px' }}>
                  📅 Effective From Date (தொடங்கும் தேதி):
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
                <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-secondary)', marginTop: '4px' }}>
                  இந்தத் தேதியிலிருந்து பதிவாகும் பில்களுக்கு மட்டுமே விதிகள் செயல்படும்.
                </div>
              </div>

              <div style={{ background: 'var(--theme-elevation-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--theme-elevation-200)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--theme-text-primary)', marginBottom: '6px' }}>
                  🔀 Verification Flow (சரிபார்ப்பு முறை):
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
                  <option value="any">Any Order / Parallel (எந்த வரிசையிலும்)</option>
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-secondary)', marginTop: '4px' }}>
                  {tempSettings.flowType === 'any'
                    ? 'யார் வேண்டுமானாலும் எப்போது வேண்டுமானாலும் சரிபார்க்கலாம் (Lock இல்லை).'
                    : 'மேனேஜர் → அக்கவுண்டன்ட் → வாட்சர் வரிசைப்படி மட்டுமே.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={tempSettings.requireManager}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireManager: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
                <span><strong>Step 1:</strong> Require Manager Verification</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={tempSettings.requireAccountant}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireAccountant: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
                <span><strong>Step 2:</strong> Require Accountant / Office Admin Verification</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={tempSettings.requireWatcher}
                  onChange={(e) => setTempSettings({ ...tempSettings, requireWatcher: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
                <span><strong>Step 3:</strong> Require Watcher Verification</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--theme-elevation-250)', background: 'transparent', color: 'var(--theme-text-primary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ver-btn ver-btn--approve"
                onClick={handleSaveVerificationSettings}
                disabled={isSavingSettings}
              >
                {isSavingSettings ? 'Saving...' : 'Save Verification Rules'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Image Modal */}
      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Image
              src={previewImage}
              alt="Dealer proof"
              width={1200}
              height={1200}
              style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
              unoptimized
            />
            <button className="close-btn" onClick={() => setPreviewImage(null)}>
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Preview Products Modal */}
      {previewProducts && (
        <div className="materials-modal-overlay" onClick={() => setPreviewProducts(null)}>
          <div className="materials-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Products List</h3>
            <div className="materials-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>#</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>Photo</th>
                    <th>Product Name</th>
                    <th style={{ textAlign: 'right', width: '25%' }}>Quantity / Count</th>
                    <th style={{ textAlign: 'right', width: '25%' }}>Total Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewProducts.map((prod, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td style={{ textAlign: 'center' }}>
                        {prod.photoUrl ? (
                          <img
                            src={prod.photoUrl}
                            alt={prod.name}
                            style={{
                              width: '36px',
                              height: '36px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: '1px solid var(--theme-elevation-200)',
                            }}
                            onClick={() => setPreviewImage(prod.photoUrl!)}
                            title="Click to view full photo"
                          />
                        ) : (
                          <span style={{ opacity: 0.3 }}>-</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{prod.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {prod.quantity ? prod.quantity.toLocaleString('en-IN') : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                        {prod.totalAmount ? `₹${prod.totalAmount.toLocaleString('en-IN')}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {previewProducts.some((p) => p.totalAmount || p.quantity) && (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--theme-elevation-200)', fontWeight: 700 }}>
                      <td colSpan={3} style={{ textAlign: 'right' }}>Total:</td>
                      <td style={{ textAlign: 'right' }}>
                        {previewProducts.reduce((sum, p) => sum + (p.quantity || 0), 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', color: '#10b981' }}>
                        ₹{previewProducts.reduce((sum, p) => sum + (p.totalAmount || 0), 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <button type="button" className="close-modal-btn" onClick={() => setPreviewProducts(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentModalItem && (
        <div className="image-preview-modal" onClick={() => setShowPaymentModal(false)}>
          <div
            className="modal-content"
            style={{
              padding: '2.5rem',
              background: 'var(--theme-elevation-100)',
              minWidth: '320px',
              maxWidth: '450px',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--theme-elevation-200)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: '1.5rem',
                fontSize: '1.25rem',
                borderBottom: '1px solid var(--theme-elevation-200)',
                paddingBottom: '0.75rem',
                color: 'var(--theme-text-primary)',
              }}
            >
              Record Payment
            </h3>
            <div style={{ color: 'var(--theme-text-primary)', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Dealer:</span>
                <span style={{ fontWeight: 'bold' }}>{paymentModalItem.dealerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Bill Amount:</span>
                <span style={{ fontWeight: 'bold' }}>₹{paymentModalItem.amount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Already Paid:</span>
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>₹{(paymentModalItem.paidAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Remaining:</span>
                <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>
                  ₹{(paymentModalItem.amount - (paymentModalItem.paidAmount || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--theme-text-primary)' }}>
                Payment Amount (₹)
              </label>
              <input
                type="number"
                placeholder="Enter amount to pay..."
                value={paymentAmountInput}
                onChange={(e) => setPaymentAmountInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--theme-elevation-300)',
                  background: 'var(--theme-elevation-50)',
                  color: 'var(--theme-text-primary)',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--theme-elevation-300)',
                  background: 'transparent',
                  color: 'var(--theme-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const entered = parseFloat(paymentAmountInput)
                  const remaining = paymentModalItem.amount - (paymentModalItem.paidAmount || 0)
                  if (isNaN(entered) || entered <= 0) {
                    alert('Please enter a valid positive payment amount')
                    return
                  }
                  if (entered > remaining) {
                    alert(`Payment cannot exceed the remaining outstanding balance of ₹${remaining.toLocaleString('en-IN')}`)
                    return
                  }

                  const newPaidAmount = (paymentModalItem.paidAmount || 0) + entered
                  try {
                    await handlePaymentUpdate(paymentModalItem.id, newPaidAmount, paymentModalItem)
                    setShowPaymentModal(false)
                  } catch (e) {}
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#10b981',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Record Payment
              </button>
            </div>
            
            <button className="close-btn" type="button" onClick={() => setShowPaymentModal(false)}>
              &times;
            </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalItem && (
        <div className="image-preview-modal" onClick={() => setHistoryModalItem(null)}>
          <div
            className="modal-content"
            style={{
              padding: '2.5rem',
              background: 'var(--theme-elevation-100)',
              minWidth: '320px',
              maxWidth: '500px',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--theme-elevation-200)',
              color: 'var(--theme-text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: '1.5rem',
                fontSize: '1.25rem',
                borderBottom: '1px solid var(--theme-elevation-200)',
                paddingBottom: '0.75rem',
                color: 'var(--theme-text-primary)',
              }}
            >
              Payment History
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--theme-text-secondary, #888)' }}>Dealer:</span>
                <span style={{ fontWeight: 'bold' }}>{historyModalItem.dealerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--theme-text-secondary, #888)' }}>Total Bill Amount:</span>
                <span style={{ fontWeight: 'bold' }}>₹{historyModalItem.amount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--theme-text-secondary, #888)' }}>Paid Amount:</span>
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>
                  ₹{(historyModalItem.status === 'paid' ? historyModalItem.amount : (historyModalItem.paidAmount || 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--theme-text-secondary, #888)' }}>Remaining Outstanding:</span>
                <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>
                  ₹{Math.max(0, historyModalItem.amount - (historyModalItem.status === 'paid' ? historyModalItem.amount : (historyModalItem.paidAmount || 0))).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', marginTop: '15px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--theme-elevation-200)' }}>
                    <th style={{ padding: '8px 4px', textAlign: 'left', fontSize: '0.85rem', color: 'var(--theme-text-secondary, #888)' }}>S.NO</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--theme-text-secondary, #888)' }}>Amount Paid</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--theme-text-secondary, #888)' }}>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyModalItem.payments || []).map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--theme-elevation-150)' }}>
                      <td style={{ padding: '8px 4px', textAlign: 'left', fontSize: '0.9rem', opacity: 0.8 }}>{idx + 1}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        ₹{p.amount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: '0.9rem', opacity: 0.8 }}>
                        {dayjs(p.date).tz('Asia/Kolkata').format('DD-MM-YY hh:mm A')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="close-btn" type="button" onClick={() => setHistoryModalItem(null)}>
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

export default DealerReport
