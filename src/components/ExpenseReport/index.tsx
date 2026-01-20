'use client'

import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import './index.scss'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { components, OptionProps } from 'react-select'

type ReportStats = {
  branchName: string
  [key: string]: any // For dynamic category columns
  total: number
  sNo?: number
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStats[]
  totals: Record<string, number>
  categories: string[]
}

const CheckboxOption = (props: OptionProps<any>) => {
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

const CustomValueContainer = ({ children, ...props }: any) => {
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

const ExpenseReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [selectedCategory, setSelectedCategory] = useState<string[]>(['all'])
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [selectedDrillDown, setSelectedDrillDown] = useState<{
    branchId: string
    branchName: string
    category: string
  } | null>(null)
  const [drillDownData, setDrillDownData] = useState<any[]>([])
  const [loadingDrillDown, setLoadingDrillDown] = useState(false)

  const categoryMap: Record<string, string> = {
    MAINTENANCE: 'MAINT',
    TRANSPORT: 'TRANS',
    FUEL: 'FUEL',
    PACKING: 'PACK',
    'STAFF WELFARE': 'WELFARE',
    Supplies: 'SUPP',
    ADVERTISEMENT: 'ADVT',
    ADVANCE: 'ADV',
    COMPLEMENTARY: 'COMP',
    'RAW MATERIAL': 'RAW',
    SALARY: 'SAL',
    'OC PRODUCTS': 'OC',
    OTHERS: 'OTRS',
  }

  const allCategories = Object.keys(categoryMap)

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_month', label: 'Last Month' },
  ]

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...allCategories.map((c) => ({ value: c, label: c })),
  ]

  const customStyles = {
    control: (base: any, state: any) => ({
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
      flexWrap: 'nowrap' as any,
    }),
    valueContainer: (base: any) => ({
      ...base,
      flexWrap: 'nowrap' as any,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'var(--theme-text-primary)',
      fontWeight: '600',
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--theme-info-500)'
        : state.isFocused
          ? 'var(--theme-elevation-100)'
          : 'var(--theme-input-bg, var(--theme-elevation-50))',
      color: state.isSelected ? '#fff' : 'var(--theme-text-primary)',
      cursor: 'pointer',
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      border: '1px solid var(--theme-elevation-150)',
      zIndex: 9999,
    }),
  }

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const branchRes = await fetch('/api/branches?limit=100&pagination=false')
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

  const formatValue = (val: number) => {
    if (val === undefined || val === null) return '0'
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchReport = React.useCallback(
    async (start: Date, end: Date, branchIds: string[], categoryNames: string[]) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const branchParam = branchIds.includes('all') ? 'all' : branchIds.join(',')
        const categoryParam = categoryNames.includes('all') ? 'all' : categoryNames.join(',')

        const res = await fetch(
          `/api/reports/expense?startDate=${startStr}&endDate=${endStr}&branch=${branchParam}&category=${categoryParam}`,
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
      fetchReport(startDate, endDate, selectedBranch, selectedCategory)
    }
  }, [startDate, endDate, selectedBranch, selectedCategory, fetchReport])

  useEffect(() => {
    if (selectedDrillDown) {
      const fetchDrillDown = async () => {
        setLoadingDrillDown(true)
        try {
          const startStr = toLocalDateStr(startDate!)
          const endStr = toLocalDateStr(endDate!)
          const res = await fetch(
            `/api/reports/expense?details=true&branchId=${selectedDrillDown.branchId}&category=${selectedDrillDown.category}&startDate=${startStr}&endDate=${endStr}`,
          )
          const json = await res.json()
          setDrillDownData(json.details || [])
        } catch (err) {
          console.error('Error fetching drill down data', err)
        } finally {
          setLoadingDrillDown(false)
        }
      }
      fetchDrillDown()
    }
  }, [selectedDrillDown, startDate, endDate])

  const handleDatePresetChange = (value: string) => {
    setDateRangePreset(value)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let start: Date = today
    let end: Date = today

    switch (value) {
      case 'today':
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
        start = new Date(today.getFullYear(), today.getMonth(), 1)
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
    }
    setDateRange([start, end])
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

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    const headers = [
      'S.No',
      'Branch Name',
      ...data.categories.map((cat) => categoryMap[cat] || cat),
      'Total',
    ]
    csvRows.push(headers.join(','))

    data.stats.forEach((row, index) => {
      const categoryValues = data.categories.map((cat) => formatValue((row as any)[cat]))
      csvRows.push(
        [index + 1, `"${row.branchName}"`, ...categoryValues, formatValue(row.total)].join(','),
      )
    })

    const totalCategoryValues = data.categories.map((cat) => formatValue((data.totals as any)[cat]))
    csvRows.push(['', 'TOTAL', ...totalCategoryValues, formatValue(data.totals.total)].join(','))

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expense_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${endDate ? toLocalDateStr(endDate) : ''}.csv`
    a.click()
  }

  return (
    <div className="expense-report-container">
      <div className="report-header">
        <div className="header-top">
          <h1>Expense Report</h1>
          <div className="header-actions">
            <div className="filter-group">
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
                popperPlacement="bottom-end"
              />
            </div>
            <button className="export-btn" onClick={handleExportExcel} title="Export to Excel">
              <span>Export</span>
              <span className="icon">↓</span>
            </button>
          </div>
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <Select
              options={dateRangeOptions}
              value={dateRangeOptions.find((o) => o.value === dateRangePreset)}
              onChange={(opt: any) => handleDatePresetChange(opt.value)}
              styles={customStyles}
              placeholder="Date Range..."
              isSearchable={false}
            />
          </div>

          <div className="filter-group">
            <Select
              instanceId="branch-select"
              options={branchOptions}
              isMulti
              value={branchOptions.filter((o) => selectedBranch.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedBranch.includes('all')
                const hasAll = selected.includes('all')

                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
                else if (final.length === 0) final = ['all']
                setSelectedBranch(final)
              }}
              styles={customStyles}
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

          <div className="filter-group">
            <Select
              instanceId="category-select"
              options={categoryOptions}
              isMulti
              value={categoryOptions.filter((o) => selectedCategory.includes(o.value))}
              onChange={(newValue) => {
                const selected = newValue ? newValue.map((x) => x.value) : []
                const wasAll = selectedCategory.includes('all')
                const hasAll = selected.includes('all')

                let final = selected
                if (hasAll && !wasAll) final = ['all']
                else if (hasAll && wasAll && selected.length > 1)
                  final = selected.filter((x) => x !== 'all')
                else if (final.length === 0) final = ['all']
                setSelectedCategory(final)
              }}
              styles={customStyles}
              placeholder="Select Category..."
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

          <button
            onClick={() => {
              setDateRange([new Date(), new Date()])
              setSelectedBranch(['all'])
              setSelectedCategory(['all'])
              setDateRangePreset('today')
            }}
            title="Reset Filters"
            className="reset-btn"
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

        {!selectedCategory.includes('all') && selectedCategory.length > 0 && (
          <div className="selected-filters-tags">
            {selectedCategory.map((cat) => (
              <div key={cat} className="filter-tag">
                <span>{cat}</span>
                <button
                  onClick={() => {
                    const next = selectedCategory.filter((c) => c !== cat)
                    setSelectedCategory(next.length > 0 ? next : ['all'])
                  }}
                  className="remove-tag"
                  title={`Remove ${cat}`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="loading-state">Loading...</div>}
      {error && <div className="error-message">{error}</div>}

      {data && !loading && (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>BRANCH NAME</th>
                {data.categories.map((cat) => (
                  <th key={cat} style={{ textAlign: 'right' }}>
                    {categoryMap[cat] || cat}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.length > 0 ? (
                data.stats.map((row, index) => (
                  <tr key={row.branchName}>
                    <td>{index + 1}</td>
                    <td className="branch-name-cell">{row.branchName.toUpperCase()}</td>
                    {data.categories.map((cat) => (
                      <td
                        key={cat}
                        style={{ textAlign: 'right', cursor: 'pointer' }}
                        className="amount-cell"
                        onClick={() =>
                          setSelectedDrillDown({
                            branchId: row.branchId,
                            branchName: row.branchName,
                            category: cat,
                          })
                        }
                      >
                        {formatValue(row[cat])}
                      </td>
                    ))}
                    <td
                      style={{ textAlign: 'right', fontWeight: 'bold', cursor: 'pointer' }}
                      className="amount-cell"
                      onClick={() =>
                        setSelectedDrillDown({
                          branchId: row.branchId,
                          branchName: row.branchName,
                          category: 'all',
                        })
                      }
                    >
                      {formatValue(row.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={data.categories.length + 3} style={{ textAlign: 'center' }}>
                    No data found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
            {data.stats.length > 0 && (
              <tfoot>
                <tr className="grand-total">
                  <td colSpan={2}>
                    <strong>Total</strong>
                  </td>
                  {data.categories.map((cat) => (
                    <td
                      key={cat}
                      style={{ textAlign: 'right', fontWeight: 'bold', cursor: 'pointer' }}
                      className="amount-cell"
                      onClick={() =>
                        setSelectedDrillDown({
                          branchId: 'all',
                          branchName: 'ALL',
                          category: cat,
                        })
                      }
                    >
                      {formatValue(data.totals[cat])}
                    </td>
                  ))}
                  <td
                    style={{ textAlign: 'right', fontWeight: 'bold', cursor: 'pointer' }}
                    className="amount-cell"
                    onClick={() =>
                      setSelectedDrillDown({
                        branchId: 'all',
                        branchName: 'ALL',
                        category: 'all',
                      })
                    }
                  >
                    {formatValue(data.totals.total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {selectedDrillDown && (
        <ExpenseDetailPopup
          branchName={selectedDrillDown.branchName}
          category={selectedDrillDown.category}
          data={drillDownData}
          loading={loadingDrillDown}
          onClose={() => setSelectedDrillDown(null)}
        />
      )}
    </div>
  )
}

const ExpenseDetailPopup = ({
  branchName,
  category,
  data,
  loading,
  onClose,
}: {
  branchName: string
  category: string
  data: any[]
  loading: boolean
  onClose: () => void
}) => {
  const formatDateTime = (iso: string) => {
    const d = dayjs(iso)
    return d.format('DD-MM-YY HH:mm')
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-container" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <div className="header-info">
            <h2>{branchName.toUpperCase()} Expense Details</h2>
            <div className="sub-header">
              <span className="info-value category-value">
                {category === 'all' ? 'ALL' : category}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="popup-body">
          {loading ? (
            <div className="popup-loading">Loading details...</div>
          ) : data.length > 0 ? (
            <div className="popup-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>DATE & TIME</th>
                    {branchName === 'ALL' && <th style={{ width: '120px' }}>BRANCH</th>}
                    {category === 'all' && <th style={{ width: '100px' }}>CAT</th>}
                    <th style={{ width: '250px' }}>REASON</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={idx}>
                      <td className="date-cell">{formatDateTime(item.time)}</td>
                      {branchName === 'ALL' && (
                        <td style={{ fontSize: '0.8rem', fontWeight: '600' }}>{item.branchName}</td>
                      )}
                      {category === 'all' && (
                        <td style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.8 }}>
                          {item.category}
                        </td>
                      )}
                      <td className="reason-cell">{item.reason}</td>
                      <td
                        className="amount-cell"
                        style={{ textAlign: 'right', fontWeight: 'bold' }}
                      >
                        ₹ {item.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2 + (branchName === 'ALL' ? 1 : 0) + (category === 'all' ? 1 : 0)}>
                      <strong>Total</strong>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      ₹ {data.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="no-data">No expense records found.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExpenseReport
