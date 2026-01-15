'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, X, Search } from 'lucide-react'
import './index.scss'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select from 'react-select'

type DetailItem = {
  productName: string
  price: number
  instockQty: number
  categoryName?: string
  departmentName?: string
  branchDisplay?: string
  invoiceNumbers?: string[]
}

type ReportData = {
  startDate: string
  endDate: string
  totalInstock: number
  totalEntries: number
  details: DetailItem[]
}

const InstockEntryReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [data, setData] = useState<ReportData | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filters State
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedProd, setSelectedProd] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedDealer, setSelectedDealer] = useState('')

  // React Select Constants
  const statusOptions = [
    { value: 'waiting', label: 'Waiting' },
    { value: 'approved', label: 'Approved' },
  ]

  const customStyles = {
    control: (base: any, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: '#18181b', // dark background
      borderColor: state.isFocused ? '#3b82f6' : '#27272a',
      borderRadius: '6px',
      height: '38px',
      minHeight: '38px',
      minWidth: '160px',
      boxShadow: 'none',
      color: '#ffffff',
      '&:hover': {
        borderColor: '#52525b',
      },
    }),
    singleValue: (base: any) => ({
      ...base,
      color: '#ffffff',
      fontWeight: '500',
    }),
    option: (base: any, state: { isSelected: boolean; isFocused: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#27272a' : '#18181b',
      color: '#ffffff',
      cursor: 'pointer',
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: '#18181b',
      border: '1px solid #27272a',
      zIndex: 9999,
    }),
    input: (base: any) => ({
      ...base,
      color: '#ffffff',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#a1a1aa',
    }),
  }

  // Options Lists
  const [branches, setBranches] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [dealers, setDealers] = useState<any[]>([])

  useEffect(() => {
    // Fetch Filter Options
    const fetchOptions = async () => {
      try {
        const [resBranches, resDepts, resCats, resProds, resDealers] = await Promise.all([
          fetch('/api/branches?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/departments?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/categories?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/products?limit=1000&sort=name').then((res) => res.json()),
          fetch('/api/dealers?limit=1000&sort=companyName').then((res) => res.json()),
        ])
        setBranches(resBranches.docs || [])
        setDepartments(resDepts.docs || [])
        setCategories(resCats.docs || [])
        setProducts(resProds.docs || [])
        setDealers(resDealers.docs || [])
      } catch (err) {
        console.error('Error fetching filter options', err)
      }
    }
    fetchOptions()
  }, [])

  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchReport = React.useCallback(async (start: Date, end: Date, filters: any) => {
    setLoading(true)
    setError('')
    try {
      const startStr = toLocalDateStr(start)
      const endStr = toLocalDateStr(end)
      const query = new URLSearchParams({
        startDate: startStr,
        endDate: endStr,
        ...(filters.branch && { branch: filters.branch }),
        ...(filters.department && { department: filters.department }),
        ...(filters.category && { category: filters.category }),
        ...(filters.product && { product: filters.product }),
        ...(filters.status && { status: filters.status }),
        ...(filters.dealer && { dealer: filters.dealer }),
      })

      const res = await fetch(`/api/reports/instock-entry?${query.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch report')
      const json: ReportData = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      setError('Error loading report data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate, {
        branch: selectedBranch,
        department: selectedDept,
        category: selectedCat,
        product: selectedProd,
        status: selectedStatus,
        dealer: selectedDealer,
      })
    }
  }, [
    dateRange,
    startDate,
    endDate,
    fetchReport,
    selectedBranch,
    selectedDept,
    selectedCat,
    selectedProd,
    selectedStatus,
    selectedDealer,
  ])

  // Custom Date Input
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
        </button>
      )
    },
  )
  CustomInput.displayName = 'CustomInput'

  // Filter Logic helpers
  const filteredCategories = selectedDept
    ? categories.filter((c) => {
        if (!c.department) return false
        const deptId = typeof c.department === 'object' ? c.department.id : c.department
        return deptId === selectedDept
      })
    : categories

  const filteredProducts = selectedCat
    ? products.filter((p) => {
        if (!p.category) return false
        const catId = typeof p.category === 'object' ? p.category.id : p.category
        return catId === selectedCat
      })
    : products

  // Grouping Data
  const groupedDetails = React.useMemo(() => {
    if (!data?.details) return {}

    return data.details.reduce(
      (acc, item) => {
        const dept = item.departmentName || 'No Department'
        const cat = item.categoryName || 'Uncategorized'

        if (!acc[dept]) acc[dept] = {}
        if (!acc[dept][cat]) acc[dept][cat] = []

        acc[dept][cat].push(item)
        return acc
      },
      {} as Record<string, Record<string, DetailItem[]>>,
    )
  }, [data])

  return (
    <div className="instock-report-container">
      <div className="report-header">
        <h1>Instock Entry Report</h1>

        <div className="header-controls">
          <DatePicker
            selectsRange={true}
            startDate={startDate}
            endDate={endDate}
            onChange={(update: [Date | null, Date | null]) => {
              setDateRange(update)
            }}
            dateFormat="yyyy-MM-dd"
            customInput={<CustomInput />}
          />
          <button
            onClick={() => {
              setDateRange([new Date(), new Date()])
              setSelectedBranch('')
              setSelectedDept('')
              setSelectedCat('')
              setSelectedProd('')
              setSelectedStatus('')
              setSelectedDealer('')
            }}
            className="reset-btn"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="filters-row">
        <Select
          options={[
            { value: '', label: 'All Branches' },
            ...branches.map((b: any) => ({ value: b.id, label: b.name })),
          ]}
          value={
            selectedBranch
              ? {
                  value: selectedBranch,
                  label: branches.find((b) => b.id === selectedBranch)?.name || 'All Branches',
                }
              : null
          }
          onChange={(option: any) => setSelectedBranch(option?.value || '')}
          styles={customStyles}
          placeholder="All Branches"
          isClearable
        />
        <Select
          options={[
            { value: '', label: 'All Departments' },
            ...departments.map((d: any) => ({ value: d.id, label: d.name })),
          ]}
          value={
            selectedDept
              ? {
                  value: selectedDept,
                  label: departments.find((d) => d.id === selectedDept)?.name || 'All Departments',
                }
              : null
          }
          onChange={(option: any) => setSelectedDept(option?.value || '')}
          styles={customStyles}
          placeholder="All Departments"
          isClearable
        />
        <Select
          options={[
            { value: '', label: 'All Categories' },
            ...filteredCategories.map((c: any) => ({ value: c.id, label: c.name })),
          ]}
          value={
            selectedCat
              ? {
                  value: selectedCat,
                  label:
                    filteredCategories.find((c) => c.id === selectedCat)?.name || 'All Categories',
                }
              : null
          }
          onChange={(option: any) => setSelectedCat(option?.value || '')}
          styles={customStyles}
          placeholder="All Categories"
          isClearable
        />
        <Select
          options={[
            { value: '', label: 'All Products' },
            ...filteredProducts.map((p: any) => ({ value: p.id, label: p.name })),
          ]}
          value={
            selectedProd
              ? {
                  value: selectedProd,
                  label:
                    filteredProducts.find((p) => p.id === selectedProd)?.name || 'All Products',
                }
              : null
          }
          onChange={(option: any) => setSelectedProd(option?.value || '')}
          styles={customStyles}
          placeholder="All Products"
          isClearable
        />
        <Select
          options={[
            { value: '', label: 'All Dealers' },
            ...dealers.map((d: any) => ({ value: d.id, label: d.companyName })),
          ]}
          value={
            selectedDealer
              ? {
                  value: selectedDealer,
                  label: dealers.find((d) => d.id === selectedDealer)?.companyName || 'All Dealers',
                }
              : null
          }
          onChange={(option: any) => setSelectedDealer(option?.value || '')}
          styles={customStyles}
          placeholder="All Dealers"
          isClearable
        />
        <Select
          options={[{ value: '', label: 'All Status' }, ...statusOptions]}
          value={selectedStatus ? statusOptions.find((o) => o.value === selectedStatus) : null}
          onChange={(option: any) => setSelectedStatus(option?.value || '')}
          styles={customStyles}
          placeholder="All Status"
          isClearable
        />
      </div>

      <div className="report-content">
        {loading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && data && (
          <div className="results-container">
            <div className="summary-metrics">
              <div className="metric-card">
                <span>Total Entries</span>
                <strong>{data.totalEntries}</strong>
              </div>
              <div className="metric-card">
                <span>Total Qty</span>
                <strong>{data.totalInstock}</strong>
              </div>
            </div>

            <div className="details-table-wrapper">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Department</th>
                    <th>Total In-Stock</th>
                    <th>Branch Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(groupedDetails).map((dept) => (
                    <React.Fragment key={dept}>
                      <tr className="group-header dept-header">
                        <td colSpan={5}>{dept}</td>
                      </tr>
                      {Object.keys(groupedDetails[dept]).map((cat) => (
                        <React.Fragment key={cat}>
                          <tr className="group-header cat-header">
                            <td colSpan={5} style={{ paddingLeft: '20px' }}>
                              {cat}
                            </td>
                          </tr>
                          {groupedDetails[dept][cat].map((item, idx) => (
                            <tr key={idx} className="item-row">
                              <td>{item.productName}</td>
                              <td>{item.categoryName}</td>
                              <td>{item.departmentName}</td>
                              <td className="qty-cell">{item.instockQty}</td>
                              <td className="breakdown-cell">{item.branchDisplay}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InstockEntryReport
