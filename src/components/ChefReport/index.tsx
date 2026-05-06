'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

type NamedOption = {
  id: string
  name: string
}

type KitchenOption = NamedOption & {
  branchIds: string[]
  categoryIds: string[]
}

type ProductOption = NamedOption & {
  categoryId: string
}

type ChefSummaryRow = {
  chefName: string
  sendingAmount: number
}

type ChefSummaryApiRow = {
  chefName?: unknown
  sendingAmount?: unknown
}

type ChefReportResponse = {
  data?: {
    stockOrderReport?: {
      chefSummary?: ChefSummaryApiRow[]
    }
  }
  errors?: Array<{ message?: string }>
}

type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'last_month'
  | 'custom'

const STOCK_ORDER_CHEF_QUERY = `
  query StockOrderChefSummary($filter: StockOrderReportFilterInput) {
    stockOrderReport(filter: $filter) {
      chefSummary {
        chefName
        sendingAmount
      }
    }
  }
`

const toDateInputValue = (date: Date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

const getRelationshipId = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  if (!('id' in value)) return ''
  return toStringValue((value as { id?: unknown }).id)
}

const getRelationshipIdList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => getRelationshipId(entry))
      .filter((id): id is string => id.length > 0)
  }

  const single = getRelationshipId(value)
  return single ? [single] : []
}

const toNamedOptions = (rawDocs: unknown[]): NamedOption[] =>
  rawDocs
    .filter((doc): doc is { id?: unknown; name?: unknown } => !!doc && typeof doc === 'object')
    .map((doc) => {
      const id = toStringValue(doc.id)
      const name = toStringValue(doc.name)
      return { id, name }
    })
    .filter((doc) => doc.id.length > 0 && doc.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

const toKitchenOptions = (rawDocs: unknown[]): KitchenOption[] =>
  rawDocs
    .filter(
      (doc): doc is { id?: unknown; name?: unknown; branches?: unknown; categories?: unknown } =>
        !!doc && typeof doc === 'object',
    )
    .map((doc) => {
      const id = toStringValue(doc.id)
      const name = toStringValue(doc.name)
      const branchIds = getRelationshipIdList(doc.branches)
      const categoryIds = getRelationshipIdList(doc.categories)

      return { id, name, branchIds, categoryIds }
    })
    .filter((doc) => doc.id.length > 0 && doc.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

const toProductOptions = (rawDocs: unknown[]): ProductOption[] =>
  rawDocs
    .filter(
      (doc): doc is { id?: unknown; name?: unknown; category?: unknown } =>
        !!doc && typeof doc === 'object',
    )
    .map((doc) => {
      const id = toStringValue(doc.id)
      const name = toStringValue(doc.name)
      const categoryId = getRelationshipId(doc.category)
      return { id, name, categoryId }
    })
    .filter((doc) => doc.id.length > 0 && doc.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

const getPresetRange = (preset: Exclude<DatePreset, 'custom'>): { start: Date; end: Date } => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'today') {
    return { start: today, end: today }
  }

  if (preset === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return { start: yesterday, end: yesterday }
  }

  if (preset === 'last_7_days') {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { start, end: today }
  }

  if (preset === 'this_month') {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }
  }

  if (preset === 'last_30_days') {
    const start = new Date(today)
    start.setDate(start.getDate() - 29)
    return { start, end: today }
  }

  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const end = new Date(today.getFullYear(), today.getMonth(), 0)
  return { start, end }
}

