'use client'

import React, { useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './index.scss'

import {
  KitchenDoc,
  BranchDoc,
  CategoryDoc,
  UserDoc,
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
  formatRailwayTime,
} from './utils'

import { DateRangeInput } from './components/DateRangeInput'

type TopListLimit = 10 | 25 | 50 | 100 | 'all'

type ProductPreparationBillDetailsQueryResponse = {
  data?: {
    productPreparationBillDetailsReport?: {
      availableChefs?: Array<{ id?: unknown; name?: unknown }>
      details?: Array<{
        amount?: unknown
        billNumber?: unknown
        billingId?: unknown
        chefName?: unknown
        confirmedByName?: unknown
        deliveredByName?: unknown
        confirmedAt?: unknown
        deliveredAt?: unknown
        waiterName?: unknown
        chefPreparationTime?: unknown
        orderedAt?: unknown
        preparedAt?: unknown
        preparationTime?: unknown
        productId?: unknown
        productName?: unknown
        productStandardPreparationTime?: unknown
        quantity?: unknown
        status?: unknown
        chefStatus?: unknown
        supervisorConfirmingTime?: unknown
        supervisorStandardTime?: unknown
        supervisorStatus?: unknown
        waiterDeliverTime?: unknown
        waiterStandardTime?: unknown
        waiterStatus?: unknown
      }>
    }
  }
  errors?: {
    message?: string
  }[]
}

const PRODUCT_PREPARATION_BILL_DETAILS_QUERY = `
  query ProductPreparationBillDetailsReport($filter: ProductPreparationBillDetailsReportFilterInput) {
    productPreparationBillDetailsReport(filter: $filter) {
      startDate
      endDate
      productId
      availableChefs {
        id
        name
      }
      details {
        billingId
        billNumber
        amount
        productId
        productName
        orderedAt
        preparedAt
        preparationTime
        chefPreparationTime
        productStandardPreparationTime
        chefName
        confirmedByName
        deliveredByName
        confirmedAt
        deliveredAt
        waiterName
        quantity
        status
        chefStatus
        supervisorConfirmingTime
        supervisorStandardTime
        supervisorStatus
        waiterDeliverTime
        waiterStandardTime
        waiterStatus
      }
    }
  }
`

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
  const [availableChefs, setAvailableChefs] = useState<UserDoc[]>([])

  const [stationType, setStationType] = useState<'kitchen' | 'counter'>('kitchen')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedKitchen, setSelectedKitchen] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<string>('all')
  const [selectedChef, setSelectedChef] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [velocityMode, setVelocityMode] = useState<
    'products' | 'categories' | 'chefs' | 'all_three'
  >('categories')
  const [topListLimit, setTopListLimit] = useState<TopListLimit>(50)

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

  const normalizeStatusFilter = (
    value: string,
  ):
    | 'all'
    | 'exceeded'
    | 'lower'
    | 'neutral'
    | 'chef_preparing_time'
    | 'supervisor_exceeded'
    | 'waiter_exceeded'
    | 'chef_exceeded' => {
    const normalized = value.trim().toLowerCase()

    if (normalized === 'all' || normalized === 'all status') return 'all'
    if (normalized === 'supervisor_exceeded' || normalized.includes('supervisor')) return 'supervisor_exceeded'
    if (normalized === 'waiter_exceeded' || normalized.includes('waiter')) return 'waiter_exceeded'
    if (normalized === 'chef_exceeded') return 'chef_exceeded'
    if (normalized === 'exceeded' || normalized.includes('exceed')) return 'exceeded'
    if (normalized === 'lower' || normalized.includes('lower') || normalized.includes('green')) return 'lower'
    if (normalized === 'neutral' || normalized.includes('neutral')) return 'neutral'
    if (
      normalized === 'chef_preparing_time' ||
      normalized.includes('chef') ||
      normalized.includes('preparing')
    ) {
      return 'chef_preparing_time'
    }

    return 'all'
  }

  useEffect(() => {
    const fetchMetadata = async () => {
      setLoadingMeta(true)
      setError('')

      try {
        const branchResPromise = fetch('/api/reports/branches')
        const filterMetaPromise = Promise.all([
          fetch('/api/kitchens?limit=200&pagination=false&depth=1'),
          fetch('/api/categories?limit=1000&pagination=false&depth=0'),
          fetch('/api/products?limit=2000&pagination=false&depth=0'),
          fetch('/api/users?where[role][equals]=chef&limit=1000&pagination=false&depth=0'),
          fetch('/api/billings?sort=createdAt&limit=1'),
        ])

        // Load branches first so the branch dropdown becomes usable as early as possible.
        try {
          const branchRes = await branchResPromise
          if (!branchRes.ok) throw new Error('Failed to load branches')

          const branchJson = (await branchRes.json()) as ApiListResponse<BranchDoc>
          const branchDocs = Array.isArray(branchJson.docs) ? branchJson.docs : []
          branchDocs.sort(byNameAsc)
          setBranches(branchDocs)
        } catch (branchError) {
          console.error(branchError)
          setError('Error loading branch filters')
        }

        const [kitchenRes, categoryRes, productRes, chefRes, billRes] = await filterMetaPromise
        if (!kitchenRes.ok || !categoryRes.ok || !productRes.ok || !chefRes.ok) {
          throw new Error('Failed to load filter metadata')
        }

        const kitchenJson = (await kitchenRes.json()) as ApiListResponse<KitchenDoc>
        const categoryJson = (await categoryRes.json()) as ApiListResponse<CategoryDoc>
        const productJson = (await productRes.json()) as ApiListResponse<ProductDoc>
        const chefJson = (await chefRes.json()) as ApiListResponse<UserDoc>

        const kitchenDocs = Array.isArray(kitchenJson.docs) ? kitchenJson.docs : []
        const categoryDocs = Array.isArray(categoryJson.docs) ? categoryJson.docs : []
        const productDocs = Array.isArray(productJson.docs) ? productJson.docs : []
        const chefDocs = Array.isArray(chefJson.docs) ? chefJson.docs : []

        kitchenDocs.sort(byNameAsc)
        categoryDocs.sort(byNameAsc)
        productDocs.sort(byNameAsc)
        chefDocs.sort(byNameAsc)

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
        setError((previous) => previous || 'Error loading kitchen/category/product filters')
      } finally {
        setLoadingMeta(false)
      }
    }

    fetchMetadata()
  }, [])

  const filteredKitchens = useMemo(() => {
    if (!selectedBranch) return []
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
      return '' // Don't auto-select first one to prevent loading data on branch change
    })
  }, [filteredKitchens])

  const kitchenCategoryIDs = useMemo(() => {
    if (!selectedKitchen) return []

    const kitchen = filteredKitchens.find((item) => item.id === selectedKitchen)
    if (!kitchen) return []

    return relationshipToIDList(kitchen.categories)
  }, [filteredKitchens, selectedKitchen])

  const isKitchenProduct = (product: ProductDoc) => {
    const prep = toFiniteNumber(product.preparationTime)
    return prep != null && prep > 0
  }

  const isCounterProduct = (product: ProductDoc) => {
    const prep = toFiniteNumber(product.preparationTime)
    return prep == null || prep <= 0
  }

  const filteredCategories = useMemo(() => {
    if (stationType === 'counter') {
      const counterCatIDs = new Set<string>()
      products.forEach((p) => {
        if (isCounterProduct(p)) {
          const cid = normalizeRelationshipID(p.category)
          if (cid) counterCatIDs.add(cid)
        }
      })
      const counterCats = categories.filter((category) => counterCatIDs.has(category.id))
      return counterCats.length > 0 ? counterCats : categories
    }

    if (kitchenCategoryIDs.length === 0) return []

    const kitchenCatSet = new Set(kitchenCategoryIDs)
    const kitchenProdCatIDs = new Set<string>()
    products.forEach((p) => {
      if (isKitchenProduct(p)) {
        const cid = normalizeRelationshipID(p.category)
        if (cid) kitchenProdCatIDs.add(cid)
      }
    })

    return categories.filter(
      (category) => kitchenCatSet.has(category.id) && kitchenProdCatIDs.has(category.id),
    )
  }, [categories, kitchenCategoryIDs, stationType, products])

  const filteredProducts = useMemo(() => {
    const isTargetStationProduct = stationType === 'counter' ? isCounterProduct : isKitchenProduct

    const categorySet = new Set(
      selectedCategory === 'all'
        ? filteredCategories.map((category) => category.id)
        : [selectedCategory],
    )

    return products.filter((product) => {
      if (!isTargetStationProduct(product)) return false
      const categoryID = normalizeRelationshipID(product.category)
      return categoryID.length > 0 && categorySet.has(categoryID)
    })
  }, [products, filteredCategories, selectedCategory, stationType])

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
    setSelectedChef('all')
  }, [stationType])

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
      const requiresKitchen = stationType === 'kitchen'
      if (!rangeStartDate || !rangeEndDate || !selectedBranch || (requiresKitchen && !selectedKitchen)) {
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
      const categoryParam =
        selectedCategory === 'all'
          ? (stationType === 'kitchen' ? kitchenCategoryIDs.join(',') : 'all')
          : selectedCategory
      const normalizedStatus = normalizeStatusFilter(selectedStatus)

      setLoadingBillDetails(true)
      setBillDetailsError('')
      setLoading(true)
      try {
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: PRODUCT_PREPARATION_BILL_DETAILS_QUERY,
            variables: {
              filter: {
                startDate,
                endDate,
                branch: selectedBranch,
                kitchenId: stationType === 'kitchen' ? selectedKitchen : undefined,
                category: categoryParam,
                department: 'all',
                productId: selectedProduct,
                chefId: stationType === 'kitchen' ? selectedChef : 'all',
                status: normalizedStatus,
                stationType,
              },
            },
          }),
        })
        if (!res.ok) throw new Error(`Failed to fetch bill details (HTTP ${res.status})`)

        const json = (await res.json()) as ProductPreparationBillDetailsQueryResponse
        if (Array.isArray(json.errors) && json.errors.length > 0) {
          throw new Error(json.errors[0]?.message || 'Failed to fetch bill details')
        }

        const report = json.data?.productPreparationBillDetailsReport
        if (!report) throw new Error('No report data returned from GraphQL')

        const details = Array.isArray(report.details)
          ? report.details.map((entry) => {
              const mapped = {
                amount: typeof entry.amount === 'number' && Number.isFinite(entry.amount) ? entry.amount : null,
                billingId: typeof entry.billingId === 'string' ? entry.billingId.trim() : '',
                billNumber:
                  typeof entry.billNumber === 'string' && entry.billNumber.trim().length > 0
                    ? entry.billNumber
                    : 'Unknown',
                productId: typeof entry.productId === 'string' ? entry.productId.trim() : '',
                productName: typeof entry.productName === 'string' ? entry.productName : '--',
                orderedAt: typeof entry.orderedAt === 'string' ? entry.orderedAt : '--',
                preparedAt: typeof entry.preparedAt === 'string' ? entry.preparedAt : '--',
                confirmedByName: typeof entry.confirmedByName === 'string' ? entry.confirmedByName : '--',
                deliveredByName: typeof entry.deliveredByName === 'string' ? entry.deliveredByName : '--',
                confirmedAt: typeof entry.confirmedAt === 'string' ? entry.confirmedAt : '--',
                deliveredAt: typeof entry.deliveredAt === 'string' ? entry.deliveredAt : '--',
                waiterName: typeof entry.waiterName === 'string' ? entry.waiterName : '--',
                preparationTime:
                  typeof entry.preparationTime === 'number' && Number.isFinite(entry.preparationTime)
                    ? entry.preparationTime
                    : null,
                chefPreparationTime:
                  typeof entry.chefPreparationTime === 'number' && Number.isFinite(entry.chefPreparationTime)
                    ? entry.chefPreparationTime
                    : null,
                productStandardPreparationTime:
                  typeof entry.productStandardPreparationTime === 'number' &&
                  Number.isFinite(entry.productStandardPreparationTime)
                    ? entry.productStandardPreparationTime
                    : null,
                chefName: typeof entry.chefName === 'string' ? entry.chefName : '--',
                quantity:
                  typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) && entry.quantity > 0
                    ? entry.quantity
                    : 1,
                chefStatus:
                  typeof entry.chefStatus === 'string' &&
                  ['exceeded', 'lower', 'neutral'].includes(entry.chefStatus.trim().toLowerCase())
                    ? (entry.chefStatus.trim().toLowerCase() as 'exceeded' | 'lower' | 'neutral')
                    : undefined,
                supervisorConfirmingTime:
                  typeof entry.supervisorConfirmingTime === 'number' && Number.isFinite(entry.supervisorConfirmingTime)
                    ? entry.supervisorConfirmingTime
                    : null,
                supervisorStandardTime:
                  typeof entry.supervisorStandardTime === 'number' && Number.isFinite(entry.supervisorStandardTime)
                    ? entry.supervisorStandardTime
                    : null,
                supervisorStatus:
                  typeof entry.supervisorStatus === 'string' &&
                  ['exceeded', 'lower', 'neutral'].includes(entry.supervisorStatus.trim().toLowerCase())
                    ? (entry.supervisorStatus.trim().toLowerCase() as 'exceeded' | 'lower' | 'neutral')
                    : undefined,
                waiterDeliverTime:
                  typeof entry.waiterDeliverTime === 'number' && Number.isFinite(entry.waiterDeliverTime)
                    ? entry.waiterDeliverTime
                    : null,
                waiterStandardTime:
                  typeof entry.waiterStandardTime === 'number' && Number.isFinite(entry.waiterStandardTime)
                    ? entry.waiterStandardTime
                    : null,
                waiterStatus:
                  typeof entry.waiterStatus === 'string' &&
                  ['exceeded', 'lower', 'neutral'].includes(entry.waiterStatus.trim().toLowerCase())
                    ? (entry.waiterStatus.trim().toLowerCase() as 'exceeded' | 'lower' | 'neutral')
                    : undefined,
              }
              const configuredPerUnit = toFiniteNumber(mapped.productStandardPreparationTime)
              const sharedKot =
                (toFiniteNumber(mapped.supervisorStandardTime) ?? 0) +
                (toFiniteNumber(mapped.waiterStandardTime) ?? 0)
              const chefPreparationTime =
                mapped.chefPreparationTime ??
                (configuredPerUnit != null && configuredPerUnit > 0
                  ? configuredPerUnit > sharedKot
                    ? Number((configuredPerUnit - sharedKot).toFixed(2))
                    : configuredPerUnit
                  : null)
              const chefTargetTime = chefPreparationTime ?? configuredPerUnit
              const billPreparedTime = toFiniteNumber(mapped.preparationTime)
              const chefStatus =
                billPreparedTime != null && chefTargetTime != null && chefTargetTime > 0
                  ? getPreparationStatus(billPreparedTime, chefTargetTime)
                  : mapped.chefStatus ?? 'neutral'

              const supervisorStatus =
                mapped.supervisorConfirmingTime != null &&
                mapped.supervisorStandardTime != null &&
                mapped.supervisorStandardTime > 0
                  ? getPreparationStatus(mapped.supervisorConfirmingTime, mapped.supervisorStandardTime)
                  : mapped.supervisorStatus ?? 'neutral'

              const waiterStatus =
                mapped.waiterDeliverTime != null &&
                mapped.waiterStandardTime != null &&
                mapped.waiterStandardTime > 0
                  ? getPreparationStatus(mapped.waiterDeliverTime, mapped.waiterStandardTime)
                  : mapped.waiterStatus ?? 'neutral'

              const overallStatus: 'exceeded' | 'lower' | 'neutral' =
                chefStatus === 'exceeded' ||
                supervisorStatus === 'exceeded' ||
                waiterStatus === 'exceeded'
                  ? 'exceeded'
                  : chefStatus === 'lower' ||
                      supervisorStatus === 'lower' ||
                      waiterStatus === 'lower'
                    ? 'lower'
                    : 'neutral'

              return {
                ...mapped,
                chefPreparationTime,
                status: overallStatus,
                chefStatus,
                supervisorStatus,
                waiterStatus,
              }
            })
          : []

        setBillDetails(details)
        setAvailableChefs(
          Array.isArray(report.availableChefs)
            ? report.availableChefs
                .filter((chef) => typeof chef?.id === 'string')
                .map((chef) => ({
                  id: typeof chef.id === 'string' ? chef.id : '',
                  name: typeof chef.name === 'string' ? chef.name : '--',
                }))
            : [],
        )
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
        setBillDetailsError(
          detailsError instanceof Error ? detailsError.message : 'Failed to load bill details',
        )
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
    selectedStatus,
    stationType,
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

    const isCounter = stationType === 'counter'
    const columns = isCounter
      ? [
          'SNO',
          'PRODUCT',
          'ORD AT',
          'CON AT',
          'CON BY',
          'SUPERVISOR TIME',
          'SUPERVISOR STATUS',
          'DEL AT',
          'DEL BY / WAITER',
          'DELIVERY TIME',
          'WAITER KOT TIME',
          'WAITER STATUS',
          'OVERALL STATUS',
        ]
      : [
          'SNO',
          'PRODUCT',
          'ORD AT',
          'STD PREP',
          'CHEF PREP',
          'PT (ACTUAL)',
          'PREP AT',
          'CHEF',
          'CHEF STATUS',
          'CON AT',
          'CON BY',
          'SUPERVISOR TIME',
          'SUPERVISOR STATUS',
          'DEL AT',
          'DEL BY',
          'WAITER DEL TIME',
          'WAITER STATUS',
          'OVERALL STATUS',
          'WAITER',
        ]

    const csvRows = [
      columns.join(','),
      ...billDetails.map((row, index) =>
        isCounter
          ? [
              String(index + 1),
              `"${row.productName.replace(/"/g, '""')}"`,
              `"${formatRailwayTime(row.orderedAt)}"`,
              `"${formatRailwayTime(row.confirmedAt)}"`,
              `"${row.confirmedByName.replace(/"/g, '""')}"`,
              formatMinutes(row.supervisorConfirmingTime).replace(' min', ''),
              `"${row.supervisorStatus || '--'}"`,
              `"${formatRailwayTime(row.deliveredAt)}"`,
              `"${(row.deliveredByName && row.deliveredByName !== '--' ? row.deliveredByName : row.waiterName).replace(/"/g, '""')}"`,
              formatMinutes(row.waiterDeliverTime).replace(' min', ''),
              formatMinutes(row.waiterStandardTime).replace(' min', ''),
              `"${row.waiterStatus || '--'}"`,
              `"${row.status}"`,
            ].join(',')
          : [
              String(index + 1),
              `"${row.productName.replace(/"/g, '""')}"`,
              `"${formatRailwayTime(row.orderedAt)}"`,
              formatMinutes(row.productStandardPreparationTime).replace(' min', ''),
              formatMinutes(row.chefPreparationTime).replace(' min', ''),
              formatMinutes(row.preparationTime).replace(' min', ''),
              `"${formatRailwayTime(row.preparedAt)}"`,
              `"${row.chefName.replace(/"/g, '""')}"`,
              `"${row.chefStatus || row.status}"`,
              `"${formatRailwayTime(row.confirmedAt)}"`,
              `"${row.confirmedByName.replace(/"/g, '""')}"`,
              formatMinutes(row.supervisorConfirmingTime).replace(' min', ''),
              `"${row.supervisorStatus || '--'}"`,
              `"${formatRailwayTime(row.deliveredAt)}"`,
              `"${row.deliveredByName.replace(/"/g, '""')}"`,
              formatMinutes(row.waiterDeliverTime).replace(' min', ''),
              `"${row.waiterStatus || '--'}"`,
              `"${row.status}"`,
              `"${row.waiterName.replace(/"/g, '""')}"`,
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

  const activeChefList = useMemo(() => {
    if (availableChefs.length > 0) return availableChefs
    return chefs
  }, [availableChefs, chefs])

  const hasRequiredFilters =
    stationType === 'counter'
      ? Boolean(rangeStartDate && rangeEndDate && selectedBranch)
      : Boolean(rangeStartDate && rangeEndDate && selectedBranch && selectedKitchen)

  const productToCategoryMap = useMemo(() => {
    const map = new Map<string, { categoryId: string; categoryName: string }>()
    products.forEach((product) => {
      const categoryId = normalizeRelationshipID(product.category)
      const category = categories.find((c) => c.id === categoryId)
      if (categoryId && category) {
        map.set(product.id, { categoryId, categoryName: category.name })
      }
    })
    return map
  }, [products, categories])

  const displayDetails = useMemo(() => {
    let filtered = billDetails

    // Status Filter
    const normalizedStatus = normalizeStatusFilter(selectedStatus)
    if (normalizedStatus !== 'all') {
      if (normalizedStatus === 'chef_preparing_time') {
        filtered = filtered.filter((entry) => entry.chefPreparationTime != null)
      } else if (normalizedStatus === 'supervisor_exceeded') {
        filtered = filtered.filter((entry) => entry.supervisorStatus === 'exceeded')
      } else if (normalizedStatus === 'waiter_exceeded') {
        filtered = filtered.filter((entry) => entry.waiterStatus === 'exceeded')
      } else if (normalizedStatus === 'chef_exceeded') {
        filtered = filtered.filter((entry) => entry.chefStatus === 'exceeded')
      } else {
        filtered = filtered.filter((entry) => entry.status === normalizedStatus)
      }
    }

    // Category Filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((entry) => {
        const catInfo = productToCategoryMap.get(entry.productId)
        return catInfo?.categoryId === selectedCategory
      })
    }

    // Product Filter
    if (selectedProduct !== 'all') {
      filtered = filtered.filter((entry) => entry.productId === selectedProduct)
    }

    // Chef Filter
    if (selectedChef !== 'all') {
      filtered = filtered.filter((entry) => {
        const name = String(entry.chefName || '').trim() || '--'
        return name === selectedChef
      })
    }

    // Station Type Filter (Kitchen = has preparation time, Counter = no preparation time)
    filtered = filtered.filter((entry) => {
      const prepTime = entry.productStandardPreparationTime
      const hasPrep = prepTime != null && Number(prepTime) > 0
      return stationType === 'kitchen' ? hasPrep : !hasPrep
    })

    return filtered
  }, [billDetails, selectedStatus, selectedCategory, selectedProduct, selectedChef, productToCategoryMap, stationType])

  const topCategoryRows = useMemo(() => {
    const categoryCountMap = new Map<
      string,
      { categoryId: string; name: string; orderCount: number; orderValue: number }
    >()

    displayDetails.forEach((entry) => {
      const catInfo = productToCategoryMap.get(entry.productId)
      if (catInfo) {
        const { categoryId, categoryName: name } = catInfo
        const rowAmount = toFiniteNumber(entry.amount) ?? 0
        const existing = categoryCountMap.get(categoryId)
        if (existing) {
          existing.orderCount += 1
          existing.orderValue += rowAmount
        } else {
          categoryCountMap.set(categoryId, {
            categoryId,
            name,
            orderCount: 1,
            orderValue: rowAmount,
          })
        }
      }
    })

    const sortedRows = Array.from(categoryCountMap.values()).sort((a, b) => b.orderCount - a.orderCount)

    if (topListLimit === 'all') return sortedRows
    return sortedRows.slice(0, topListLimit)
  }, [displayDetails, productToCategoryMap, topListLimit])

  const topProductRows = useMemo(() => {
    const productCountMap = new Map<
      string,
      { productId: string; name: string; orderCount: number; quantity: number; orderValue: number }
    >()

    displayDetails.forEach((entry) => {
      const name = entry.productName?.trim() || '--'
      const productId = entry.productId.trim()
      const productKey = productId || `name:${name.toLowerCase()}`
      const rowAmount = toFiniteNumber(entry.amount) ?? 0
      const rowQty =
        typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) ? entry.quantity : 1
      const existing = productCountMap.get(productKey)
      if (existing) {
        existing.orderCount += 1
        existing.quantity += rowQty
        existing.orderValue += rowAmount
      } else {
        productCountMap.set(productKey, {
          productId,
          name,
          orderCount: 1,
          quantity: rowQty,
          orderValue: rowAmount,
        })
      }
    })

    const sortedRows = Array.from(productCountMap.values()).sort((a, b) => {
      if (b.orderCount === a.orderCount) return a.name.localeCompare(b.name)
      return b.orderCount - a.orderCount
    })

    if (topListLimit === 'all') return sortedRows
    return sortedRows.slice(0, topListLimit)
  }, [displayDetails, topListLimit])

  const topChefRows = useMemo(() => {
    const chefValueMap = new Map<
      string,
      { chefName: string; orderValue: number; orderCount: number }
    >()

    displayDetails.forEach((entry) => {
      const name = String(entry.chefName || '').trim() || '--'
      const rowAmount = toFiniteNumber(entry.amount) ?? 0
      const existing = chefValueMap.get(name)
      if (existing) {
        existing.orderValue += rowAmount
        existing.orderCount += 1
      } else {
        chefValueMap.set(name, { chefName: name, orderValue: rowAmount, orderCount: 1 })
      }
    })

    const sortedRows = Array.from(chefValueMap.values()).sort((a, b) => b.orderValue - a.orderValue)

    if (topListLimit === 'all') return sortedRows
    return sortedRows.slice(0, topListLimit)
  }, [displayDetails, topListLimit])

  const topWaiterRows = useMemo(() => {
    const waiterValueMap = new Map<
      string,
      { waiterName: string; orderValue: number; orderCount: number }
    >()

    displayDetails.forEach((entry) => {
      const name = String(entry.deliveredByName && entry.deliveredByName !== '--' ? entry.deliveredByName : entry.waiterName || '').trim() || '--'
      const rowAmount = toFiniteNumber(entry.amount) ?? 0
      const existing = waiterValueMap.get(name)
      if (existing) {
        existing.orderValue += rowAmount
        existing.orderCount += 1
      } else {
        waiterValueMap.set(name, { waiterName: name, orderValue: rowAmount, orderCount: 1 })
      }
    })

    const sortedRows = Array.from(waiterValueMap.values()).sort((a, b) => b.orderValue - a.orderValue)

    if (topListLimit === 'all') return sortedRows
    return sortedRows.slice(0, topListLimit)
  }, [displayDetails, topListLimit])

  const hasAnyFilterSelection =
    stationType !== 'kitchen' ||
    selectedBranch !== '' ||
    selectedKitchen !== '' ||
    selectedCategory !== 'all' ||
    selectedProduct !== 'all' ||
    selectedChef !== 'all' ||
    selectedStatus !== 'all'

  const statusSummaryCards = useMemo(() => {
    const summary = {
      totalAmount: 0,
      totalCount: 0,
      exceededAmount: 0,
      exceededCount: 0,
      lowerAmount: 0,
      lowerCount: 0,
      neutralAmount: 0,
      neutralCount: 0,
      chefPrepGivenAmount: 0,
      chefPrepGivenCount: 0,
    }

    displayDetails.forEach((entry) => {
      const rowAmount = toFiniteNumber(entry.amount) ?? 0
      summary.totalAmount += rowAmount
      summary.totalCount += 1

      const isExceeded =
        entry.status === 'exceeded' ||
        entry.supervisorStatus === 'exceeded' ||
        entry.waiterStatus === 'exceeded' ||
        entry.chefStatus === 'exceeded'
      const isLower =
        !isExceeded &&
        (entry.status === 'lower' ||
          entry.supervisorStatus === 'lower' ||
          entry.waiterStatus === 'lower' ||
          entry.chefStatus === 'lower')

      if (isExceeded) {
        summary.exceededAmount += rowAmount
        summary.exceededCount += 1
      } else if (isLower) {
        summary.lowerAmount += rowAmount
        summary.lowerCount += 1
      } else {
        summary.neutralAmount += rowAmount
        summary.neutralCount += 1
      }
      if (entry.chefPreparationTime != null) {
        summary.chefPrepGivenAmount += rowAmount
        summary.chefPrepGivenCount += 1
      }
    })

    return [
      {
        key: 'total',
        label: 'Total Amount',
        amount: summary.totalAmount,
        count: summary.totalCount,
        tone: 'total',
      },
      {
        key: 'exceeded',
        label: 'Exceeded Amount',
        amount: summary.exceededAmount,
        count: summary.exceededCount,
        tone: 'exceeded',
      },
      {
        key: 'lower',
        label: 'Lower Amount',
        amount: summary.lowerAmount,
        count: summary.lowerCount,
        tone: 'lower',
      },
      {
        key: 'neutral',
        label: 'Neutral Amount',
        amount: summary.neutralAmount,
        count: summary.neutralCount,
        tone: 'neutral',
      },
      {
        key: 'chef-prep',
        label: 'Chef Prep Amount',
        amount: summary.chefPrepGivenAmount,
        count: summary.chefPrepGivenCount,
        tone: 'chef-prep',
      },
    ] as const
  }, [displayDetails])

  const formatSummaryAmount = (value: number): string => {
    const minFractionDigits = Number.isInteger(value) ? 0 : 2
    return `₹ ${value.toLocaleString('en-IN', {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: 2,
    })}`
  }

  const handleClearAllFilters = () => {
    setStationType('kitchen')
    setSelectedBranch('')
    setSelectedKitchen('')
    setSelectedCategory('all')
    setSelectedProduct('all')
    setSelectedChef('all')
    setSelectedStatus('all')
    setSelectedBillRow(null)
    setSelectedBill(null)
    setSelectedBillError('')
    setIsReceiptModalOpen(false)
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
          Station
          <select
            aria-label="Station filter"
            value={stationType}
            onChange={(e) => {
              const val = e.target.value as 'kitchen' | 'counter'
              setStationType(val)
              setSelectedCategory('all')
              setSelectedProduct('all')
              setSelectedChef('all')
            }}
          >
            <option value="kitchen">Kitchen</option>
            <option value="counter">Counter</option>
          </select>
        </label>

        <label>
          Branch
          <select
            aria-label="Branch filter"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="">Select Branch</option>
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
            aria-label="Kitchen filter"
            value={stationType === 'counter' ? '' : selectedKitchen}
            onChange={(e) => setSelectedKitchen(e.target.value)}
            disabled={stationType === 'counter' || loadingMeta || !selectedBranch || filteredKitchens.length === 0}
          >
            <option value="">
              {stationType === 'counter'
                ? 'Counter (No Kitchen)'
                : selectedBranch
                  ? 'Select Kitchen'
                  : 'Select Branch First'}
            </option>
            {stationType !== 'counter' &&
              filteredKitchens.map((kitchen) => (
                <option key={kitchen.id} value={kitchen.id}>
                  {kitchen.name}
                </option>
              ))}
          </select>
        </label>

        <label>
          Category
          <select
            aria-label="Category filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={loadingMeta || (stationType === 'kitchen' ? !selectedKitchen : !selectedBranch)}
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
            aria-label="Product filter"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            disabled={loadingMeta || (stationType === 'kitchen' ? !selectedKitchen : !selectedBranch)}
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
            aria-label="Chef filter"
            value={stationType === 'counter' ? 'all' : selectedChef}
            onChange={(e) => setSelectedChef(e.target.value)}
            disabled={stationType === 'counter' || loadingMeta}
          >
            <option value="all">
              {stationType === 'counter' ? 'Counter (No Chef)' : 'All Chefs'}
            </option>
            {stationType !== 'counter' &&
              activeChefList.map((chef) => (
                <option key={chef.id} value={chef.id}>
                  {chef.name}
                </option>
              ))}
          </select>
        </label>

        <label>
          Status
          <select
            aria-label="Status filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(normalizeStatusFilter(e.target.value))}
          >
            <option value="all">All Status</option>
            <option value="exceeded">Any Exceeded (Red)</option>
            <option value="supervisor_exceeded">Supervisor Exceeded (Red)</option>
            <option value="waiter_exceeded">Waiter Exceeded (Red)</option>
            <option value="chef_exceeded">Chef Exceeded (Red)</option>
            <option value="lower">Lower / On-Time (Green)</option>
            <option value="neutral">Neutral (Others)</option>
            <option value="chef_preparing_time">Preparing Time Given (Chef)</option>
          </select>
        </label>

        <button
          type="button"
          className="filters-clear-icon-btn"
          onClick={handleClearAllFilters}
          disabled={!hasAnyFilterSelection || loading || loadingMeta || loadingBillDetails}
          aria-label="Clear all filters"
          title="Clear all filters"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M4 6h16m-13 0l1 13h8l1-13m-8 0V4h4v2m-6 6l6 6m0-6l-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="pt-status-summary-row">
        {statusSummaryCards.map((card) => (
          <div key={card.key} className={`pt-status-summary-card tone-${card.tone}`}>
            <p className="pt-status-summary-title">{card.label}</p>
            <p className="pt-status-summary-value">{formatSummaryAmount(card.amount)}</p>
            <p className="pt-status-summary-count">order count: {formatCount(card.count)}</p>
          </div>
        ))}
      </div>

      {error && <p className="state error">{error}</p>}
      {hasRequiredFilters && (loading || loadingBillDetails) && <p className="state">Loading report...</p>}

      {hasRequiredFilters && !loading && !loadingMeta && !loadingBillDetails && billDetails.length === 0 && (
        <p className="state">No data found for selected filters.</p>
      )}

      {billDetails.length > 0 && (
        <div className="report-panels">
          <div className="pt-table-wrap details-table-wrap">
            <table className="pt-report-table pt-details-table">
                <thead>
                  {stationType === 'counter' ? (
                    <tr>
                      <th style={{ width: '50px' }}>SNO</th>
                      <th>PRODUCT</th>
                      <th style={{ width: '110px' }}>ORD AT</th>
                      <th style={{ width: '110px' }}>CON AT</th>
                      <th>CON BY</th>
                      <th style={{ width: '110px' }}>DEL AT</th>
                      <th>DEL BY / WAITER</th>
                      <th style={{ width: '140px' }}>DELIVERY TIME</th>
                      <th style={{ width: '120px' }}>STATUS</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={{ width: '50px' }}>SNO</th>
                      <th>PRODUCT</th>
                      <th style={{ width: '110px' }}>ORD AT</th>
                      <th>STD PREP</th>
                      <th>CHEF PREP</th>
                      <th>PREP AT</th>
                      <th>CON BY</th>
                      <th>DEL BY</th>
                      <th>WAITER</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {loadingBillDetails && (
                    <tr>
                      <td colSpan={9}>Loading...</td>
                    </tr>
                  )}

                  {!loadingBillDetails && billDetailsError && (
                    <tr>
                      <td colSpan={9}>{billDetailsError}</td>
                    </tr>
                  )}

                  {!loadingBillDetails && !billDetailsError && displayDetails.length === 0 && (
                    <tr>
                      <td colSpan={9}>No details found.</td>
                    </tr>
                  )}

                  {!loadingBillDetails &&
                    !billDetailsError &&
                    displayDetails.map((entry, index) => {
                      // billingId repeats for multiple items in the same bill; include index for a unique row key.
                      const key = `${entry.billingId || entry.billNumber}-${index}`
                      const isSelected =
                        selectedBillRow != null &&
                        entry.billingId.length > 0 &&
                        entry.billingId === selectedBillRow.billingId
                      const isAnyExceeded =
                        entry.status === 'exceeded' ||
                        entry.supervisorStatus === 'exceeded' ||
                        entry.waiterStatus === 'exceeded' ||
                        entry.chefStatus === 'exceeded'

                      const rowClassName = [
                        entry.billingId.length > 0 ? 'is-clickable' : 'is-disabled',
                        isSelected ? 'is-selected' : '',
                        isAnyExceeded ? 'row-has-exceeded' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')

                      const chefCellClass =
                        entry.chefStatus === 'exceeded'
                          ? 'cell-role-exceeded'
                          : entry.chefStatus === 'lower'
                            ? 'cell-role-lower'
                            : ''

                      const supervisorCellClass =
                        entry.supervisorStatus === 'exceeded'
                          ? 'cell-role-exceeded'
                          : entry.supervisorStatus === 'lower'
                            ? 'cell-role-lower'
                            : ''

                      const waiterCellClass =
                        entry.waiterStatus === 'exceeded'
                          ? 'cell-role-exceeded'
                          : entry.waiterStatus === 'lower'
                            ? 'cell-role-lower'
                            : ''

                      if (stationType === 'counter') {
                        const resolvedWaiter =
                          entry.deliveredByName && entry.deliveredByName !== '--'
                            ? entry.deliveredByName
                            : entry.waiterName || '--'

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
                            <td>{index + 1}</td>
                            <td><strong>{entry.productName}</strong></td>
                            <td>{formatRailwayTime(entry.orderedAt)}</td>
                            <td className={supervisorCellClass}>
                              {formatRailwayTime(entry.confirmedAt)}
                            </td>
                            <td className={supervisorCellClass}>
                              {entry.confirmedByName && entry.confirmedByName !== '--' ? entry.confirmedByName : '--'}
                            </td>
                            <td className={waiterCellClass}>
                              {formatRailwayTime(entry.deliveredAt)}
                            </td>
                            <td className={waiterCellClass}>
                              <strong>{resolvedWaiter}</strong>
                            </td>
                            <td className={waiterCellClass}>
                              <div>{formatMinutes(entry.waiterDeliverTime)}</div>
                              {entry.waiterStandardTime != null && (
                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                  KOT: {formatMinutes(entry.waiterStandardTime)}
                                </div>
                              )}
                            </td>
                            <td>
                              {entry.waiterStatus === 'exceeded' ? (
                                <span className="pt-status-pill tone-exceeded">Exceeded</span>
                              ) : entry.waiterStatus === 'lower' ? (
                                <span className="pt-status-pill tone-lower">On-Time</span>
                              ) : (
                                <span className="pt-status-pill tone-neutral">--</span>
                              )}
                            </td>
                          </tr>
                        )
                      }

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
                          <td>{index + 1}</td>
                          <td><strong>{entry.productName}</strong></td>
                          <td>{formatRailwayTime(entry.orderedAt)}</td>
                          <td>{formatMinutes(entry.productStandardPreparationTime).replace(' min', '')}</td>
                          <td>{formatMinutes(entry.chefPreparationTime).replace(' min', '')}</td>
                          <td
                            className={chefCellClass}
                            title={entry.preparedAt ? `Prepared at ${formatRailwayTime(entry.preparedAt)}` : undefined}
                          >
                            <div>{formatMinutes(entry.preparationTime)}</div>
                            {entry.chefName && entry.chefName !== '--' && (
                              <div className="pt-chef-subname">
                                {entry.chefName}
                              </div>
                            )}
                          </td>
                          <td
                            className={supervisorCellClass}
                            title={entry.confirmedAt ? `Confirmed at ${formatRailwayTime(entry.confirmedAt)}` : undefined}
                          >
                            <div>{formatMinutes(entry.supervisorConfirmingTime)}</div>
                            {entry.confirmedByName && entry.confirmedByName !== '--' && (
                              <div className="pt-chef-subname">
                                {entry.confirmedByName}
                              </div>
                            )}
                          </td>
                          <td
                            className={waiterCellClass}
                            title={entry.deliveredAt ? `Delivered at ${formatRailwayTime(entry.deliveredAt)}` : undefined}
                          >
                            <div>{formatMinutes(entry.waiterDeliverTime)}</div>
                            {entry.deliveredByName && entry.deliveredByName !== '--' && (
                              <div className="pt-chef-subname">
                                {entry.deliveredByName}
                              </div>
                            )}
                          </td>
                          <td>{entry.waiterName}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
          </div>

          <div className="pt-velocity-section">
            <div className="pt-velocity-section-header">
              <div className="velocity-toggle-buttons">
                <button
                  type="button"
                  className={velocityMode === 'categories' ? 'active' : ''}
                  onClick={() => setVelocityMode('categories')}
                >
                  Top Categories
                </button>
                <button
                  type="button"
                  className={velocityMode === 'products' ? 'active' : ''}
                  onClick={() => setVelocityMode('products')}
                >
                  Top Products
                </button>
                <button
                  type="button"
                  className={velocityMode === 'chefs' ? 'active' : ''}
                  onClick={() => setVelocityMode('chefs')}
                >
                  {stationType === 'counter' ? 'Top Waiters' : 'Top Chefs'}
                </button>
                <button
                  type="button"
                  className={velocityMode === 'all_three' ? 'active' : ''}
                  onClick={() => setVelocityMode('all_three')}
                >
                  All 3 Tables
                </button>
              </div>

              <div className="pt-velocity-options-row">
                <div className="pt-velocity-title-group">
                  <p className="pt-top-orders-kicker">Performance Velocity</p>
                  <h3>
                    {velocityMode === 'products'
                      ? 'Top Products'
                      : velocityMode === 'categories'
                        ? 'Top Categories'
                        : velocityMode === 'chefs'
                          ? (stationType === 'counter' ? 'Top Waiters' : 'Top Chefs')
                          : (stationType === 'counter'
                              ? 'Top Categories, Products & Waiters'
                              : 'Top Categories, Products & Chefs')}
                  </h3>
                </div>

                <label className="pt-top-orders-filter">
                  Top Limit
                  <select
                    value={String(topListLimit)}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setTopListLimit(nextValue === 'all' ? 'all' : (Number(nextValue) as TopListLimit))
                    }}
                  >
                    <option value="10">Top 10</option>
                    <option value="25">Top 25</option>
                    <option value="50">Top 50</option>
                    <option value="100">Top 100</option>
                    <option value="all">All</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="pt-velocity-content">
              {velocityMode === 'categories' && (
                <div className="pt-table-wrap pt-velocity-table-wrap">
                  <table className="pt-report-table pt-velocity-table">
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>#</th>
                        <th>CATEGORY NAME</th>
                        <th style={{ width: '160px' }}>ORDERS COUNT</th>
                        <th style={{ width: '180px' }}>TOTAL AMOUNT</th>
                        <th style={{ width: '180px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCategoryRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center' }}>No categories found.</td>
                        </tr>
                      ) : (
                        topCategoryRows.map((row, index) => {
                          const isFilterable = !!row.categoryId
                          const isActive = isFilterable && selectedCategory === row.categoryId
                          const nextCategoryFilter = isActive ? 'all' : row.categoryId

                          return (
                            <tr
                              key={`${row.categoryId || row.name}-${index}`}
                              className={[
                                isFilterable ? 'is-clickable' : '',
                                isActive ? 'is-selected' : '',
                              ].filter(Boolean).join(' ')}
                              onClick={() => {
                                if (!isFilterable) return
                                setSelectedCategory(nextCategoryFilter)
                                setSelectedProduct('all')
                              }}
                            >
                              <td>{String(index + 1).padStart(2, '0')}</td>
                              <td><strong>{row.name}</strong></td>
                              <td>{formatCount(row.orderCount)}</td>
                              <td>₹ {formatAmount(row.orderValue)}</td>
                              <td>
                                {isActive ? (
                                  <span className="pt-filter-active-pill">Active Filter (Click to Reset)</span>
                                ) : (
                                  <span className="pt-filter-btn">Filter by Category</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {velocityMode === 'products' && (
                <div className="pt-table-wrap pt-velocity-table-wrap">
                  <table className="pt-report-table pt-velocity-table">
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>#</th>
                        <th>PRODUCT NAME</th>
                        <th style={{ width: '140px' }}>TOTAL QTY</th>
                        <th style={{ width: '160px' }}>ORDERS COUNT</th>
                        <th style={{ width: '180px' }}>TOTAL AMOUNT</th>
                        <th style={{ width: '180px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProductRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center' }}>No products found.</td>
                        </tr>
                      ) : (
                        topProductRows.map((row, index) => {
                          const isFilterable = row.productId.length > 0
                          const isActive = isFilterable && selectedProduct === row.productId
                          const nextProductFilter = isActive ? 'all' : row.productId

                          return (
                            <tr
                              key={`${row.productId || row.name}-${index}`}
                              className={[
                                isFilterable ? 'is-clickable' : '',
                                isActive ? 'is-selected' : '',
                              ].filter(Boolean).join(' ')}
                              onClick={() => {
                                if (!isFilterable) return
                                setSelectedProduct(nextProductFilter)
                              }}
                            >
                              <td>{String(index + 1).padStart(2, '0')}</td>
                              <td><strong>{row.name}</strong></td>
                              <td>{row.quantity}</td>
                              <td>{formatCount(row.orderCount)}</td>
                              <td>₹ {formatAmount(row.orderValue)}</td>
                              <td>
                                {isActive ? (
                                  <span className="pt-filter-active-pill">Active Filter (Click to Reset)</span>
                                ) : (
                                  <span className="pt-filter-btn">Filter by Product</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {velocityMode === 'chefs' && (
                <div className="pt-table-wrap pt-velocity-table-wrap">
                  <table className="pt-report-table pt-velocity-table">
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>#</th>
                        <th>{stationType === 'counter' ? 'WAITER NAME' : 'CHEF NAME'}</th>
                        <th style={{ width: '160px' }}>ORDERS COUNT</th>
                        <th style={{ width: '180px' }}>TOTAL VALUE</th>
                        <th style={{ width: '180px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationType === 'counter' ? (
                        topWaiterRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center' }}>No waiters found.</td>
                          </tr>
                        ) : (
                          topWaiterRows.map((row, index) => (
                            <tr key={`${row.waiterName}-${index}`}>
                              <td>{String(index + 1).padStart(2, '0')}</td>
                              <td><strong>{row.waiterName}</strong></td>
                              <td>{formatCount(row.orderCount)}</td>
                              <td>₹ {formatAmount(row.orderValue)}</td>
                              <td>
                                <span className="pt-filter-active-pill" style={{ opacity: 0.75 }}>
                                  Waiter Metric
                                </span>
                              </td>
                            </tr>
                          ))
                        )
                      ) : topChefRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center' }}>No chefs found.</td>
                        </tr>
                      ) : (
                        topChefRows.map((row, index) => {
                          const isFilterable = true
                          const isActive = selectedChef === row.chefName
                          const nextChefFilter = isActive ? 'all' : row.chefName

                          return (
                            <tr
                              key={`${row.chefName}-${index}`}
                              className={[
                                isFilterable ? 'is-clickable' : '',
                                isActive ? 'is-selected' : '',
                              ].filter(Boolean).join(' ')}
                              onClick={() => {
                                if (!isFilterable) return
                                setSelectedChef(nextChefFilter)
                              }}
                            >
                              <td>{String(index + 1).padStart(2, '0')}</td>
                              <td><strong>{row.chefName}</strong></td>
                              <td>{formatCount(row.orderCount)}</td>
                              <td>₹ {formatAmount(row.orderValue)}</td>
                              <td>
                                {isActive ? (
                                  <span className="pt-filter-active-pill">Active Filter (Click to Reset)</span>
                                ) : (
                                  <span className="pt-filter-btn">Filter by Chef</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {velocityMode === 'all_three' && (
                <div className="pt-velocity-grid-three">
                  {/* Column 1: Categories */}
                  <div className="pt-velocity-grid-col">
                    <h4>Top Categories</h4>
                    <table className="pt-report-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th>Category</th>
                          <th style={{ width: '70px' }}>Orders</th>
                          <th style={{ width: '90px' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topCategoryRows.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center' }}>None</td></tr>
                        ) : (
                          topCategoryRows.map((row, index) => {
                            const isFilterable = !!row.categoryId
                            const isActive = isFilterable && selectedCategory === row.categoryId
                            return (
                              <tr
                                key={`all-cat-${index}`}
                                className={[isFilterable ? 'is-clickable' : '', isActive ? 'is-selected' : ''].filter(Boolean).join(' ')}
                                onClick={() => {
                                  if (!isFilterable) return
                                  setSelectedCategory(isActive ? 'all' : row.categoryId)
                                  setSelectedProduct('all')
                                }}
                              >
                                <td>{index + 1}</td>
                                <td><strong>{row.name}</strong></td>
                                <td>{row.orderCount}</td>
                                <td>₹ {formatAmount(row.orderValue)}</td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Column 2: Products */}
                  <div className="pt-velocity-grid-col">
                    <h4>Top Products</h4>
                    <table className="pt-report-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th>Product</th>
                          <th style={{ width: '70px' }}>Orders</th>
                          <th style={{ width: '90px' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProductRows.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center' }}>None</td></tr>
                        ) : (
                          topProductRows.map((row, index) => {
                            const isFilterable = row.productId.length > 0
                            const isActive = isFilterable && selectedProduct === row.productId
                            return (
                              <tr
                                key={`all-prod-${index}`}
                                className={[isFilterable ? 'is-clickable' : '', isActive ? 'is-selected' : ''].filter(Boolean).join(' ')}
                                onClick={() => {
                                  if (!isFilterable) return
                                  setSelectedProduct(isActive ? 'all' : row.productId)
                                }}
                              >
                                <td>{index + 1}</td>
                                <td><strong>{row.name}</strong></td>
                                <td>{row.orderCount}</td>
                                <td>₹ {formatAmount(row.orderValue)}</td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Column 3: Chefs / Waiters */}
                  <div className="pt-velocity-grid-col">
                    <h4>{stationType === 'counter' ? 'Top Waiters' : 'Top Chefs'}</h4>
                    <table className="pt-report-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th>{stationType === 'counter' ? 'Waiter' : 'Chef'}</th>
                          <th style={{ width: '70px' }}>Orders</th>
                          <th style={{ width: '90px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stationType === 'counter' ? (
                          topWaiterRows.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center' }}>None</td></tr>
                          ) : (
                            topWaiterRows.map((row, index) => (
                              <tr key={`all-waiter-${index}`}>
                                <td>{index + 1}</td>
                                <td><strong>{row.waiterName}</strong></td>
                                <td>{row.orderCount}</td>
                                <td>₹ {formatAmount(row.orderValue)}</td>
                              </tr>
                            ))
                          )
                        ) : topChefRows.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center' }}>None</td></tr>
                        ) : (
                          topChefRows.map((row, index) => {
                            const isFilterable = true
                            const isActive = selectedChef === row.chefName
                            return (
                              <tr
                                key={`all-chef-${index}`}
                                className={[isFilterable ? 'is-clickable' : '', isActive ? 'is-selected' : ''].filter(Boolean).join(' ')}
                                onClick={() => {
                                  if (!isFilterable) return
                                  setSelectedChef(isActive ? 'all' : row.chefName)
                                }}
                              >
                                <td>{index + 1}</td>
                                <td><strong>{row.chefName}</strong></td>
                                <td>{row.orderCount}</td>
                                <td>₹ {formatAmount(row.orderValue)}</td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isReceiptModalOpen && (
        <div className="thermal-modal-backdrop" onClick={() => setIsReceiptModalOpen(false)}>
          <div className="thermal-modal" onClick={(event) => event.stopPropagation()}>
            <div className="pt-table-wrap thermal-preview-wrap">
              <button
                type="button"
                className="thermal-modal-close"
                onClick={() => setIsReceiptModalOpen(false)}
              >
                Close
              </button>

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
