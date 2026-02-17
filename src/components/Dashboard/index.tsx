'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Gutter } from '@payloadcms/ui'
import './index.scss'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select from 'react-select'
import { Calendar, RotateCw } from 'lucide-react'

interface StockStat {
  name: string
  ois: number
  rec: number
  rtn: number
  tot: number
  bill: number
  cis: number
}

// Custom Date Input Component
const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
  ({ value, onClick }, ref) => {
    const [start, end] = value ? value.split(' - ') : ['', '']
    return (
      <button className="custom-date-input" onClick={onClick} ref={ref}>
        <span className="date-text">{start}</span>
        <span className="separator" style={{ padding: '0 5px' }}>
          →
        </span>
        <span className="date-text">{end || start}</span>
        <span className="icon">
          <Calendar size={15} />
        </span>
      </button>
    )
  },
)
CustomInput.displayName = 'CustomInput'

// React Select Styles
const customStyles = {
  control: (base: any, state: { isFocused: boolean }) => ({
    ...base,
    backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
    borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-200)',
    borderRadius: '6px',
    height: '38px',
    minHeight: '38px',
    minWidth: '150px',
    boxShadow: 'none',
    color: 'var(--theme-text-primary, var(--theme-text))',
    '&:hover': {
      borderColor: 'var(--theme-elevation-350)',
    },
  }),
  singleValue: (base: any) => ({
    ...base,
    color: 'var(--theme-text-primary, var(--theme-text))',
    fontWeight: '500',
  }),
  option: (base: any, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--theme-info-500)'
      : state.isFocused
        ? 'var(--theme-elevation-100)'
        : 'var(--theme-input-bg, var(--theme-elevation-50))',
    color: state.isSelected
      ? 'var(--theme-text-invert, #fff)'
      : 'var(--theme-text-primary, var(--theme-text))',
    cursor: 'pointer',
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
    border: '1px solid var(--theme-elevation-150)',
    zIndex: 9999,
  }),
  input: (base: any) => ({
    ...base,
    color: 'var(--theme-text-primary, var(--theme-text))',
  }),
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StockStat[]>([])
  const [loading, setLoading] = useState(true)

  // Filter State
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  // Quick Date Preset State
  const [datePreset, setDatePreset] = useState('today')

  const [branches, setBranches] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedProd, setSelectedProd] = useState('')

  // 1. Fetch Options on Mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [resBranches, resDepts, resCats, resProds] = await Promise.all([
          fetch('/api/branches?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/departments?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/categories?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/products?limit=1000&sort=name').then((res) => res.json()),
        ])
        setBranches(resBranches.docs || [])
        setDepartments(resDepts.docs || [])
        setCategories(resCats.docs || [])
        setProducts(resProds.docs || [])
      } catch (err) {
        console.error('Error fetching filter options', err)
      }
    }
    fetchOptions()
  }, [])

  // Handle Date Preset Change
  const handleDatePresetChange = (option: any) => {
    const val = option?.value || 'custom'
    setDatePreset(val)

    const today = new Date()
    let start = new Date()
    let end = new Date()

    switch (val) {
      case 'today':
        // start/end is today
        break
      case 'yesterday':
        start.setDate(today.getDate() - 1)
        end.setDate(today.getDate() - 1)
        break
      case 'last_7_days':
        start.setDate(today.getDate() - 6)
        break
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'custom':
        return // Don't change dates, user will use picker
      default:
        break
    }
    setDateRange([start, end])
  }

  // Handle Manual Date Change (set preset to custom)
  const handleManualDateChange = (update: [Date | null, Date | null]) => {
    setDateRange(update)
    setDatePreset('custom')
  }

  // 2. Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (startDate) query.append('startDate', startDate.toISOString())
      if (endDate) query.append('endDate', endDate.toISOString())
      if (selectedBranch) query.append('branch', selectedBranch)
      if (selectedDept) query.append('department', selectedDept)
      if (selectedCat) query.append('category', selectedCat)
      if (selectedProd) query.append('product', selectedProd)

      const res = await fetch(`/api/dashboard-stats?${query.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedBranch, selectedDept, selectedCat, selectedProd])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Helpers for Dependent Dropdowns
  const filteredCategories = selectedDept
    ? categories.filter((c) => {
        const deptId = typeof c.department === 'object' ? c.department?.id : c.department
        return deptId === selectedDept
      })
    : categories

  const filteredProducts = selectedCat
    ? products.filter((p) => {
        const catId = typeof p.category === 'object' ? p.category?.id : p.category
        return catId === selectedCat
      })
    : products

  const handleExport = () => {
    // Basic CSV Export
    const headers = ['S.NO', 'PRODUCT', 'OIS', 'REC', 'RTN', 'TOT', 'BILL', 'CIS']
    const rows = stats.map((s, i) => [
      i + 1,
      `"${s.name}"`,
      s.ois,
      s.rec,
      s.rtn,
      s.tot,
      s.bill,
      s.cis,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'dashboard_stock_report.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const [selectedColumn, setSelectedColumn] = useState('')

  // ... (keep existing effects)

  const handleReset = () => {
    setDatePreset('today')
    setDateRange([new Date(), new Date()])
    setSelectedBranch('')
    setSelectedDept('')
    setSelectedCat('')
    setSelectedProd('')
    setSelectedColumn('')
  }

  const dateOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'custom', label: 'Custom' },
  ]

  const columnOptions = [
    { value: 'ois', label: 'Starting Instock' },
    { value: 'rec', label: 'Received' },
    { value: 'rtn', label: 'Returned' },
    { value: 'tot', label: 'Total Available' },
    { value: 'bill', label: 'Billing' },
    { value: 'cis', label: 'Current Instock' },
  ]

  // Helper to check visibility
  const isVisible = (col: string) => !selectedColumn || selectedColumn === col

  const visibleStats = stats.filter((stat) => {
    if (!selectedColumn) return true
    return (stat as any)[selectedColumn] !== 0
  })

  return (
    <div className="dashboard-page">
      <Gutter>
        <div className="header-row">
          <h1>Overall Report</h1>
          <div className="top-actions">
            <Select
              options={dateOptions}
              value={dateOptions.find((o) => o.value === datePreset)}
              onChange={handleDatePresetChange}
              styles={customStyles}
              isSearchable={false}
              className="filter-select-container"
            />
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={handleManualDateChange}
              customInput={<CustomInput />}
              dateFormat="yyyy-MM-dd"
              calendarClassName="custom-calendar"
            />
            <button className="export-btn" onClick={handleExport}>
              Export ↓
            </button>
          </div>
        </div>

        <div className="filters-row">
          <Select
            options={[
              { value: '', label: 'All Branches' },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
            value={
              selectedBranch
                ? {
                    value: selectedBranch,
                    label: branches.find((b) => b.id === selectedBranch)?.name,
                  }
                : null
            }
            onChange={(opt: any) => setSelectedBranch(opt?.value || '')}
            placeholder="All Branches"
            styles={customStyles}
            isClearable
            className="filter-select-container"
          />

          <Select
            options={[{ value: '', label: 'All Columns' }, ...columnOptions]}
            value={selectedColumn ? columnOptions.find((o) => o.value === selectedColumn) : null}
            onChange={(opt: any) => setSelectedColumn(opt?.value || '')}
            placeholder="All Columns"
            styles={customStyles}
            isClearable
            className="filter-select-container"
          />

          <Select
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
            value={
              selectedDept
                ? {
                    value: selectedDept,
                    label: departments.find((d) => d.id === selectedDept)?.name,
                  }
                : null
            }
            onChange={(opt: any) => setSelectedDept(opt?.value || '')}
            placeholder="All Departments"
            styles={customStyles}
            isClearable
            className="filter-select-container"
          />
          <Select
            options={[
              { value: '', label: 'All Categories' },
              ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={
              selectedCat
                ? { value: selectedCat, label: categories.find((c) => c.id === selectedCat)?.name }
                : null
            }
            onChange={(opt: any) => setSelectedCat(opt?.value || '')}
            placeholder="All Categories"
            styles={customStyles}
            isClearable
            className="filter-select-container"
          />
          <Select
            options={[
              { value: '', label: 'All Products' },
              ...filteredProducts.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={
              selectedProd
                ? { value: selectedProd, label: products.find((p) => p.id === selectedProd)?.name }
                : null
            }
            onChange={(opt: any) => setSelectedProd(opt?.value || '')}
            placeholder="All Products"
            styles={customStyles}
            isClearable
            className="filter-select-container"
          />

          <button className="reset-btn" onClick={handleReset} title="Reset">
            <RotateCw size={18} />
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="text-cell" style={{ width: '50px' }}>
                    S.NO
                  </th>
                  <th className="text-cell" style={{ width: '100px', maxWidth: '100px' }}>
                    PRODUCT
                  </th>
                  {isVisible('ois') && <th style={{ width: '80px' }}>OIS</th>}
                  {isVisible('rec') && <th style={{ width: '80px' }}>REC</th>}
                  {isVisible('rtn') && <th style={{ width: '80px' }}>RTN</th>}
                  {isVisible('tot') && <th style={{ width: '80px' }}>TOT</th>}
                  {isVisible('bill') && <th style={{ width: '80px' }}>BILL</th>}
                  {isVisible('cis') && <th style={{ width: '80px' }}>CIS</th>}
                </tr>
              </thead>
              <tbody>
                {visibleStats.length > 0 ? (
                  visibleStats.map((stat, index) => (
                    <tr key={index}>
                      <td className="text-cell">{index + 1}</td>
                      <td className="text-cell">{stat.name}</td>
                      {isVisible('ois') && <td>{stat.ois}</td>}
                      {isVisible('rec') && <td>{stat.rec}</td>}
                      {isVisible('rtn') && <td>{stat.rtn}</td>}
                      {isVisible('tot') && <td>{stat.tot}</td>}
                      {isVisible('bill') && <td>{stat.bill}</td>}
                      {isVisible('cis') && <td>{stat.cis}</td>}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>
                      No Data Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Gutter>
    </div>
  )
}

export default Dashboard