const ChefReport: React.FC = () => {
  const today = toDateInputValue(new Date())
  const [datePreset, setDatePreset] = useState<DatePreset>('today')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)

  const [selectedBranch, setSelectedBranch] = useState('all')
  const [selectedKitchen, setSelectedKitchen] = useState('all')
  const [selectedChef, setSelectedChef] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState('all')

  const [branches, setBranches] = useState<NamedOption[]>([])
  const [kitchens, setKitchens] = useState<KitchenOption[]>([])
  const [chefs, setChefs] = useState<NamedOption[]>([])
  const [categories, setCategories] = useState<NamedOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])

  const [loadingFilters, setLoadingFilters] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<ChefSummaryRow[]>([])

  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoadingFilters(true)
      try {
        const [branchRes, kitchenRes, categoryRes, productRes, chefRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/kitchens?limit=1000&pagination=false&sort=name&depth=0'),
          fetch('/api/categories?limit=1000&pagination=false&sort=name&depth=0'),
          fetch('/api/products?limit=2000&pagination=false&sort=name&depth=0'),
          fetch('/api/users?where[role][equals]=chef&limit=1000&pagination=false&sort=name&depth=0'),
        ])

        const [branchJson, kitchenJson, categoryJson, productJson, chefJson] = await Promise.all([
          branchRes.json(),
          kitchenRes.json(),
          categoryRes.json(),
          productRes.json(),
          chefRes.json(),
        ])

        const branchDocs = Array.isArray(branchJson?.docs) ? branchJson.docs : []
        const kitchenDocs = Array.isArray(kitchenJson?.docs) ? kitchenJson.docs : []
        const categoryDocs = Array.isArray(categoryJson?.docs) ? categoryJson.docs : []
        const productDocs = Array.isArray(productJson?.docs) ? productJson.docs : []
        const chefDocs = Array.isArray(chefJson?.docs) ? chefJson.docs : []

        setBranches(toNamedOptions(branchDocs))
        setKitchens(toKitchenOptions(kitchenDocs))
        setCategories(toNamedOptions(categoryDocs))
        setProducts(toProductOptions(productDocs))
        setChefs(toNamedOptions(chefDocs))
      } catch (_err) {
        setBranches([])
        setKitchens([])
        setCategories([])
        setProducts([])
        setChefs([])
      } finally {
        setLoadingFilters(false)
      }
    }

    void fetchFilterOptions()
  }, [])

  const filteredKitchens = useMemo(() => {
    if (selectedBranch === 'all') return kitchens
    return kitchens.filter((kitchen) => kitchen.branchIds.includes(selectedBranch))
  }, [kitchens, selectedBranch])

  const allowedCategoryIDSet = useMemo(() => {
    if (selectedKitchen !== 'all') {
      const kitchen = kitchens.find((item) => item.id === selectedKitchen)
      return new Set(kitchen?.categoryIds || [])
    }

    if (selectedBranch !== 'all') {
      const union = new Set<string>()
      filteredKitchens.forEach((kitchen) => {
        kitchen.categoryIds.forEach((categoryId) => {
          union.add(categoryId)
        })
      })
      return union
    }

    return null
  }, [filteredKitchens, kitchens, selectedBranch, selectedKitchen])

  const filteredCategories = useMemo(() => {
    if (!allowedCategoryIDSet) return categories
    return categories.filter((category) => allowedCategoryIDSet.has(category.id))
  }, [allowedCategoryIDSet, categories])

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return products
    return products.filter((product) => product.categoryId === selectedCategory)
  }, [products, selectedCategory])

  useEffect(() => {
    if (selectedBranch === 'all') return
    const exists = branches.some((branch) => branch.id === selectedBranch)
    if (!exists) setSelectedBranch('all')
  }, [branches, selectedBranch])

  useEffect(() => {
    if (selectedKitchen === 'all') return
    const exists = filteredKitchens.some((kitchen) => kitchen.id === selectedKitchen)
    if (!exists) setSelectedKitchen('all')
  }, [filteredKitchens, selectedKitchen])

  useEffect(() => {
    if (selectedCategory === 'all') return
    const exists = filteredCategories.some((category) => category.id === selectedCategory)
    if (!exists) setSelectedCategory('all')
  }, [filteredCategories, selectedCategory])

  useEffect(() => {
    if (selectedProduct === 'all') return
    const exists = filteredProducts.some((product) => product.id === selectedProduct)
    if (!exists) setSelectedProduct('all')
  }, [filteredProducts, selectedProduct])

  useEffect(() => {
    if (selectedChef === 'all') return
    const exists = chefs.some((chef) => chef.id === selectedChef)
    if (!exists) setSelectedChef('all')
  }, [chefs, selectedChef])

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return
    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      setError('Start date cannot be after end date.')
      setRows([])
      return
    }

    setLoadingReport(true)
    setError('')

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: STOCK_ORDER_CHEF_QUERY,
          variables: {
            filter: {
              startDate,
              endDate,
              branch: selectedBranch,
              kitchen: selectedKitchen,
              category: selectedCategory,
              product: selectedProduct,
              chef: selectedChef,
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch chef report (HTTP ${response.status})`)
      }

      const json = (await response.json()) as ChefReportResponse
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || 'Failed to fetch chef report')
      }

      const reportRows = Array.isArray(json.data?.stockOrderReport?.chefSummary)
        ? json.data?.stockOrderReport?.chefSummary
        : []

      const normalizedRows = reportRows
        .map((row) => ({
          chefName: toStringValue(row.chefName).trim() || 'Unknown',
          sendingAmount: toFiniteNumber(row.sendingAmount),
        }))
        .filter((row) => row.sendingAmount > 0)

      setRows(normalizedRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading chef report')
      setRows([])
    } finally {
      setLoadingReport(false)
    }
  }, [
    endDate,
    selectedBranch,
    selectedCategory,
    selectedChef,
    selectedKitchen,
    selectedProduct,
    startDate,
  ])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const totalSendingAmount = useMemo(
    () => rows.reduce((sum, row) => sum + (Number.isFinite(row.sendingAmount) ? row.sendingAmount : 0), 0),
    [rows],
  )

  const applyPreset = (preset: Exclude<DatePreset, 'custom'>) => {
    const range = getPresetRange(preset)
    setDatePreset(preset)
    setStartDate(toDateInputValue(range.start))
    setEndDate(toDateInputValue(range.end))
  }

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setDatePreset('custom')
      return
    }

    if (
      value === 'today' ||
      value === 'yesterday' ||
      value === 'last_7_days' ||
      value === 'this_month' ||
      value === 'last_30_days' ||
      value === 'last_month'
    ) {
      applyPreset(value)
    }
  }

  const handleExportCsv = () => {
    const csvRows: string[] = []
    csvRows.push(['Chef Name', 'Sending Amount'].join(','))
    rows.forEach((row) => {
      csvRows.push([`"${row.chefName.replace(/"/g, '""')}"`, row.sendingAmount.toString()].join(','))
    })
    csvRows.push(['"TOTAL"', totalSendingAmount.toString()].join(','))

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chef_report_${startDate}_to_${endDate}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const resetFilters = () => {
    applyPreset('today')
    setSelectedBranch('all')
    setSelectedKitchen('all')
    setSelectedChef('all')
    setSelectedCategory('all')
    setSelectedProduct('all')
  }

  return (
    <div style={{ padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <label>
          Calendar Controller:{' '}
          <select
            value={datePreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            style={{ padding: '6px 8px' }}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_month">Last Month</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label>
          Calendar Start:{' '}
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setDatePreset('custom')
              setStartDate(e.target.value)
            }}
            style={{ padding: '6px 8px' }}
          />
        </label>

        <label>
          Calendar End:{' '}
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setDatePreset('custom')
              setEndDate(e.target.value)
            }}
            style={{ padding: '6px 8px' }}
          />
        </label>

        <label>
          Branch:{' '}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{ padding: '6px 8px' }}
            disabled={loadingFilters}
          >
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Kitchen:{' '}
          <select
            value={selectedKitchen}
            onChange={(e) => setSelectedKitchen(e.target.value)}
            style={{ padding: '6px 8px' }}
            disabled={loadingFilters}
          >
            <option value="all">All Kitchens</option>
            {filteredKitchens.map((kitchen) => (
              <option key={kitchen.id} value={kitchen.id}>
                {kitchen.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Chef:{' '}
          <select
            value={selectedChef}
            onChange={(e) => setSelectedChef(e.target.value)}
            style={{ padding: '6px 8px' }}
            disabled={loadingFilters}
          >
            <option value="all">All Chefs</option>
            {chefs.map((chef) => (
              <option key={chef.id} value={chef.id}>
                {chef.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Category:{' '}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '6px 8px' }}
            disabled={loadingFilters}
          >
            <option value="all">All Categories</option>
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Product:{' '}
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            style={{ padding: '6px 8px' }}
            disabled={loadingFilters}
          >
            <option value="all">All Products</option>
            {filteredProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void fetchReport()}
          style={{ padding: '7px 10px', cursor: 'pointer' }}
          disabled={loadingReport}
        >
          Refresh
        </button>

        <button
          type="button"
          onClick={handleExportCsv}
          style={{ padding: '7px 10px', cursor: 'pointer' }}
          disabled={rows.length === 0}
        >
          Export CSV
        </button>

        <button type="button" onClick={resetFilters} style={{ padding: '7px 10px', cursor: 'pointer' }}>
          Reset
        </button>
      </div>

      <h1 style={{ margin: '0 0 16px 0' }}>Chef Report</h1>

      {loadingReport && <p>Loading chef report...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ overflowX: 'auto', width: '70%', maxWidth: '100%' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid var(--theme-elevation-200)',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px',
                  borderBottom: '1px solid var(--theme-elevation-200)',
                }}
              >
                Chef Name
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '10px',
                  borderBottom: '1px solid var(--theme-elevation-200)',
                }}
              >
                Sending Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${row.chefName}-${index}`}>
                  <td
                    style={{
                      padding: '10px',
                      borderBottom: '1px solid var(--theme-elevation-150)',
                      fontSize: '1.06rem',
                      fontWeight: 600,
                    }}
                  >
                    {row.chefName}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      borderBottom: '1px solid var(--theme-elevation-150)',
                      textAlign: 'right',
                      fontWeight: 700,
                    }}
                  >
                    ₹ {row.sendingAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={2}
                  style={{
                    textAlign: 'center',
                    padding: '16px',
                    borderBottom: '1px solid var(--theme-elevation-150)',
                  }}
                >
                  No chef report data found.
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '10px', fontWeight: 800, fontSize: '1.18rem' }}>Total</td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, fontSize: '1.18rem' }}>
                ₹ {totalSendingAmount.toLocaleString('en-IN')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ChefReport
