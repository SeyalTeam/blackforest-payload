'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { GoogleDateRangePicker } from './GoogleDateRangePicker'
import { Mail } from 'lucide-react'
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

export type RawMaterialBillingReportItem = {
  id: string
  companyName?: string
  dealerName: string
  dealerAccountNumber?: string
  dealerBankName?: string
  dealerIfscCode?: string
  dealerBranch?: string
  dealerHasBankAccount?: boolean
  dealerPreferredPaymentMethod?: string
  amount: number
  paidAmount?: number
  payments?: { amount: number; date: string }[]
  billCopyUrl?: string
  productsPhotoUrls?: string[]
  deliveryPersonPhotoUrl?: string
  time: string
  status: string
  plannedPaymentDate?: string
  notes?: string
  verification?: BillVerificationData
  rawMaterials?: {
    name: string
    quantity: number
    unit: string
    packageSize?: number
    numberOfPackages?: number
    totalAmount?: number
    category?: string | { id: string }
    photoUrl?: string
  }[]
}

export type CompanyGroup = {
  _id: string
  companyName: string
  total: number
  count: number
  items: RawMaterialBillingReportItem[]
}

type ReportData = {
  startDate: string
  endDate: string
  viewMode?: string
  groups: CompanyGroup[]
  meta: {
    grandTotal: number
    totalCount: number
    plannedDatesWithBills?: string[]
  }
}

const CheckboxOption = (props: OptionProps<SelectOption>) => {
  return (
    <components.Option {...props} className="billing-report-checkbox-option">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
        }}
      >
        <input
          type="checkbox"
          checked={props.isSelected}
          readOnly
          style={{
            appearance: 'auto',
            WebkitAppearance: 'checkbox',
            MozAppearance: 'checkbox',
            width: '16px',
            height: '16px',
            minWidth: '16px',
            maxWidth: '16px',
            minHeight: '16px',
            maxHeight: '16px',
            margin: 0,
            padding: 0,
            cursor: 'pointer',
            accentColor: '#3b82f6',
            flexShrink: 0,
            display: 'inline-block',
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            fontSize: '13px',
            color: 'var(--theme-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            lineHeight: '16px',
          }}
        >
          {props.label}
        </span>
      </div>
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
        <div
          style={{
            paddingLeft: '4px',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--theme-text-primary)',
            fontSize: '0.88rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 'calc(100% - 40px)',
          }}
        >
          {count === 1 ? selected[0].label : `${count} Selected`}
        </div>
      )}
      {children}
    </components.ValueContainer>
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

