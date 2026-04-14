'use client'

import React, { useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './index.scss'

type KitchenDoc = {
  id: string
  name: string
  branches?: unknown
  categories?: unknown
}

type BranchDoc = {
  id: string
  name: string
}

type CategoryDoc = {
  id: string
  name: string
}

type ProductDoc = {
  id: string
  name: string
  category?: unknown
  preparationTime?: unknown
}

type ReportStat = {
  productId: string
  productName: string
  preparationTime: number | null
  averagePreparationTime: number | null
  totalQuantity: number | null
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReportStat[]
}

type PreparationStatus = 'exceeded' | 'lower' | 'neutral'

type BillPreparationDetail = {
  billingId: string
  billNumber: string
  preparationTime: number | null
  chefPreparationTime: number | null
}

type BillItem = {
  id?: unknown
  product?: unknown
  name?: unknown
  quantity?: unknown
  preparingTime?: unknown
  orderedAt?: unknown
  preparedAt?: unknown
  unitPrice?: unknown
  gstRate?: unknown
  finalLineTotal?: unknown
  subtotal?: unknown
  status?: unknown
}

type BillingDoc = {
  id?: string
  invoiceNumber?: unknown
  kotNumber?: unknown
  company?: unknown
  createdAt?: unknown
  customerDetails?: {
    name?: unknown
    phoneNumber?: unknown
  } | null
  tableDetails?: {
    section?: unknown
    tableNumber?: unknown
  } | null
  paymentMethod?: unknown
  subTotal?: unknown
  cgstAmount?: unknown
  sgstAmount?: unknown
  roundOffAmount?: unknown
  totalAmount?: unknown
  createdBy?: unknown
  branch?: unknown
  items?: BillItem[] | null
}

type ApiListResponse<T> = {
  docs?: T[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

const byNameAsc = <T extends { name: string }>(a: T, b: T): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

const toLocalDateStr = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeRelationshipID = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (value && typeof value === 'object') {
    const record = value as { id?: unknown; _id?: unknown }
    if (typeof record.id === 'string' && record.id.trim().length > 0) return record.id
    if (typeof record.id === 'number' && Number.isFinite(record.id)) return String(record.id)
    if (typeof record._id === 'string' && record._id.trim().length > 0) return record._id
    if (typeof record._id === 'number' && Number.isFinite(record._id)) return String(record._id)
  }

  return ''
}

const relationshipToIDList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(normalizeRelationshipID).filter(Boolean)
  }

  const single = normalizeRelationshipID(value)
  return single ? [single] : []
}

const formatMinutes = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'

  const fixed = value.toFixed(2)
  const pretty = fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
  return `${pretty} min`
}

const formatCount = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  if (Number.isInteger(value)) return String(value)

  const fixed = value.toFixed(2)
  return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const getPreparationStatus = (
  actual: number | null | undefined,
  baseline: number | null | undefined,
): PreparationStatus => {
  if (actual == null || baseline == null) return 'neutral'
  if (!Number.isFinite(actual) || !Number.isFinite(baseline)) return 'neutral'
  if (actual > baseline) return 'exceeded'
  if (actual < baseline) return 'lower'
  return 'neutral'
}

const formatAmount = (value: unknown): string => {
  const parsed = toFiniteNumber(value)
  if (parsed == null) return '--'
  const fixed = parsed.toFixed(2)
  return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
}

const resolveLabel = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (isRecord(value)) {
    if (typeof value.name === 'string' && value.name.trim().length > 0) return value.name.trim()
    if (typeof value.email === 'string' && value.email.trim().length > 0) {
      return value.email.trim().split('@')[0]
    }
  }
  return '--'
}

const resolveCreatedByLabel = (value: unknown): string => {
  if (isRecord(value)) {
    if (typeof value.name === 'string' && value.name.trim().length > 0) return value.name.trim()
    if (isRecord(value.employee) && typeof value.employee.name === 'string' && value.employee.name.trim()) {
      return value.employee.name.trim()
    }
    if (typeof value.email === 'string' && value.email.trim()) return value.email.trim().split('@')[0]
  }

  return '--'
}

const asText = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

const readObjectTextByKeys = (value: unknown, keys: string[]): string => {
  if (!isRecord(value)) return ''

  for (const key of keys) {
    const text = asText(value[key])
    if (text) return text
  }

  return ''
}

const toBillSuffix = (value: string): string => {
  const text = value.trim()
  if (!text) return '--'

  const segments = text.split('-').map((part) => part.trim()).filter(Boolean)
  const last = segments.length > 0 ? segments[segments.length - 1] : text

  if (/^\d+$/.test(last)) return last.padStart(3, '0')
  return last
}

