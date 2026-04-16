'use client'

import React, { useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './index.scss'

import {
  KitchenDoc,
  BranchDoc,
  CategoryDoc,
  ProductDoc,
  BillPreparationDetail,
  BillingDoc,
  ApiListResponse,
} from './types'

import {
  isRecord,
  byNameAsc,
  toLocalDateStr,
  normalizeRelationshipID,
  relationshipToIDList,
  formatMinutes,
  formatCount,
  toFiniteNumber,
  getPreparationStatus,
  formatAmount,
  resolveLabel,
  resolveCreatedByLabel,
  asText,
  readObjectTextByKeys,
  toBillSuffix,
  formatThermalDateTime,
  resolveItemActualPreparationMinutesForPreview,
  getQuarterDates,
} from './utils'

import { DateRangeInput } from './components/DateRangeInput'

const ProductTimeReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [rangeStartDate, rangeEndDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)

  const [branches, setBranches] = useState<BranchDoc[]>([])
  const [kitchens, setKitchens] = useState<KitchenDoc[]>([])
  const [categories, setCategories] = useState<CategoryDoc[]>([])
  const [products, setProducts] = useState<ProductDoc[]>([])
  const [chefs, setChefs] = useState<UserDoc[]>([])

  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedKitchen, setSelectedKitchen] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<string>('all')
  const [selectedChef, setSelectedChef] = useState<string>('all')

  const [loading, setLoading] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [error, setError] = useState('')
  const [billDetails, setBillDetails] = useState<BillPreparationDetail[]>([])
  const [loadingBillDetails, setLoadingBillDetails] = useState(false)
  const [billDetailsError, setBillDetailsError] = useState('')
  const [selectedBillRow, setSelectedBillRow] = useState<BillPreparationDetail | null>(null)
  const [selectedBill, setSelectedBill] = useState<BillingDoc | null>(null)
  const [loadingSelectedBill, setLoadingSelectedBill] = useState(false)
  const [selectedBillError, setSelectedBillError] = useState('')
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)

  useEffect(() => {
    const fetchMetadata = async () => {
      setLoadingMeta(true)
      setError('')

      try {
        const [branchRes, kitchenRes, categoryRes, productRes, chefRes, billRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/kitchens?limit=200&pagination=false&depth=1'),
          fetch('/api/categories?limit=1000&pagination=false&depth=0'),
          fetch('/api/products?limit=2000&pagination=false&depth=0'),
          fetch('/api/users?where[role][equals]=chef&limit=1000&pagination=false&depth=0'),
          fetch('/api/billings?sort=createdAt&limit=1'),
        ])

        if (!branchRes.ok || !kitchenRes.ok || !categoryRes.ok || !productRes.ok || !chefRes.ok) {
          throw new Error('Failed to load filter metadata')
        }

        const branchJson = (await branchRes.json()) as ApiListResponse<BranchDoc>
        const kitchenJson = (await kitchenRes.json()) as ApiListResponse<KitchenDoc>
        const categoryJson = (await categoryRes.json()) as ApiListResponse<CategoryDoc>
        const productJson = (await productRes.json()) as ApiListResponse<ProductDoc>
        const chefJson = (await chefRes.json()) as ApiListResponse<UserDoc>

        const branchDocs = Array.isArray(branchJson.docs) ? branchJson.docs : []
        const kitchenDocs = Array.isArray(kitchenJson.docs) ? kitchenJson.docs : []
        const categoryDocs = Array.isArray(categoryJson.docs) ? categoryJson.docs : []
        const productDocs = Array.isArray(productJson.docs) ? productJson.docs : []
        const chefDocs = Array.isArray(chefJson.docs) ? chefJson.docs : []

        branchDocs.sort(byNameAsc)
        kitchenDocs.sort(byNameAsc)
        categoryDocs.sort(byNameAsc)
        productDocs.sort(byNameAsc)
        chefDocs.sort(byNameAsc)

        setBranches(branchDocs)
        setKitchens(kitchenDocs)
        setCategories(categoryDocs)
        setProducts(productDocs)
        setChefs(chefDocs)

        if (billRes.ok) {
          const billJson = (await billRes.json()) as ApiListResponse<{ createdAt?: string }>
          const first = Array.isArray(billJson.docs) ? billJson.docs[0] : undefined
          if (first?.createdAt) {
            const parsed = new Date(first.createdAt)
            if (!Number.isNaN(parsed.getTime())) {
              setFirstBillDate(parsed)
            }
          }
        }

      } catch (metadataError) {
        console.error(metadataError)
        setError('Error loading kitchen/category/product filters')
      } finally {
        setLoadingMeta(false)
      }
    }

    fetchMetadata()
  }, [])

  const filteredKitchens = useMemo(() => {
    if (selectedBranch === 'all') return kitchens

    return kitchens.filter((kitchen) => relationshipToIDList(kitchen.branches).includes(selectedBranch))
  }, [kitchens, selectedBranch])

  useEffect(() => {
    if (filteredKitchens.length === 0) {
      setSelectedKitchen('')
      return
    }

    setSelectedKitchen((previous) => {
      if (previous && filteredKitchens.some((kitchen) => kitchen.id === previous)) return previous
      return filteredKitchens[0].id
    })
  }, [filteredKitchens])

  const kitchenCategoryIDs = useMemo(() => {
    if (!selectedKitchen) return []

    const kitchen = filteredKitchens.find((item) => item.id === selectedKitchen)
    if (!kitchen) return []

    return relationshipToIDList(kitchen.categories)
  }, [filteredKitchens, selectedKitchen])

  const filteredCategories = useMemo(() => {
    if (kitchenCategoryIDs.length === 0) return []

    const categorySet = new Set(kitchenCategoryIDs)
    return categories.filter((category) => categorySet.has(category.id))
  }, [categories, kitchenCategoryIDs])

  const filteredProducts = useMemo(() => {
    if (filteredCategories.length === 0) return []

    const categorySet = new Set(
      selectedCategory === 'all'
        ? filteredCategories.map((category) => category.id)
        : [selectedCategory],
    )

    return products.filter((product) => {
      const categoryID = normalizeRelationshipID(product.category)
      return categoryID.length > 0 && categorySet.has(categoryID)
    })
  }, [products, filteredCategories, selectedCategory])

  const productPreparationByID = useMemo(() => {
    const map = new Map<string, number>()

    products.forEach((product) => {
      const prep = toFiniteNumber(product.preparationTime)
      if (prep != null) {
        map.set(product.id, prep)
      }
    })

    return map
  }, [products])

  useEffect(() => {
    setSelectedCategory('all')
    setSelectedProduct('all')
  }, [selectedKitchen])

  useEffect(() => {
    setSelectedProduct('all')
  }, [selectedCategory])

  const handleDatePresetChange = (value: string) => {
    setDateRangePreset(value)
    const now = new Date()
    const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let start: Date | null = null
    let end: Date | null = currentDay

    switch (value) {
      case 'till_now':
        start = firstBillDate
        break
      case 'today':
        start = currentDay
        end = currentDay
        break
      case 'yesterday': {
        const yesterday = new Date(currentDay)
        yesterday.setDate(yesterday.getDate() - 1)
        start = yesterday
        end = yesterday
        break
      }
      case 'last_7_days': {
        const last7 = new Date(currentDay)
        last7.setDate(last7.getDate() - 6)
        start = last7
        break
      }
      case 'this_month':
        start = new Date(currentDay.getFullYear(), currentDay.getMonth(), 1)
        end = currentDay
        break
      case 'last_30_days': {
        const last30 = new Date(currentDay)
        last30.setDate(last30.getDate() - 29)
        start = last30
        break
      }
      case 'last_month':
        start = new Date(currentDay.getFullYear(), currentDay.getMonth() - 1, 1)
        end = new Date(currentDay.getFullYear(), currentDay.getMonth(), 0)
        break
      case 'last_quarter': {
        const quarter = getQuarterDates(currentDay)
        start = quarter.start
        end = quarter.end
        break
      }
      default:
        break
    }

    if (start && end) {
      setDateRange([start, end])
    }
  }



  useEffect(() => {
    const fetchBillDetails = async () => {
      if (!rangeStartDate || !rangeEndDate) {
        setBillDetails([])
        setBillDetailsError('')
        setSelectedBillRow(null)
        setSelectedBill(null)
        setSelectedBillError('')
        setIsReceiptModalOpen(false)
        return
      }

      const startDate = toLocalDateStr(rangeStartDate)
      const endDate = toLocalDateStr(rangeEndDate)
      const categoryParam = selectedCategory === 'all' ? kitchenCategoryIDs.join(',') : selectedCategory

      setLoadingBillDetails(true)
      setBillDetailsError('')
      setLoading(true)
      try {
        const url = `/api/reports/product-preparation-bill-details?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&branch=${encodeURIComponent(selectedBranch)}&category=${encodeURIComponent(categoryParam)}&department=all&productId=${encodeURIComponent(selectedProduct)}&chefId=${encodeURIComponent(selectedChef)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch bill details')

        const json = (await res.json()) as {
          details?: Array<{
            billingId?: unknown
            billNumber?: unknown
            productName?: unknown
            orderedAt?: unknown
            preparedAt?: unknown
            preparationTime?: unknown
            chefPreparationTime?: unknown
            chefName?: unknown
          }>
        }

        const details = Array.isArray(json.details)
          ? json.details.map((entry) => ({
              billingId: typeof entry.billingId === 'string' ? entry.billingId.trim() : '',
              billNumber:
                typeof entry.billNumber === 'string' && entry.billNumber.trim().length > 0
                  ? entry.billNumber
                  : 'Unknown',
              productName: typeof entry.productName === 'string' ? entry.productName : '--',
              orderedAt: typeof entry.orderedAt === 'string' ? entry.orderedAt : '--',
              preparedAt: typeof entry.preparedAt === 'string' ? entry.preparedAt : '--',
              preparationTime:
                typeof entry.preparationTime === 'number' && Number.isFinite(entry.preparationTime)
                  ? entry.preparationTime
                  : null,
              chefPreparationTime:
                typeof entry.chefPreparationTime === 'number' && Number.isFinite(entry.chefPreparationTime)
                  ? entry.chefPreparationTime
                  : null,
              productStandardPreparationTime:
                typeof entry.productStandardPreparationTime === 'number' && Number.isFinite(entry.productStandardPreparationTime)
                  ? entry.productStandardPreparationTime
                  : null,
              chefName: typeof entry.chefName === 'string' ? entry.chefName : '--',
            }))
          : []

        setBillDetails(details)
        setSelectedBillRow((previous) => {
          if (details.length === 0) return null
          if (
            previous &&
            previous.billingId.length > 0 &&
            details.some((entry) => entry.billingId === previous.billingId)
          ) {
            return previous
          }
          return details[0]
        })
        if (details.length === 0) {
          setSelectedBill(null)
          setSelectedBillError('')
          setIsReceiptModalOpen(false)
        }
      } catch (detailsError) {
        console.error(detailsError)
        setBillDetails([])
        setBillDetailsError('Failed to load bill details')
        setSelectedBillRow(null)
        setSelectedBill(null)
        setSelectedBillError('')
        setIsReceiptModalOpen(false)
      } finally {
        setLoadingBillDetails(false)
        setLoading(false)
      }
    }

    fetchBillDetails()
  }, [
    selectedProduct,
    rangeStartDate,
    rangeEndDate,
    selectedBranch,
    selectedKitchen,
    selectedCategory,
    kitchenCategoryIDs,
    selectedChef,
  ])

  useEffect(() => {
    const fetchSelectedBill = async () => {
      if (!selectedBillRow || !selectedBillRow.billingId) {
        setSelectedBill(null)
        setSelectedBillError('')
        return
      }

      setLoadingSelectedBill(true)
      setSelectedBillError('')
      try {
        const res = await fetch(`/api/billings/${encodeURIComponent(selectedBillRow.billingId)}?depth=2`)
        if (!res.ok) throw new Error('Failed to fetch bill preview')

        const raw = (await res.json()) as unknown
        const billPayload: unknown = isRecord(raw) && isRecord(raw.doc) ? raw.doc : raw
        if (!isRecord(billPayload)) throw new Error('Invalid bill response')

        setSelectedBill(billPayload as BillingDoc)
      } catch (billError) {
        console.error(billError)
        setSelectedBill(null)
        setSelectedBillError('Failed to load bill preview')
      } finally {
        setLoadingSelectedBill(false)
      }
    }

    fetchSelectedBill()
  }, [selectedBillRow])

  const selectedBillItems = useMemo(() => {
    if (!selectedBill || !Array.isArray(selectedBill.items)) return []

    return selectedBill.items.filter((item) => {
      const status = asText(item?.status).toLowerCase()
      return status !== 'cancelled'
    })
  }, [selectedBill])

  const selectedBillNumber =
    asText(selectedBill?.invoiceNumber) ||
    asText(selectedBill?.kotNumber) ||
    selectedBillRow?.billNumber ||
    '--'
  const selectedBillShortNo = toBillSuffix(selectedBillNumber)

  const selectedCustomerName = asText(selectedBill?.customerDetails?.name) || '--'
  const selectedCustomerPhone = asText(selectedBill?.customerDetails?.phoneNumber) || '--'
  const selectedTableSection = asText(selectedBill?.tableDetails?.section)
  const selectedTableNumber = asText(selectedBill?.tableDetails?.tableNumber)
  const selectedTableLabel =
    selectedTableNumber || selectedTableSection
      ? `${selectedTableNumber}${selectedTableSection ? ` (${selectedTableSection})` : ''}`
      : '--'
  const selectedBranchLabel = resolveLabel(selectedBill?.branch)
  const selectedBranchGST =
    readObjectTextByKeys(selectedBill?.branch, ['gstin', 'gst', 'gstNumber', 'gstNo', 'gstId']) ||
    '--'
  const selectedBranchPhone =
    readObjectTextByKeys(selectedBill?.branch, ['phone', 'mobile', 'phoneNumber', 'contactNumber']) ||
    '--'
  const selectedCreatedByLabel = resolveCreatedByLabel(selectedBill?.createdBy)
  const selectedPaymentMethod = asText(selectedBill?.paymentMethod)
  const selectedCompanyLabel = resolveLabel(selectedBill?.company) !== '--' ? resolveLabel(selectedBill?.company) : 'BlackForest Cakes'
  const selectedThermalDate = formatThermalDateTime(selectedBill?.createdAt)
  const selectedRoundOffValue = toFiniteNumber(selectedBill?.roundOffAmount)
  const selectedRoundOffLabel =
    selectedRoundOffValue == null
      ? '--'
      : `${selectedRoundOffValue > 0 ? '+' : ''}${formatAmount(selectedRoundOffValue)}`

  const handleExportCSV = () => {
    if (billDetails.length === 0 || !rangeStartDate || !rangeEndDate) return

    const startDate = toLocalDateStr(rangeStartDate)
    const endDate = toLocalDateStr(rangeEndDate)

    const columns = [
      'BILL NO',
      'PRODUCT NAME',
      'ORDERED AT',
      'STD PREP',
      'PT (ACTUAL)',
      'PREPARED AT',
      'CHEF',
    ]

    const csvRows = [
      columns.join(','),
      ...billDetails.map((row) =>
        [
          `"${row.billNumber.replace(/"/g, '""')}"`,
          `"${row.productName.replace(/"/g, '""')}"`,
          `"${row.orderedAt}"`,
          formatMinutes(row.productStandardPreparationTime).replace(' min', ''),
          formatMinutes(row.preparationTime).replace(' min', ''),
          `"${row.preparedAt}"`,
          `"${row.chefName.replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ]

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `detailed_product_time_report_${startDate}_to_${endDate}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="product-time-report-container">
      <div className="product-time-report-header">
        <h1>Product Time Report</h1>
      </div>

      <div className="top-controls-row">
        <label className="preset-filter">
          Preset
          <select value={dateRangePreset} onChange={(e) => handleDatePresetChange(e.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_month">Last Month</option>
            <option value="last_quarter">Last Quarter</option>
            <option value="till_now">Till Now</option>
          </select>
        </label>

        <label className="date-range-filter">
          Date Range
          <DatePicker
            selectsRange
            startDate={rangeStartDate}
            endDate={rangeEndDate}
            onChange={(update) => setDateRange(update)}
            monthsShown={2}
            dateFormat="yyyy-MM-dd"
            customInput={<DateRangeInput />}
            calendarClassName="custom-calendar"
            popperPlacement="bottom-start"
          />
        </label>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={billDetails.length === 0 || loading || loadingMeta}
        >
          Export
        </button>
      </div>

      <div className="filters-wrap">
        <label>
          Branch
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Kitchen
          <select
            value={selectedKitchen}
            onChange={(e) => setSelectedKitchen(e.target.value)}
            disabled={loadingMeta || filteredKitchens.length === 0}
          >
            {filteredKitchens.length === 0 && <option value="">No kitchens</option>}
            {filteredKitchens.map((kitchen) => (
              <option key={kitchen.id} value={kitchen.id}>
                {kitchen.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Category
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={loadingMeta || !selectedKitchen}
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
          Product
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            disabled={loadingMeta || !selectedKitchen}
          >
            <option value="all">All Products</option>
            {filteredProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Chef
          <select
            value={selectedChef}
            onChange={(e) => setSelectedChef(e.target.value)}
            disabled={loadingMeta}
          >
            <option value="all">All Chefs</option>
            {chefs.map((chef) => (
              <option key={chef.id} value={chef.id}>
                {chef.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="state error">{error}</p>}
      {(loading || loadingMeta) && <p className="state">Loading report...</p>}

      {!loading && !loadingMeta && billDetails.length === 0 && (
        <p className="state">No data found for selected filters.</p>
      )}

      {billDetails.length > 0 && (
        <div className="report-panels">
          <div className="right-panels">
            <div className="pt-table-wrap details-table-wrap">
              <table className="pt-report-table pt-details-table">
                <thead>
                  <tr>
                    <th>BILL NO</th>
                    <th>PRODUCT NAME</th>
                    <th>ORDERED AT</th>
                    <th>STD PREP</th>
                    <th>PT (ACTUAL)</th>
                    <th>PREPARED AT</th>
                    <th>CHEF</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBillDetails && (
                    <tr>
                      <td colSpan={7}>Loading...</td>
                    </tr>
                  )}

                  {!loadingBillDetails && billDetailsError && (
                    <tr>
                      <td colSpan={7}>{billDetailsError}</td>
                    </tr>
                  )}

                  {!loadingBillDetails && !billDetailsError && billDetails.length === 0 && (
                    <tr>
                      <td colSpan={7}>No details found.</td>
                    </tr>
                  )}

                  {!loadingBillDetails &&
                    !billDetailsError &&
                    billDetails.map((entry, index) => {
                      const key = entry.billingId || `${entry.billNumber}-${index}`
                      const isSelected =
                        selectedBillRow != null &&
                        entry.billingId.length > 0 &&
                        entry.billingId === selectedBillRow.billingId
                      const configuredPerUnit = entry.productStandardPreparationTime ?? 0
                      const totalStandardTime = configuredPerUnit * (entry.quantity || 1)

                      const billPreparedTime = toFiniteNumber(entry.preparationTime)
                      const preparationStatus = getPreparationStatus(
                        billPreparedTime,
                        totalStandardTime,
                      )
                      const rowClassName = [
                        entry.billingId.length > 0 ? 'is-clickable' : 'is-disabled',
                        isSelected ? 'is-selected' : '',
                        preparationStatus === 'exceeded' ? 'prep-row-exceeded' : '',
                        preparationStatus === 'lower' ? 'prep-row-lower' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')

                      return (
                        <tr
                          key={key}
                          className={rowClassName}
                          onClick={() => {
                            if (!entry.billingId) return
                            setSelectedBillRow(entry)
                            setIsReceiptModalOpen(true)
                          }}
                        >
                          <td>{entry.billNumber}</td>
                          <td>{entry.productName}</td>
                          <td>{entry.orderedAt}</td>
                          <td>{formatMinutes(entry.productStandardPreparationTime)}</td>
                          <td>
                            <span className="prep-time-with-chef">
                              <span>{formatMinutes(entry.preparationTime)}</span>
                              {entry.chefPreparationTime != null && (
                                <span className="chef-prep-time">({formatMinutes(entry.chefPreparationTime)})</span>
                              )}
                            </span>
                          </td>
                          <td>{entry.preparedAt}</td>
                          <td>{entry.chefName}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isReceiptModalOpen && (
        <div className="thermal-modal-backdrop" onClick={() => setIsReceiptModalOpen(false)}>
          <div className="thermal-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="thermal-modal-close"
              onClick={() => setIsReceiptModalOpen(false)}
            >
              Close
            </button>

            <div className="pt-table-wrap thermal-preview-wrap">
              {loadingSelectedBill && <p className="state">Loading bill...</p>}
              {!loadingSelectedBill && selectedBillError && <p className="state error">{selectedBillError}</p>}
              {!loadingSelectedBill && !selectedBillError && !selectedBill && (
                <p className="state">Click a bill number to view full bill.</p>
              )}

              {!loadingSelectedBill && !selectedBillError && selectedBill && (
                <div className="thermal-bill">
                  <div className="thermal-bill-header">
                    <h3>{selectedCompanyLabel}</h3>
                    <p>Branch: {selectedBranchLabel}</p>
                    <p>GST: {selectedBranchGST}</p>
                    <p>Mobile: {selectedBranchPhone}</p>
                  </div>

                  <p className="thermal-separator">==============================================</p>

                  <div className="thermal-meta-row thermal-meta-row-main">
                    <p className="thermal-inline-left">Date: {selectedThermalDate}</p>
                    <p className="thermal-inline-right">BILL NO -{selectedBillShortNo}</p>
                  </div>
                  <div className="thermal-meta-row">
                    <p>Assigned by: {selectedCreatedByLabel}</p>
                    <p className="thermal-meta-right">Table : {selectedTableLabel}</p>
                  </div>

                  <p className="thermal-separator">==============================================</p>

                  <table className="thermal-items-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>PT</th>
                        <th>Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBillItems.length === 0 && (
                        <tr>
                          <td colSpan={4}>No items</td>
                        </tr>
                      )}

                      {selectedBillItems.map((item, index) => {
                        const rawQuantity = toFiniteNumber(item.quantity)
                        const quantity = rawQuantity != null && rawQuantity > 0 ? rawQuantity : 1
                        const itemProductId = normalizeRelationshipID(item.product)
                        const configuredProductPrepPerUnit =
                          (itemProductId ? productPreparationByID.get(itemProductId) : null)
                        const itemPreparingTime = toFiniteNumber(item.preparingTime)

                        const estimatedTotalPrepTime = itemPreparingTime
                        const actualTotalPrepTime = resolveItemActualPreparationMinutesForPreview(
                          item,
                          selectedBill?.createdAt,
                        )
                        const totalPrepTime = actualTotalPrepTime ?? estimatedTotalPrepTime
                        const prepPerUnit =
                          totalPrepTime != null && Number.isFinite(totalPrepTime) && quantity > 0
                            ? totalPrepTime
                            : null
                        const estimatedPrepPerUnit =
                          configuredProductPrepPerUnit != null &&
                          Number.isFinite(configuredProductPrepPerUnit) &&
                          configuredProductPrepPerUnit > 0
                            ? configuredProductPrepPerUnit
                            : null
                        const isPrepExceeded =
                          prepPerUnit != null &&
                          estimatedPrepPerUnit != null &&
                          prepPerUnit > estimatedPrepPerUnit * quantity
                        const isPrepLower =
                          prepPerUnit != null &&
                          estimatedPrepPerUnit != null &&
                          prepPerUnit < estimatedPrepPerUnit * quantity
                        const ptClassName = isPrepExceeded
                          ? 'pt-exceeded'
                          : isPrepLower
                            ? 'pt-lower'
                            : ''
                        const amount = toFiniteNumber(item.finalLineTotal) ?? toFiniteNumber(item.subtotal)
                        const itemName = asText(item.name) || '--'

                        return (
                          <tr key={`${itemName}-${index}`}>
                            <td>{itemName}</td>
                            <td>{formatCount(quantity)}</td>
                            <td className={ptClassName}>{formatCount(prepPerUnit)}</td>
                            <td>{formatAmount(amount)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <p className="thermal-separator">----------------------------------------------</p>

                  <div className="thermal-totals">
                    <p>
                      <span>SUB TOTAL RS</span>
                      <strong>{formatAmount(selectedBill.subTotal)}</strong>
                    </p>
                    <p>
                      <span>CGST RS</span>
                      <strong>{formatAmount(selectedBill.cgstAmount)}</strong>
                    </p>
                    <p>
                      <span>SGST RS</span>
                      <strong>{formatAmount(selectedBill.sgstAmount)}</strong>
                    </p>
                    <p>
                      <span>Round off</span>
                      <strong>{selectedRoundOffLabel}</strong>
                    </p>
                    <p className="thermal-grand-total">
                      <span>GRAND TOTAL RS</span>
                      <strong>{formatAmount(selectedBill.totalAmount)}</strong>
                    </p>
                  </div>

                  <p className="thermal-separator">==============================================</p>

                  <p className="thermal-paid-by">
                    PAID BY: <strong>{selectedPaymentMethod ? selectedPaymentMethod.toUpperCase() : '--'}</strong>
                  </p>

                  <div className="thermal-customer">
                    <p>Customer: {selectedCustomerName}</p>
                    <p>Phone: {selectedCustomerPhone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductTimeReport
