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
  variantName?: string
  stockCount: number
  standardStockLevel?: number
  minimumStockLevel?: number
  maximumStockLevel?: number
  packSize?: number
  variants?: {
    name: string
    weight?: number
    unit?: string
    standardStockLevel?: number
    minimumStockLevel?: number
    maximumStockLevel?: number
  }[]
  totalValue: number
  lastBillingDate: string
  dealerName?: string
  branchName?: string
  purchaseFrequency?: string
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
  const [products, setProducts] = useState<
    { id: string; name: string; dealerIds: string[]; packSize?: number; variants?: any[] }[]
  >([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>(['all'])
  const [selectedFrequency, setSelectedFrequency] = useState<string>('all')

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
              let dealerIds: string[] = []
              if (Array.isArray(p.dealer)) {
                dealerIds = p.dealer
                  .map((d: any) => (typeof d === 'string' ? d : d?.id || d?._id || ''))
                  .filter(Boolean)
              } else if (typeof p.dealer === 'string') {
                dealerIds = [p.dealer]
              } else if (p.dealer && typeof p.dealer === 'object') {
                dealerIds = [p.dealer.id || p.dealer._id || ''].filter(Boolean)
              }
              return {
                id: p.id,
                name: (p.name || 'Unknown Product').trim(),
                dealerIds,
                packSize: p.packSize,
                variants: Array.isArray(p.variants) ? p.variants : [],
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
        `/api/reports/other-products-inventory?branch=${bStr}&dealer=${dStr}&product=${pStr}&purchaseFrequency=${selectedFrequency}`,
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
  }, [selectedBranch, selectedDealers, selectedProducts, selectedFrequency])

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
        (p) => p.dealerIds && p.dealerIds.some((dId) => selectedDealers.includes(dId)),
      )
    }

    const options: SelectOption[] = [{ value: 'all', label: 'All Products' }]

    filteredProducts.forEach((p) => {
      options.push({ value: p.id, label: p.name })
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        p.variants.forEach((v: any) => {
          if (v.name) {
            options.push({
              value: p.id,
              label: `  ↳ ${p.name} (${v.name})`,
            })
          }
        })
      }
    })

    return options
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
        const validIds = products
          .filter((p) => p.dealerIds && p.dealerIds.some((dId) => nextDealers.includes(dId)))
          .map((p) => p.id)
        const filtered = prev.filter((id) => validIds.includes(id))
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

            <div className="filter-item">
              <label className="filter-label">Purchase Frequency:</label>
              <select
                value={selectedFrequency}
                onChange={(e) => {
                  setSelectedFrequency(e.target.value)
                  setCurrentPage(1)
                }}
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--theme-elevation-200)',
                  backgroundColor: 'var(--theme-elevation-0)',
                  color: 'var(--theme-elevation-800)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Frequencies</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="3month">3 Months</option>
                <option value="6month">6 Months</option>
                <option value="yearly">Yearly</option>
              </select>
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
                        <th style={{ width: '4%' }}>S.NO</th>
                        <th style={{ width: '26%' }}>Product Name</th>
                        <th style={{ width: '12%', textAlign: 'center' }}>Pack Size</th>
                        <th style={{ width: '12%', textAlign: 'right' }}>Stock Count</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>STD</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>MIN</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>MAX</th>
                        <th style={{ width: '16%', textAlign: 'right' }}>Total Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => (
                        <tr key={`${item.productId}-${idx}`}>
                          <td style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                            {(activePage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="product-cell">
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span>{item.productName}</span>
                              {item.purchaseFrequency && (
                                <span
                                  style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    color: '#2563eb',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {item.purchaseFrequency === '3month'
                                    ? '3 Months'
                                    : item.purchaseFrequency === '6month'
                                      ? '6 Months'
                                      : item.purchaseFrequency}
                                </span>
                              )}
                            </div>
                            {Array.isArray(item.variants) && item.variants.length > 0 && (
                              <div style={{ fontSize: '0.75rem', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {item.variants.map((v: any, vIdx: number) => (
                                  <span
                                    key={vIdx}
                                    style={{
                                      backgroundColor: 'var(--theme-elevation-150)',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontSize: '0.72rem',
                                    }}
                                  >
                                    Variant: {v.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="quantity-cell" style={{ textAlign: 'center' }}>
                            {item.packSize ? (
                              <>{item.packSize}</>
                            ) : Array.isArray(item.variants) && item.variants.length > 0 ? (
                              <span style={{ fontSize: '0.78rem' }}>
                                {item.variants.map((v: any) => `${v.name || ''}`).join(', ')}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
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
                        <td></td>
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
