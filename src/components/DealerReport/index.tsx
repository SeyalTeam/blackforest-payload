'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
  products?: DealerReportProductItem[]
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

const MultiValue = () => null

const customStyles = {
  control: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-50)',
    borderColor: 'var(--theme-elevation-200)',
    borderRadius: '8px',
    padding: '2px 6px',
    minWidth: '200px',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'var(--theme-elevation-400)',
    },
  }),
  menu: (base: any) => ({
    ...base,
    background: 'var(--theme-elevation-100)',
    border: '1px solid var(--theme-elevation-200)',
  }),
  option: (base: any, state: any) => ({
    ...base,
    background: state.isFocused ? 'var(--theme-elevation-150)' : 'transparent',
    color: 'var(--theme-text-primary)',
    cursor: 'pointer',
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
  }),
  input: (base: any) => ({
    ...base,
    color: 'var(--theme-text-primary)',
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

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealers, setSelectedDealers] = useState<string[]>(['all'])
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showScrollBottom, setShowScrollBottom] = useState(true)
  const lastScrollY = useRef(0)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentModalItem, setPaymentModalItem] = useState<DealerReportItem | null>(null)
  const [paymentAmountInput, setPaymentAmountInput] = useState('')
  const [historyModalItem, setHistoryModalItem] = useState<DealerReportItem | null>(null)

  const handlePaymentUpdate = async (id: string, newPaidAmount: number, targetItem?: DealerReportItem) => {
    try {
      const item = targetItem || allItems.find(x => x.id === id)
      if (!item) throw new Error('Item not found')

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

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/dealer-billings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      })
      if (!res.ok) throw new Error(`Failed to update status (HTTP ${res.status})`)

      if (data) {
        const updatedGroups = data.groups.map((group) => {
          const updatedItems = group.items.map((item) => {
            if (item.id === id) {
              return { ...item, status: newStatus }
            }
            return item
          })
          return { ...group, items: updatedItems }
        })
        setData({ ...data, groups: updatedGroups })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
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
        items.push({
          ...item,
          branchName: group.branchName,
        })
      })
    })
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [data, selectedStatus])

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
    async (start: Date, end: Date, branchIds: string[], dealerIds: string[]) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const branchParam = branchIds.includes('all') ? 'all' : branchIds.join(',')
        const dealerParam = dealerIds.includes('all') ? 'all' : dealerIds.join(',')

        const res = await fetch(
          `/api/reports/dealer?startDate=${startStr}&endDate=${endStr}&branch=${branchParam}&dealer=${dealerParam}`,
        )
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
      fetchReport(startDate, endDate, selectedBranch, selectedDealers)
    }
  }, [startDate, endDate, selectedBranch, selectedDealers, fetchReport])

  useEffect(() => {
    setCurrentPage(1)
  }, [startDate, endDate, selectedBranch, selectedDealers])

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

  return (
    <div className="dealer-report-container-v2">
      <div className="report-header-v2">
        <div className="header-controls">
          <div className="date-controls">
            <GoogleDateRangePicker
              startDate={startDate}
              endDate={endDate}
              presetKey={dateRangePreset}
              onApply={(newStart, newEnd, presetKey) => {
                setDateRange([newStart, newEnd])
                setDateRangePreset(presetKey)
              }}
            />
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
            <Select
              options={statusOptions}
              value={statusOptions.find((o) => o.value === selectedStatus)}
              onChange={(newValue) => {
                setSelectedStatus(newValue ? newValue.value : 'all')
                setCurrentPage(1)
              }}
              styles={customStyles}
              classNamePrefix="react-select"
              placeholder="Select Status..."
              isSearchable={false}
            />
          </div>
        </div>
      </div>

      <div className="report-content">
        {loading && <div className="loading-state">Loading...</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && data && (
          <div className="report-main-layout">
            <div className="report-table-container" style={{ width: '100%' }}>
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
                  </div>

                  <div className="report-items-table">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '2%' }}>S.NO</th>
                          <th style={{ width: '18%' }}>Dealer</th>
                          <th style={{ width: '10%' }}>Branch</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Paid</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Balance</th>
                          <th style={{ width: '7%', textAlign: 'center' }}>Status</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>Bank Acc No</th>
                          <th style={{ width: '5%', textAlign: 'center' }}>History</th>
                          <th style={{ width: '5%', textAlign: 'center' }}>Bill Copy</th>
                          <th style={{ width: '5%', textAlign: 'center' }}>Photos</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item, idx) => {
                          const remaining = item.amount - (item.paidAmount || 0)
                          return (
                            <tr key={item.id}>
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
                              <td className="company-cell">
                                {item.branchName}
                              </td>
                              <td className="amount-cell">₹{item.amount.toLocaleString('en-IN')}</td>
                              <td className="paid-cell" style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                ₹{(item.paidAmount || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="balance-cell" style={{ textAlign: 'right', color: remaining > 0 ? '#f59e0b' : 'inherit', fontWeight: 700 }}>
                                ₹{remaining.toLocaleString('en-IN')}
                              </td>
                              <td className="status-cell" style={{ textAlign: 'center' }}>
                                {item.status === 'pending' ? (
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
                                ) : item.status === 'paid' ? (
                                  <span className="status-paid-badge">Paid ✓</span>
                                ) : (
                                  <span className="status-cancelled-badge">Cancelled</span>
                                )}
                              </td>
                              <td className="bank-account-cell" style={{ textAlign: 'center' }}>
                                {item.dealerAccountNumber ? (
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.dealerAccountNumber}</span>
                                ) : (
                                  <span style={{ opacity: 0.5 }}>-</span>
                                )}
                              </td>
                              <td className="history-cell" style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                  {item.status === 'pending' && (
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
                <div className="no-data">No dealer billings found.</div>
              )}
            </div>
          </div>
        )}
      </div>

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
