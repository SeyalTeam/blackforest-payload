'use client'

import React, { useState, useEffect, useRef } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { ChevronDown, ChevronUp } from 'lucide-react'
import './index.scss'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')
import ExpenseTrendGraph from './ExpenseTrendGraph'
import Image from 'next/image'

type SelectOption = {
  value: string
  label: string
}

export type ExpenseItem = {
  category: string
  reason: string
  amount: number
  time: string
  imageUrl?: string
}

export type BranchGroup = {
  _id: string
  branchName: string
  total: number
  count: number
  items: ExpenseItem[]
}

type ReportCategoryStat = {
  category: string
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
    categories: string[]
    categoryStats: ReportCategoryStat[]
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

const getStableColor = (category: string) => {
  const categoryColors: Record<string, string> = {
    'RAW MATERIAL': '#8b5cf6', // Purple
    'OC PRODUCTS': '#10b981', // Green
    ADVANCE: '#06b6d4', // Cyan
    COMPLEMENTARY: '#ec4899', // Pink
    TRANSPORT: '#f59e0b', // Orange
    MAINTENANCE: '#ef4444', // Red
    FUEL: '#f43f5e', // Crimson
    SALARY: '#6366f1', // Indigo
    'STAFF WELFARE': '#84cc16', // Lime
    'PACKING MATERIAL': '#fbbf24', // Amber
    MARKETING: '#3b82f6', // Blue
    UTILITIES: '#db2777', // Deep Pink
    ALL: '#56CFE1', // Default Cyan
  }

  const normalized = category.toUpperCase()
  if (categoryColors[normalized]) return categoryColors[normalized]

  // Fallback: simple hash to pick from the palette
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899']
  return colors[Math.abs(hash) % colors.length]
}

const CategorySummary: React.FC<{
  stats: ReportCategoryStat[]
  groups: BranchGroup[]
  onCategoryClick: (category: string) => void
  activeCategory: string
}> = ({ stats, groups, onCategoryClick, activeCategory }) => {
  return (
    <div className="category-summary">
      <div className="summary-title">Category Occupancy</div>
      <div className="stats-list">
        {stats.map((stat) => {
          const color = getStableColor(stat.category)
          const isActive = activeCategory === (stat.category === 'ALL' ? 'all' : stat.category)
          // Circular progress math
          const radius = 35
          const circumference = 2 * Math.PI * radius
          const offset = circumference - (stat.percentage / 100) * circumference

          return (
            <div
              key={stat.category}
              className={`stat-card ${isActive ? 'active' : ''}`}
              onClick={() => onCategoryClick(stat.category === 'ALL' ? 'all' : stat.category)}
              style={{
                cursor: 'pointer',
                borderColor: isActive ? color : 'transparent',
              }}
            >
              <div className="stat-visual">
                <svg width="60" height="60" viewBox="0 0 100 100" className="circular-progress">
                  <circle
                    className="progress-bg"
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="var(--theme-elevation-200)"
                    strokeWidth="10"
                  />
                  <circle
                    className="progress-bar"
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                  <text
                    x="50"
                    y="58"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="bold"
                    fill="#fff"
                  >
                    {Math.round(stat.percentage)}%
                  </text>
                </svg>
              </div>
              <div className="stat-info">
                <div className="stat-value">₹{stat.total.toLocaleString('en-IN')}</div>
                <div className="stat-count">{stat.count} items</div>
                <div className="stat-name">{stat.category}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="branch-summary-section" style={{ marginTop: '2.5rem' }}>
        <div
          className="summary-title"
          style={{ color: activeCategory !== 'all' ? getStableColor(activeCategory) : '#56CFE1' }}
        >
          Branch Summary
        </div>
        <div
          className="branch-stats-list"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          {groups.map((group) => {
            const highlightColor =
              activeCategory !== 'all' ? getStableColor(activeCategory) : '#56CFE1'
            return (
              <div
                key={group.branchName}
                className="branch-stat-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--theme-elevation-100)',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${highlightColor}`,
                }}
              >
                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{group.branchName}</span>
                <span style={{ fontWeight: '800', color: highlightColor, fontSize: '1.1rem' }}>
                  ₹{group.total.toLocaleString('en-IN')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const ExpenseReport: React.FC = () => {
  // Initialize with Today's date
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [activeCategory, setActiveCategory] = useState<string>('all')
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
        // Direct detection of scroll direction
        if (currentScrollY > lastScrollY.current) {
          setShowScrollBottom(true) // Scrolling down
        } else if (currentScrollY < lastScrollY.current) {
          setShowScrollBottom(false) // Scrolling up
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
        // logic for till now if needed, for now just use today or a far past date
        // defaulting to last 365 days for "till now" context if no specific first bill date
        const farPast = new Date(today)
        farPast.setDate(farPast.getDate() - 365)
        start = farPast
        break
      case 'today':
        start = today
        end = today
        break
      case 'yesterday':
        const yest = new Date(today)
        yest.setDate(yest.getDate() - 1)
        start = yest
        end = yest
        break
      case 'last_7_days':
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 6)
        start = last7
        break
      case 'this_month':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        start = thisMonthStart
        end = today
        break
      case 'last_30_days':
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        start = last30
        break
      case 'last_month':
        const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        start = prevMonthStart
        end = prevMonthEnd
        break
      case 'last_quarter':
        const { start: qStart, end: qEnd } = getQuarterDates(today)
        start = qStart
        end = qEnd
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
      padding: '0',
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
      minWidth: '200px',
    }),
    valueContainer: (base: Record<string, unknown>) => ({
      ...base,
      flexWrap: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  }

  // Fetch branches
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const branchRes = await fetch('/api/reports/branches')
        if (branchRes.ok) {
          const json = await branchRes.json()
          setBranches(json.docs)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchMetadata()
  }, [])

  const fetchReport = React.useCallback(
    async (start: Date, end: Date, category: string, branchIds: string[]) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        // Pass 'all' explicitly if needed, but UI uses specific category mostly
        const categoryParam = category
        const branchParam = branchIds.includes('all') ? 'all' : branchIds.join(',')

        const res = await fetch(
          `/api/reports/expense?startDate=${startStr}&endDate=${endStr}&category=${categoryParam}&branch=${branchParam}`,
        )
        if (!res.ok) throw new Error('Failed to fetch report')
        const json: ReportData = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
        setError('Error loading report data')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, activeCategory, selectedBranch)
    }
  }, [startDate, endDate, activeCategory, selectedBranch, fetchReport])

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

  const categories = [
    'ALL',
    'ADVANCE',
    'COMPLEMENTARY',
    'FUEL',
    'MAINTENANCE',
    'OC PRODUCTS',
    'OTHERS',
    'PACKING',
    'RAW MATERIAL',
    'SALARY',
    'STAFF WELFARE',
    'TRANSPORT',
  ]

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  return (
    <div className="expense-report-container-v2">
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
          <div className="category-tabs">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-tab ${activeCategory === (cat === 'ALL' ? 'all' : cat) ? 'active' : ''}`}
                onClick={() => {
                  const target = cat === 'ALL' ? 'all' : cat
                  setActiveCategory(activeCategory === target ? 'all' : target)
                }}
              >
                {cat}
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
                    borderColor: getStableColor(activeCategory),
                    boxShadow: `0 4px 15px ${getStableColor(activeCategory)}26`,
                  }}
                >
                  <div className="total-info">
                    <div className="total-label">OVERALL TOTAL</div>
                    <span className="total-count">{data.meta.totalCount} items</span>
                  </div>
                  <div className="total-amount" style={{ color: getStableColor(activeCategory) }}>
                    ₹{data.meta.grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
              {data.groups.map((group) => (
                <div key={group._id} className="branch-section">
                  <div className="branch-header">
                    <div className="branch-info">
                      <h2>{group.branchName}</h2>
                      <span className="item-count">{group.count} items</span>
                    </div>
                    <div className="branch-total" style={{ color: getStableColor(activeCategory) }}>
                      {group.total.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="branch-items-table">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '5%' }}>S.NO</th>
                          <th style={{ width: '15%' }}>Category</th>
                          <th style={{ width: '17.5%' }}>Reason</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>Time</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>Image</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items
                          .slice()
                          .reverse()
                          .map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>{idx + 1}</td>
                              <td className="category-cell">{item.category}</td>
                              <td className="reason-cell">{item.reason}</td>
                              <td className="amount-cell">{item.amount.toLocaleString('en-IN')}</td>
                              <td className="time-cell" title={item.time}>
                                {dayjs.utc(item.time).format('DD-MM-YY hh:mm A')}
                              </td>
                              <td className="image-cell" style={{ textAlign: 'center' }}>
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
              {data.groups.length === 0 && <div className="no-data">No expenses found.</div>}
            </div>

            <CategorySummary
              stats={data.meta.categoryStats}
              groups={data.groups}
              onCategoryClick={(target) =>
                setActiveCategory(activeCategory === target ? 'all' : target)
              }
              activeCategory={activeCategory}
            />
          </div>
        )}

        {!loading && data && data.groups.length > 0 && (
          <ExpenseTrendGraph groups={data.groups} preset={dateRangePreset} />
        )}
      </div>

      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Image
              src={previewImage}
              alt="Expense"
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

export default ExpenseReport
