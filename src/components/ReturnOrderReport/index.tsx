'use client'

import React, { useEffect, useRef, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import './index.scss'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type SelectOption = {
  value: string
  label: string
}

type ReturnOrderItem = {
  returnNumber: string
  status: string
  product: string
  quantity: number
  unitPrice: number
  subtotal: number
  notes?: string
  time: string
  imageUrl?: string
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

const CheckboxOption = (props: OptionProps<SelectOption, true>) => {
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

        const res = await fetch(
          `/api/reports/return-order?startDate=${startStr}&endDate=${endStr}&status=${status}&branch=${branchParam}`,
        )
        if (!res.ok) throw new Error('Failed to fetch return order report')
        const json: ReportData = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
        setError('Error loading return order report')
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

              {data.groups.map((group) => (
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
                          <th style={{ width: '5%' }}>S.NO</th>
                          <th style={{ width: '15%' }}>Return No</th>
                          <th style={{ width: '17%' }}>Product</th>
                          <th style={{ width: '9%', textAlign: 'right' }}>Qty</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Unit Price</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '11%', textAlign: 'center' }}>Status</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Time</th>
                          <th style={{ width: '7%', textAlign: 'center' }}>Image</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items
                          .slice()
                          .reverse()
                          .map((item, idx) => (
                            <tr key={`${item.returnNumber}-${idx}`}>
                              <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>{idx + 1}</td>
                              <td className="return-number-cell">{item.returnNumber}</td>
                              <td className="product-cell">{item.product}</td>
                              <td className="quantity-cell">{item.quantity.toFixed(2)}</td>
                              <td className="price-cell">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                              <td className="amount-cell">₹{item.subtotal.toLocaleString('en-IN')}</td>
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
                              <td className="time-cell" title={item.time}>
                                {dayjs.utc(item.time).format('DD-MM-YY hh:mm A')}
                              </td>
                              <td className="image-cell">
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
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

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

      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Image
              src={previewImage}
              alt="Return Proof"
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

export default ReturnOrderReport
