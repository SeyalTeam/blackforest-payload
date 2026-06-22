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
  const [showScrollBottom, setShowScrollBottom] = useState(true)
  const lastScrollY = useRef(0)

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
    async (start: Date, end: Date, branchIds: string[]) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const branchParam = branchIds.includes('all') ? 'all' : branchIds.join(',')

        const res = await fetch(
          `/api/reports/dealer?startDate=${startStr}&endDate=${endStr}&branch=${branchParam}`,
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
          setBranches(list)
        }
      } catch (e) {
        console.error('Failed to load branches', e)
      }
    }
    loadBranches()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, selectedBranch)
    }
  }, [startDate, endDate, selectedBranch, fetchReport])

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
                <div className="overall-report-total">
                  <div className="total-info">
                    <div className="total-label">OVERALL TOTAL</div>
                    <span className="total-count">{data.meta.totalCount} entries</span>
                  </div>
                  <div className="total-amount">
                    ₹{data.meta.grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
              {data.groups.map((group) => (
                <div key={group._id} className="branch-section">
                  <div className="branch-header">
                    <div className="branch-info">
                      <h2>{group.branchName}</h2>
                      <span className="item-count">{group.count} entries</span>
                    </div>
                    <div className="branch-total">
                      ₹{group.total.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="branch-items-table">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '5%' }}>S.NO</th>
                          <th style={{ width: '20%' }}>Dealer</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>Bill Photo</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>Product Photo</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>Status</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>{idx + 1}</td>
                            <td className="dealer-cell">{item.dealerName}</td>
                            <td className="amount-cell">₹{item.amount.toLocaleString('en-IN')}</td>
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
                            <td className="time-cell" title={item.time}>
                              {dayjs.utc(item.time).format('DD-MM-YY hh:mm A')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {data.groups.length === 0 && <div className="no-data">No dealer billings found.</div>}
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
