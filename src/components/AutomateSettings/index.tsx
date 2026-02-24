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
} from 'lucide-react'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './index.scss'

type Option = { value: string; label: string }
type Branch = { id: string; name: string }

type TableCustomerDetailsRow = {
  id?: string
  branch?: string | { id?: string; name?: string } | null
  showCustomerDetailsForTableOrders?: boolean | null
  allowSkipCustomerDetailsForTableOrders?: boolean | null
}

type BillingCustomerDetailsRow = {
  id?: string
  branch?: string | { id?: string; name?: string } | null
  showCustomerDetailsForBillingOrders?: boolean | null
  allowSkipCustomerDetailsForBillingOrders?: boolean | null
}

type AutomateSettingsGlobal = {
  tableOrderCustomerDetailsByBranch?: TableCustomerDetailsRow[] | null
  billingOrderCustomerDetailsByBranch?: BillingCustomerDetailsRow[] | null
}

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

const AutomateSettings: React.FC = () => {
  const [isStockOrderModalOpen, setIsStockOrderModalOpen] = useState(false)
  const [isTableCustomerDetailsModalOpen, setIsTableCustomerDetailsModalOpen] = useState(false)
  const [isBillingCustomerDetailsModalOpen, setIsBillingCustomerDetailsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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

  // Stock order modal state
  const [selectedBranch, setSelectedBranch] = useState<Option | null>(null)
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date(Date.now() + 86400000)) // Tomorrow
  const [orderType, setOrderType] = useState<Option>({
    value: 'stock',
    label: 'Stock Order',
  })
  const [message, setMessage] = useState('')

  // Customer details setting modal state
  const [selectedTableCustomerDetailsBranch, setSelectedTableCustomerDetailsBranch] = useState<Option | null>(
    null,
  )
  const [tableCustomerDetailsVisibility, setTableCustomerDetailsVisibility] = useState<Option>({
    value: 'enabled',
    label: 'Enabled',
  })
  const [skipTableCustomerDetailsVisibility, setSkipTableCustomerDetailsVisibility] = useState<Option>({
    value: 'enabled',
    label: 'Enabled',
  })

  const [selectedBillingCustomerDetailsBranch, setSelectedBillingCustomerDetailsBranch] =
    useState<Option | null>(null)
  const [billingCustomerDetailsVisibility, setBillingCustomerDetailsVisibility] = useState<Option>({
    value: 'enabled',
    label: 'Enabled',
  })
  const [skipBillingCustomerDetailsVisibility, setSkipBillingCustomerDetailsVisibility] = useState<Option>({
    value: 'enabled',
    label: 'Enabled',
  })

  const branchOptions = useMemo(
    () => branches.map((branch) => ({ value: branch.id, label: branch.name })),
    [branches],
  )

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
        } => row !== null,
      )
      .sort((a, b) => a.branchName.localeCompare(b.branchName))
  }, [billingOrderCustomerDetailsByBranch, branchNameByID])

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      try {
        const [branchesResponse, settingsResponse] = await Promise.all([
          fetch('/api/branches?limit=1000&sort=name'),
          fetch('/api/globals/automate-settings?depth=0'),
        ])

        const branchesJSON = await branchesResponse.json()
        setBranches(branchesJSON.docs || [])

        if (settingsResponse.ok) {
          const settingsJSON = (await settingsResponse.json()) as AutomateSettingsGlobal
          setTableOrderCustomerDetailsByBranch(settingsJSON.tableOrderCustomerDetailsByBranch || [])
          setBillingOrderCustomerDetailsByBranch(settingsJSON.billingOrderCustomerDetailsByBranch || [])
        }
      } catch (err) {
        console.error('Error fetching automate settings data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  const handleSubmit = async () => {
    if (!selectedBranch || !deliveryDate || !message) {
      alert('Please fill in all fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/automate/create-order', {
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
        setIsStockOrderModalOpen(false)
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

  useEffect(() => {
    if (!selectedTableCustomerDetailsBranch) {
      setTableCustomerDetailsVisibility({ value: 'enabled', label: 'Enabled' })
      setSkipTableCustomerDetailsVisibility({ value: 'enabled', label: 'Enabled' })
      return
    }

    const branchID = selectedTableCustomerDetailsBranch.value
    const row = tableOrderCustomerDetailsByBranch.find(
      (candidate) => getRelationshipID(candidate.branch) === branchID,
    )
    const isPopupEnabled = row?.showCustomerDetailsForTableOrders !== false
    const isSkipEnabled = row?.allowSkipCustomerDetailsForTableOrders !== false
    setTableCustomerDetailsVisibility(isPopupEnabled ? visibilityOptions[0] : visibilityOptions[1])
    setSkipTableCustomerDetailsVisibility(isSkipEnabled ? visibilityOptions[0] : visibilityOptions[1])
  }, [selectedTableCustomerDetailsBranch, tableOrderCustomerDetailsByBranch, visibilityOptions])

  useEffect(() => {
    if (!selectedBillingCustomerDetailsBranch) {
      setBillingCustomerDetailsVisibility({ value: 'enabled', label: 'Enabled' })
      setSkipBillingCustomerDetailsVisibility({ value: 'enabled', label: 'Enabled' })
      return
    }

    const branchID = selectedBillingCustomerDetailsBranch.value
    const row = billingOrderCustomerDetailsByBranch.find(
      (candidate) => getRelationshipID(candidate.branch) === branchID,
    )
    const isPopupEnabled = row?.showCustomerDetailsForBillingOrders !== false
    const isSkipEnabled = row?.allowSkipCustomerDetailsForBillingOrders !== false
    setBillingCustomerDetailsVisibility(isPopupEnabled ? visibilityOptions[0] : visibilityOptions[1])
    setSkipBillingCustomerDetailsVisibility(isSkipEnabled ? visibilityOptions[0] : visibilityOptions[1])
  }, [selectedBillingCustomerDetailsBranch, billingOrderCustomerDetailsByBranch, visibilityOptions])

  const persistCustomerSettings = async ({
    tableRows = tableOrderCustomerDetailsByBranch,
    billingRows = billingOrderCustomerDetailsByBranch,
  }: {
    tableRows?: TableCustomerDetailsRow[]
    billingRows?: BillingCustomerDetailsRow[]
  }): Promise<AutomateSettingsGlobal> => {
    const payloadData = {
      tableOrderCustomerDetailsByBranch: tableRows,
      billingOrderCustomerDetailsByBranch: billingRows,
    }

    let response: Response | null = null
    let methodsTried = 0
    for (const method of ['POST', 'PATCH']) {
      methodsTried += 1
      const attemptedResponse = await fetch('/api/globals/automate-settings', {
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
      throw new Error('Failed to update automate settings')
    }

    const json = await response.json()
    if (!response.ok) {
      throw new Error(json?.message || 'Failed to update settings')
    }

    return json as AutomateSettingsGlobal
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
      })

      const persistedSettings = await persistCustomerSettings({ tableRows: dedupedRows })
      setTableOrderCustomerDetailsByBranch(
        persistedSettings.tableOrderCustomerDetailsByBranch || dedupedRows,
      )
      setBillingOrderCustomerDetailsByBranch(
        persistedSettings.billingOrderCustomerDetailsByBranch || billingOrderCustomerDetailsByBranch,
      )
      alert('Table customer details setting updated')
      setIsTableCustomerDetailsModalOpen(false)
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
        persistedSettings.billingOrderCustomerDetailsByBranch || billingOrderCustomerDetailsByBranch,
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
      })

      const persistedSettings = await persistCustomerSettings({ billingRows: dedupedRows })
      setTableOrderCustomerDetailsByBranch(
        persistedSettings.tableOrderCustomerDetailsByBranch || tableOrderCustomerDetailsByBranch,
      )
      setBillingOrderCustomerDetailsByBranch(
        persistedSettings.billingOrderCustomerDetailsByBranch || dedupedRows,
      )
      alert('Billing customer details setting updated')
      setIsBillingCustomerDetailsModalOpen(false)
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
    <div className="automate-settings">
      <div className="header">
        <h1>Automate</h1>
        <p>Quickly execute automated tasks and workflows.</p>
      </div>

      <div className="tiles-grid">
        <div className="tile" onClick={() => setIsStockOrderModalOpen(true)}>
          <Package className="tile-icon" size={48} />
          <span className="tile-label">Stock Order</span>
        </div>
        <div className="tile" onClick={() => setIsTableCustomerDetailsModalOpen(true)}>
          <UserRound className="tile-icon" size={48} />
          <span className="tile-label">Table Customer Details</span>
        </div>
        <div className="tile" onClick={() => setIsBillingCustomerDetailsModalOpen(true)}>
          <UserRound className="tile-icon" size={48} />
          <span className="tile-label">Billing Customer Details</span>
        </div>
      </div>

      {isStockOrderModalOpen && (
        <div className="automate-modal-overlay" onClick={() => setIsStockOrderModalOpen(false)}>
          <div className="automate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Automate Stock Order</h2>
              <button className="close-btn" onClick={() => setIsStockOrderModalOpen(false)}>
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
                  <MessageSquare size={14} style={{ marginRight: 4 }} /> Order Details (Product Qty)
                </label>
                <textarea
                  placeholder="Example:&#10;Veg puff 30&#10;Egg puff 20"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsStockOrderModalOpen(false)}>
                Cancel
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
        </div>
      )}

      {isTableCustomerDetailsModalOpen && (
        <div className="automate-modal-overlay" onClick={() => setIsTableCustomerDetailsModalOpen(false)}>
          <div className="automate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Table Customer Details Setting</h2>
              <button className="close-btn" onClick={() => setIsTableCustomerDetailsModalOpen(false)}>
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
                  onChange={(option) => setSelectedTableCustomerDetailsBranch(option as Option | null)}
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
                    setSkipTableCustomerDetailsVisibility((option as Option) || visibilityOptions[0])
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
                              Popup: {row.showCustomerDetailsForTableOrders ? 'Enabled' : 'Disabled'}
                            </span>
                            <span
                              className={
                                row.allowSkipCustomerDetailsForTableOrders
                                  ? 'status-badge status-enabled'
                                  : 'status-badge status-disabled'
                              }
                            >
                              Skip: {row.allowSkipCustomerDetailsForTableOrders ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="remove-row-btn"
                            onClick={() => removeTableConfiguredBranch(row.branchID, row.branchName)}
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
              <button className="btn btn-secondary" onClick={() => setIsTableCustomerDetailsModalOpen(false)}>
                Cancel
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
        </div>
      )}

      {isBillingCustomerDetailsModalOpen && (
        <div className="automate-modal-overlay" onClick={() => setIsBillingCustomerDetailsModalOpen(false)}>
          <div className="automate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Billing Customer Details Setting</h2>
              <button className="close-btn" onClick={() => setIsBillingCustomerDetailsModalOpen(false)}>
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
                  onChange={(option) => setSelectedBillingCustomerDetailsBranch(option as Option | null)}
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
                    setBillingCustomerDetailsVisibility((option as Option) || visibilityOptions[0])
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
                    setSkipBillingCustomerDetailsVisibility((option as Option) || visibilityOptions[0])
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
                              Popup: {row.showCustomerDetailsForBillingOrders ? 'Enabled' : 'Disabled'}
                            </span>
                            <span
                              className={
                                row.allowSkipCustomerDetailsForBillingOrders
                                  ? 'status-badge status-enabled'
                                  : 'status-badge status-disabled'
                              }
                            >
                              Skip: {row.allowSkipCustomerDetailsForBillingOrders ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="remove-row-btn"
                            onClick={() => removeBillingConfiguredBranch(row.branchID, row.branchName)}
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
              <button className="btn btn-secondary" onClick={() => setIsBillingCustomerDetailsModalOpen(false)}>
                Cancel
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
        </div>
      )}
    </div>
  )
}

export default AutomateSettings
