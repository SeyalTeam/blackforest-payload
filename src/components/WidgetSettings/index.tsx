'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Package,
  X,
  Calendar,
  MapPin,
  MessageSquare,
  ListFilter,
  Loader2,
  UserRound,
  Save,
  Trash2,
  LayoutGrid,
  RefreshCw,
  Eye,
  Printer,
  Download,
  Upload,
  Copy,
  Plus,
  Check,
  Gift,
} from 'lucide-react'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { getBill } from '@/app/actions/getBill'
import BillReceipt, { BillData } from '@/components/BillReceipt'
import CustomerOfferWidget from './CustomerOfferWidget'
import './index.scss'

type Option = { value: string; label: string }
type Branch = { id: string; name: string }

type TableCustomerDetailsRow = {
  id?: string
  branch?: string | { id?: string; name?: string } | null
  showCustomerDetailsForTableOrders?: boolean | null
  allowSkipCustomerDetailsForTableOrders?: boolean | null
  showCustomerHistoryForTableOrders?: boolean | null
}

type BillingCustomerDetailsRow = {
  id?: string
  branch?: string | { id?: string; name?: string } | null
  showCustomerDetailsForBillingOrders?: boolean | null
  allowSkipCustomerDetailsForBillingOrders?: boolean | null
  showCustomerHistoryForBillingOrders?: boolean | null
}

type AppRow = {
  id?: string
  appName: string
  downloadURL: string
  apkFile?: string | { id: string; filename: string } | null
}

type AppDownloadSettings = {
  apps?: AppRow[] | null
}

type WidgetSettingsGlobal = {
  tableOrderCustomerDetailsByBranch?: TableCustomerDetailsRow[] | null
  billingOrderCustomerDetailsByBranch?: BillingCustomerDetailsRow[] | null
}

type LiveTableRow = {
  tableKey: string
  tableNumber: string
  tableLabel: string
  tableState?: 'available' | 'active' | 'prepared' | 'delivered'
  occupied: boolean
  billId?: string | null
  status: string | null
  kotNumber: string | null
  totalAmount?: number | null
  servedBy: string | null
  startedAt: string | null
  elapsedSeconds: number | null
}

type LiveTableSection = {
  sectionName: string
  tables: LiveTableRow[]
}

type LiveTableBranch = {
  branchId: string
  branchName: string
  sections: LiveTableSection[]
}

type WidgetKey =
  | 'stock-order'
  | 'table-customer-details'
  | 'billing-customer-details'
  | 'live-table'
  | 'customer-offer-settings'
  | 'app-downloads'

const getRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id?: unknown }).id === 'string'
  ) {
    return (value as { id: string }).id
  }
  return null
}

const getElapsedLabel = (
  startedAt: string | null | undefined,
  elapsedFallback: number | null | undefined,
  nowMs: number,
): string => {
  let elapsedSeconds = 0

  if (typeof startedAt === 'string' && startedAt.trim().length > 0) {
    const startedAtMs = new Date(startedAt).getTime()
    if (Number.isFinite(startedAtMs)) {
      elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
    }
  } else if (typeof elapsedFallback === 'number' && Number.isFinite(elapsedFallback)) {
    elapsedSeconds = Math.max(0, Math.floor(elapsedFallback))
  }

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const getAmountLabel = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `Rs ${value.toFixed(2)}`
}

const getKotAmountLabel = (
  kotNumber: string | null | undefined,
  amount: number | null | undefined,
): string => {
  const normalizedKot =
    typeof kotNumber === 'string' && kotNumber.trim().length > 0 ? kotNumber.trim() : '-'
  return `${normalizedKot} - ${getAmountLabel(amount)}`
}

const CustomDateInput = React.forwardRef<
  HTMLInputElement,
  { value?: string; onClick?: () => void }
>(({ value, onClick }, ref) => (
  <div className="input-wrapper" onClick={onClick}>
    <input
      ref={ref}
      type="text"
      value={value}
      readOnly
      style={{
        width: '100%',
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '0.5rem',
        padding: '0.75rem',
        color: '#fff',
        cursor: 'pointer',
      }}
    />
  </div>
))
CustomDateInput.displayName = 'CustomDateInput'

const BillModal: React.FC<{
  billData: BillData | null
  loading: boolean
  onClose: () => void
}> = ({ billData, loading, onClose }) => {
  if (!billData && !loading) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '0',
          borderRadius: '0',
          width: '90%',
          maxWidth: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 25px rgba(0,0,0,0.5)',
          color: '#000',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#111' }}>Loading Bill...</div>
        ) : (
          billData && <BillReceipt data={billData} />
        )}
      </div>
    </div>
  )
}

