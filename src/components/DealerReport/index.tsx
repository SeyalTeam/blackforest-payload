'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { ChevronDown, ChevronUp } from 'lucide-react'
import './index.scss'
import Image from 'next/image'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type SelectOption = {
  value: string
  label: string
}

export type DealerReportItem = {
  id: string
  dealerName: string
  amount: number
  paidAmount?: number
  payments?: { amount: number; date: string }[]
  billCopyUrl?: string
  productsUrl?: string
  time: string
  status: string
  products?: string[]
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
  const [previewProducts, setPreviewProducts] = useState<string[] | null>(null)
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealers, setSelectedDealers] = useState<string[]>(['all'])
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
        items.push({
          ...item,
          branchName: group.branchName,
        })
      })
    })
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
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
        debit = item.paidAmount || 0
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
        const itemPaid = item.paidAmount || 0
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

  const handleDatePresetChange = (preset: string) => {
    setDateRangePreset(preset)
    const today = dayjs().tz('Asia/Kolkata')
    switch (preset) {
      case 'today':
        setDateRange([today.toDate(), today.toDate()])
        break
      case 'yesterday':
        const yesterday = today.subtract(1, 'day')
        setDateRange([yesterday.toDate(), yesterday.toDate()])
        break
      case 'last7':
        setDateRange([today.subtract(6, 'day').toDate(), today.toDate()])
        break
      case 'last30':
        setDateRange([today.subtract(29, 'day').toDate(), today.toDate()])
        break
      case 'thisMonth':
        setDateRange([today.startOf('month').toDate(), today.endOf('month').toDate()])
        break
      default:
        break
    }
  }

  const scrollToToggle = () => {
    if (showScrollBottom) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      const dates = value ? value.split(' - ') : []
      const start = dates[0] ? dayjs(dates[0]).format('DD MMM YYYY') : ''
      const end = dates[1] ? dayjs(dates[1]).format('DD MMM YYYY') : ''

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref} type="button">
          <span>{start}</span>
          {end && (
            <>
              <span className="separator">→</span>
              <span>{end}</span>
            </>
          )}
          <span className="icon">📅</span>
        </button>
      )
    },
  )
  CustomInput.displayName = 'CustomDateInput'

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7', label: 'Last 7 Days' },
    { value: 'last30', label: 'Last 30 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'custom', label: 'Custom' },
  ]

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const dealerOptions = [
    { value: 'all', label: 'All Dealers' },
    ...dealers.map((d) => ({ value: d.id, label: d.name })),
  ]

  return (
    <div className="dealer-report-container-v2">
      <div className="report-header-v2">
        <div className="header-controls">
          <div className="date-controls">
            <Select
              options={dateRangeOptions}
              value={dateRangeOptions.find((o) => o.value === dateRangePreset)}
              onChange={(option) => {
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
                  setDateRangePreset('custom')
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
                          <th style={{ width: '3%' }}>S.NO</th>
                          <th style={{ width: '14%' }}>Dealer</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Branch</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Debit</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Credit</th>
                          <th style={{ width: '10%', textAlign: 'right' }}>Balance</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Status</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Pay Now</th>
                          <th style={{ width: '5%', textAlign: 'center' }}>Bill Photo</th>
                          <th style={{ width: '5%', textAlign: 'center' }}>Product Photo</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item, idx) => (
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
                                  }}
                                  title="Click to view products"
                                >
                                  {item.dealerName}
                                </button>
                              ) : (
                                <span style={{ fontWeight: 600 }}>{item.dealerName}</span>
                              )}
                            </td>
                            <td className="branch-cell" style={{ textAlign: 'center' }}>
                              {item.branchName}
                            </td>
                            <td className="amount-cell">₹{item.amount.toLocaleString('en-IN')}</td>
                            <td className="debit-cell">
                              {item.debit > 0 ? `₹${item.debit.toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="credit-cell">
                              {item.credit > 0 ? `₹${item.credit.toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="balance-cell">
                              {item.balance >= 0
                                ? `₹${item.balance.toLocaleString('en-IN')}`
                                : `-₹${Math.abs(item.balance).toLocaleString('en-IN')}`}
                            </td>
                            <td className="status-cell" style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    color:
                                      item.status === 'paid'
                                        ? '#10b981'
                                        : item.status === 'cancelled'
                                        ? '#ef4444'
                                        : '#f59e0b',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {item.status || 'pending'}
                                </span>
                                {item.payments && item.payments.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setHistoryModalItem(item)}
                                    title="View Payment History"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: '2px',
                                      cursor: 'pointer',
                                      color: 'var(--theme-text-secondary, #888)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="pay-now-cell" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {item.status === 'pending' ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                                  <button
                                    className="pay-now-btn"
                                    onClick={async () => {
                                      const remaining = item.amount - (item.paidAmount || 0)
                                      if (window.confirm(`Are you sure you want to mark the remaining ₹${remaining.toLocaleString('en-IN')} for this bill from ${item.dealerName} as Paid?`)) {
                                        await handlePaymentUpdate(item.id, item.amount, item)
                                      }
                                    }}
                                  >
                                    Pay Now
                                  </button>
                                  <button
                                    className="payment-edit-btn"
                                    type="button"
                                    onClick={() => {
                                      setPaymentModalItem(item)
                                      setPaymentAmountInput('')
                                      setShowPaymentModal(true)
                                    }}
                                    title="Record partial payment"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: '4px',
                                      cursor: 'pointer',
                                      color: 'var(--theme-text-primary)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
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
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
                                    </svg>
                                  </button>
                                </div>
                              ) : item.status === 'paid' ? (
                                <span className="status-paid-badge">Paid ✓</span>
                              ) : (
                                <span className="status-cancelled-badge">Cancelled</span>
                              )}
                            </td>
                            <td className="image-cell" style={{ textAlign: 'center' }}>
                              <button
                                className={`image-view-btn ${item.billCopyUrl ? 'active' : 'inactive'}`}
                                disabled={!item.billCopyUrl}
                                onClick={() => item.billCopyUrl && setPreviewImage(item.billCopyUrl)}
                                title={item.billCopyUrl ? 'View Bill Photo' : 'No Photo'}
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
                            <td className="image-cell" style={{ textAlign: 'center' }}>
                              <button
                                className={`image-view-btn ${item.productsUrl ? 'active' : 'inactive'}`}
                                disabled={!item.productsUrl}
                                onClick={() => item.productsUrl && setPreviewImage(item.productsUrl)}
                                title={item.productsUrl ? 'View Product Photo' : 'No Photo'}
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
                            <td className="time-cell" title={item.time}>
                              {dayjs(item.time).tz('Asia/Kolkata').format('DD-MM-YY hh:mm A')}
                            </td>
                          </tr>
                        ))}
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
                          className="pagination-btn prev-btn"
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
                                  className={`pagination-btn page-num ${activePage === p ? 'active' : ''}`}
                                >
                                  {p}
                                </button>
                              </React.Fragment>
                            )
                          })}
                        <button
                          disabled={activePage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="pagination-btn next-btn"
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
            />
            <button className="close-btn" onClick={() => setPreviewImage(null)}>
              &times;
            </button>
          </div>
        </div>
      )}

      {previewProducts && (
        <div className="image-preview-modal" onClick={() => setPreviewProducts(null)}>
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
              Selected Products
            </h3>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {previewProducts.map((prodName, pIdx) => (
                <li
                  key={pIdx}
                  style={{
                    padding: '10px 14px',
                    background: 'var(--theme-elevation-150)',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    color: 'var(--theme-text-primary)',
                    border: '1px solid var(--theme-elevation-200)',
                  }}
                >
                  {prodName}
                </li>
              ))}
            </ul>
            <button className="close-btn" onClick={() => setPreviewProducts(null)}>
              &times;
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
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>₹{(historyModalItem.paidAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--theme-text-secondary, #888)' }}>Remaining Outstanding:</span>
                <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>
                  ₹{Math.max(0, historyModalItem.amount - (historyModalItem.paidAmount || 0)).toLocaleString('en-IN')}
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
