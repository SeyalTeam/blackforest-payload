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
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealers, setSelectedDealers] = useState<string[]>(['all'])
  const [showScrollBottom, setShowScrollBottom] = useState(true)
  const lastScrollY = useRef(0)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

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

      if (item.status === 'paid') {
        debit = item.amount
        runningBalance -= debit
      } else if (item.status === 'pending') {
        credit = item.amount
        runningBalance += credit
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
      if (item.status === 'paid') {
        paid += item.amount
      } else if (item.status === 'cancelled') {
        cancelled += item.amount
      } else {
        pending += item.amount
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
                          <th style={{ width: '8%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Debit</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Credit</th>
                          <th style={{ width: '10%', textAlign: 'right' }}>Balance</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Branch</th>
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
                              <div style={{ fontWeight: 600 }}>{item.dealerName}</div>
                              {item.products && item.products.length > 0 && (
                                <div className="product-badges-list" style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {item.products.map((prodName, pIdx) => (
                                    <span
                                      key={pIdx}
                                      style={{
                                        fontSize: '0.7rem',
                                        background: 'var(--theme-elevation-150)',
                                        color: 'var(--theme-text-secondary)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontWeight: 'normal',
                                      }}
                                    >
                                      {prodName}
                                    </span>
                                  ))}
                                </div>
                              )}
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
                            <td className="branch-cell" style={{ textAlign: 'center' }}>
                              {item.branchName}
                            </td>
                            <td className="status-cell" style={{ textAlign: 'center' }}>
                              <select
                                value={item.status}
                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                style={{
                                  background:
                                    item.status === 'paid'
                                      ? 'rgba(16, 185, 129, 0.15)'
                                      : item.status === 'cancelled'
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : 'rgba(245, 158, 11, 0.15)',
                                  color:
                                    item.status === 'paid'
                                      ? '#10b981'
                                      : item.status === 'cancelled'
                                      ? '#ef4444'
                                      : '#f59e0b',
                                  border: '1px solid currentColor',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '0.85rem',
                                }}
                              >
                                <option value="pending" style={{ background: 'var(--theme-elevation-100)', color: 'var(--theme-text-primary)' }}>Pending</option>
                                <option value="paid" style={{ background: 'var(--theme-elevation-100)', color: 'var(--theme-text-primary)' }}>Paid</option>
                                <option value="cancelled" style={{ background: 'var(--theme-elevation-100)', color: 'var(--theme-text-primary)' }}>Cancelled</option>
                              </select>
                            </td>
                            <td className="pay-now-cell" style={{ textAlign: 'center' }}>
                              {item.status === 'pending' ? (
                                <button
                                  className="pay-now-btn"
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to mark this bill from ${item.dealerName} for ₹${item.amount.toLocaleString('en-IN')} as Paid?`)) {
                                      await handleStatusChange(item.id, 'paid')
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
