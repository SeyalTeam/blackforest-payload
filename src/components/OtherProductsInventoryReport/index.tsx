'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Select, { components, OptionProps, ValueContainerProps } from 'react-select'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import './index.scss'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

type SelectOption = {
  value: string
  label: string
}

export type OtherProductsInventoryItem = {
  productId: string
  productName: string
  stockCount: number
  standardStockLevel?: number
  minimumStockLevel?: number
  maximumStockLevel?: number
  totalValue: number
  lastBillingDate: string
  dealerName?: string
  branchName?: string
}

export type OtherProductsInventoryGroup = {
  branchId: string
  branchName: string
  totalStockCount: number
  totalStockValue: number
  items: OtherProductsInventoryItem[]
}

type ReportData = {
  groups: OtherProductsInventoryGroup[]
  meta: {
    grandTotalValue: number
    grandTotalStockCount: number
    totalProductsCount: number
  }
}

const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: 'var(--theme-elevation-50)',
    borderColor: state.isFocused ? 'var(--theme-elevation-400)' : 'var(--theme-elevation-200)',
    borderRadius: '8px',
    padding: '2px 4px',
    boxShadow: 'none',
    minWidth: '220px',
    maxWidth: '280px',
    height: '42px',
    minHeight: '42px',
    maxHeight: '42px',
    overflow: 'hidden',
    cursor: 'pointer',
    '&:hover': {
      borderColor: 'var(--theme-elevation-400)',
    },
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    height: '38px',
    maxHeight: '38px',
    overflow: 'hidden',
    flexWrap: 'nowrap',
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: 'var(--theme-elevation-100)',
    border: '1px solid var(--theme-elevation-200)',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1050,
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? 'var(--theme-elevation-250)'
      : state.isFocused
        ? 'var(--theme-elevation-150)'
        : 'transparent',
    color: 'var(--theme-text-primary)',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: 'var(--theme-elevation-200)',
    },
  }),
  multiValue: (provided: any) => ({
    ...provided,
    display: 'none',
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: 'var(--theme-text-primary)',
  }),
  input: (provided: any) => ({
    ...provided,
    color: 'var(--theme-text-primary)',
  }),
}

const CustomValueContainer = (props: ValueContainerProps<SelectOption, true>) => {
  const { children, getValue } = props
  const selected = getValue()
  const hasAll = selected.some((option) => option.value === 'all')

  let labelText = ''
  if (selected.length === 0 || hasAll) {
    labelText = 'All'
  } else if (selected.length === 1) {
    labelText = selected[0].label
  } else {
    labelText = `${selected.length} Selected`
  }

  return (
    <components.ValueContainer {...props}>
      <span
        style={{
          color: 'var(--theme-text-primary)',
          paddingLeft: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '0.95rem',
        }}
      >
        {labelText}
      </span>
      {React.Children.map(children, (child) => (React.isValidElement(child) && child.type === components.Input ? child : null))}
    </components.ValueContainer>
  )
}

const CustomOption = (props: OptionProps<SelectOption, true>) => {
  const { isSelected, data } = props
  const { value, label } = data
  const selectedValues = props.getValue().map((opt) => opt.value)
  const isAllSelected = selectedValues.includes('all')
  const checked = value === 'all' ? isAllSelected : isSelected && !isAllSelected

  return (
    <components.Option {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" checked={checked} onChange={() => {}} style={{ cursor: 'pointer' }} />
        <span>{label}</span>
      </div>
    </components.Option>
  )
}

const OtherProductsInventoryReport: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string[]>(['all'])
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealers, setSelectedDealers] = useState<string[]>(['all'])
  const [products, setProducts] = useState<{ id: string; name: string; dealerId?: string }[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>(['all'])

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(100)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [branchRes, dealerRes, productRes] = await Promise.all([
          fetch('/api/branches?limit=1000'),
          fetch('/api/dealers?limit=1000'),
          fetch('/api/products?limit=1000'),
        ])
        const branchData = await branchRes.json()
        const dealerData = await dealerRes.json()
        const productData = await productRes.json()

        if (branchData.docs) {
          setBranches(branchData.docs.map((b: any) => ({ id: b.id, name: b.name })))
        }
        if (dealerData.docs) {
          setDealers(
            dealerData.docs.map((d: any) => ({
              id: d.id,
              name: d.companyName || d.name || 'Unknown Dealer',
            })),
          )
        }
        if (productData.docs) {
          setProducts(
            productData.docs.map((p: any) => {
              let dealerId = ''
              if (typeof p.dealer === 'string') {
                dealerId = p.dealer
              } else if (p.dealer && typeof p.dealer === 'object') {
                dealerId = p.dealer.id || p.dealer._id || ''
              }
              return {
                id: p.id,
                name: (p.name || 'Unknown Product').trim(),
                dealerId,
              }
            }),
          )
        }
      } catch (err) {
        console.error('Failed to fetch options', err)
      }
    }
    fetchOptions()
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    setError('')

    try {
      const bStr = selectedBranch.includes('all') ? 'all' : selectedBranch.join(',')
      const dStr = selectedDealers.includes('all') ? 'all' : selectedDealers.join(',')
      const pStr = selectedProducts.includes('all') ? 'all' : selectedProducts.join(',')

      const res = await fetch(
        `/api/reports/other-products-inventory?branch=${bStr}&dealer=${dStr}&product=${pStr}`,
      )
      if (!res.ok) throw new Error('Failed to fetch inventory report')
      const result: ReportData = await res.json()
      setData(result)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [selectedBranch, selectedDealers, selectedProducts])

  const branchOptions: SelectOption[] = useMemo(
    () => [{ value: 'all', label: 'All Branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))],
    [branches],
  )

  const dealerOptions: SelectOption[] = useMemo(
    () => [{ value: 'all', label: 'All Dealers' }, ...dealers.map((d) => ({ value: d.id, label: d.name }))],
    [dealers],
  )

  const productOptions: SelectOption[] = useMemo(() => {
    let filteredProducts = products

    if (!selectedDealers.includes('all') && selectedDealers.length > 0) {
      filteredProducts = products.filter(
        (p) => p.dealerId && selectedDealers.includes(p.dealerId),
      )
    }

    return [
      { value: 'all', label: 'All Products' },
      ...filteredProducts.map((p) => ({ value: p.id, label: p.name })),
    ]
  }, [products, selectedDealers])

  const handleBranchChange = (selected: readonly SelectOption[]) => {
    if (!selected || selected.length === 0) {
      setSelectedBranch(['all'])
      return
    }
    const lastSelected = selected[selected.length - 1]
    if (lastSelected.value === 'all') {
      setSelectedBranch(['all'])
    } else {
      const nextValues = selected.map((s) => s.value).filter((v) => v !== 'all')
      setSelectedBranch(nextValues.length === 0 ? ['all'] : nextValues)
    }
  }

  const handleDealerChange = (selected: readonly SelectOption[]) => {
    let nextDealers: string[] = ['all']
    if (selected && selected.length > 0) {
      const lastSelected = selected[selected.length - 1]
      if (lastSelected.value !== 'all') {
        const values = selected.map((s) => s.value).filter((v) => v !== 'all')
        if (values.length > 0) nextDealers = values
      }
    }
    setSelectedDealers(nextDealers)

    if (!nextDealers.includes('all')) {
      setSelectedProducts((prev) => {
        if (prev.includes('all')) return ['all']
        const validForDealer = products
          .filter((p) => p.dealerId && nextDealers.includes(p.dealerId))
          .map((p) => p.id)
        const filtered = prev.filter((id) => validForDealer.includes(id))
        return filtered.length === 0 ? ['all'] : filtered
      })
    }
  }

  const handleProductChange = (selected: readonly SelectOption[]) => {
    if (!selected || selected.length === 0) {
      setSelectedProducts(['all'])
      return
    }
    const lastSelected = selected[selected.length - 1]
    if (lastSelected.value === 'all') {
      setSelectedProducts(['all'])
    } else {
      const nextValues = selected.map((s) => s.value).filter((v) => v !== 'all')
      setSelectedProducts(nextValues.length === 0 ? ['all'] : nextValues)
    }
  }

  const allItems = useMemo(() => {
    if (!data || !data.groups) return []
    const flat: OtherProductsInventoryItem[] = []
    data.groups.forEach((g) => {
      if (Array.isArray(g.items)) {
        flat.push(...g.items)
      }
    })
    return flat.sort((a, b) => b.totalValue - a.totalValue)
  }, [data])

  const totalItems = allItems.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const activePage = Math.min(currentPage, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (activePage - 1) * pageSize
    return allItems.slice(start, start + pageSize)
  }, [allItems, activePage, pageSize])

  return (
    <div className="other-products-inventory-container">
      <div className="report-header">
        <div className="report-title-row">
          <h1>Other Products Inventory Report</h1>
        </div>
        <div className="header-controls">
          <div className="filter-controls-group">
            <div className="filter-item">
              <label className="filter-label">Branch Filter:</label>
              <Select
                isMulti
                options={branchOptions}
                value={branchOptions.filter((opt) => selectedBranch.includes(opt.value))}
                onChange={handleBranchChange}
                styles={customSelectStyles}
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                components={{ ValueContainer: CustomValueContainer, Option: CustomOption }}
                placeholder="Select Branch"
              />
            </div>

            <div className="filter-item">
              <label className="filter-label">Dealer Filter:</label>
              <Select
                isMulti
                options={dealerOptions}
                value={dealerOptions.filter((opt) => selectedDealers.includes(opt.value))}
                onChange={handleDealerChange}
                styles={customSelectStyles}
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                components={{ ValueContainer: CustomValueContainer, Option: CustomOption }}
                placeholder="Select Dealer"
              />
            </div>

            <div className="filter-item">
              <label className="filter-label">Product Filter:</label>
              <Select
                isMulti
                options={productOptions}
                value={productOptions.filter((opt) => selectedProducts.includes(opt.value))}
                onChange={handleProductChange}
                styles={customSelectStyles}
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                components={{ ValueContainer: CustomValueContainer, Option: CustomOption }}
                placeholder="Select Product"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="report-content">
        {loading ? (
          <div className="loading-state">Loading inventory report...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : data ? (
          <div>
            <div className="summary-cards-grid">
              <div className="stock-summary-card stock-summary-card--count">
                <div className="stock-summary-title">Total Products</div>
                <div className="stock-summary-amount">{data.meta.totalProductsCount}</div>
              </div>
              <div className="stock-summary-card stock-summary-card--quantity">
                <div className="stock-summary-title">Total Stock Quantity</div>
                <div className="stock-summary-amount">{data.meta.grandTotalStockCount.toLocaleString('en-IN')}</div>
              </div>
              <div className="stock-summary-card stock-summary-card--value">
                <div className="stock-summary-title">Total Stock Value</div>
                <div className="stock-summary-amount">₹{data.meta.grandTotalValue.toLocaleString('en-IN')}</div>
              </div>
            </div>

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
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                  <span> entries</span>
                </div>
              </div>

              {paginatedItems.length > 0 ? (
                <div className="report-items-table">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '5%' }}>S.NO</th>
                        <th style={{ width: '32%' }}>Product Name</th>
                        <th style={{ width: '13%', textAlign: 'right' }}>Stock Count</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>STD</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>MIN</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>MAX</th>
                        <th style={{ width: '20%', textAlign: 'right' }}>Total Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => (
                        <tr key={`${item.productId}-${idx}`}>
                          <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                            {(activePage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="product-cell">{item.productName}</td>
                          <td className="quantity-cell">{item.stockCount.toLocaleString('en-IN')}</td>
                          <td className="quantity-cell" style={{ textAlign: 'right' }}>
                            {item.standardStockLevel !== undefined && item.standardStockLevel !== null
                              ? item.standardStockLevel.toLocaleString('en-IN')
                              : '-'}
                          </td>
                          <td className="quantity-cell" style={{ textAlign: 'right' }}>
                            {item.minimumStockLevel !== undefined && item.minimumStockLevel !== null
                              ? item.minimumStockLevel.toLocaleString('en-IN')
                              : '-'}
                          </td>
                          <td className="quantity-cell" style={{ textAlign: 'right' }}>
                            {item.maximumStockLevel !== undefined && item.maximumStockLevel !== null
                              ? item.maximumStockLevel.toLocaleString('en-IN')
                              : '-'}
                          </td>
                          <td className="value-cell">₹{item.totalValue.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700 }}>
                        <td colSpan={2} style={{ textAlign: 'right' }}>Total:</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {data.meta.grandTotalStockCount.toLocaleString('en-IN')}
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                          ₹{data.meta.grandTotalValue.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {totalPages > 1 && (
                    <div className="pagination-wrapper">
                      <div className="pagination-info">
                        Showing {(activePage - 1) * pageSize + 1} to{' '}
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
                          .map((p) => (
                            <button
                              key={p}
                              onClick={() => setCurrentPage(p)}
                              className={`pagination-btn ${activePage === p ? 'active' : ''}`}
                            >
                              {p}
                            </button>
                          ))}

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
                <div className="no-data">No product inventory records found.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="no-data">No data available.</div>
        )}
      </div>
    </div>
  )
}

export default OtherProductsInventoryReport
