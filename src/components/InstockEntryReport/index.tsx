'use client'

import React, { useState, useEffect } from 'react'
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
  dealerName?: string
  invoiceNumbers?: string[]
  invoiceDetails?: Record<
    string,
    {
      qty: number
      status: string
      dealer: string
      branch: string
      entryId?: string
      itemId?: string
    }
  >
}

interface InvoiceStat {
  invoice: string
  date: string
  productCount: number
  totalAmount: number
}

type ReportData = {
  startDate: string
  endDate: string
  totalInstock: number
  totalEntries: number
  details: DetailItem[]
  invoices: InvoiceStat[]
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
  const [selectedInvoice, setSelectedInvoice] = useState('')

  // React Select Constants
  const statusOptions = [
    { value: 'waiting', label: 'Waiting' },
    { value: 'approved', label: 'Approved' },
  ]

  const customStyles = {
    control: (base: any, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: '#18181b',
      borderColor: state.isFocused ? '#3b82f6' : '#27272a',
      borderRadius: '6px',
      height: '38px',
      minHeight: '38px',
      minWidth: '90px',
      padding: '0 2px',
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
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base: any) => ({
      ...base,
      color: '#a1a1aa',
      padding: '4px',
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

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    // Format: 14.01.26- 19.52
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}.${mm}.${yy}- ${hh}.${min}`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
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
      setSelectedInvoice('') // Reset filtered invoice on new fetch
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

  const handleStatusClick = async (invDetail: any) => {
    if (!invDetail || !invDetail.entryId || !invDetail.itemId) return

    // "when click status waiting its need to change approved"
    // We'll allow toggling back to waiting as well for flexibility
    const newStatus = invDetail.status === 'waiting' ? 'approved' : 'waiting'

    try {
      const res = await fetch('/api/instock-params/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: invDetail.entryId,
          itemId: invDetail.itemId,
          status: newStatus,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to update status')
      }

      // Update local state without reloading
      setData((prevData) => {
        if (!prevData) return prevData
        const newDetails = prevData.details.map((item) => {
          if (selectedInvoice && item.invoiceDetails && item.invoiceDetails[selectedInvoice]) {
            const detail = item.invoiceDetails[selectedInvoice]
            if (detail.entryId === invDetail.entryId && detail.itemId === invDetail.itemId) {
              return {
                ...item,
                invoiceDetails: {
                  ...item.invoiceDetails,
                  [selectedInvoice]: {
                    ...detail,
                    status: newStatus,
                  },
                },
              }
            }
          }
          return item
        })

        return {
          ...prevData,
          details: newDetails,
        }
      })
    } catch (err) {
      console.error(err)
      alert('Failed to update status')
    }
  }

  const handleBulkApprove = async (targetStatus: string) => {
    if (!selectedInvoice || !data?.invoices) return

    // Find entryId from any item in this invoice
    let entryIdToUpdate = ''
    data.details.forEach((item) => {
      if (
        item.invoiceDetails &&
        item.invoiceDetails[selectedInvoice] &&
        item.invoiceDetails[selectedInvoice].entryId
      ) {
        entryIdToUpdate = item.invoiceDetails[selectedInvoice].entryId!
      }
    })

    if (!entryIdToUpdate) return

    const confirmMsg =
      targetStatus === 'approved'
        ? 'Are you sure you want to approve all items in this invoice?'
        : 'Are you sure you want to reverse all items to waiting?'

    if (!confirm(confirmMsg)) return

    try {
      const res = await fetch('/api/instock-params/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: entryIdToUpdate,
          updateAll: true,
          status: targetStatus,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to update status')
      }

      // Optimistic UI Update
      setData((prevData) => {
        if (!prevData) return prevData
        const newDetails = prevData.details.map((item) => {
          if (selectedInvoice && item.invoiceDetails && item.invoiceDetails[selectedInvoice]) {
            const detail = item.invoiceDetails[selectedInvoice]
            // Update all items in this invoice to targetStatus
            return {
              ...item,
              invoiceDetails: {
                ...item.invoiceDetails,
                [selectedInvoice]: {
                  ...detail,
                  status: targetStatus,
                },
              },
            }
          }
          return item
        })

        return {
          ...prevData,
          details: newDetails,
        }
      })
    } catch (err) {
      console.error(err)
      alert('Failed to bulk update')
    }
  }

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

    // Filter by Selected Invoice if active
    let filteredItems = data.details
    if (selectedInvoice) {
      filteredItems = data.details.filter((item) => item.invoiceNumbers?.includes(selectedInvoice))
    }

    return filteredItems.reduce(
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
  }, [data, selectedInvoice])

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
              setSelectedInvoice('')
            }}
            className="reset-btn"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div
        className="filters-row"
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '15px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: '#18181b', // Dark background for sticky header
          paddingTop: '10px',
          paddingBottom: '10px',
          borderBottom: '1px solid #27272a',
        }}
      >
        <div style={{ flex: '0 0 180px' }}>
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
        </div>
        <div style={{ flex: '0 0 180px' }}>
          <Select
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d: any) => ({ value: d.id, label: d.name })),
            ]}
            value={
              selectedDept
                ? {
                    value: selectedDept,
                    label:
                      departments.find((d) => d.id === selectedDept)?.name || 'All Departments',
                  }
                : null
            }
            onChange={(option: any) => setSelectedDept(option?.value || '')}
            styles={customStyles}
            placeholder="All Departments"
            isClearable
          />
        </div>
        <div style={{ flex: '0 0 180px' }}>
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
                      filteredCategories.find((c) => c.id === selectedCat)?.name ||
                      'All Categories',
                  }
                : null
            }
            onChange={(option: any) => setSelectedCat(option?.value || '')}
            styles={customStyles}
            placeholder="All Categories"
            isClearable
          />
        </div>
        <div style={{ flex: '0 0 180px' }}>
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
        </div>
        <div style={{ flex: '0 0 180px' }}>
          <Select
            options={[
              { value: '', label: 'All Dealers' },
              ...dealers.map((d: any) => ({ value: d.id, label: d.companyName })),
            ]}
            value={
              selectedDealer
                ? {
                    value: selectedDealer,
                    label:
                      dealers.find((d) => d.id === selectedDealer)?.companyName || 'All Dealers',
                  }
                : null
            }
            onChange={(option: any) => setSelectedDealer(option?.value || '')}
            styles={customStyles}
            placeholder="All Dealers"
            isClearable
          />
        </div>
        <div style={{ flex: '0 0 180px' }}>
          <Select
            options={[{ value: '', label: 'All Status' }, ...statusOptions]}
            value={selectedStatus ? statusOptions.find((o) => o.value === selectedStatus) : null}
            onChange={(option: any) => setSelectedStatus(option?.value || '')}
            styles={customStyles}
            placeholder="All Status"
            isClearable
          />
        </div>
      </div>

      <div className="report-content">
        {loading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && data && (
          <div className="report-body">
            <div className="details-table-wrapper">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Instock</th>
                    <th>Dealer Name</th>
                    <th>Branch Name</th>
                    {selectedInvoice && <th>Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(groupedDetails).map((dept) => (
                    <React.Fragment key={dept}>
                      <tr className="group-header dept-header">
                        <td colSpan={selectedInvoice ? 5 : 4}>{dept}</td>
                      </tr>
                      {Object.keys(groupedDetails[dept]).map((cat) => (
                        <React.Fragment key={cat}>
                          <tr className="group-header cat-header">
                            <td colSpan={selectedInvoice ? 5 : 4} style={{ paddingLeft: '20px' }}>
                              {cat}
                            </td>
                          </tr>
                          {groupedDetails[dept][cat].map((item, idx) => {
                            // Determine display values based on selection
                            let displayQty = item.instockQty
                            let displayDealer = item.dealerName
                            let displayBranch = item.branchDisplay
                            let displayStatus = ''

                            if (
                              selectedInvoice &&
                              item.invoiceDetails &&
                              item.invoiceDetails[selectedInvoice]
                            ) {
                              const invDetail = item.invoiceDetails[selectedInvoice]
                              displayQty = invDetail.qty
                              displayDealer = invDetail.dealer
                              displayBranch = invDetail.branch
                              displayStatus = invDetail.status
                            }

                            return (
                              <tr key={idx} className="item-row">
                                <td>{item.productName}</td>
                                <td className="qty-cell">{displayQty}</td>
                                <td>{displayDealer || 'Unknown Dealer'}</td>
                                <td>{displayBranch || 'Unknown Branch'}</td>
                                {selectedInvoice && (
                                  <td className="status-cell">
                                    <span
                                      className={`status-badge ${displayStatus || 'waiting'}`}
                                      onClick={() => {
                                        if (
                                          item.invoiceDetails &&
                                          item.invoiceDetails[selectedInvoice]
                                        ) {
                                          handleStatusClick(item.invoiceDetails[selectedInvoice])
                                        }
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {displayStatus || 'waiting'}
                                    </span>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-sidebar">
              <div className="invoice-list">
                {data.invoices?.length ? (
                  data.invoices.map((inv) => (
                    <div
                      key={inv.invoice}
                      className={`invoice-card ${selectedInvoice === inv.invoice ? 'selected' : ''}`}
                      onClick={() =>
                        setSelectedInvoice(selectedInvoice === inv.invoice ? '' : inv.invoice)
                      }
                    >
                      <div className="inv-title">{inv.invoice}</div>
                      <div className="inv-row">
                        <span>Ord:</span> {formatDateTime(inv.date)}
                      </div>
                      <div
                        className="inv-row"
                        style={{ justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div>
                          <span>Items:</span> {inv.productCount}
                        </div>
                        <div className="inv-amt">Amt: {formatCurrency(inv.totalAmount)}</div>
                      </div>
                      {selectedInvoice === inv.invoice && (
                        <div style={{ marginTop: '8px', textAlign: 'right' }}>
                          {(() => {
                            // Check if all items in this invoice are approved
                            let allApproved = true
                            let hasItems = false

                            // Iterate details to check status
                            data.details.forEach((dItem) => {
                              if (dItem.invoiceDetails && dItem.invoiceDetails[inv.invoice]) {
                                hasItems = true
                                if (dItem.invoiceDetails[inv.invoice].status !== 'approved') {
                                  allApproved = false
                                }
                              }
                            })

                            if (!hasItems) return null

                            if (allApproved) {
                              return (
                                <button
                                  className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleBulkApprove('waiting')
                                  }}
                                >
                                  Undo All
                                </button>
                              )
                            } else {
                              return (
                                <button
                                  className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleBulkApprove('approved')
                                  }}
                                >
                                  Approve All
                                </button>
                              )
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#71717a', textAlign: 'center' }}>No invoices found</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InstockEntryReport