const customCategoryStyles = {
  ...customStyles,
  control: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-50)',
    borderColor: 'var(--theme-elevation-200)',
    borderRadius: '8px',
    padding: '0 6px',
    minWidth: '220px',
    minHeight: '38px',
    height: '38px',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'var(--theme-elevation-400)',
    },
  }),
  container: (base: any) => ({
    ...base,
    minWidth: '220px',
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

const ColumnValueContainer = ({ children, ...props }: ValueContainerProps<SelectOption, true>) => {
  const { getValue, selectProps } = props
  const selected = getValue()
  const total = selectProps.options ? (selectProps.options as any[]).length : 6
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

const RawMaterialBillingReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewMaterials, setPreviewMaterials] = useState<RawMaterialBillingReportItem['rawMaterials'] | null>(null)
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')

  const [plannedDateRange, setPlannedDateRange] = useState<[Date | null, Date | null]>([null, null])
  const [plannedDatePreset, setPlannedDatePreset] = useState<string>('')

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string[]>(['all'])
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealers, setSelectedDealers] = useState<string[]>(['all'])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all'])
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'single' | 'combined'>('single')
  const [showScrollBottom, setShowScrollBottom] = useState(true)
  const lastScrollY = useRef(0)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentModalItem, setPaymentModalItem] = useState<RawMaterialBillingReportItem | null>(null)
  const [paymentAmountInput, setPaymentAmountInput] = useState('')
  const [historyModalItem, setHistoryModalItem] = useState<RawMaterialBillingReportItem | null>(null)
  const [tempPlannedDates, setTempPlannedDates] = useState<Record<string, string>>({})

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  const isSuperAdmin = userRole === 'superadmin'
  const isAdmin = userRole === 'admin' || isSuperAdmin
  const isAccountant = userRole === 'account' || isAdmin
  const isWatcher = userRole === 'watcher' || isAdmin
  const isManager = userRole === 'manager' || isAdmin

  const [verificationSettings, setVerificationSettings] = useState<{
    effectiveFrom?: string | null
    requireAccountant: boolean
    requireWatcher: boolean
    requireManager: boolean
  }>({
    effectiveFrom: null,
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  })
  const [tempSettings, setTempSettings] = useState<{
    effectiveFrom?: string | null
    requireAccountant: boolean
    requireWatcher: boolean
    requireManager: boolean
  }>({
    effectiveFrom: null,
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  })
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationModalItem, setVerificationModalItem] = useState<RawMaterialBillingReportItem | null>(null)
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false)

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
  const [activeStepTab, setActiveStepTab] = useState<'accountant' | 'watcher' | 'manager'>('accountant')

  const [selectedVerificationFilter, setSelectedVerificationFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const res = await fetch('/api/users/me')
        if (res.ok) {
          const json = await res.json()
          if (json.user) {
            setCurrentUser(json.user)
            if (json.user.role) {
              setUserRole(json.user.role)
            }
          }
        }
      } catch {
        // ignore
      }

      try {
        const sRes = await fetch('/api/reports/verification-settings')
        if (sRes.ok) {
          const sJson = await sRes.json()
          if (sJson.settings?.rawMaterial) {
            setVerificationSettings(sJson.settings.rawMaterial)
            setTempSettings(sJson.settings.rawMaterial)
          }
        }
      } catch {
        // ignore
      }
    }
    fetchInitialData()
  }, [])

  const isStoreKeeper = userRole === 'store_keeper'

  const isBillFullyVerified = (item: RawMaterialBillingReportItem) => {
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

  const getPendingVerificationSteps = (item: RawMaterialBillingReportItem) => {
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

  const openVerificationModal = (item: RawMaterialBillingReportItem) => {
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
      const res = await fetch('/api/raw-material-billings/update-verification', {
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
          rawMaterial: tempSettings,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to update verification settings')
      }
      setVerificationSettings(tempSettings)
      setShowSettingsModal(false)
      alert('Verification rules updated successfully!')
    } catch (err: any) {
      alert(err.message || 'Failed to save settings')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('raw_material_billing_visible_columns')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) return parsed
        }
      } catch {
        // ignore
      }
    }
    return [
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
      localStorage.setItem('raw_material_billing_visible_columns', JSON.stringify(cols))
    } catch {
      // ignore
    }
  }

  const columnOptions: SelectOption[] = React.useMemo(() => [
    { value: 'bankAccount', label: 'Bank Acc No' },
    { value: 'plannedPaymentDate', label: 'Planned Pay Date' },
    ...(!isStoreKeeper ? [{ value: 'notes', label: 'Verification & Notes' }] : []),
    { value: 'history', label: 'History' },
    { value: 'billCopy', label: 'Bill Copy' },
    { value: 'photos', label: 'Photos' },
  ], [isStoreKeeper])

  const [showNotesModal, setShowNotesModal] = useState(false)
  const [notesModalItem, setNotesModalItem] = useState<RawMaterialBillingReportItem | null>(null)
  const [notesInput, setNotesInput] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)

  const handleNotesUpdate = async (id: string, notesText: string) => {
    setIsSavingNote(true)
    try {
      const res = await fetch(`/api/raw-material-billings/update-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billId: id,
          notes: notesText,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errMsg = errData.errors?.[0]?.message || errData.message || `HTTP ${res.status}`
        throw new Error(`Failed to update notes: ${errMsg}`)
      }

      if (data) {
        const updatedGroups = data.groups.map((group) => {
          const updatedItems = group.items.map((i) => {
            if (i.id === id) {
              return {
                ...i,
                notes: notesText,
              }
            }
            return i
          })
          return { ...group, items: updatedItems }
        })
        setData({ ...data, groups: updatedGroups })
      }
      setShowNotesModal(false)
      setNotesModalItem(null)
    } catch (err: any) {
      alert(err.message || 'Failed to save note')
    } finally {
      setIsSavingNote(false)
    }
  }

  const handlePaymentUpdate = async (id: string, newPaidAmount: number, targetItem?: RawMaterialBillingReportItem) => {
    try {
      const item = targetItem || allItems.find((x: any) => x.id === id)
      if (!item) throw new Error('Item not found')

      if (!isBillFullyVerified(item)) {
        const pending = getPendingVerificationSteps(item)
        alert(`Cannot process payment. Bill must be verified by ${pending.join(', ')} (or skipped by Admin) first.`)
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
        date: new Date().toISOString()
      }
      const updatedPayments = [...currentPayments, newPaymentEntry]

      const res = await fetch(`/api/raw-material-billings/${id}`, {
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errMsg = errData.errors?.[0]?.message || errData.message || `HTTP ${res.status}`
        throw new Error(`Failed to update payment: ${errMsg}`)
      }

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
    }
  }

  const handlePlannedDateUpdate = async (id: string, dateStr: string) => {
    try {
      const res = await fetch(`/api/raw-material-billings/${id}`, {
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

  const handleDatePresetChange = (preset: string) => {
    setDateRangePreset(preset)
    const today = dayjs()
    switch (preset) {
      case 'today':
        setDateRange([today.toDate(), today.toDate()])
        break
      case 'yesterday':
        setDateRange([today.subtract(1, 'day').toDate(), today.subtract(1, 'day').toDate()])
        break
      case 'thisWeek':
        setDateRange([today.startOf('week').toDate(), today.endOf('week').toDate()])
        break
      case 'thisMonth':
        setDateRange([today.startOf('month').toDate(), today.endOf('month').toDate()])
        break
      case 'lastMonth':
        setDateRange([
          today.subtract(1, 'month').startOf('month').toDate(),
          today.subtract(1, 'month').endOf('month').toDate(),
        ])
        break
      case 'lastQuarter': {
        const currentMonth = today.month()
        const currentYear = today.year()
        const quarterIndex = Math.floor(currentMonth / 3)
        let targetQuarter = quarterIndex - 1
        let targetYear = currentYear
        if (targetQuarter < 0) {
          targetQuarter = 3
          targetYear -= 1
        }
        const startMonth = targetQuarter * 3
        const startOfLastQuarter = dayjs().year(targetYear).month(startMonth).startOf('month')
        const endOfLastQuarter = dayjs().year(targetYear).month(startMonth + 2).endOf('month')
        setDateRange([startOfLastQuarter.toDate(), endOfLastQuarter.toDate()])
        break
      }
      case 'tillNow':
        setDateRange([dayjs('2020-01-01').toDate(), today.toDate()])
        break
      default:
        break
    }
  }

  const fetchReport = React.useCallback(
    async (
      start: Date,
      end: Date,
      companyIds: string[],
      dealerIds: string[],
      pStart?: Date | null,
      pEnd?: Date | null,
      currentViewMode: 'single' | 'combined' = 'single',
    ) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const companyParam = companyIds.includes('all') ? 'all' : companyIds.join(',')
        const dealerParam = dealerIds.includes('all') ? 'all' : dealerIds.join(',')

        let url = `/api/reports/raw-material-billing?startDate=${startStr}&endDate=${endStr}&company=${companyParam}&dealer=${dealerParam}&viewMode=${currentViewMode}`

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
    const loadCompanies = async () => {
      try {
        const res = await fetch('/api/companies?limit=1000&sort=name')
        if (res.ok) {
          const list = await res.json()
          setCompanies(list.docs || [])
        }
      } catch (e) {
        console.error('Failed to load companies', e)
      }
    }
    const loadDealers = async () => {
      try {
        const res = await fetch('/api/raw-material-dealers?limit=1000&sort=companyName')
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
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/raw-material-categories?limit=1000&sort=name')
        if (res.ok) {
          const list = await res.json()
          setCategories(
            (list.docs || []).map((c: any) => ({
              id: c.id || c._id,
              name: c.name,
            })),
          )
        }
      } catch (e) {
        console.error('Failed to load categories', e)
      }
    }
    loadCompanies()
    loadDealers()
    loadCategories()
    handleDatePresetChange('today')
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      void fetchReport(
        startDate,
        endDate,
        selectedCompany,
        selectedDealers,
        plannedDateRange[0],
        plannedDateRange[1],
        viewMode,
      )
    }
  }, [startDate, endDate, selectedCompany, selectedDealers, plannedDateRange, viewMode, fetchReport])

  const allItems = useMemo(() => {
    if (!data || !data.groups) return []
    const itemsList: (RawMaterialBillingReportItem & { companyName: string })[] = []
    data.groups.forEach((group) => {
      group.items.forEach((item) => {
        if (selectedStatus !== 'all' && item.status !== selectedStatus) {
          return
        }

        if (selectedVerificationFilter !== 'all') {
          const ver = item.verification
          const overall = ver?.overallStatus || 'pending'
          const reqAcc = verificationSettings.requireAccountant
          const reqWat = verificationSettings.requireWatcher
          const reqMgr = verificationSettings.requireManager

          const accSt = ver?.accountant?.status || 'pending'
          const watSt = ver?.watcher?.status || 'pending'
          const mgrSt = ver?.manager?.status || 'pending'

          if (selectedVerificationFilter === 'verified') {
            if (overall !== 'verified') return
          } else if (selectedVerificationFilter === 'partially_verified') {
            if (overall !== 'partially_verified') return
          } else if (selectedVerificationFilter === 'pending') {
            if (overall !== 'pending' && overall !== 'partially_verified') return
          } else if (selectedVerificationFilter === 'accountant_pending') {
            if (!reqAcc || accSt !== 'pending') return
          } else if (selectedVerificationFilter === 'watcher_pending') {
            if (!reqWat || watSt !== 'pending') return
          } else if (selectedVerificationFilter === 'manager_pending') {
            if (!reqMgr || mgrSt !== 'pending') return
          } else if (selectedVerificationFilter === 'rejected') {
            if (overall !== 'rejected' && accSt !== 'rejected' && watSt !== 'rejected' && mgrSt !== 'rejected') return
          } else if (selectedVerificationFilter === 'skipped') {
            if (accSt !== 'skipped' && watSt !== 'skipped' && mgrSt !== 'skipped') return
          }
        }

        if (!selectedCategories.includes('all')) {
          if (!item.rawMaterials || item.rawMaterials.length === 0) return
          const hasMatchingMaterial = item.rawMaterials.some((m) => {
            if (!m.category) return false
            const catId = typeof m.category === 'object'
              ? (m.category as any).id || (m.category as any)._id
              : m.category
            return selectedCategories.includes(catId)
          })
          if (!hasMatchingMaterial) return
        }

        itemsList.push({
          ...item,
          companyName: group.companyName,
        })
      })
    })
    return itemsList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [data, selectedCategories, selectedStatus, selectedVerificationFilter, verificationSettings])

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

  const statusTotals = useMemo(() => {
    let total = 0
    let paid = 0
    let pending = 0
    let cancelled = 0

    const startDay = startDate ? dayjs(toLocalDateStr(startDate)).startOf('day') : null
    const endDay = endDate ? dayjs(toLocalDateStr(endDate)).endOf('day') : null
    const startStr = startDate ? toLocalDateStr(startDate) : ''
    const endStr = endDate ? toLocalDateStr(endDate) : ''

    const isSubmittedInDateRange = (item: any) => {
      if (viewMode === 'single') return true
      const dateToCheck = item.time || item.createdAt
      if (!dateToCheck) return true
      const d = dayjs(dateToCheck)
      if (startDay && endDay && ((d.isAfter(startDay) || d.isSame(startDay, 'day')) && (d.isBefore(endDay) || d.isSame(endDay, 'day')))) {
        return true
      }
      const formatted = d.format('YYYY-MM-DD')
      if (startStr && endStr && formatted >= startStr && formatted <= endStr) {
        return true
      }
      const rawPrefix = String(dateToCheck).slice(0, 10)
      if (startStr && endStr && rawPrefix >= startStr && rawPrefix <= endStr) {
        return true
      }
      return false
    }

    allItems.forEach((item: any) => {
      if (item.status === 'cancelled') {
        cancelled += item.amount
      } else {
        const isCurrentPeriodBill = isSubmittedInDateRange(item)
        if (isCurrentPeriodBill) {
          total += item.amount
          pending += Math.max(0, item.amount - (item.paidAmount || 0))
        }

        if (viewMode === 'combined') {
          // In combined mode, count payments made in this date range
          if (item.payments && item.payments.length > 0) {
            item.payments.forEach((p: any) => {
              if (p && p.date) {
                const pd = dayjs(p.date)
                const inRange = startDay && endDay
                  ? ((pd.isAfter(startDay) || pd.isSame(startDay, 'day')) && (pd.isBefore(endDay) || pd.isSame(endDay, 'day')))
                    || (pd.format('YYYY-MM-DD') >= startStr && pd.format('YYYY-MM-DD') <= endStr)
                    || (String(p.date).slice(0, 10) >= startStr && String(p.date).slice(0, 10) <= endStr)
                  : true
                if (inRange) {
                  paid += p.amount || 0
                }
              }
            })
          } else {
            paid += item.paidAmount || 0
          }
        } else {
          // In single mode, paid is the payments recorded on this bill
          paid += item.paidAmount || 0
        }
      }
    })

    return { total, paid, pending, cancelled }
  }, [allItems, viewMode, startDate, endDate])

  const statusCounts = useMemo(() => {
    let total = 0
    let paid = 0
    let pending = 0
    let cancelled = 0

    allItems.forEach((item: any) => {
      if (item.status === 'cancelled') {
        cancelled++
      } else {
        total++
        if (item.status === 'paid') paid++
        else pending++
      }
    })

    return { total, paid, pending, cancelled }
  }, [allItems])

  const totalItems = allItems.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const activePage = Math.min(currentPage, totalPages || 1)

  const paginatedItems = useMemo(() => {
    const start = (activePage - 1) * pageSize
    return allItems.slice(start, start + pageSize)
  }, [allItems, activePage, pageSize])

  const companyOptions = [
    { value: 'all', label: 'All Companies' },
    ...companies.map((c) => ({ value: c.id, label: c.name })),
  ]

  const dealerOptions = [
    { value: 'all', label: 'All Dealers' },
    ...dealers.map((d) => ({ value: d.id, label: d.name })),
  ]

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
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
    <div className="raw-material-report-container">
      <h1 className="report-page-title">RAW MATERIAL BILLING REPORT</h1>

      {/* Top Filter Bar: Placed before the 4 boxes, left aligned */}
      <div className="report-header-v2">
        <div className="header-controls">
          {/* Row 1: Billing Mode & Date Pickers */}
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
              <label className="filter-label">Company</label>
              <Select
                options={companyOptions}
                isMulti
                value={companyOptions.filter((o) => selectedCompany.includes(o.value))}
                onChange={(newValue) => {
                  const selected = newValue ? newValue.map((x) => x.value) : []
                  const wasAll = selectedCompany.includes('all')
                  const hasAll = selected.includes('all')

                  let final = selected
                  if (hasAll && !wasAll) {
                    final = ['all']
                  } else if (hasAll && wasAll && selected.length > 1) {
                    final = selected.filter((x) => x !== 'all')
                  } else if (final.length === 0) {
                    final = ['all']
                  }
                  setSelectedCompany(final)
                }}
                styles={customStyles}
                classNamePrefix="react-select"
                placeholder="Select Company..."
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

            <div className="filter-item filter-item--category">
              <label className="filter-label">Category</label>
              <Select
                options={categoryOptions}
                isMulti
                value={categoryOptions.filter((o) => selectedCategories.includes(o.value))}
                onChange={(newValue) => {
                  const selected = newValue ? newValue.map((x) => x.value) : []
                  const wasAll = selectedCategories.includes('all')
                  const hasAll = selected.includes('all')

                  let final = selected
                  if (hasAll && !wasAll) {
                    final = ['all']
                  } else if (hasAll && wasAll && selected.length > 1) {
                    final = selected.filter((x) => x !== 'all')
                  } else if (final.length === 0) {
                    final = ['all']
                  }
                  setSelectedCategories(final)
                }}
                styles={customCategoryStyles}
                classNamePrefix="react-select"
                placeholder="Select Category..."
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


            {(dateRangePreset !== 'today' || plannedDateRange[0] !== null || plannedDateRange[1] !== null || !selectedCompany.includes('all') || !selectedDealers.includes('all') || !selectedCategories.includes('all') || selectedStatus !== 'all' || selectedVerificationFilter !== 'all' || viewMode !== 'single') && (
              <div className="filter-item filter-item--clear">
                <label className="filter-label" style={{ visibility: 'hidden' }}>&nbsp;</label>
                <button
                  type="button"
                  className="clear-all-filters-btn"
                  title="Clear all filters"
                  onClick={() => {
                    handleDatePresetChange('today')
                    setPlannedDateRange([null, null])
                    setPlannedDatePreset('')
                    setSelectedCompany(['all'])
                    setSelectedDealers(['all'])
                    setSelectedCategories(['all'])
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
        <div className="report-table-container">
          {loading && <div className="loading-state">Loading...</div>}
          {error && <div className="error-message">{error}</div>}

          {!loading && data && (
              <>
                {allItems.length > 0 && (
                <div className="summary-cards-grid">
                  <div className="stock-summary-card stock-summary-card--total">
                    <div className="stock-summary-title">OVERALL TOTAL</div>
                    <div className="stock-summary-amount">
                      {statusTotals.total.toLocaleString('en-IN')}
                    </div>
                    <div className="stock-summary-ref">
                      {statusCounts.total} entries
                    </div>
                  </div>

                  <div className="stock-summary-card stock-summary-card--existing">
                    <div className="stock-summary-title">PAID TOTAL</div>
                    <div className="stock-summary-amount">
                      {statusTotals.paid.toLocaleString('en-IN')}
                    </div>
                    <div className="stock-summary-ref">
                      {statusCounts.paid} entries
                    </div>
                  </div>

                  <div className="stock-summary-card stock-summary-card--new">
                    <div className="stock-summary-title">PENDING TOTAL</div>
                    <div className="stock-summary-amount">
                      {statusTotals.pending.toLocaleString('en-IN')}
                    </div>
                    <div className="stock-summary-ref">
                      {statusCounts.pending} entries
                    </div>
                  </div>

                  <div className="stock-summary-card stock-summary-card--billing">
                    <div className="stock-summary-title">CANCELLED TOTAL</div>
                    <div className="stock-summary-amount">
                      {statusTotals.cancelled.toLocaleString('en-IN')}
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
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value))
                          setCurrentPage(1)
                        }}
                        className="page-size-select"
                        title="Rows per page"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value={500}>500</option>
                        <option value={1000}>1000</option>
                      </select>
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
                          MultiValue: () => null,
                        }}
                      />
                    </div>
                  </div>

                  <div className="report-items-table">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '2%' }}>S.NO</th>
                          <th style={{ width: '16%' }}>Dealer</th>
                          <th style={{ width: '10%' }}>Company</th>
                          <th style={{ width: '5%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '5%', textAlign: 'right' }}>Paid</th>
                          <th style={{ width: '5%', textAlign: 'right' }}>Balance</th>
                          <th style={{ width: '6%', textAlign: 'center' }}>Status</th>
                          {visibleColumns.includes('bankAccount') && (
                            <th style={{ width: '10%', textAlign: 'center' }}>Bank Acc No</th>
                          )}
                          {visibleColumns.includes('plannedPaymentDate') && (
                            <th style={{ width: '9%', textAlign: 'center' }}>Planned Pay Date</th>
                          )}
                          {!isStoreKeeper && visibleColumns.includes('notes') && (
                            <th style={{ width: '10%', textAlign: 'center' }}>Verification & Notes</th>
                          )}
                          {visibleColumns.includes('history') && (
                            <th style={{ width: '4%', textAlign: 'center' }}>History</th>
                          )}
                          {visibleColumns.includes('billCopy') && (
                            <th style={{ width: '4%', textAlign: 'center' }}>Bill Copy</th>
                          )}
                          {visibleColumns.includes('photos') && (
                            <th style={{ width: '4%', textAlign: 'center' }}>Photos</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item: any, idx: number) => {
                          const remaining = item.amount - (item.paidAmount || 0)
                          const hasPlannedDate = Boolean(item.plannedPaymentDate)
                          return (
                            <tr key={item.id} className={hasPlannedDate ? 'has-planned-date-row' : ''}>
                              <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                                {(activePage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="dealer-cell">
                                <button
                                  type="button"
                                  onClick={() => setPreviewMaterials(item.rawMaterials || [])}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    margin: 0,
                                    font: 'inherit',
                                    color: 'inherit',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontWeight: 700,
                                    fontSize: '1.05rem',
                                    textTransform: 'uppercase' as const,
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '3px',
                                  }}
                                  title="Click to view materials list"
                                >
                                  {item.dealerName}
                                </button>
                                <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                                  {dayjs(item.time).tz('Asia/Kolkata').format('DD-MM-YY hh:mm A')}
                                </div>
                              </td>
                              <td className="company-cell">
                                {item.companyName}
                              </td>
                              <td className="amount-cell">{item.amount.toLocaleString('en-IN')}</td>
                              <td className="paid-cell" style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                {(item.paidAmount || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="balance-cell" style={{ textAlign: 'right', color: remaining > 0 ? '#f59e0b' : 'inherit', fontWeight: 700 }}>
                                {remaining.toLocaleString('en-IN')}
                              </td>
                              <td className="status-cell" style={{ textAlign: 'center' }}>
                                {item.status === 'pending' ? (
                                  (() => {
                                    const isVerified = isBillFullyVerified(item)
                                    const pendingSteps = getPendingVerificationSteps(item)
                                    if (!isVerified) {
                                      return (
                                        <button
                                          type="button"
                                          className="pay-now-btn pay-now-btn-locked"
                                          disabled
                                          title={`Payment locked: Pending ${pendingSteps.join(', ')} verification. Click Verification column to approve/skip.`}
                                          onClick={() => openVerificationModal(item)}
                                        >
                                          🔒 Pay Now
                                        </button>
                                      )
                                    }
                                    return (
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
                                  })()
                                ) : item.status === 'paid' ? (
                                  <span className="status-paid-badge">Paid ✓</span>
                                ) : (
                                  <span className="status-cancelled-badge">Cancelled</span>
                                )}
                              </td>
                              {visibleColumns.includes('bankAccount') && (
                                <td className="bank-account-cell" style={{ textAlign: 'center' }}>
                                  {item.dealerAccountNumber ? (
                                    (() => {
                                      const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                                      const isSameAsDealer = Boolean(
                                        item.dealerBankName &&
                                        item.dealerName &&
                                        (normalize(item.dealerBankName).includes(normalize(item.dealerName)) ||
                                         normalize(item.dealerName).includes(normalize(item.dealerBankName)))
                                      )
                                      const bankNameToShow = isSameAsDealer ? '' : item.dealerBankName
                                      const subtext = [bankNameToShow, item.dealerIfscCode].filter(Boolean).join(' • ')
                                      return (
                                        <div>
                                          <div style={{ fontWeight: 600, fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                            {item.dealerAccountNumber}
                                          </div>
                                          {subtext && (
                                            <div style={{ fontSize: '0.72rem', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                                              {subtext}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })()
                                  ) : item.dealerPreferredPaymentMethod ? (
                                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: 'var(--theme-elevation-150)', color: 'var(--theme-text-secondary)', fontWeight: 600 }}>
                                      {item.dealerPreferredPaymentMethod}
                                    </span>
                                  ) : (
                                    <span style={{ opacity: 0.4 }}>-</span>
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
                              {!isStoreKeeper && visibleColumns.includes('notes') && (
                                <td className="notes-cell" style={{ textAlign: 'center' }}>
                                  {userRole === 'account' ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                      <button
                                        type="button"
                                        className={`ver-role-action-btn ver-${item.verification?.accountant?.status || 'pending'}`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openVerificationModal(item)
                                        }}
                                        title="Click to review and verify this bill as Accountant"
                                      >
                                        {item.verification?.accountant?.status === 'verified'
                                          ? '✓ Verified'
                                          : item.verification?.accountant?.status === 'skipped'
                                          ? '⏭ Skipped'
                                          : item.verification?.accountant?.status === 'rejected'
                                          ? '✕ Rejected'
                                          : 'Verify (Acc)'}
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
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openVerificationModal(item)
                                        }}
                                        title="Click to review and verify this bill as Watcher"
                                      >
                                        {item.verification?.watcher?.status === 'verified'
                                          ? '✓ Verified'
                                          : item.verification?.watcher?.status === 'skipped'
                                          ? '⏭ Skipped'
                                          : item.verification?.watcher?.status === 'rejected'
                                          ? '✕ Rejected'
                                          : 'Verify (Watcher)'}
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
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openVerificationModal(item)
                                        }}
                                        title="Click to review and approve this bill as Manager"
                                      >
                                        {item.verification?.manager?.status === 'verified'
                                          ? '✓ Approved'
                                          : item.verification?.manager?.status === 'skipped'
                                          ? '⏭ Skipped'
                                          : item.verification?.manager?.status === 'rejected'
                                          ? '✕ Rejected'
                                          : 'Approve (Mgr)'}
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
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openVerificationModal(item)
                                      }}
                                      title="Click to view or update 3-step verification"
                                    >
                                      <div className="verification-chips" style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', justifyContent: 'center' }}>
                                        {/* Step 1: Manager */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          <span
                                            className={`ver-chip ${
                                              !verificationSettings.requireManager
                                                ? 'ver-disabled'
                                                : `ver-${item.verification?.manager?.status || 'pending'}`
                                            }`}
                                            title={`Manager: ${
                                              !verificationSettings.requireManager
                                                ? 'Disabled'
                                                : item.verification?.manager?.status || 'Pending'
                                            }${item.verification?.manager?.verifiedByName ? ` (${item.verification.manager.verifiedByName})` : ''}`}
                                          >
                                            {item.verification?.manager?.status === 'verified'
                                              ? '✓ Mgr'
                                              : item.verification?.manager?.status === 'skipped'
                                              ? '⏭ Mgr'
                                              : item.verification?.manager?.status === 'rejected'
                                              ? '✕ Mgr'
                                              : '○ Mgr'}
                                          </span>
                                          {Boolean(item.verification?.manager?.notes?.trim()) && (
                                            <span
                                              className="ver-note-icon-btn"
                                              title={`Manager Note: ${item.verification?.manager?.notes}`}
                                            >
                                              <Mail size={12} fill="#2563eb" color="#1e3a8a" strokeWidth={1.8} />
                                            </span>
                                          )}
                                        </div>

                                        {/* Step 2: Accountant */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          <span
                                            className={`ver-chip ${
                                              !verificationSettings.requireAccountant
                                                ? 'ver-disabled'
                                                : `ver-${item.verification?.accountant?.status || 'pending'}`
                                            }`}
                                            title={`Accountant: ${
                                              !verificationSettings.requireAccountant
                                                ? 'Disabled'
                                                : item.verification?.accountant?.status || 'Pending'
                                            }${item.verification?.accountant?.verifiedByName ? ` (${item.verification.accountant.verifiedByName})` : ''}`}
                                          >
                                            {item.verification?.accountant?.status === 'verified'
                                              ? '✓ Acc'
                                              : item.verification?.accountant?.status === 'skipped'
                                              ? '⏭ Acc'
                                              : item.verification?.accountant?.status === 'rejected'
                                              ? '✕ Acc'
                                              : '○ Acc'}
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
                                            className={`ver-chip ${
                                              !verificationSettings.requireWatcher
                                                ? 'ver-disabled'
                                                : `ver-${item.verification?.watcher?.status || 'pending'}`
                                            }`}
                                            title={`Watcher: ${
                                              !verificationSettings.requireWatcher
                                                ? 'Disabled'
                                                : item.verification?.watcher?.status || 'Pending'
                                            }${item.verification?.watcher?.verifiedByName ? ` (${item.verification.watcher.verifiedByName})` : ''}`}
                                          >
                                            {item.verification?.watcher?.status === 'verified'
                                              ? '✓ Wat'
                                              : item.verification?.watcher?.status === 'skipped'
                                              ? '⏭ Wat'
                                              : item.verification?.watcher?.status === 'rejected'
                                              ? '✕ Wat'
                                              : '○ Wat'}
                                          </span>
                                          {Boolean(item.verification?.watcher?.notes?.trim()) && (
                                            <span
                                              className="ver-note-icon-btn"
                                              title={`Watcher Note: ${item.verification?.watcher?.notes}`}
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
                                      (() => {
                                        const isVerified = isBillFullyVerified(item)
                                        const pendingSteps = getPendingVerificationSteps(item)
                                        if (!isVerified) {
                                          return (
                                            <button
                                              className="payment-edit-btn payment-edit-btn-locked"
                                              type="button"
                                              disabled
                                              title={`Payment locked: Pending ${pendingSteps.join(', ')} verification`}
                                            >
                                              🔒
                                            </button>
                                          )
                                        }
                                        return (
                                          <button
                                            className="payment-edit-btn"
                                            type="button"
                                            onClick={() => {
                                              setPaymentModalItem(item)
                                              setPaymentAmountInput('')
                                              setShowPaymentModal(true)
                                            }}
                                            title="Record partial payment"
                                          >
                                            📝
                                          </button>
                                        )
                                      })()
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
                                        title={`View Products Photo (${item.productsPhotoUrls.length})`}
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
                <div className="no-data">No raw material billing entries found for selected filters.</div>
              )}
            </>
          )}
        </div>
      </div>

      {previewMaterials && (
        <div className="materials-modal-overlay" onClick={() => setPreviewMaterials(null)} role="presentation">
          <div className="materials-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Materials Purchased List</h3>
            {previewMaterials.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--theme-text-secondary)', fontSize: '0.95rem' }}>
                No itemized materials found for this billing entry.
              </div>
            ) : (
              <div className="materials-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>Photo</th>
                      <th>Material Name</th>
                      <th style={{ width: '22%' }}>Weight / Pack Details</th>
                      <th style={{ textAlign: 'right', width: '20%' }}>Quantity / Count</th>
                      <th style={{ textAlign: 'right', width: '20%' }}>Total Price (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewMaterials.map((mat: any, idx) => {
                      const materialName = mat.name || mat.rawMaterialName || 'Unknown Material'
                      const pUrl = mat.photoUrl || (typeof mat.photo === 'object' ? mat.photo?.url : null)
                      const packParts = []
                      if (mat.packageSize !== undefined && mat.packageSize !== null) {
                        packParts.push(`${mat.packageSize} ${mat.unit || ''}`.trim())
                      }
                      if (mat.numberOfPackages !== undefined && mat.numberOfPackages !== null && mat.numberOfPackages > 0) {
                        packParts.push(`${mat.numberOfPackages} pack${mat.numberOfPackages > 1 ? 's' : ''}`)
                      }
                      const packDetails = packParts.join(' × ')

                      return (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td style={{ textAlign: 'center' }}>
                            {pUrl ? (
                              <img
                                src={pUrl}
                                alt={materialName}
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  objectFit: 'cover',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  border: '1px solid var(--theme-elevation-200)',
                                }}
                                onClick={() => setPreviewImage(pUrl)}
                                title="Click to view full photo"
                              />
                            ) : (
                              <span style={{ opacity: 0.3 }}>-</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{materialName}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
                            {packDetails || '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {mat.quantity !== undefined
                              ? `${mat.quantity.toLocaleString('en-IN')} ${mat.unit || ''}`.trim()
                              : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                            {mat.totalAmount ? `₹${mat.totalAmount.toLocaleString('en-IN')}` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {previewMaterials.some((m) => m.totalAmount || m.quantity) && (
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--theme-elevation-200)', fontWeight: 700 }}>
                        <td colSpan={4} style={{ textAlign: 'right' }}>Total:</td>
                        <td style={{ textAlign: 'right' }}>
                          {previewMaterials.reduce((sum, m) => sum + (m.quantity || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', color: '#10b981' }}>
                          ₹{previewMaterials.reduce((sum, m) => sum + (m.totalAmount || 0), 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
            <button type="button" className="close-modal-btn" onClick={() => setPreviewMaterials(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {showPaymentModal && paymentModalItem && (
        <div className="modal-overlay-payment">
          <div className="modal-content-payment">
            <h3>Record Payment</h3>
            <p>
              Dealer: <strong>{paymentModalItem.dealerName}</strong>
            </p>
            <p>
              Bill Total: <strong>₹{paymentModalItem.amount.toLocaleString('en-IN')}</strong>
            </p>
            <p>
              Already Paid: <strong>₹{(paymentModalItem.paidAmount || 0).toLocaleString('en-IN')}</strong>
            </p>
            <p>
              Remaining Balance: <strong>₹{(paymentModalItem.amount - (paymentModalItem.paidAmount || 0)).toLocaleString('en-IN')}</strong>
            </p>

            <div className="form-group">
              <label>Amount to Record (₹):</label>
              <input
                type="number"
                value={paymentAmountInput}
                onChange={(e) => setPaymentAmountInput(e.target.value)}
                placeholder="Enter amount"
                className="payment-input-field"
              />
            </div>

            <div className="modal-actions-payment">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentModalItem(null)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="submit-btn"
                onClick={async () => {
                  const inputVal = parseFloat(paymentAmountInput)
                  if (isNaN(inputVal) || inputVal <= 0) {
                    alert('Please enter a valid amount greater than zero')
                    return
                  }
                  const currentPaid = paymentModalItem.paidAmount || 0
                  const newTotalPaid = currentPaid + inputVal
                  if (newTotalPaid > paymentModalItem.amount) {
                    alert('Total paid amount cannot exceed bill total')
                    return
                  }
                  await handlePaymentUpdate(paymentModalItem.id, newTotalPaid, paymentModalItem)
                  setShowPaymentModal(false)
                  setPaymentModalItem(null)
                }}
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {historyModalItem && (
        <div className="modal-overlay-payment" onClick={() => setHistoryModalItem(null)} role="presentation">
          <div className="modal-content-payment" onClick={(e) => e.stopPropagation()}>
            <h3>Payment History</h3>
            <p>
              Dealer: <strong>{historyModalItem.dealerName}</strong>
            </p>
            <p>
              Bill Total: <strong>₹{historyModalItem.amount.toLocaleString('en-IN')}</strong>
            </p>

            <div className="history-list">
              {historyModalItem.payments && historyModalItem.payments.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>S.NO</th>
                      <th>Paid Amount</th>
                      <th>Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyModalItem.payments.map((p, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600, color: '#10b981' }}>₹{p.amount.toLocaleString('en-IN')}</td>
                        <td>{dayjs(p.date).tz('Asia/Kolkata').format('DD-MM-YY hh:mm A')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No payment entries found.</p>
              )}
            </div>
            <button type="button" className="close-modal-btn" onClick={() => setHistoryModalItem(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Three-Step Verification & Notes Modal */}
      {showVerificationModal && verificationModalItem && (
        <div
          className="modal-overlay-payment"
          onClick={() => {
            setShowVerificationModal(false)
            setVerificationModalItem(null)
          }}
        >
          <div
            className="modal-content-payment"
            style={{ maxWidth: '640px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--theme-text-primary)' }}>
                  {userRole === 'account'
                    ? 'Accountant Verification'
                    : userRole === 'watcher'
                    ? 'Watcher (CCTV) Verification'
                    : userRole === 'manager'
                    ? 'Manager Approval & Verification'
                    : 'Verification & Remarks'}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--theme-text-secondary)', marginTop: '4px' }}>
                  Dealer: <strong style={{ color: 'var(--theme-text-primary)' }}>{verificationModalItem.dealerName}</strong> • Company: <strong>{verificationModalItem.companyName}</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                  Bill Total: <strong style={{ color: '#10b981' }}>₹{verificationModalItem.amount.toLocaleString('en-IN')}</strong> • Date: {dayjs(verificationModalItem.time).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mm A')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background:
                      verificationModalItem.verification?.overallStatus === 'verified'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : verificationModalItem.verification?.overallStatus === 'rejected'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : verificationModalItem.verification?.overallStatus === 'partially_verified'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'var(--theme-elevation-150)',
                    color:
                      verificationModalItem.verification?.overallStatus === 'verified'
                        ? '#10b981'
                        : verificationModalItem.verification?.overallStatus === 'rejected'
                        ? '#ef4444'
                        : verificationModalItem.verification?.overallStatus === 'partially_verified'
                        ? '#f59e0b'
                        : 'var(--theme-text-secondary)',
                    border: '1px solid currentColor',
                  }}
                >
                  {verificationModalItem.verification?.overallStatus === 'verified'
                    ? 'Fully Verified'
                    : verificationModalItem.verification?.overallStatus === 'rejected'
                    ? 'Rejected'
                    : verificationModalItem.verification?.overallStatus === 'partially_verified'
                    ? 'Partially Verified'
                    : 'Pending Verification'}
                </span>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => {
                    setShowVerificationModal(false)
                    setVerificationModalItem(null)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--theme-text-secondary)',
                    fontSize: '1.4rem',
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Photos Preview Strip */}
            {(verificationModalItem.billCopyUrl ||
              verificationModalItem.deliveryPersonPhotoUrl ||
              (verificationModalItem.productsPhotoUrls && verificationModalItem.productsPhotoUrls.length > 0)) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: 'var(--theme-elevation-100)',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  overflowX: 'auto',
                }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--theme-text-secondary)' }}>
                  Photos:
                </span>
                {verificationModalItem.billCopyUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(verificationModalItem.billCopyUrl!)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--theme-elevation-300)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      color: '#10b981',
                      fontWeight: 600,
                    }}
                  >
                    📄 Bill Copy
                  </button>
                )}
                {verificationModalItem.deliveryPersonPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(verificationModalItem.deliveryPersonPhotoUrl!)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--theme-elevation-300)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      color: '#3b82f6',
                      fontWeight: 600,
                    }}
                  >
                    👤 Delivery Person
                  </button>
                )}
                {verificationModalItem.productsPhotoUrls &&
                  verificationModalItem.productsPhotoUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setPreviewImage(url)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--theme-elevation-300)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        color: '#f59e0b',
                        fontWeight: 600,
                      }}
                    >
                      📦 Product #{i + 1}
                    </button>
                  ))}
              </div>
            )}

            {/* Step Navigation Tabs: Only show for Admin/Superadmin who oversee all 3 steps */}
            {isAdmin && (
              <div className="verification-step-tabs">
                <button
                  type="button"
                  className={`step-tab-btn ${activeStepTab === 'manager' ? 'active' : ''}`}
                  onClick={() => setActiveStepTab('manager')}
                >
                  <span className="step-status-icon">
                    {verificationModalItem.verification?.manager?.status === 'verified'
                      ? '✅'
                      : verificationModalItem.verification?.manager?.status === 'skipped'
                      ? '⏭️'
                      : verificationModalItem.verification?.manager?.status === 'rejected'
                      ? '❌'
                      : '⚪'}
                  </span>
                  Step 1: Manager
                </button>

                <button
                  type="button"
                  className={`step-tab-btn ${activeStepTab === 'accountant' ? 'active' : ''}`}
                  onClick={() => setActiveStepTab('accountant')}
                >
                  <span className="step-status-icon">
                    {verificationModalItem.verification?.accountant?.status === 'verified'
                      ? '✅'
                      : verificationModalItem.verification?.accountant?.status === 'skipped'
                      ? '⏭️'
                      : verificationModalItem.verification?.accountant?.status === 'rejected'
                      ? '❌'
                      : !isAdmin &&
                        verificationSettings.requireManager &&
                        verificationModalItem.verification?.manager?.status !== 'verified' &&
                        verificationModalItem.verification?.manager?.status !== 'skipped'
                      ? '🔒'
                      : '⚪'}
                  </span>
                  Step 2: Accountant
                </button>

                <button
                  type="button"
                  className={`step-tab-btn ${activeStepTab === 'watcher' ? 'active' : ''}`}
                  onClick={() => setActiveStepTab('watcher')}
                >
                  <span className="step-status-icon">
                    {verificationModalItem.verification?.watcher?.status === 'verified'
                      ? '✅'
                      : verificationModalItem.verification?.watcher?.status === 'skipped'
                      ? '⏭️'
                      : verificationModalItem.verification?.watcher?.status === 'rejected'
                      ? '❌'
                      : !isAdmin &&
                        verificationSettings.requireAccountant &&
                        verificationModalItem.verification?.accountant?.status !== 'verified' &&
                        verificationModalItem.verification?.accountant?.status !== 'skipped'
                      ? '🔒'
                      : '⚪'}
                  </span>
                  Step 3: Watcher
                </button>
              </div>
            )}

            {/* TAB CONTENT: STEP 1 - MANAGER */}
            {(userRole === 'manager' || (isAdmin && activeStepTab === 'manager')) && (
              <div className="verification-step-card">
                <div className="step-card-header">
                  <div className="step-title">
                    <span>Step 1: Manager Approval & Verification</span>
                  </div>
                  <span
                    className={`ver-chip ver-${verificationModalItem.verification?.manager?.status || 'pending'}`}
                  >
                    {verificationModalItem.verification?.manager?.status || 'Pending'}
                  </span>
                </div>

                {!verificationSettings.requireManager && (
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '10px' }}>
                    ⚠️ Note: Manager verification is currently disabled in Verification Rules.
                  </div>
                )}

                {verificationModalItem.verification?.manager?.verifiedAt && (
                  <div className="step-meta-info">
                    Verified by: <strong>{verificationModalItem.verification.manager.verifiedByName || 'Unknown'}</strong> (
                    {verificationModalItem.verification.manager.verifiedByRole || 'Manager'}) on{' '}
                    {dayjs(verificationModalItem.verification.manager.verifiedAt).format('DD-MM-YYYY hh:mm A')}
                  </div>
                )}

                <div style={{ marginBottom: '8px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
                  Manager Remarks / Sign-off:
                </div>
                <textarea
                  className="step-textarea"
                  rows={4}
                  value={stepNotes.manager}
                  onChange={(e) => setStepNotes({ ...stepNotes, manager: e.target.value })}
                  placeholder="Enter manager sign-off remarks, payment clearance notes..."
                  disabled={!isManager}
                />

                {isAdmin && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="text"
                      className="step-textarea"
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                      placeholder="Optional reason for skipping (e.g., Manager not available today)"
                      value={stepSkipReason.manager}
                      onChange={(e) => setStepSkipReason({ ...stepSkipReason, manager: e.target.value })}
                    />
                  </div>
                )}

                <div className="step-actions">
                  {isAdmin && (
                    <button
                      type="button"
                      className="ver-btn ver-btn--skip"
                      disabled={isSubmittingVerification}
                      onClick={() => handleVerificationSubmit(verificationModalItem.id, 'manager', 'skipped')}
                      title="Skip manager approval (e.g., if manager is not available today)"
                    >
                      ⏭️ Skip Step
                    </button>
                  )}
                  {isManager && (
                    <>
                      <button
                        type="button"
                        className="ver-btn ver-btn--reject"
                        disabled={isSubmittingVerification}
                        onClick={() => handleVerificationSubmit(verificationModalItem.id, 'manager', 'rejected')}
                      >
                        ❌ Reject
                      </button>
                      <button
                        type="button"
                        className="ver-btn ver-btn--approve"
                        disabled={isSubmittingVerification}
                        onClick={() => handleVerificationSubmit(verificationModalItem.id, 'manager', 'verified')}
                      >
                        {isSubmittingVerification ? 'Saving...' : '✓ Verify & Approve (Manager)'}
                      </button>
                    </>
                  )}
                  {!isManager && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--theme-text-secondary)', alignSelf: 'center' }}>
                      🔒 Only Manager or Office Admin can verify this step.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: STEP 2 - ACCOUNTANT */}
            {(userRole === 'account' || (isAdmin && activeStepTab === 'accountant')) && (
              <div className="verification-step-card">
                <div className="step-card-header">
                  <div className="step-title">
                    <span>Step 2: Accountant / Office Admin Verification</span>
                  </div>
                  <span
                    className={`ver-chip ver-${verificationModalItem.verification?.accountant?.status || 'pending'}`}
                  >
                    {verificationModalItem.verification?.accountant?.status || 'Pending'}
                  </span>
                </div>

                {!verificationSettings.requireAccountant && (
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '10px' }}>
                    ⚠️ Note: Accountant verification is currently disabled in Verification Rules.
                  </div>
                )}

                {/* Sequential check notice */}
                {!isAdmin &&
                  verificationSettings.requireManager &&
                  verificationModalItem.verification?.manager?.status !== 'verified' &&
                  verificationModalItem.verification?.manager?.status !== 'skipped' && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '6px',
                        color: '#f59e0b',
                        fontSize: '0.85rem',
                        marginBottom: '14px',
                      }}
                    >
                      🔒 <strong>Step Locked:</strong> Step 1 (Manager) must be verified or skipped before Accountant verification can proceed.
                    </div>
                  )}

                {verificationModalItem.verification?.accountant?.verifiedAt && (
                  <div className="step-meta-info">
                    Verified by: <strong>{verificationModalItem.verification.accountant.verifiedByName || 'Unknown'}</strong> (
                    {verificationModalItem.verification.accountant.verifiedByRole || 'Admin'}) on{' '}
                    {dayjs(verificationModalItem.verification.accountant.verifiedAt).format('DD-MM-YYYY hh:mm A')}
                  </div>
                )}

                <div style={{ marginBottom: '8px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
                  Accountant Remarks / Notes:
                </div>
                <textarea
                  className="step-textarea"
                  rows={4}
                  value={stepNotes.accountant}
                  onChange={(e) => setStepNotes({ ...stepNotes, accountant: e.target.value })}
                  placeholder="Enter invoice verification notes, pricing confirmation, etc..."
                  disabled={
                    !isAccountant ||
                    (!isAdmin &&
                      verificationSettings.requireManager &&
                      verificationModalItem.verification?.manager?.status !== 'verified' &&
                      verificationModalItem.verification?.manager?.status !== 'skipped')
                  }
                />

                {isAdmin && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="text"
                      className="step-textarea"
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                      placeholder="Optional reason for skipping (e.g., Accountant not available today)"
                      value={stepSkipReason.accountant}
                      onChange={(e) => setStepSkipReason({ ...stepSkipReason, accountant: e.target.value })}
                    />
                  </div>
                )}

                <div className="step-actions">
                  {isAdmin && (
                    <button
                      type="button"
                      className="ver-btn ver-btn--skip"
                      disabled={isSubmittingVerification}
                      onClick={() => handleVerificationSubmit(verificationModalItem.id, 'accountant', 'skipped')}
                      title="Skip this step (e.g. if accountant is not available today)"
                    >
                      ⏭️ Skip Step
                    </button>
                  )}
                  {isAccountant &&
                    (isAdmin ||
                      !verificationSettings.requireManager ||
                      verificationModalItem.verification?.manager?.status === 'verified' ||
                      verificationModalItem.verification?.manager?.status === 'skipped') && (
                      <>
                        <button
                          type="button"
                          className="ver-btn ver-btn--reject"
                          disabled={isSubmittingVerification}
                          onClick={() => handleVerificationSubmit(verificationModalItem.id, 'accountant', 'rejected')}
                        >
                          ❌ Reject
                        </button>
                        <button
                          type="button"
                          className="ver-btn ver-btn--approve"
                          disabled={isSubmittingVerification}
                          onClick={() => handleVerificationSubmit(verificationModalItem.id, 'accountant', 'verified')}
                        >
                          {isSubmittingVerification ? 'Saving...' : '✓ Verify & Approve (Accountant)'}
                        </button>
                      </>
                    )}
                  {!isAccountant && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--theme-text-secondary)', alignSelf: 'center' }}>
                      🔒 Only Accountant or Office Admin can verify this step.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: STEP 3 - WATCHER */}
            {(userRole === 'watcher' || (isAdmin && activeStepTab === 'watcher')) && (
              <div className="verification-step-card">
                <div className="step-card-header">
                  <div className="step-title">
                    <span>Step 3: Watcher (CCTV) Verification</span>
                  </div>
                  <span
                    className={`ver-chip ver-${verificationModalItem.verification?.watcher?.status || 'pending'}`}
                  >
                    {verificationModalItem.verification?.watcher?.status || 'Pending'}
                  </span>
                </div>

                {!verificationSettings.requireWatcher && (
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '10px' }}>
                    ⚠️ Note: Watcher verification is currently disabled in Verification Rules.
                  </div>
                )}

                {/* Sequential check notice */}
                {!isAdmin &&
                  verificationSettings.requireAccountant &&
                  verificationModalItem.verification?.accountant?.status !== 'verified' &&
                  verificationModalItem.verification?.accountant?.status !== 'skipped' && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '6px',
                        color: '#f59e0b',
                        fontSize: '0.85rem',
                        marginBottom: '14px',
                      }}
                    >
                      🔒 <strong>Step Locked:</strong> Step 2 (Accountant / Office Admin) must be verified or skipped before Watcher verification can proceed.
                    </div>
                  )}

                {verificationModalItem.verification?.watcher?.verifiedAt && (
                  <div className="step-meta-info">
                    Verified by: <strong>{verificationModalItem.verification.watcher.verifiedByName || 'Unknown'}</strong> (
                    {verificationModalItem.verification.watcher.verifiedByRole || 'Watcher'}) on{' '}
                    {dayjs(verificationModalItem.verification.watcher.verifiedAt).format('DD-MM-YYYY hh:mm A')}
                  </div>
                )}

                <div style={{ marginBottom: '8px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
                  Watcher Remarks / Notes (CCTV & Gate Delivery Check):
                </div>
                <textarea
                  className="step-textarea"
                  rows={4}
                  value={stepNotes.watcher}
                  onChange={(e) => setStepNotes({ ...stepNotes, watcher: e.target.value })}
                  placeholder="Enter CCTV check notes, delivery gate confirmation, quantity verification..."
                  disabled={
                    !isWatcher ||
                    (!isAdmin &&
                      verificationSettings.requireAccountant &&
                      verificationModalItem.verification?.accountant?.status !== 'verified' &&
                      verificationModalItem.verification?.accountant?.status !== 'skipped')
                  }
                />

                {isAdmin && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="text"
                      className="step-textarea"
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                      placeholder="Optional reason for skipping (e.g., Watcher not available / CCTV down)"
                      value={stepSkipReason.watcher}
                      onChange={(e) => setStepSkipReason({ ...stepSkipReason, watcher: e.target.value })}
                    />
                  </div>
                )}

                <div className="step-actions">
                  {isAdmin && (
                    <button
                      type="button"
                      className="ver-btn ver-btn--skip"
                      disabled={isSubmittingVerification}
                      onClick={() => handleVerificationSubmit(verificationModalItem.id, 'watcher', 'skipped')}
                      title="Skip this step (e.g. if watcher is not available)"
                    >
                      ⏭️ Skip Step
                    </button>
                  )}
                  {isWatcher &&
                    (isAdmin ||
                      !verificationSettings.requireAccountant ||
                      verificationModalItem.verification?.accountant?.status === 'verified' ||
                      verificationModalItem.verification?.accountant?.status === 'skipped') && (
                      <>
                        <button
                          type="button"
                          className="ver-btn ver-btn--reject"
                          disabled={isSubmittingVerification}
                          onClick={() => handleVerificationSubmit(verificationModalItem.id, 'watcher', 'rejected')}
                        >
                          ❌ Reject
                        </button>
                        <button
                          type="button"
                          className="ver-btn ver-btn--approve"
                          disabled={isSubmittingVerification}
                          onClick={() => handleVerificationSubmit(verificationModalItem.id, 'watcher', 'verified')}
                        >
                          {isSubmittingVerification ? 'Saving...' : '✓ Verify & Approve (Watcher)'}
                        </button>
                      </>
                    )}
                  {!isWatcher && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--theme-text-secondary)', alignSelf: 'center' }}>
                      🔒 Only Watcher or Office Admin can verify this step.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verification Settings Modal (Office Admin & Super Admin) */}
      {showSettingsModal && (
        <div
          className="modal-overlay-payment"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="modal-content-payment"
            style={{ maxWidth: '520px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--theme-text-primary)' }}>
                ⚙️ Verification Step Rules
              </h2>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setShowSettingsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--theme-text-secondary)',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--theme-text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Configure which verification steps are mandatory before payments can be unlocked. If a manager or watcher is not available today, you can disable their requirement here, or skip individual bills in the verification modal.
            </div>

            {/* Effective From Date */}
            <div style={{ marginBottom: '16px', background: 'var(--theme-elevation-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--theme-elevation-200)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--theme-text-primary)', marginBottom: '6px' }}>
                📅 Effective From Date (விதிகள் தொடங்கும் தேதி):
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
                  maxWidth: '220px',
                }}
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-secondary)', marginTop: '4px' }}>
                தேர்ந்தெடுக்கப்பட்ட இந்தத் தேதியிலிருந்து பதிவாகும் பில்களுக்கு மட்டுமே வெரிஃபிகேஷன் விதிகள் செயல்படும்.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  background: 'var(--theme-elevation-50)',
                  borderRadius: '6px',
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
                    Requires final review and sign-off by Branch / Office Manager before payments can be made.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  background: 'var(--theme-elevation-50)',
                  borderRadius: '6px',
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
                    Requires invoice amounts, totals, and bill verification by Accountant or Office Admin.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  background: 'var(--theme-elevation-50)',
                  borderRadius: '6px',
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
                    Step 3: Watcher (CCTV) Verification
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                    Requires CCTV physical gate entry and goods receipt check by the Watcher team.
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

      {/* Legacy Notes Modal Popup */}
      {showNotesModal && notesModalItem && (
        <div
          className="modal-overlay-payment"
          onClick={() => {
            setShowNotesModal(false)
            setNotesModalItem(null)
          }}
        >
          <div
            className="modal-content-payment"
            style={{ maxWidth: '500px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Notes - {notesModalItem.dealerName}</h2>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => {
                  setShowNotesModal(false)
                  setNotesModalItem(null)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--theme-text-secondary)',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '4px 0 16px' }}>
              <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--theme-text-secondary)' }}>
                Write or update remarks/notes for this raw material bill.
              </div>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Write notes about this bill here..."
                rows={5}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--theme-elevation-200)',
                  background: 'var(--theme-elevation-0)',
                  color: 'var(--theme-text-primary)',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowNotesModal(false)
                  setNotesModalItem(null)
                }}
                disabled={isSavingNote}
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
                onClick={() => handleNotesUpdate(notesModalItem.id, notesInput)}
                disabled={isSavingNote}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {isSavingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Image Modal - rendered at root level on top of all modals */}
      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)} role="presentation">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Attachment Preview" />
            <button type="button" className="close-btn" onClick={() => setPreviewImage(null)}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RawMaterialBillingReport
