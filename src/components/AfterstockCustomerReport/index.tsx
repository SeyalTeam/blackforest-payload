'use client'

import React, { useState, useEffect, useRef } from 'react'
import './index.scss' // reusing the same scss or creating new one? Let's assume we can reuse basic table styles if they are global or in a similar scss.
// However, the prompt implies "follow same table ui in product wise".
// ProductWise has its own index.scss. I should probably create one or reuse it.
// For now, I will assume I need to create a basic scss file or use inline styles for simplicity if scss is not shared.
// Actually, I'll create a scss file for it to be safe.

import Select from 'react-select'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { getBill } from '@/app/actions/getBill'
import BillReceipt, { BillData } from '@/components/BillReceipt'

type CustomerStat = {
  sNo: number
  customerName: string
  phoneNumber: string
  totalBills: number
  totalAmount: number
  lastPurchasingDate: string
  billId?: string
  billIds?: string[]
  branchName?: string
  waiterName?: string
}

type ReportData = {
  startDate: string
  endDate: string
  stats: CustomerStat[]
}

type ReportBranch = {
  id: string
  name: string
}

type ReportWaiter = {
  id: string
  name?: string | null
}

const BillModal: React.FC<{
  billData: BillData | null
  loading: boolean
  customerName: string
  customerPhone: string
  currentIndex: number
  totalBills: number
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  onNavigatorWheel: (event: React.WheelEvent<HTMLDivElement>) => void
  onClose: () => void
}> = ({
  billData,
  loading,
  customerName,
  customerPhone,
  currentIndex,
  totalBills,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onNavigatorWheel,
  onClose,
}) => {
  if (!billData && !loading) return null

  return (
    <div className="bill-modal-overlay" onClick={onClose}>
      <div className="bill-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="bill-modal-toolbar" onWheel={onNavigatorWheel}>
          <div className="bill-modal-customer">
            <strong>{customerName?.toUpperCase() || 'CUSTOMER'}</strong>
            <span>{customerPhone}</span>
          </div>
          <div className="bill-modal-navigation">
            <button type="button" onClick={onPrev} disabled={loading || !hasPrev}>
              Prev
            </button>
            <span className="bill-modal-counter">
              {totalBills > 0 ? `${currentIndex + 1} / ${totalBills}` : '0 / 0'}
            </span>
            <button type="button" onClick={onNext} disabled={loading || !hasNext}>
              Next
            </button>
          </div>
        </div>
        {loading ? (
          <div className="bill-modal-loading">Loading Bill...</div>
        ) : (
          billData && <BillReceipt data={billData} />
        )}
      </div>
    </div>
  )
}

const AfterstockCustomerReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<ReportBranch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [waiters, setWaiters] = useState<ReportWaiter[]>([])
  const [selectedWaiter, setSelectedWaiter] = useState('all')

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedBill, setSelectedBill] = useState<BillData | null>(null)
  const [loadingBill, setLoadingBill] = useState(false)
  const [selectedBillIDs, setSelectedBillIDs] = useState<string[]>([])
  const [selectedBillIndex, setSelectedBillIndex] = useState(0)
  const [activeCustomerName, setActiveCustomerName] = useState('')
  const [activeCustomerPhone, setActiveCustomerPhone] = useState('')
  const billFetchTokenRef = useRef(0)
  const billNavigatorWheelLockRef = useRef(0)

  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const loadBillAtIndex = async (billIDs: string[], index: number) => {
    if (!billIDs[index]) return

    const fetchToken = billFetchTokenRef.current + 1
    billFetchTokenRef.current = fetchToken
    setLoadingBill(true)
    setSelectedBill(null)

    try {
      const bill = await getBill(billIDs[index])
      if (billFetchTokenRef.current !== fetchToken) return
      if (!bill) {
        alert('Unable to load bill details')
        return
      }
      setSelectedBill(bill)
      setSelectedBillIndex(index)
    } catch (billError) {
      if (billFetchTokenRef.current !== fetchToken) return
      console.error('Failed to fetch bill details', billError)
      alert('Failed to load bill details')
    } finally {
      if (billFetchTokenRef.current === fetchToken) {
        setLoadingBill(false)
      }
    }
  }

  const handleCustomerRowClick = async (row: CustomerStat) => {
    const billIDs =
      Array.isArray(row.billIds) && row.billIds.length > 0
        ? row.billIds
        : row.billId
          ? [row.billId]
          : []

    if (billIDs.length === 0) {
      alert('Bill details are not available for this customer.')
      return
    }

    setActiveCustomerName(row.customerName || '')
    setActiveCustomerPhone(row.phoneNumber || '')
    setSelectedBillIDs(billIDs)
    setSelectedBillIndex(0)

    await loadBillAtIndex(billIDs, 0)
  }

  const handleBillStep = async (step: -1 | 1) => {
    if (loadingBill || selectedBillIDs.length === 0) return
    const nextIndex = selectedBillIndex + step
    if (nextIndex < 0 || nextIndex >= selectedBillIDs.length) return
    await loadBillAtIndex(selectedBillIDs, nextIndex)
  }

  const handleBillNavigatorWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (loadingBill || selectedBillIDs.length <= 1) return
    if (Math.abs(event.deltaY) < 20) return

    event.preventDefault()

    const now = Date.now()
    if (now - billNavigatorWheelLockRef.current < 250) return
    billNavigatorWheelLockRef.current = now

    if (event.deltaY > 0) {
      void handleBillStep(1)
    } else {
      void handleBillStep(-1)
    }
  }

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchRes, waiterRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/users?where[role][equals]=waiter&limit=1000&pagination=false'),
        ])

        if (branchRes.ok) {
          const json = await branchRes.json()
          setBranches(json.docs)
        }
        if (waiterRes.ok) {
          const json = await waiterRes.json()
          setWaiters(json.docs)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchMetadata()
  }, [])

  useEffect(() => {
    const fetchReport = async (start: Date, end: Date) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        let url = `/api/reports/afterstock-customer?startDate=${startStr}&endDate=${endStr}`
        if (selectedBranch !== 'all') {
          url += `&branch=${selectedBranch}`
        }
        if (selectedWaiter !== 'all') {
          url += `&waiter=${selectedWaiter}`
        }

        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch report')
        const json: ReportData = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
        setError('Error loading report data')
      } finally {
        setLoading(false)
      }
    }

    if (startDate && endDate) {
      fetchReport(startDate, endDate)
    }
  }, [startDate, endDate, selectedBranch, selectedWaiter])

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    csvRows.push(
      [
        'S.NO',
        'CUSTOMER NAME',
        'PHONE NUMBER',
        'STATUS',
        'TOTAL BILLS',
        'TOTAL AMOUNT',
        'LAST PURCHASING DATE',
      ].join(','),
    )
    data.stats.forEach((row) => {
      const customerStatus = row.totalBills > 1 ? 'Existing' : 'New'
      csvRows.push(
        [
          row.sNo,
          `"${row.customerName}"`,
          `"${row.phoneNumber}"`,
          customerStatus,
          row.totalBills,
          row.totalAmount,
          `"${new Date(row.lastPurchasingDate).toLocaleString()}"`,
        ].join(','),
      )
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customer_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    a.click()
    setShowExportMenu(false)
  }

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
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const waiterOptions = [
    { value: 'all', label: 'All Waiters' },
    ...waiters.map((w) => ({ value: w.id, label: (w.name || 'Unknown').toUpperCase() })),
  ]

  const customStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-400)',
      borderRadius: '8px',
      height: '42px',
      minHeight: '42px',
      minWidth: '200px',
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

  return (
    <div className="customer-report-container">
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Customer Report</h1>
        </div>
        <div className="date-filter">
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
              className="date-input"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
            />
          </div>

          <div className="filter-group select-group">
            <Select
              instanceId="branch-select"
              options={branchOptions}
              value={branchOptions.find((o) => o.value === selectedBranch)}
              onChange={(option: { value: string; label: string } | null) =>
                setSelectedBranch(option?.value || 'all')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Branch..."
              isSearchable={true}
            />
          </div>

          <div className="filter-group select-group">
            <Select
              instanceId="waiter-select"
              options={waiterOptions}
              value={waiterOptions.find((o) => o.value === selectedWaiter)}
              onChange={(option: { value: string; label: string } | null) =>
                setSelectedWaiter(option?.value || 'all')
              }
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Waiter..."
              isSearchable={true}
            />
          </div>

          <div className="filter-group">
            <div className="export-container">
              <button
                className="export-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Report"
              >
                <span>Export</span>
                <span className="icon">↓</span>
              </button>
              {showExportMenu && (
                <div className="export-menu">
                  <button onClick={handleExportExcel}>Excel</button>
                </div>
              )}
            </div>
            {showExportMenu && (
              <div
                className="export-backdrop"
                onClick={() => setShowExportMenu(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 9998,
                  cursor: 'default',
                }}
              />
            )}
          </div>
          <div className="filter-group">
            <button
              onClick={() => {
                setDateRange([new Date(), new Date()])
                setSelectedBranch('all')
                setSelectedWaiter('all')
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
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>CUSTOMER NAME</th>
                <th>PHONE NUMBER</th>
                <th>STATUS</th>
                <th>BRANCH</th>
                <th>WAITER</th>
                <th style={{ textAlign: 'right' }}>TOTAL BILLS</th>
                <th style={{ textAlign: 'right' }}>TOTAL AMOUNT</th>
                <th style={{ textAlign: 'right' }}>LAST PURCHASING DATE</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((row) => {
                const canViewBill = Boolean(
                  (Array.isArray(row.billIds) && row.billIds.length > 0) || row.billId,
                )
                const customerStatus = row.totalBills > 1 ? 'Existing' : 'New'
                return (
                  <tr
                    key={`${row.sNo}-${row.phoneNumber}`}
                    className={canViewBill ? 'customer-row customer-row--clickable' : 'customer-row'}
                    onClick={canViewBill ? () => void handleCustomerRowClick(row) : undefined}
                    title={canViewBill ? 'Click to view latest bill' : 'Bill unavailable'}
                  >
                    <td>{row.sNo}</td>
                    <td>{row.customerName?.toUpperCase()}</td>
                    <td>{row.phoneNumber}</td>
                    <td
                      className={
                        customerStatus === 'Existing'
                          ? 'customer-status customer-status--existing'
                          : 'customer-status customer-status--new'
                      }
                    >
                      {customerStatus}
                    </td>
                    <td>{row.branchName?.toUpperCase()}</td>
                    <td>{row.waiterName?.toUpperCase()}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>{row.totalBills}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600', fontSize: '1.1rem' }}>
                      {formatValue(row.totalAmount)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {new Date(row.lastPurchasingDate).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(selectedBill || loadingBill) && (
        <BillModal
          billData={selectedBill}
          loading={loadingBill}
          customerName={activeCustomerName}
          customerPhone={activeCustomerPhone}
          currentIndex={selectedBillIndex}
          totalBills={selectedBillIDs.length}
          hasPrev={selectedBillIndex > 0}
          hasNext={selectedBillIndex < selectedBillIDs.length - 1}
          onPrev={() => void handleBillStep(-1)}
          onNext={() => void handleBillStep(1)}
          onNavigatorWheel={handleBillNavigatorWheel}
          onClose={() => {
            billFetchTokenRef.current += 1
            setSelectedBill(null)
            setLoadingBill(false)
            setSelectedBillIDs([])
            setSelectedBillIndex(0)
            setActiveCustomerName('')
            setActiveCustomerPhone('')
          }}
        />
      )}
    </div>
  )
}

export default AfterstockCustomerReport