const formatThermalDateTime = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  let hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, '0')
  const meridiem = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12

  return `${year}-${month}-${day} ${hour}:${minute}${meridiem}`
}

const parseBillTimeValue = (value: unknown, fallbackDate: Date): Date | null => {
  if (value == null) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const explicit = new Date(trimmed)
  if (!Number.isNaN(explicit.getTime())) return explicit

  const timeOnly = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!timeOnly) return null

  const hour = Number.parseInt(timeOnly[1], 10)
  const minute = Number.parseInt(timeOnly[2], 10)
  const second = Number.parseInt(timeOnly[3] || '0', 10)

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null
  }

  const result = new Date(fallbackDate)
  result.setHours(hour, minute, second, 0)
  return result
}

const diffMinutesWithOvernight = (start: Date, end: Date): number => {
  let diffMs = end.getTime() - start.getTime()
  if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000
  return Math.max(0, diffMs / (60 * 1000))
}

const resolveItemActualPreparationMinutesForPreview = (
  item: BillItem,
  billCreatedAt: unknown,
): number | null => {
  const baseDate = (() => {
    if (typeof billCreatedAt === 'string' && billCreatedAt.trim()) {
      const parsed = new Date(billCreatedAt)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return new Date()
  })()

  const orderedAt = parseBillTimeValue(item.orderedAt, baseDate)
  const preparedAt = parseBillTimeValue(item.preparedAt, baseDate)
  if (orderedAt && preparedAt) return diffMinutesWithOvernight(orderedAt, preparedAt)

  return null
}

const getQuarterDates = (date: Date) => {
  const currentQuarter = Math.floor((date.getMonth() + 3) / 3)
  const previousQuarter = currentQuarter - 1
  let startMonth = 0
  let year = date.getFullYear()

  if (previousQuarter === 0) {
    startMonth = 9
    year -= 1
  } else {
    startMonth = (previousQuarter - 1) * 3
  }

  const endMonth = startMonth + 2
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, endMonth + 1, 0),
  }
}

const DateRangeInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
  ({ value, onClick }, ref) => {
    const [start, end] = value ? value.split(' - ') : ['', '']

    return (
      <button className="custom-date-input" onClick={onClick} ref={ref} type="button">
        <span className="date-text">{start || '--'}</span>
        <span className="separator">→</span>
        <span className="date-text">{end || start || '--'}</span>
        <span className="calendar-icon" aria-hidden="true">
          <svg
            width="18"
            height="18"
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
DateRangeInput.displayName = 'DateRangeInput'

const ProductTimeReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [rangeStartDate, rangeEndDate] = dateRange
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
  const [firstBillDate, setFirstBillDate] = useState<Date | null>(null)

  const [branches, setBranches] = useState<BranchDoc[]>([])
  const [kitchens, setKitchens] = useState<KitchenDoc[]>([])
  const [categories, setCategories] = useState<CategoryDoc[]>([])
  const [products, setProducts] = useState<ProductDoc[]>([])

  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedKitchen, setSelectedKitchen] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<string>('all')

  const [loading, setLoading] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [selectedProductRow, setSelectedProductRow] = useState<ReportStat | null>(null)
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
        const [branchRes, kitchenRes, categoryRes, productRes, billRes] = await Promise.all([
          fetch('/api/reports/branches'),
          fetch('/api/kitchens?limit=200&pagination=false&depth=1'),
          fetch('/api/categories?limit=1000&pagination=false&depth=0'),
          fetch('/api/products?limit=2000&pagination=false&depth=0'),
          fetch('/api/billings?sort=createdAt&limit=1'),
        ])

        if (!branchRes.ok || !kitchenRes.ok || !categoryRes.ok || !productRes.ok) {
          throw new Error('Failed to load filter metadata')
        }

        const branchJson = (await branchRes.json()) as ApiListResponse<BranchDoc>
        const kitchenJson = (await kitchenRes.json()) as ApiListResponse<KitchenDoc>
        const categoryJson = (await categoryRes.json()) as ApiListResponse<CategoryDoc>
        const productJson = (await productRes.json()) as ApiListResponse<ProductDoc>

        const branchDocs = Array.isArray(branchJson.docs) ? branchJson.docs : []
        const kitchenDocs = Array.isArray(kitchenJson.docs) ? kitchenJson.docs : []
        const categoryDocs = Array.isArray(categoryJson.docs) ? categoryJson.docs : []
        const productDocs = Array.isArray(productJson.docs) ? productJson.docs : []

        branchDocs.sort(byNameAsc)
        kitchenDocs.sort(byNameAsc)
        categoryDocs.sort(byNameAsc)
        productDocs.sort(byNameAsc)

        setBranches(branchDocs)
        setKitchens(kitchenDocs)
        setCategories(categoryDocs)
        setProducts(productDocs)

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
    const fetchReport = async () => {
      if (!rangeStartDate || !rangeEndDate) {
        setData(null)
        setSelectedProductRow(null)
        setBillDetails([])
        setSelectedBillRow(null)
        setSelectedBill(null)
        setSelectedBillError('')
        return
      }

      const startDate = toLocalDateStr(rangeStartDate)
      const endDate = toLocalDateStr(rangeEndDate)

      if (!selectedKitchen) {
        setData({ startDate, endDate, stats: [] })
        setSelectedProductRow(null)
        setBillDetails([])
        setSelectedBillRow(null)
        setSelectedBill(null)
        setSelectedBillError('')
        return
      }

      if (kitchenCategoryIDs.length === 0) {
        setData({ startDate, endDate, stats: [] })
        setSelectedProductRow(null)
        setBillDetails([])
        setSelectedBillRow(null)
        setSelectedBill(null)
        setSelectedBillError('')
        return
      }

      const categoryParam = selectedCategory === 'all' ? kitchenCategoryIDs.join(',') : selectedCategory
      const productParam = selectedProduct === 'all' ? 'all' : selectedProduct

      setLoading(true)
      setError('')
      try {
        const url = `/api/reports/product-wise?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&branch=${encodeURIComponent(selectedBranch)}&category=${encodeURIComponent(categoryParam)}&department=all&product=${encodeURIComponent(productParam)}`
        const res = await fetch(url)

        if (!res.ok) throw new Error('Failed to fetch product time report')

        const json = (await res.json()) as ReportData
        const stats: ReportStat[] = Array.isArray(json.stats)
          ? json.stats.map((row) => ({
              productId: row.productId,
              productName: row.productName,
              preparationTime: row.preparationTime,
              averagePreparationTime: row.averagePreparationTime,
              totalQuantity: row.totalQuantity,
            }))
          : []

        setData({
          startDate: json.startDate,
          endDate: json.endDate,
          stats,
        })

        setSelectedProductRow((previous) => {
          if (!stats.length) return null
          if (previous && stats.some((row) => row.productId === previous.productId)) return previous
          return stats[0]
        })
        if (stats.length === 0) {
          setBillDetails([])
          setSelectedBillRow(null)
          setSelectedBill(null)
          setSelectedBillError('')
        }
      } catch (reportError) {
        console.error(reportError)
        setError('Error loading product time report')
        setSelectedProductRow(null)
        setBillDetails([])
        setSelectedBillRow(null)
        setSelectedBill(null)
        setSelectedBillError('')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [
    rangeStartDate,
    rangeEndDate,
    selectedBranch,
    selectedKitchen,
    selectedCategory,
    selectedProduct,
    kitchenCategoryIDs,
  ])

  useEffect(() => {
    const fetchBillDetails = async () => {
      if (!selectedProductRow || !rangeStartDate || !rangeEndDate) {
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
      try {
        const url = `/api/reports/product-preparation-bill-details?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&branch=${encodeURIComponent(selectedBranch)}&category=${encodeURIComponent(categoryParam)}&department=all&productId=${encodeURIComponent(selectedProductRow.productId)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch bill details')

        const json = (await res.json()) as {
          details?: Array<{
            billingId?: unknown
            billNumber?: unknown
            preparationTime?: unknown
            chefPreparationTime?: unknown
          }>
        }

        const details = Array.isArray(json.details)
          ? json.details.map((entry) => ({
              billingId: typeof entry.billingId === 'string' ? entry.billingId.trim() : '',
              billNumber:
                typeof entry.billNumber === 'string' && entry.billNumber.trim().length > 0
                  ? entry.billNumber
                  : 'Unknown',
              preparationTime:
                typeof entry.preparationTime === 'number' && Number.isFinite(entry.preparationTime)
                  ? entry.preparationTime
                  : null,
              chefPreparationTime:
                typeof entry.chefPreparationTime === 'number' && Number.isFinite(entry.chefPreparationTime)
                  ? entry.chefPreparationTime
                  : null,
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
      }
    }

    fetchBillDetails()
  }, [
    selectedProductRow,
    rangeStartDate,
    rangeEndDate,
    selectedBranch,
    selectedCategory,
    kitchenCategoryIDs,
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
    if (!data) return

    const rows = [
      ['PRODUCT NAME', 'PREPARATION TIME', 'ORDER COUNT', 'AVG'].join(','),
      ...data.stats.map((row) =>
        [
          `"${row.productName.replace(/"/g, '""')}"`,
          formatMinutes(row.preparationTime),
          formatCount(row.totalQuantity),
          formatMinutes(row.averagePreparationTime),
        ].join(','),
      ),
    ]

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `product_time_report_${data.startDate}_to_${data.endDate}.csv`
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

        <button type="button" onClick={handleExportCSV} disabled={!data || loading || loadingMeta}>
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
      </div>

      {error && <p className="state error">{error}</p>}
      {(loading || loadingMeta) && <p className="state">Loading report...</p>}

      {!loading && !loadingMeta && data && data.stats.length === 0 && (
        <p className="state">No data found for selected filters.</p>
      )}

      {!loading && !loadingMeta && data && data.stats.length > 0 && (
        <div className="report-panels">
          <div className="pt-table-wrap main-table">
            <table className="pt-report-table">
              <thead>
                <tr>
                  <th>PRODUCT NAME</th>
                  <th>PREPARATION TIME</th>
                  <th>ORDER COUNT</th>
                  <th>AVG</th>
                </tr>
              </thead>
              <tbody>
                {data.stats.map((row, index) => {
                  const isSelected =
                    selectedProductRow != null && row.productId === selectedProductRow.productId
                  const configuredPreparationTime = toFiniteNumber(row.preparationTime)
                  const averagePreparationTime = toFiniteNumber(row.averagePreparationTime)
                  const preparationStatus = getPreparationStatus(
                    averagePreparationTime,
                    configuredPreparationTime,
                  )
                  const rowClassName = [
                    isSelected ? 'is-selected' : '',
                    preparationStatus === 'exceeded' ? 'prep-row-exceeded' : '',
                    preparationStatus === 'lower' ? 'prep-row-lower' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <tr
                      key={`${row.productId}-${index}`}
                      className={rowClassName}
                      onClick={() => setSelectedProductRow(row)}
                    >
                      <td>{row.productName}</td>
                      <td>{formatMinutes(row.preparationTime)}</td>
                      <td>{formatCount(row.totalQuantity)}</td>
                      <td>{formatMinutes(row.averagePreparationTime)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="right-panels">
            <div className="pt-table-wrap details-table-wrap">
              <table className="pt-report-table pt-details-table">
                <thead>
                  <tr>
                    <th>BILL NUMBER</th>
                    <th>PREPARED TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBillDetails && (
                    <tr>
                      <td colSpan={2}>Loading...</td>
                    </tr>
                  )}

                  {!loadingBillDetails && billDetailsError && (
                    <tr>
                      <td colSpan={2}>{billDetailsError}</td>
                    </tr>
                  )}

                  {!loadingBillDetails && !billDetailsError && billDetails.length === 0 && (
                    <tr>
                      <td colSpan={2}>No details found.</td>
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
                      const configuredPreparationTime =
                        selectedProductRow && typeof selectedProductRow.preparationTime === 'number'
                          ? selectedProductRow.preparationTime
                          : null
                      const billPreparedTime = toFiniteNumber(entry.preparationTime)
                      const preparationStatus = getPreparationStatus(
                        billPreparedTime,
                        configuredPreparationTime,
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
                          <td>
                            <span className="prep-time-with-chef">
                              <span>{formatMinutes(entry.preparationTime)}</span>
                              {entry.chefPreparationTime != null && (
                                <span className="chef-prep-time">({formatMinutes(entry.chefPreparationTime)})</span>
                              )}
                            </span>
                          </td>
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
                          (itemProductId ? productPreparationByID.get(itemProductId) : null) ??
                          (selectedProductRow &&
                          itemProductId &&
                          itemProductId === selectedProductRow.productId &&
                          typeof selectedProductRow.preparationTime === 'number'
                            ? selectedProductRow.preparationTime
                            : null)
                        const itemPreparingTime = toFiniteNumber(item.preparingTime)

                        const estimatedTotalPrepTime = itemPreparingTime
                        const actualTotalPrepTime = resolveItemActualPreparationMinutesForPreview(
                          item,
                          selectedBill?.createdAt,
                        )
                        const totalPrepTime = actualTotalPrepTime ?? estimatedTotalPrepTime
                        const prepPerUnit =
                          totalPrepTime != null && Number.isFinite(totalPrepTime) && quantity > 0
                            ? totalPrepTime / quantity
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
                          prepPerUnit > estimatedPrepPerUnit
                        const isPrepLower =
                          prepPerUnit != null &&
                          estimatedPrepPerUnit != null &&
                          prepPerUnit < estimatedPrepPerUnit
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
