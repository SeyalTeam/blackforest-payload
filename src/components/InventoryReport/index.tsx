'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Select from 'react-select'
import './index.scss'

type BranchInventory = {
  id: string
  name: string
  inventory: number
  value: number
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

  const fetchMetadata = useCallback(async () => {
    try {
      const [deptRes, catRes, prodRes, branchRes] = await Promise.all([
        fetch('/api/departments?limit=1000&pagination=false'),
        fetch('/api/categories?limit=1000&pagination=false'),
        fetch('/api/products?limit=1000&pagination=false'),
        fetch('/api/branches?limit=1000&pagination=false'),
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
        branchTotals[branch.id] = (branchTotals[branch.id] || 0) + branch.inventory
        branchValues[branch.id] = (branchValues[branch.id] || 0) + (branch.value || 0)
      })
      grandTotal += product.totalInventory
      grandTotalValue += product.totalValue || 0
    })

    return { branchTotals, grandTotal, branchValues, grandTotalValue }
  }, [data])

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

    const rows = data.products.map((p, i) => [
      i + 1,
      p.name,
      ...p.branches.map((b) => b.inventory),
      p.totalInventory,
    ])

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
    link.setAttribute('download', `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`)
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

  return (
    <div className="inventory-report-container">
      <div className="report-header">
        <div className="header-left">
          <h1>Inventory Report</h1>
        </div>
      </div>

      <div className="filters-row">
        <div className="filter-group">
          <label>Branch</label>
          <Select
            options={branchOptions}
            value={branchOptions.find((o) => o.value === selectedBranch)}
            onChange={(o) => setSelectedBranch(o?.value || 'all')}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
        <div className="filter-group">
          <label>Department</label>
          <Select
            options={deptOptions}
            value={deptOptions.find((o) => o.value === selectedDepartment)}
            onChange={(o) => setSelectedDepartment(o?.value || 'all')}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
        <div className="filter-group">
          <label>Category</label>
          <Select
            options={catOptions}
            value={catOptions.find((o) => o.value === selectedCategory)}
            onChange={(o) => setSelectedCategory(o?.value || 'all')}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
        <div className="filter-group">
          <label>Product</label>
          <Select
            options={productOptions}
            value={productOptions.find((o) => o.value === selectedProduct)}
            onChange={(o) => setSelectedProduct(o?.value || 'all')}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
        <div className="filter-actions">
          <button
            onClick={handleZeroOutStock}
            className="reset-stock-btn"
            title="Reset selected stock to zero"
          >
            Zero Out Stock
          </button>
          <button onClick={handleExportExcel} className="export-btn">
            Export
          </button>
          <button
            className="reset-btn"
            onClick={() => {
              setSelectedBranch('all')
              setSelectedDepartment('all')
              setSelectedCategory('all')
              setSelectedProduct('all')
            }}
            title="Reset Filters"
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
          </button>
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
              {data.products.map((product: ProductInventory, index: number) => (
                <tr key={product.id}>
                  <td>{index + 1}</td>
                  <td style={{ fontWeight: '600' }}>{product.name}</td>
                  {/* Render branch-wise inventory */}
                  {product.branches.map((branch: BranchInventory) => (
                    <td
                      key={branch.id}
                      className="text-right"
                      style={{
                        fontWeight: '600',
                        color:
                          branch.inventory < 0
                            ? 'red'
                            : branch.inventory === 0
                              ? 'orange'
                              : 'inherit',
                      }}
                    >
                      {formatValue(branch.inventory)}
                    </td>
                  ))}
                  <td
                    className="text-right"
                    style={{
                      fontWeight: 'bold',
                      color:
                        product.totalInventory < 0
                          ? 'red'
                          : product.totalInventory === 0
                            ? 'orange'
                            : 'inherit',
                    }}
                  >
                    {formatValue(product.totalInventory)}
                  </td>
                </tr>
              ))}
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
                      <span
                        style={{
                          color: columnTotals.branchValues[branch.id] < 0 ? 'red' : 'inherit',
                        }}
                      >
                        {formatCurrency(columnTotals.branchValues[branch.id])}
                      </span>
                      <span style={{ fontSize: '0.8em', color: 'var(--theme-elevation-400)' }}>
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
                    <span
                      style={{
                        color: columnTotals.grandTotalValue < 0 ? 'red' : 'inherit',
                      }}
                    >
                      {formatCurrency(columnTotals.grandTotalValue)}
                    </span>
                    <span style={{ fontSize: '0.8em', color: 'var(--theme-elevation-400)' }}>
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
