'use client'

import React, { useState, useEffect, useCallback, forwardRef } from 'react'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Button } from '@payloadcms/ui'
import './index.scss'

type BranchInventory = {
  id: string
  name: string
  inventory: number
  value: number
  company?: { id: string; name: string } | string
}

type ProductInventory = {
  id: string
  name: string
  totalInventory: number
  totalValue: number
  branches: BranchInventory[]
}

type ReportData = {
  timestamp: string
  products: ProductInventory[]
}

const InventoryReport: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [allBranches, setAllBranches] = useState<{ id: string; name: string }[]>([])

  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState('all')
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [viewMode, setViewMode] = useState<'stock' | 'billing' | 'return' | 'received' | 'instock'>(
    'stock',
  )
  const [toDate, setToDate] = useState<Date | null>(new Date())

  const CustomDateInput = forwardRef(({ value, onClick }: any, ref: any) => (
    <div className="custom-date-input" onClick={onClick} ref={ref}>
      {value}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="icon"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    </div>
  ))
  CustomDateInput.displayName = 'CustomDateInput'

  const fetchMetadata = useCallback(async () => {
    try {
      const [deptRes, catRes, prodRes, branchRes] = await Promise.all([
        fetch('/api/departments?limit=1000&pagination=false'),
        fetch('/api/categories?limit=1000&pagination=false'),
        fetch('/api/products?limit=1000&pagination=false'),
        fetch('/api/reports/branches'),
      ])

      if (deptRes.ok) setDepartments((await deptRes.json()).docs)
      if (catRes.ok) setCategories((await catRes.json()).docs)
      if (prodRes.ok) setProducts((await prodRes.json()).docs)
      if (branchRes.ok) setAllBranches((await branchRes.json()).docs)
    } catch (e) {
      console.error('Error fetching metadata:', e)
    }
  }, [])

  useEffect(() => {
    fetchMetadata()
  }, [fetchMetadata])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({
        department: selectedDepartment,
        category: selectedCategory,
        product: selectedProduct,
        branch: selectedBranch,
      })
      const res = await fetch(`/api/reports/inventory?${query.toString()}`)
      const json: ReportData = await res.json()
      if (res.ok) {
        setData(json)
      } else {
        throw new Error('Failed to fetch inventory data')
      }
    } catch (error) {
      console.error(error)
      setError('Failed to fetch inventory report')
    } finally {
      setLoading(false)
    }
  }, [selectedDepartment, selectedCategory, selectedProduct, selectedBranch])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const formatValue = (val: number) => {
    const fixed = val.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(val)
  }

  const customStyles = {
    control: (base: any, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'var(--theme-input-bg, var(--theme-elevation-50))',
      borderColor: state.isFocused ? 'var(--theme-info-500)' : 'var(--theme-elevation-200)',
      borderRadius: '6px',
      height: '38px',
      minHeight: '38px',
      minWidth: '90px',
      padding: '0 2px',
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
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base: any) => ({
      ...base,
      color: 'var(--theme-text-secondary, var(--theme-elevation-600))',
      padding: '4px',
      '&:hover': {
        color: 'var(--theme-text-primary, var(--theme-text))',
      },
    }),
  }

  // Calculate Column Totals
  const columnTotals = React.useMemo(() => {
    if (!data || data.products.length === 0)
      return { branchTotals: {}, grandTotal: 0, branchValues: {}, grandTotalValue: 0 }

    const branchTotals: Record<string, number> = {}
    const branchValues: Record<string, number> = {}
    let grandTotal = 0
    let grandTotalValue = 0

    // Initialize branch totals
    data.products[0].branches.forEach((b) => {
      branchTotals[b.id] = 0
      branchValues[b.id] = 0
    })

    data.products.forEach((product) => {
      product.branches.forEach((branch) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = branch as any
        let val = 0
        if (viewMode === 'stock') val = b.inventory
        else if (viewMode === 'billing') val = b.sold
        else if (viewMode === 'return') val = b.returned
        else if (viewMode === 'received') val = b.received
        else if (viewMode === 'instock') val = b.instock

        branchTotals[branch.id] = (branchTotals[branch.id] || 0) + val
        branchValues[branch.id] = (branchValues[branch.id] || 0) + (branch.value || 0) // Value always keeps total value? Or should value also reflect view? Usually value is stock value.
      })

      let prodVal = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = product as any
      if (viewMode === 'stock') prodVal = p.totalInventory
      else if (viewMode === 'billing') prodVal = p.totalSold
      else if (viewMode === 'return') prodVal = p.totalReturned
      else if (viewMode === 'received') prodVal = p.totalReceived
      else if (viewMode === 'instock') prodVal = p.totalInstock

      grandTotal += prodVal
      grandTotalValue += product.totalValue || 0
    })

    return { branchTotals, grandTotal, branchValues, grandTotalValue }
  }, [data, viewMode])

  const handleZeroOutStock = async () => {
    if (!selectedBranch || selectedBranch === 'all') {
      alert('Please select a specific branch to reset its stock.')
      return
    }

    const branchName =
      allBranches.find((b) => b.id === selectedBranch)?.name || 'the selected branch'
    let scope = branchName
    if (selectedProduct !== 'all') {
      scope = `product "${products.find((p) => p.id === selectedProduct)?.name}" in ${branchName}`
    } else if (selectedCategory !== 'all') {
      scope = `all products in category "${categories.find((c) => c.id === selectedCategory)?.name}" for ${branchName}`
    } else if (selectedDepartment !== 'all') {
      scope = `all products in department "${departments.find((d) => d.id === selectedDepartment)?.name}" for ${branchName}`
    } else {
      scope = `ALL products for ${branchName}`
    }

    const confirmMessage = `Are you sure you want to reset stock to zero for ${scope}?\n\nThis action cannot be undone.`
    if (!window.confirm(confirmMessage)) return

    setLoading(true)
    try {
      const res = await fetch('/api/inventory/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: selectedBranch,
          department: selectedDepartment === 'all' ? undefined : selectedDepartment,
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          product: selectedProduct === 'all' ? undefined : selectedProduct,
        }),
      })

      if (res.ok) {
        alert('Inventory reset successful!')
        fetchReport()
      } else {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to reset inventory')
      }
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to reset inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleExportExcel = () => {
    if (!data) return

    const headers = [
      'S.NO',
      'PRODUCT NAME',
      ...data.products[0].branches.map((b) => b.name.toUpperCase()),
      'TOTAL',
    ]

    const rows = data.products.map((p, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prod = p as any
      let totalVal = 0
      if (viewMode === 'stock') totalVal = prod.totalInventory
      else if (viewMode === 'billing') totalVal = prod.totalSold
      else if (viewMode === 'return') totalVal = prod.totalReturned
      else if (viewMode === 'received') totalVal = prod.totalReceived
      else if (viewMode === 'instock') totalVal = prod.totalInstock

      return [
        i + 1,
        p.name,
        ...p.branches.map((b) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const branch = b as any
          let val = 0
          if (viewMode === 'stock') val = branch.inventory
          else if (viewMode === 'billing') val = branch.sold
          else if (viewMode === 'return') val = branch.returned
          else if (viewMode === 'received') val = branch.received
          else if (viewMode === 'instock') val = branch.instock
          return val
        }),
        totalVal,
      ]
    })

    // Add Grand Total row to export
    const totalRow = [
      '',
      'GRAND TOTAL',
      ...data.products[0].branches.map((b) => columnTotals.branchTotals[b.id]),
      columnTotals.grandTotal,
    ]
    rows.push(totalRow)

    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `Inventory_Report_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`,
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const deptOptions = [
    { value: 'all', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ]

  const catOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

  const productOptions = [
    { value: 'all', label: 'All Products' },
    ...products.map((p) => ({ value: p.id, label: p.name })),
  ]

  const branchOptions = [
    { value: 'all', label: 'All Branches' },
    ...allBranches.map((b) => ({ value: b.id, label: b.name })),
  ]

  const viewOptions = [
    { value: 'stock', label: 'Current Stock' },
    { value: 'billing', label: 'Billing' },
    { value: 'return', label: 'Return' },
    { value: 'received', label: 'REC Count' },
    { value: 'instock', label: 'INS Count' },
  ]

  return (
    <div className="inventory-report-container">
      <div className="report-header">
        <div className="header-left">
          <h1>Inventory Report</h1>
        </div>
      </div>
      <div className="filters-row">
        <div>
          <DatePicker
            selected={toDate}
            onChange={(date: Date | null) => setToDate(date)}
            customInput={<CustomDateInput />}
            dateFormat="dd MMM yyyy"
            calendarClassName="custom-calendar"
          />
        </div>
        <Select
          options={viewOptions}
          value={viewOptions.find((o) => o.value === viewMode)}
          onChange={(o) =>
            setViewMode(
              (o?.value as 'stock' | 'billing' | 'return' | 'received' | 'instock') || 'stock',
            )
          }
          styles={customStyles}
        />
        <Select
          options={branchOptions}
          value={branchOptions.find((o) => o.value === selectedBranch)}
          onChange={(o) => setSelectedBranch(o?.value || 'all')}
          styles={customStyles}
        />
        <Select
          options={deptOptions}
          value={deptOptions.find((o) => o.value === selectedDepartment)}
          onChange={(o) => setSelectedDepartment(o?.value || 'all')}
          styles={customStyles}
        />
        <Select
          options={catOptions}
          value={catOptions.find((o) => o.value === selectedCategory)}
          onChange={(o) => setSelectedCategory(o?.value || 'all')}
          styles={customStyles}
        />
        <Select
          options={productOptions}
          value={productOptions.find((o) => o.value === selectedProduct)}
          onChange={(o) => setSelectedProduct(o?.value || 'all')}
          styles={customStyles}
        />
        <div
          className="filter-actions"
          style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
        >
          <Button onClick={handleZeroOutStock} className="btn-error">
            Zero Out Stock
          </Button>
          <Button onClick={handleExportExcel} buttonStyle="primary">
            Export
          </Button>
          <Button
            buttonStyle="secondary"
            onClick={() => {
              setSelectedBranch('all')
              setSelectedDepartment('all')
              setSelectedCategory('all')
              setSelectedProduct('all')
              setViewMode('stock')
            }}
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
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </Button>
        </div>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {data && data.products.length > 0 && (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>PRODUCT NAME</th>
                {/* Dynamically render branch headers with shortened names */}
                {data.products[0].branches.map((branch: BranchInventory) => (
                  <th key={branch.id} className="text-right">
                    {branch.name.substring(0, 3).toUpperCase()}
                  </th>
                ))}
                <th className="text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((product: ProductInventory, index: number) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p = product as any
                let totalVal = 0
                if (viewMode === 'stock') totalVal = p.totalInventory
                else if (viewMode === 'billing') totalVal = p.totalSold
                else if (viewMode === 'return') totalVal = p.totalReturned
                else if (viewMode === 'received') totalVal = p.totalReceived
                else if (viewMode === 'instock') totalVal = p.totalInstock
                return (
                  <tr key={product.id}>
                    <td>{index + 1}</td>
                    <td style={{ fontWeight: '600' }}>{product.name}</td>
                    {/* Render branch-wise inventory */}
                    {product.branches.map((branch: BranchInventory) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const b = branch as any
                      let val = 0
                      if (viewMode === 'stock') val = b.inventory
                      else if (viewMode === 'billing') val = b.sold
                      else if (viewMode === 'return') val = b.returned
                      else if (viewMode === 'received') val = b.received
                      else if (viewMode === 'instock') val = b.instock

                      return (
                        <td
                          key={branch.id}
                          className="text-right"
                          style={{
                            fontWeight: '700',
                            fontSize: '18px',
                            color:
                              val > 0
                                ? '#22c55e'
                                : val < 0 && viewMode === 'stock'
                                  ? '#ef4444'
                                  : val === 0 && viewMode === 'stock'
                                    ? '#ef4444'
                                    : 'inherit',
                          }}
                        >
                          {formatValue(val)}
                        </td>
                      )
                    })}
                    <td
                      className="text-right"
                      style={{
                        fontWeight: '700',
                        fontSize: '18px',
                        color:
                          totalVal > 0
                            ? '#22c55e'
                            : totalVal < 0 && viewMode === 'stock'
                              ? '#ef4444'
                              : totalVal === 0 && viewMode === 'stock'
                                ? '#ef4444'
                                : 'inherit',
                      }}
                    >
                      {formatValue(totalVal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="grand-total-row">
                <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'right' }}>
                  GRAND TOTAL
                </td>
                {data.products[0].branches.map((branch: BranchInventory) => (
                  <td key={branch.id} className="text-right" style={{ fontWeight: 'bold' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                      }}
                    >
                      {viewMode === 'stock' && (
                        <span
                          style={{
                            color: columnTotals.branchValues[branch.id] < 0 ? 'red' : 'inherit',
                          }}
                        >
                          {formatCurrency(columnTotals.branchValues[branch.id])}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '1rem',
                          color: viewMode === 'stock' ? 'var(--theme-elevation-400)' : 'inherit',
                        }}
                      >
                        {formatValue(columnTotals.branchTotals[branch.id])}
                      </span>
                    </div>
                  </td>
                ))}
                <td className="text-right">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      fontWeight: 'bold',
                    }}
                  >
                    {viewMode === 'stock' && (
                      <span
                        style={{
                          color: columnTotals.grandTotalValue < 0 ? 'red' : 'inherit',
                        }}
                      >
                        {formatCurrency(columnTotals.grandTotalValue)}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '1rem',
                        color: viewMode === 'stock' ? 'var(--theme-elevation-400)' : 'inherit',
                      }}
                    >
                      {formatValue(columnTotals.grandTotal)}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default InventoryReport
