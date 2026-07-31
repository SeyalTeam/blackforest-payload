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

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type SelectOption = {
  value: string
  label: string
}

export type RawMaterialBillingReportItem = {
  id: string
  dealerName: string
  amount: number
  paidAmount?: number
  payments?: { amount: number; date: string }[]
  billCopyUrl?: string
  productsPhotoUrls?: string[]
  deliveryPersonPhotoUrl?: string
  time: string
  status: string
  rawMaterials?: {
    name: string
    quantity: number
    unit: string
    packageSize?: number
    numberOfPackages?: number
    totalAmount?: number
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
  groups: CompanyGroup[]
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

const RawMaterialBillingReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewMaterials, setPreviewMaterials] = useState<RawMaterialBillingReportItem['rawMaterials'] | null>(null)
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string[]>(['all'])
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealers, setSelectedDealers] = useState<string[]>(['all'])
  const [showScrollBottom, setShowScrollBottom] = useState(true)
  const lastScrollY = useRef(0)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentModalItem, setPaymentModalItem] = useState<RawMaterialBillingReportItem | null>(null)
  const [paymentAmountInput, setPaymentAmountInput] = useState('')
  const [historyModalItem, setHistoryModalItem] = useState<RawMaterialBillingReportItem | null>(null)

  const handlePaymentUpdate = async (id: string, newPaidAmount: number, targetItem?: RawMaterialBillingReportItem) => {
    try {
      const item = targetItem || allItems.find((x: any) => x.id === id)
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
      default:
        break
    }
  }

  const fetchReport = React.useCallback(
    async (start: Date, end: Date, companyIds: string[], dealerIds: string[]) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const companyParam = companyIds.includes('all') ? 'all' : companyIds.join(',')
        const dealerParam = dealerIds.includes('all') ? 'all' : dealerIds.join(',')

        const res = await fetch(
          `/api/reports/raw-material-billing?startDate=${startStr}&endDate=${endStr}&company=${companyParam}&dealer=${dealerParam}`,
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
    loadCompanies()
    loadDealers()
    handleDatePresetChange('today')
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      void fetchReport(startDate, endDate, selectedCompany, selectedDealers)
    }
  }, [startDate, endDate, selectedCompany, selectedDealers, fetchReport])

  const allItems = useMemo(() => {
    if (!data || !data.groups) return []
    const itemsList: (RawMaterialBillingReportItem & { companyName: string })[] = []
    data.groups.forEach((group) => {
      group.items.forEach((item) => {
        itemsList.push({
          ...item,
          companyName: group.companyName,
        })
      })
    })
    return itemsList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [data])

  const statusTotals = useMemo(() => {
    let total = 0
    let paid = 0
    let pending = 0
    let cancelled = 0

    allItems.forEach((item: any) => {
      if (item.status === 'cancelled') {
        cancelled += item.amount
      } else {
        total += item.amount
        paid += item.paidAmount || 0
        pending += item.amount - (item.paidAmount || 0)
      }
    })

    return { total, paid, pending, cancelled }
  }, [allItems])

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

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => (
      <button ref={ref} onClick={onClick} className="custom-date-input" type="button">
        {value ? value.replace(' - ', ' to ') : 'Select Date Range'}
        <span className="icon">📅</span>
      </button>
    ),
  )
  CustomInput.displayName = 'CustomInput'

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'custom', label: 'Custom Range' },
  ]

  const companyOptions = [
    { value: 'all', label: 'All Companies' },
    ...companies.map((c) => ({ value: c.id, label: c.name })),
  ]

  const dealerOptions = [
    { value: 'all', label: 'All Dealers' },
    ...dealers.map((d) => ({ value: d.id, label: d.name })),
  ]

  return (
    <div className="raw-material-report-container">
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
                          <th style={{ width: '22%' }}>Dealer</th>
                          <th style={{ width: '15%' }}>Company</th>
                          <th style={{ width: '10%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '10%', textAlign: 'right' }}>Paid</th>
                          <th style={{ width: '10%', textAlign: 'right' }}>Balance</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Status</th>
                          <th style={{ width: '5%', textAlign: 'center' }}>History</th>
                          <th style={{ width: '5%', textAlign: 'center' }}>Bill Copy</th>
                          <th style={{ width: '5%', textAlign: 'center' }}>Photos</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item: any, idx: number) => {
                          const remaining = item.amount - (item.paidAmount || 0)
                          return (
                            <tr key={item.id}>
                              <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                                {(activePage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="dealer-cell">
                                {item.rawMaterials && item.rawMaterials.length > 0 ? (
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
                                      fontWeight: 600,
                                      textDecoration: 'underline',
                                    }}
                                    title="Click to view materials list"
                                  >
                                    {item.dealerName}
                                  </button>
                                ) : (
                                  <span style={{ fontWeight: 600 }}>{item.dealerName}</span>
                                )}
                              </td>
                              <td className="company-cell">
                                {item.companyName}
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
                <div className="no-data">No raw material billing entries found for selected filters.</div>
              )}
            </div>
          </div>
        )}
      </div>

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

      {previewMaterials && (
        <div className="materials-modal-overlay" onClick={() => setPreviewMaterials(null)} role="presentation">
          <div className="materials-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Materials Purchased List</h3>
            <div className="materials-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>#</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>Photo</th>
                    <th>Material Name</th>
                    <th>Weight Size</th>
                    <th>No. of Packs</th>
                    <th style={{ textAlign: 'right' }}>Total Quantity</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right', width: '20%' }}>Total Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewMaterials.map((mat, idx) => {
                    const materialName = mat.name || mat.rawMaterialName || 'Unknown Material'
                    const pUrl = mat.photoUrl || (typeof mat.photo === 'object' ? mat.photo?.url : null)
                    return (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td style={{ textAlign: 'center' }}>
                          {pUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(pUrl)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              title="Click to view image"
                            >
                              <img
                                src={pUrl}
                                alt={materialName}
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  objectFit: 'cover',
                                  borderRadius: '6px',
                                  border: '1px solid var(--theme-elevation-200)',
                                }}
                              />
                            </button>
                          ) : (
                            <span style={{ opacity: 0.3 }}>-</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{materialName}</td>
                        <td>{mat.packageSize !== undefined ? mat.packageSize : '-'}</td>
                        <td>{mat.numberOfPackages !== undefined ? mat.numberOfPackages : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {(mat.quantity || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ textTransform: 'lowercase' }}>{mat.unit || ''}</td>
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
                      <td colSpan={5} style={{ textAlign: 'right' }}>Total:</td>
                      <td style={{ textAlign: 'right' }}>
                        {previewMaterials.reduce((sum, m) => sum + (m.quantity || 0), 0).toLocaleString('en-IN')}
                      </td>
                      <td></td>
                      <td style={{ textAlign: 'right', color: '#10b981' }}>
                        ₹{previewMaterials.reduce((sum, m) => sum + (m.totalAmount || 0), 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
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
    </div>
  )
}

export default RawMaterialBillingReport