const WidgetSettings: React.FC<any> = (props) => {
  const isAppDownloadMode = props.slug === 'app-download-settings'
  const [activeWidget, setActiveWidget] = useState<WidgetKey | null>(
    isAppDownloadMode ? 'app-downloads' : null,
  )
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingApp, setUploadingApp] = useState(false)
  const [newAppName, setNewAppName] = useState('')
  const [newAppFile, setNewAppFile] = useState<File | null>(null)
  const [copySuccessID, setCopySuccessID] = useState<string | null>(null)
  const [savingTableCustomerSetting, setSavingTableCustomerSetting] = useState(false)
  const [savingBillingCustomerSetting, setSavingBillingCustomerSetting] = useState(false)
  const [removingTableBranchID, setRemovingTableBranchID] = useState<string | null>(null)
  const [removingBillingBranchID, setRemovingBillingBranchID] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [tableOrderCustomerDetailsByBranch, setTableOrderCustomerDetailsByBranch] = useState<
    TableCustomerDetailsRow[]
  >([])
  const [billingOrderCustomerDetailsByBranch, setBillingOrderCustomerDetailsByBranch] = useState<
    BillingCustomerDetailsRow[]
  >([])
  const [appDownloadSettings, setAppDownloadSettings] = useState<AppDownloadSettings | null>(null)

  // Stock order modal state
  const [selectedBranch, setSelectedBranch] = useState<Option | null>(null)
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date(Date.now() + 86400000)) // Tomorrow
  const [orderType, setOrderType] = useState<Option>({
    value: 'stock',
    label: 'Stock Order',
  })
  const [message, setMessage] = useState('')

  // Customer details setting modal state
  const [selectedTableCustomerDetailsBranch, setSelectedTableCustomerDetailsBranch] =
    useState<Option | null>(null)
  const [tableCustomerDetailsVisibility, setTableCustomerDetailsVisibility] = useState<Option>({
    value: 'enabled',
    label: 'Enabled',
  })
  const [skipTableCustomerDetailsVisibility, setSkipTableCustomerDetailsVisibility] =
    useState<Option>({
      value: 'enabled',
      label: 'Enabled',
    })
  const [tableCustomerHistoryVisibility, setTableCustomerHistoryVisibility] = useState<Option>({
    value: 'enabled',
    label: 'Enabled',
  })

  const [selectedBillingCustomerDetailsBranch, setSelectedBillingCustomerDetailsBranch] =
    useState<Option | null>(null)
  const [billingCustomerDetailsVisibility, setBillingCustomerDetailsVisibility] = useState<Option>({
    value: 'enabled',
    label: 'Enabled',
  })
  const [skipBillingCustomerDetailsVisibility, setSkipBillingCustomerDetailsVisibility] =
    useState<Option>({
      value: 'enabled',
      label: 'Enabled',
    })
  const [billingCustomerHistoryVisibility, setBillingCustomerHistoryVisibility] = useState<Option>({
    value: 'enabled',
    label: 'Enabled',
  })
  const [selectedLiveTableBranch, setSelectedLiveTableBranch] = useState<Option>({
    value: 'all',
    label: 'All Branches',
  })
  const [liveTableBranches, setLiveTableBranches] = useState<LiveTableBranch[]>([])
  const [liveTableLoading, setLiveTableLoading] = useState(false)
  const [liveTableError, setLiveTableError] = useState<string | null>(null)
  const [liveTableTick, setLiveTableTick] = useState(0)
  const [selectedBill, setSelectedBill] = useState<BillData | null>(null)
  const [loadingBill, setLoadingBill] = useState(false)

  const branchOptions = useMemo(
    () => branches.map((branch) => ({ value: branch.id, label: branch.name })),
    [branches],
  )
  const liveTableBranchOptions = useMemo(
    () => [{ value: 'all', label: 'All Branches' }, ...branchOptions],
    [branchOptions],
  )
  const liveTableNowMs = useMemo(() => Date.now(), [liveTableTick])

  const visibilityOptions: Option[] = useMemo(
    () => [
      { value: 'enabled', label: 'Enabled' },
      { value: 'disabled', label: 'Disabled' },
    ],
    [],
  )

  const branchNameByID = useMemo(() => {
    const map = new Map<string, string>()
    branches.forEach((branch) => {
      map.set(branch.id, branch.name)
    })
    return map
  }, [branches])

  const configuredTableRows = useMemo(() => {
    return tableOrderCustomerDetailsByBranch
      .map((row) => {
        const branchID = getRelationshipID(row.branch)
        if (!branchID) return null

        return {
          branchID,
          branchName: branchNameByID.get(branchID) || branchID,
          showCustomerDetailsForTableOrders: row.showCustomerDetailsForTableOrders !== false,
          allowSkipCustomerDetailsForTableOrders:
            row.allowSkipCustomerDetailsForTableOrders !== false,
          showCustomerHistoryForTableOrders: row.showCustomerHistoryForTableOrders !== false,
        }
      })
      .filter(
        (
          row,
        ): row is {
          branchID: string
          branchName: string
          showCustomerDetailsForTableOrders: boolean
          allowSkipCustomerDetailsForTableOrders: boolean
          showCustomerHistoryForTableOrders: boolean
        } => row !== null,
      )
      .sort((a, b) => a.branchName.localeCompare(b.branchName))
  }, [tableOrderCustomerDetailsByBranch, branchNameByID])

  const configuredBillingRows = useMemo(() => {
    return billingOrderCustomerDetailsByBranch
      .map((row) => {
        const branchID = getRelationshipID(row.branch)
        if (!branchID) return null

        return {
          branchID,
          branchName: branchNameByID.get(branchID) || branchID,
          showCustomerDetailsForBillingOrders: row.showCustomerDetailsForBillingOrders !== false,
          allowSkipCustomerDetailsForBillingOrders:
            row.allowSkipCustomerDetailsForBillingOrders !== false,
          showCustomerHistoryForBillingOrders: row.showCustomerHistoryForBillingOrders !== false,
        }
      })
      .filter(
        (
          row,
        ): row is {
          branchID: string
          branchName: string
          showCustomerDetailsForBillingOrders: boolean
          allowSkipCustomerDetailsForBillingOrders: boolean
          showCustomerHistoryForBillingOrders: boolean
        } => row !== null,
      )
      .sort((a, b) => a.branchName.localeCompare(b.branchName))
  }, [billingOrderCustomerDetailsByBranch, branchNameByID])

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      try {
        const [branchesResponse, settingsResponse, appDownloadsResponse] = await Promise.all([
          fetch('/api/branches?limit=1000&sort=name'),
          fetch('/api/globals/widget-settings?depth=0'),
          fetch('/api/globals/app-download-settings?depth=1'),
        ])

        const branchesJSON = await branchesResponse.json()
        setBranches(branchesJSON.docs || [])

        if (settingsResponse.ok) {
          const settingsJSON = (await settingsResponse.json()) as WidgetSettingsGlobal
          setTableOrderCustomerDetailsByBranch(settingsJSON.tableOrderCustomerDetailsByBranch || [])
          setBillingOrderCustomerDetailsByBranch(
            settingsJSON.billingOrderCustomerDetailsByBranch || [],
          )
        }

        if (appDownloadsResponse.ok) {
          const appsJSON = (await appDownloadsResponse.json()) as AppDownloadSettings
          setAppDownloadSettings(appsJSON)
        }
      } catch (err) {
        console.error('Error fetching widget settings data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  const fetchLiveTableStatus = async (branchId: string) => {
    setLiveTableLoading(true)
    setLiveTableError(null)

    try {
      const query =
        branchId && branchId !== 'all' ? `?branchId=${encodeURIComponent(branchId)}` : ''
      const response = await fetch(`/api/widgets/live-table-status${query}`)
      const json = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof json?.message === 'string' ? json.message : 'Failed to load live table status',
        )
      }

      setLiveTableBranches(
        Array.isArray(json?.branches) ? (json.branches as LiveTableBranch[]) : [],
      )
    } catch (error) {
      console.error('Failed to fetch live table status:', error)
      setLiveTableError(
        error instanceof Error ? error.message : 'Unable to fetch live table status right now',
      )
      setLiveTableBranches([])
    } finally {
      setLiveTableLoading(false)
    }
  }

  useEffect(() => {
    if (activeWidget !== 'live-table') return
    void fetchLiveTableStatus(selectedLiveTableBranch.value)
  }, [activeWidget, selectedLiveTableBranch.value])

  useEffect(() => {
    if (activeWidget !== 'live-table') return

    const interval = window.setInterval(() => {
      setLiveTableTick((previous) => previous + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [activeWidget])

  const handleViewBillClick = async (billId: string | null | undefined) => {
    if (!billId) {
      alert('Bill details are not available for this table right now.')
      return
    }

    setLoadingBill(true)
    setSelectedBill(null)

    try {
      const bill = await getBill(billId)
      setSelectedBill(bill)
      if (!bill) {
        alert('Unable to load bill details')
      }
    } catch (error) {
      console.error('Failed to fetch bill', error)
      alert('Failed to load bill details')
    } finally {
      setLoadingBill(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedBranch || !deliveryDate || !message) {
      alert('Please fill in all fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/widgets/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranch.value,
          deliveryDate: deliveryDate.toISOString(),
          orderType: orderType.value,
          message: message,
        }),
      })

      const json = await res.json()
      if (res.ok) {
        alert(`Order created successfully! Invoice: ${json.invoiceNumber}`)
        setMessage('')
      } else {
        alert(`Error: ${json.message}`)
      }
    } catch (err) {
      console.error('Submission error:', err)
      alert('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyLink = (url: string, id: string) => {
    void navigator.clipboard.writeText(url)
    setCopySuccessID(id)
    setTimeout(() => setCopySuccessID(null), 2000)
  }

  const handleUploadApp = async () => {
    if (!newAppName.trim() || !newAppFile) {
      alert('Please provide an app name and select an APK file.')
      return
    }

    setUploadingApp(true)
    try {
      // 1. Upload APK File
      const formData = new FormData()
      formData.append('file', newAppFile)
      formData.append('alt', newAppName)

      const uploadRes = await fetch('/api/apk-files', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json()
        throw new Error(errJson?.errors?.[0]?.message || 'Failed to upload APK file')
      }

      const uploadedFile = await uploadRes.json()
      const apkID = uploadedFile.doc.id

      // 2. Update Global Settings
      const currentApps = appDownloadSettings?.apps || []
      const nextApps = [
        ...currentApps.map((a) => ({
          ...a,
          apkFile: typeof a.apkFile === 'object' ? a.apkFile?.id : a.apkFile,
        })),
        {
          appName: newAppName.trim(),
          apkFile: apkID,
          downloadURL: '', // Generated by backend hook
          appKey: '', // Generated by backend hook
        },
      ]

      const settingsRes = await fetch('/api/globals/app-download-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps: nextApps }),
      })

      if (!settingsRes.ok) {
        throw new Error('Failed to update app download settings')
      }

      const updatedSettings = await settingsRes.json()
      setAppDownloadSettings(updatedSettings)
      setNewAppName('')
      setNewAppFile(null)
      alert('App added successfully!')
    } catch (error) {
      console.error('App upload failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to add app')
    } finally {
      setUploadingApp(false)
    }
  }

  const handleRemoveApp = async (index: number) => {
    if (!confirm('Are you sure you want to remove this app?')) return

    setUploadingApp(true)
    try {
      const currentApps = appDownloadSettings?.apps || []
      const nextApps = currentApps
        .filter((_, i) => i !== index)
        .map((a) => ({ ...a, apkFile: typeof a.apkFile === 'object' ? a.apkFile?.id : a.apkFile }))

      const settingsRes = await fetch('/api/globals/app-download-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps: nextApps }),
      })

      const updatedSettings = await settingsRes.json()
      setAppDownloadSettings(updatedSettings)
    } catch (error) {
      console.error('Failed to remove app:', error)
      alert('Failed to remove app')
    } finally {
      setUploadingApp(false)
    }
  }

  useEffect(() => {
    if (!selectedTableCustomerDetailsBranch) {
      setTableCustomerDetailsVisibility({ value: 'enabled', label: 'Enabled' })
      setSkipTableCustomerDetailsVisibility({ value: 'enabled', label: 'Enabled' })
      setTableCustomerHistoryVisibility({ value: 'enabled', label: 'Enabled' })
      return
    }

    const branchID = selectedTableCustomerDetailsBranch.value
    const row = tableOrderCustomerDetailsByBranch.find(
      (candidate) => getRelationshipID(candidate.branch) === branchID,
    )
    const isPopupEnabled = row?.showCustomerDetailsForTableOrders !== false
    const isSkipEnabled = row?.allowSkipCustomerDetailsForTableOrders !== false
    const isHistoryEnabled = row?.showCustomerHistoryForTableOrders !== false
    setTableCustomerDetailsVisibility(isPopupEnabled ? visibilityOptions[0] : visibilityOptions[1])
    setSkipTableCustomerDetailsVisibility(
      isSkipEnabled ? visibilityOptions[0] : visibilityOptions[1],
    )
    setTableCustomerHistoryVisibility(
      isHistoryEnabled ? visibilityOptions[0] : visibilityOptions[1],
    )
  }, [selectedTableCustomerDetailsBranch, tableOrderCustomerDetailsByBranch, visibilityOptions])

  useEffect(() => {
    if (!selectedBillingCustomerDetailsBranch) {
      setBillingCustomerDetailsVisibility({ value: 'enabled', label: 'Enabled' })
      setSkipBillingCustomerDetailsVisibility({ value: 'enabled', label: 'Enabled' })
      setBillingCustomerHistoryVisibility({ value: 'enabled', label: 'Enabled' })
      return
    }

    const branchID = selectedBillingCustomerDetailsBranch.value
    const row = billingOrderCustomerDetailsByBranch.find(
      (candidate) => getRelationshipID(candidate.branch) === branchID,
    )
    const isPopupEnabled = row?.showCustomerDetailsForBillingOrders !== false
    const isSkipEnabled = row?.allowSkipCustomerDetailsForBillingOrders !== false
    const isHistoryEnabled = row?.showCustomerHistoryForBillingOrders !== false
    setBillingCustomerDetailsVisibility(
      isPopupEnabled ? visibilityOptions[0] : visibilityOptions[1],
    )
    setSkipBillingCustomerDetailsVisibility(
      isSkipEnabled ? visibilityOptions[0] : visibilityOptions[1],
    )
    setBillingCustomerHistoryVisibility(
      isHistoryEnabled ? visibilityOptions[0] : visibilityOptions[1],
    )
  }, [selectedBillingCustomerDetailsBranch, billingOrderCustomerDetailsByBranch, visibilityOptions])

  const persistCustomerSettings = async ({
    tableRows = tableOrderCustomerDetailsByBranch,
    billingRows = billingOrderCustomerDetailsByBranch,
  }: {
    tableRows?: TableCustomerDetailsRow[]
    billingRows?: BillingCustomerDetailsRow[]
  }): Promise<WidgetSettingsGlobal> => {
    const payloadData = {
      tableOrderCustomerDetailsByBranch: tableRows,
      billingOrderCustomerDetailsByBranch: billingRows,
    }

    let response: Response | null = null
    let methodsTried = 0
    for (const method of ['POST', 'PATCH']) {
      methodsTried += 1
      const attemptedResponse = await fetch('/api/globals/widget-settings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadData),
      })
      if (attemptedResponse.ok) {
        response = attemptedResponse
        break
      }
      if (![404, 405].includes(attemptedResponse.status)) {
        response = attemptedResponse
        break
      }
      if (methodsTried === 2) {
        response = attemptedResponse
      }
    }

    if (!response) {
      throw new Error('Failed to update widget settings')
    }

    const json = await response.json()
    if (!response.ok) {
      throw new Error(json?.message || 'Failed to update settings')
    }

    return json as WidgetSettingsGlobal
  }

  const saveTableCustomerDetailsSetting = async () => {
    if (!selectedTableCustomerDetailsBranch) {
      alert('Please select a branch')
      return
    }

    setSavingTableCustomerSetting(true)
    try {
      const branchID = selectedTableCustomerDetailsBranch.value
      const isPopupEnabled = tableCustomerDetailsVisibility.value === 'enabled'
      const isSkipEnabled = skipTableCustomerDetailsVisibility.value === 'enabled'
      const isHistoryEnabled = tableCustomerHistoryVisibility.value === 'enabled'

      const normalizedRows = tableOrderCustomerDetailsByBranch.map((row) => ({
        ...row,
        branch: getRelationshipID(row.branch) || row.branch,
      }))

      const existingRowForBranch = normalizedRows.find(
        (row) => getRelationshipID(row.branch) === branchID,
      )
      const dedupedRows = normalizedRows.filter((row) => getRelationshipID(row.branch) !== branchID)
      dedupedRows.push({
        ...(existingRowForBranch?.id ? { id: existingRowForBranch.id } : {}),
        branch: branchID,
        showCustomerDetailsForTableOrders: isPopupEnabled,
        allowSkipCustomerDetailsForTableOrders: isSkipEnabled,
        showCustomerHistoryForTableOrders: isHistoryEnabled,
      })

      const persistedSettings = await persistCustomerSettings({ tableRows: dedupedRows })
      setTableOrderCustomerDetailsByBranch(
        persistedSettings.tableOrderCustomerDetailsByBranch || dedupedRows,
      )
      setBillingOrderCustomerDetailsByBranch(
        persistedSettings.billingOrderCustomerDetailsByBranch ||
          billingOrderCustomerDetailsByBranch,
      )
      alert('Table customer details setting updated')
    } catch (error) {
      console.error('Failed to save table customer details setting:', error)
      alert('Failed to save table customer details setting')
    } finally {
      setSavingTableCustomerSetting(false)
    }
  }

  const removeTableConfiguredBranch = async (branchID: string, branchName: string) => {
    if (!confirm(`Remove "${branchName}" from configured branches?`)) {
      return
    }

    setRemovingTableBranchID(branchID)
    try {
      const nextRows = tableOrderCustomerDetailsByBranch
        .map((row) => ({
          ...row,
          branch: getRelationshipID(row.branch) || row.branch,
        }))
        .filter((row) => getRelationshipID(row.branch) !== branchID)

      const persistedSettings = await persistCustomerSettings({ tableRows: nextRows })
      setTableOrderCustomerDetailsByBranch(
        persistedSettings.tableOrderCustomerDetailsByBranch || nextRows,
      )
      setBillingOrderCustomerDetailsByBranch(
        persistedSettings.billingOrderCustomerDetailsByBranch ||
          billingOrderCustomerDetailsByBranch,
      )

      if (selectedTableCustomerDetailsBranch?.value === branchID) {
        setSelectedTableCustomerDetailsBranch(null)
      }

      alert('Branch removed from configured list')
    } catch (error) {
      console.error('Failed to remove branch from configured list:', error)
      alert('Failed to remove branch')
    } finally {
      setRemovingTableBranchID(null)
    }
  }

  const saveBillingCustomerDetailsSetting = async () => {
    if (!selectedBillingCustomerDetailsBranch) {
      alert('Please select a branch')
      return
    }

    setSavingBillingCustomerSetting(true)
    try {
      const branchID = selectedBillingCustomerDetailsBranch.value
      const isPopupEnabled = billingCustomerDetailsVisibility.value === 'enabled'
      const isSkipEnabled = skipBillingCustomerDetailsVisibility.value === 'enabled'
      const isHistoryEnabled = billingCustomerHistoryVisibility.value === 'enabled'

      const normalizedRows = billingOrderCustomerDetailsByBranch.map((row) => ({
        ...row,
        branch: getRelationshipID(row.branch) || row.branch,
      }))

      const existingRowForBranch = normalizedRows.find(
        (row) => getRelationshipID(row.branch) === branchID,
      )
      const dedupedRows = normalizedRows.filter((row) => getRelationshipID(row.branch) !== branchID)
      dedupedRows.push({
        ...(existingRowForBranch?.id ? { id: existingRowForBranch.id } : {}),
        branch: branchID,
        showCustomerDetailsForBillingOrders: isPopupEnabled,
        allowSkipCustomerDetailsForBillingOrders: isSkipEnabled,
        showCustomerHistoryForBillingOrders: isHistoryEnabled,
      })

      const persistedSettings = await persistCustomerSettings({ billingRows: dedupedRows })
      setTableOrderCustomerDetailsByBranch(
        persistedSettings.tableOrderCustomerDetailsByBranch || tableOrderCustomerDetailsByBranch,
      )
      setBillingOrderCustomerDetailsByBranch(
        persistedSettings.billingOrderCustomerDetailsByBranch || dedupedRows,
      )
      alert('Billing customer details setting updated')
    } catch (error) {
      console.error('Failed to save billing customer details setting:', error)
      alert('Failed to save billing customer details setting')
    } finally {
      setSavingBillingCustomerSetting(false)
    }
  }

  const removeBillingConfiguredBranch = async (branchID: string, branchName: string) => {
    if (!confirm(`Remove "${branchName}" from configured branches?`)) {
      return
    }

    setRemovingBillingBranchID(branchID)
    try {
      const nextRows = billingOrderCustomerDetailsByBranch
        .map((row) => ({
          ...row,
          branch: getRelationshipID(row.branch) || row.branch,
        }))
        .filter((row) => getRelationshipID(row.branch) !== branchID)

      const persistedSettings = await persistCustomerSettings({ billingRows: nextRows })
      setTableOrderCustomerDetailsByBranch(
        persistedSettings.tableOrderCustomerDetailsByBranch || tableOrderCustomerDetailsByBranch,
      )
      setBillingOrderCustomerDetailsByBranch(
        persistedSettings.billingOrderCustomerDetailsByBranch || nextRows,
      )

      if (selectedBillingCustomerDetailsBranch?.value === branchID) {
        setSelectedBillingCustomerDetailsBranch(null)
      }

      alert('Branch removed from configured list')
    } catch (error) {
      console.error('Failed to remove billing branch from configured list:', error)
      alert('Failed to remove branch')
    } finally {
      setRemovingBillingBranchID(null)
    }
  }

  const customSelectStyles = {
    control: (base: any) => ({
      ...base,
      backgroundColor: '#18181b',
      borderColor: '#27272a',
      color: '#fff',
      '&:hover': { borderColor: '#3b82f6' },
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: '#18181b',
      border: '1px solid #27272a',
      zIndex: 1001,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? '#27272a' : 'transparent',
      color: '#fff',
      '&:active': { backgroundColor: '#3b82f6' },
    }),
    singleValue: (base: any) => ({ ...base, color: '#fff' }),
    input: (base: any) => ({ ...base, color: '#fff' }),
  }

  return (
    <div className="widget-settings">
      <div className="header">
        <h1>{isAppDownloadMode ? 'App Downloads' : 'Widgets'}</h1>
        <p>
          {isAppDownloadMode
            ? 'Access and download the latest application builds.'
            : 'Quickly execute widget tasks and workflows.'}
        </p>
      </div>

      <div className="widgets-layout">
        <div className="tiles-grid">
          <button
            type="button"
            className={`tile ${activeWidget === 'stock-order' ? 'active' : ''}`}
            onClick={() => setActiveWidget('stock-order')}
          >
            <Package className="tile-icon" size={48} />
            <span className="tile-label">Stock Order</span>
          </button>
          <button
            type="button"
            className={`tile ${activeWidget === 'table-customer-details' ? 'active' : ''}`}
            onClick={() => setActiveWidget('table-customer-details')}
          >
            <UserRound className="tile-icon" size={48} />
            <span className="tile-label">Table Customer Details</span>
          </button>
          <button
            type="button"
            className={`tile ${activeWidget === 'billing-customer-details' ? 'active' : ''}`}
            onClick={() => setActiveWidget('billing-customer-details')}
          >
            <UserRound className="tile-icon" size={48} />
            <span className="tile-label">Billing Customer Details</span>
          </button>
          <button
            type="button"
            className={`tile ${activeWidget === 'live-table' ? 'active' : ''}`}
            onClick={() => setActiveWidget('live-table')}
          >
            <LayoutGrid className="tile-icon" size={48} />
            <span className="tile-label">Live Table</span>
          </button>
          <button
            type="button"
            className={`tile ${activeWidget === 'customer-offer-settings' ? 'active' : ''}`}
            onClick={() => setActiveWidget('customer-offer-settings')}
          >
            <Gift className="tile-icon" size={48} />
            <span className="tile-label">Customer Offer Settings</span>
          </button>
          <button
            type="button"
            className={`tile ${activeWidget === 'app-downloads' ? 'active' : ''}`}
            onClick={() => setActiveWidget('app-downloads')}
          >
            <Download className="tile-icon" size={48} />
            <span className="tile-label">App Downloads</span>
          </button>
        </div>

        <div className="widget-panel">
          {!activeWidget && (
            <div className="panel-empty">
              <h2>Select a widget</h2>
              <p>Choose one of the widgets on the left to open it on this side.</p>
            </div>
          )}

          {activeWidget === 'stock-order' && (
            <div className="widget-modal">
              <div className="modal-header">
                <h2>Stock Order</h2>
                <button className="close-btn" onClick={() => setActiveWidget(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <MapPin size={14} style={{ marginRight: 4 }} /> Branch
                  </label>
                  <Select
                    options={branchOptions}
                    value={selectedBranch}
                    onChange={(option) => setSelectedBranch(option as Option | null)}
                    styles={customSelectStyles}
                    placeholder="Select Branch..."
                    isLoading={loading}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <Calendar size={14} style={{ marginRight: 4 }} /> Delivery Date
                    </label>
                    <DatePicker
                      selected={deliveryDate}
                      onChange={(date: Date | null) => setDeliveryDate(date || new Date())}
                      className="custom-date-picker"
                      dateFormat="yyyy-MM-dd"
                      customInput={<CustomDateInput />}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <ListFilter size={14} style={{ marginRight: 4 }} /> Order Type
                    </label>
                    <Select
                      options={[
                        { value: 'stock', label: 'Stock Order' },
                        { value: 'live', label: 'Live Order' },
                      ]}
                      value={orderType}
                      onChange={(option) => setOrderType((option as Option) || orderType)}
                      styles={customSelectStyles}
                      isSearchable={false}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <MessageSquare size={14} style={{ marginRight: 4 }} /> Order Details (Product
                    Qty)
                  </label>
                  <textarea
                    placeholder="Example:&#10;Veg puff 30&#10;Egg puff 20"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setActiveWidget(null)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" size={16} /> Creating...
                    </span>
                  ) : (
                    'Create Order'
                  )}
                </button>
              </div>
            </div>
          )}

          {activeWidget === 'table-customer-details' && (
            <div className="widget-modal">
              <div className="modal-header">
                <h2>Table Customer Details Setting</h2>
                <button className="close-btn" onClick={() => setActiveWidget(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <MapPin size={14} style={{ marginRight: 4 }} /> Branch
                  </label>
                  <Select
                    options={branchOptions}
                    value={selectedTableCustomerDetailsBranch}
                    onChange={(option) =>
                      setSelectedTableCustomerDetailsBranch(option as Option | null)
                    }
                    styles={customSelectStyles}
                    placeholder="Select Branch..."
                    isLoading={loading}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <ListFilter size={14} style={{ marginRight: 4 }} /> Show Customer Details Popup
                  </label>
                  <Select
                    options={visibilityOptions}
                    value={tableCustomerDetailsVisibility}
                    onChange={(option) =>
                      setTableCustomerDetailsVisibility((option as Option) || visibilityOptions[0])
                    }
                    styles={customSelectStyles}
                    isSearchable={false}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <ListFilter size={14} style={{ marginRight: 4 }} /> Allow Skip Button
                  </label>
                  <Select
                    options={visibilityOptions}
                    value={skipTableCustomerDetailsVisibility}
                    onChange={(option) =>
                      setSkipTableCustomerDetailsVisibility(
                        (option as Option) || visibilityOptions[0],
                      )
                    }
                    styles={customSelectStyles}
                    isSearchable={false}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <ListFilter size={14} style={{ marginRight: 4 }} /> Show Customer History
                    Button
                  </label>
                  <Select
                    options={visibilityOptions}
                    value={tableCustomerHistoryVisibility}
                    onChange={(option) =>
                      setTableCustomerHistoryVisibility(
                        (option as Option) || visibilityOptions[0],
                      )
                    }
                    styles={customSelectStyles}
                    isSearchable={false}
                  />
                </div>

                <div className="configured-settings">
                  <h3>Configured Branches</h3>
                  {configuredTableRows.length === 0 ? (
                    <p className="empty-state">No branch-specific setting saved yet.</p>
                  ) : (
                    <div className="configured-list">
                      {configuredTableRows.map((row) => (
                        <div className="configured-row" key={row.branchID}>
                          <span className="branch-name">{row.branchName}</span>
                          <div className="row-controls">
                            <div className="status-group">
                              <span
                                className={
                                  row.showCustomerDetailsForTableOrders
                                    ? 'status-badge status-enabled'
                                    : 'status-badge status-disabled'
                                }
                              >
                                Popup:{' '}
                                {row.showCustomerDetailsForTableOrders ? 'Enabled' : 'Disabled'}
                              </span>
                              <span
                                className={
                                  row.allowSkipCustomerDetailsForTableOrders
                                    ? 'status-badge status-enabled'
                                    : 'status-badge status-disabled'
                                }
                              >
                                Skip:{' '}
                                {row.allowSkipCustomerDetailsForTableOrders
                                  ? 'Enabled'
                                  : 'Disabled'}
                              </span>
                              <span
                                className={
                                  row.showCustomerHistoryForTableOrders
                                    ? 'status-badge status-enabled'
                                    : 'status-badge status-disabled'
                                }
                              >
                                History:{' '}
                                {row.showCustomerHistoryForTableOrders ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="remove-row-btn"
                              onClick={() =>
                                removeTableConfiguredBranch(row.branchID, row.branchName)
                              }
                              disabled={Boolean(removingTableBranchID)}
                            >
                              {removingTableBranchID === row.branchID ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <Trash2 size={14} />
                              )}
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setActiveWidget(null)}>
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  onClick={saveTableCustomerDetailsSetting}
                  disabled={savingTableCustomerSetting || !selectedTableCustomerDetailsBranch}
                >
                  {savingTableCustomerSetting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" size={16} /> Saving...
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Save size={16} /> Save Setting
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeWidget === 'billing-customer-details' && (
            <div className="widget-modal">
              <div className="modal-header">
                <h2>Billing Customer Details Setting</h2>
                <button className="close-btn" onClick={() => setActiveWidget(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <MapPin size={14} style={{ marginRight: 4 }} /> Branch
                  </label>
                  <Select
                    options={branchOptions}
                    value={selectedBillingCustomerDetailsBranch}
                    onChange={(option) =>
                      setSelectedBillingCustomerDetailsBranch(option as Option | null)
                    }
                    styles={customSelectStyles}
                    placeholder="Select Branch..."
                    isLoading={loading}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <ListFilter size={14} style={{ marginRight: 4 }} /> Show Customer Details Popup
                  </label>
                  <Select
                    options={visibilityOptions}
                    value={billingCustomerDetailsVisibility}
                    onChange={(option) =>
                      setBillingCustomerDetailsVisibility(
                        (option as Option) || visibilityOptions[0],
                      )
                    }
                    styles={customSelectStyles}
                    isSearchable={false}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <ListFilter size={14} style={{ marginRight: 4 }} /> Allow Skip Button
                  </label>
                  <Select
                    options={visibilityOptions}
                    value={skipBillingCustomerDetailsVisibility}
                    onChange={(option) =>
                      setSkipBillingCustomerDetailsVisibility(
                        (option as Option) || visibilityOptions[0],
                      )
                    }
                    styles={customSelectStyles}
                    isSearchable={false}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <ListFilter size={14} style={{ marginRight: 4 }} /> Show Customer History
                    Button
                  </label>
                  <Select
                    options={visibilityOptions}
                    value={billingCustomerHistoryVisibility}
                    onChange={(option) =>
                      setBillingCustomerHistoryVisibility(
                        (option as Option) || visibilityOptions[0],
                      )
                    }
                    styles={customSelectStyles}
                    isSearchable={false}
                  />
                </div>

                <div className="configured-settings">
                  <h3>Configured Branches</h3>
                  {configuredBillingRows.length === 0 ? (
                    <p className="empty-state">No branch-specific setting saved yet.</p>
                  ) : (
                    <div className="configured-list">
                      {configuredBillingRows.map((row) => (
                        <div className="configured-row" key={row.branchID}>
                          <span className="branch-name">{row.branchName}</span>
                          <div className="row-controls">
                            <div className="status-group">
                              <span
                                className={
                                  row.showCustomerDetailsForBillingOrders
                                    ? 'status-badge status-enabled'
                                    : 'status-badge status-disabled'
                                }
                              >
                                Popup:{' '}
                                {row.showCustomerDetailsForBillingOrders ? 'Enabled' : 'Disabled'}
                              </span>
                              <span
                                className={
                                  row.allowSkipCustomerDetailsForBillingOrders
                                    ? 'status-badge status-enabled'
                                    : 'status-badge status-disabled'
                                }
                              >
                                Skip:{' '}
                                {row.allowSkipCustomerDetailsForBillingOrders
                                  ? 'Enabled'
                                  : 'Disabled'}
                              </span>
                              <span
                                className={
                                  row.showCustomerHistoryForBillingOrders
                                    ? 'status-badge status-enabled'
                                    : 'status-badge status-disabled'
                                }
                              >
                                History:{' '}
                                {row.showCustomerHistoryForBillingOrders ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="remove-row-btn"
                              onClick={() =>
                                removeBillingConfiguredBranch(row.branchID, row.branchName)
                              }
                              disabled={Boolean(removingBillingBranchID)}
                            >
                              {removingBillingBranchID === row.branchID ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <Trash2 size={14} />
                              )}
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setActiveWidget(null)}>
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  onClick={saveBillingCustomerDetailsSetting}
                  disabled={savingBillingCustomerSetting || !selectedBillingCustomerDetailsBranch}
                >
                  {savingBillingCustomerSetting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" size={16} /> Saving...
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Save size={16} /> Save Setting
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeWidget === 'live-table' && (
            <div className="widget-modal">
              <div className="modal-header live-table-modal-header">
                <h2>Live Table</h2>
                <div className="live-table-toolbar">
                  <div className="live-table-branch-filter">
                    <Select
                      options={liveTableBranchOptions}
                      value={selectedLiveTableBranch}
                      onChange={(option) =>
                        setSelectedLiveTableBranch((option as Option) || liveTableBranchOptions[0])
                      }
                      styles={customSelectStyles}
                      isSearchable={false}
                      isDisabled={liveTableLoading}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary live-refresh-btn"
                    onClick={() => void fetchLiveTableStatus(selectedLiveTableBranch.value)}
                    disabled={liveTableLoading}
                  >
                    {liveTableLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        Refresh
                      </>
                    )}
                  </button>
                </div>
                <button className="close-btn" onClick={() => setActiveWidget(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {liveTableError && <p className="live-error">{liveTableError}</p>}

                {!liveTableLoading && !liveTableError && liveTableBranches.length === 0 && (
                  <p className="live-empty-state">
                    No table configuration found for the selected branch.
                  </p>
                )}

                {liveTableBranches.map((branch) => (
                  <div className="live-branch-block" key={branch.branchId}>
                    <h3 className="live-branch-title">{branch.branchName}</h3>

                    {branch.sections.length === 0 ? (
                      <p className="live-empty-state">No sections available.</p>
                    ) : (
                      branch.sections.map((section) => (
                        <div
                          className="live-section-block"
                          key={`${branch.branchId}-${section.sectionName}`}
                        >
                          <h4 className="live-section-title">{section.sectionName}</h4>
                          <div className="live-table-grid">
                            {section.tables.map((table) => {
                              const tableVisualState =
                                table.tableState === 'active' ||
                                table.tableState === 'prepared' ||
                                table.tableState === 'delivered' ||
                                table.tableState === 'available'
                                  ? table.tableState
                                  : table.occupied
                                    ? 'active'
                                    : 'available'
                              const showActiveTimer = tableVisualState === 'active'
                              const showOccupiedDetails = tableVisualState !== 'available'

                              return (
                                <div
                                  className={`live-table-card ${tableVisualState}`}
                                  key={`${branch.branchId}-${section.sectionName}-${table.tableKey}`}
                                >
                                  {showActiveTimer && (
                                    <div className="table-timer">
                                      {getElapsedLabel(
                                        table.startedAt,
                                        table.elapsedSeconds,
                                        liveTableNowMs,
                                      )}
                                    </div>
                                  )}
                                  <div className="table-name">{table.tableLabel}</div>
                                  {showOccupiedDetails ? (
                                    <>
                                      <div className="table-kot">
                                        {getKotAmountLabel(table.kotNumber, table.totalAmount)}
                                      </div>
                                      <div className="table-by">
                                        By:{' '}
                                        {table.servedBy && table.servedBy.length > 0
                                          ? table.servedBy
                                          : '-'}
                                      </div>
                                      <div className="table-actions">
                                        <button
                                          type="button"
                                          className="table-action-btn"
                                          aria-label="View"
                                          onClick={() => void handleViewBillClick(table.billId)}
                                        >
                                          <Eye size={15} />
                                        </button>
                                        <button
                                          type="button"
                                          className="table-action-btn"
                                          aria-label="Print"
                                        >
                                          <Printer size={15} />
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="table-available-label">Available</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeWidget === 'app-downloads' && (
            <div className="widget-modal">
              <div className="modal-header">
                <h2>App Downloads</h2>
                <button className="close-btn" onClick={() => setActiveWidget(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <p
                  style={{
                    color: '#a1a1aa',
                    marginBottom: '1.5rem',
                    fontSize: '0.95rem',
                    lineHeight: '1.5',
                  }}
                >
                  Download the latest compiled versions of our mobile applications. These links are
                  always pointing to the most recent APK files.
                </p>

                <div className="configured-settings" style={{ borderTop: 'none', paddingTop: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem',
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Available Applications</h3>
                  </div>

                  {!appDownloadSettings?.apps || appDownloadSettings.apps.length === 0 ? (
                    <p className="empty-state">No apps have been configured for download yet.</p>
                  ) : (
                    <div className="configured-list">
                      {appDownloadSettings.apps.map((app, idx) => (
                        <div className="configured-row" key={idx}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="branch-name" style={{ fontSize: '1rem' }}>
                              {app.appName}
                            </span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#71717a',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={app.downloadURL}
                            >
                              {app.downloadURL}
                            </span>
                          </div>
                          <div className="row-controls">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                              onClick={() => handleCopyLink(app.downloadURL, `copy-${idx}`)}
                            >
                              {copySuccessID === `copy-${idx}` ? (
                                <Check size={14} style={{ color: '#22c55e' }} />
                              ) : (
                                <Copy size={14} />
                              )}
                              Copy Link
                            </button>
                            <a
                              href={app.downloadURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: '#3b82f6',
                                textDecoration: 'none',
                              }}
                            >
                              <Download size={14} />
                              Download
                            </a>
                            <button
                              type="button"
                              className="remove-row-btn"
                              style={{ padding: '0.4rem 0.75rem' }}
                              onClick={() => handleRemoveApp(idx)}
                              disabled={uploadingApp}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: '2rem',
                      padding: '1.5rem',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '0.75rem',
                    }}
                  >
                    <h4
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        margin: '0 0 1rem 0',
                        fontSize: '1rem',
                        color: '#fff',
                      }}
                    >
                      <Upload size={18} />
                      Add New App Build
                    </h4>
                    <div className="form-group">
                      <label>App Name</label>
                      <input
                        type="text"
                        value={newAppName}
                        onChange={(e) => setNewAppName(e.target.value)}
                        placeholder="e.g. Blackforest Branch App"
                        style={{
                          width: '100%',
                          background: '#09090b',
                          border: '1px solid #27272a',
                          borderRadius: '0.5rem',
                          padding: '0.6rem 0.75rem',
                          color: '#fff',
                          marginBottom: '1rem',
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>APK File</label>
                      <input
                        type="file"
                        accept=".apk"
                        onChange={(e) => setNewAppFile(e.target.files?.[0] || null)}
                        style={{
                          width: '100%',
                          color: '#a1a1aa',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '1rem', width: '100%' }}
                      onClick={handleUploadApp}
                      disabled={uploadingApp || !newAppFile || !newAppName}
                    >
                      {uploadingApp ? (
                        <>
                          <Loader2 className="animate-spin" size={16} /> Uploading & Saving...
                        </>
                      ) : (
                        <>
                          <Plus size={16} /> Add App to Downloads
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setActiveWidget(null)}>
                  Close
                </button>
              </div>
            </div>
          )}

          {activeWidget === 'customer-offer-settings' && (
            <div className="widget-modal widget-modal-embedded">
              <div className="modal-header">
                <h2>Customer Offer Settings</h2>
                <button className="close-btn" onClick={() => setActiveWidget(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body embedded-settings-body">
                <CustomerOfferWidget />
              </div>
            </div>
          )}

        </div>
      </div>

      {(selectedBill || loadingBill) && (
        <BillModal
          billData={selectedBill}
          loading={loadingBill}
          onClose={() => {
            setSelectedBill(null)
            setLoadingBill(false)
          }}
        />
      )}
    </div>
  )
}

export default WidgetSettings
