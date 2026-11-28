'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  StageKey,
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
  parseBillTimeValue,
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
        billStatus?: unknown
        kotNumber?: unknown
        tableNumber?: unknown
        section?: unknown
        itemStatus?: unknown
        itemId?: unknown
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
        billStatus
        kotNumber
        tableNumber
        section
        itemStatus
        itemId
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

const StageTimeCell: React.FC<{
  startTimeStr?: string | null
  standardMinutes?: number | null
  isFinished: boolean
  finishedMinutes?: number | null
  subName?: string | null
  tooltipTime?: string | null
  roleStatus?: 'exceeded' | 'lower' | 'neutral'
  isActiveStage: boolean
  fallbackStandardMinutes?: number
}> = ({
  startTimeStr,
  standardMinutes,
  isFinished,
  finishedMinutes,
  subName,
  tooltipTime,
  roleStatus,
  isActiveStage,
  fallbackStandardMinutes = 2,
}) => {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!isActiveStage || isFinished) return

    const intervalId = setInterval(() => {
      setTick((t) => (t + 1) % 1000000)
    }, 1000)

    return () => clearInterval(intervalId)
  }, [isActiveStage, isFinished])

  if (isFinished) {
    const cellClass =
      roleStatus === 'exceeded'
        ? 'cell-role-exceeded'
        : roleStatus === 'lower'
          ? 'cell-role-lower'
          : ''
    return (
      <td className={cellClass} title={tooltipTime || undefined}>
        <div>{formatMinutes(finishedMinutes)}</div>
        {subName && subName !== '--' && <div className="pt-chef-subname">{subName}</div>}
      </td>
    )
  }

  if (isActiveStage && startTimeStr) {
    const startDate = parseBillTimeValue(startTimeStr, new Date())
    if (startDate) {
      let diffMs = Date.now() - startDate.getTime()
      if (diffMs < -60000) {
        diffMs += 24 * 60 * 60 * 1000
      } else if (diffMs < 0) {
        diffMs = 0
      }

      const elapsedSec = Math.max(0, Math.floor(diffMs / 1000))
      const targetMins =
        standardMinutes != null && standardMinutes > 0 ? standardMinutes : fallbackStandardMinutes
      const targetSec = Math.round(targetMins * 60)
      const remainingSec = targetSec - elapsedSec

      // If time crossed 0: stop countdown at 00:00 (do not count into minus) and show ORANGE while staff has not updated
      const isZeroReached = remainingSec <= 0

      let formatted = '00:00'
      if (!isZeroReached) {
        const m = Math.floor(remainingSec / 60)
        const s = remainingSec % 60
        formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      }

      const cellClass = isZeroReached
        ? 'cell-role-yellow pt-running-cell'
        : 'cell-role-running pt-running-cell'

      return (
        <td
          className={cellClass}
          title={
            isZeroReached
              ? `Time reached 00:00 (Standard: ${targetMins} min) — Pending staff update`
              : `Standard: ${targetMins} min | Remaining: ${formatted}`
          }
        >
          <div className={`pt-countdown-badge ${isZeroReached ? 'is-yellow' : 'is-running'}`}>
            <span className="pt-countdown-dot" />
            <span className="pt-countdown-val">{formatted}</span>
          </div>
          {subName && subName !== '--' && <div className="pt-chef-subname">{subName}</div>}
        </td>
      )
    }
  }

  return (
    <td>
      <div>--</div>
      {subName && subName !== '--' && <div className="pt-chef-subname">{subName}</div>}
    </td>
  )
}

const LiveElapsedTimer: React.FC<{
  orderedAt?: string | null
  isFinished: boolean
  fallbackMinutes?: number | null
}> = ({ orderedAt, isFinished, fallbackMinutes }) => {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (isFinished || !orderedAt || orderedAt === '--') return
    const id = setInterval(() => {
      setTick((t) => (t + 1) % 1000000)
    }, 1000)
    return () => clearInterval(id)
  }, [isFinished, orderedAt])

  let formatted = '00:00'
  if (isFinished && fallbackMinutes != null && Number.isFinite(fallbackMinutes)) {
    const totalSec = Math.max(0, Math.round(fallbackMinutes * 60))
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  } else if (orderedAt && orderedAt !== '--') {
    const startDate = parseBillTimeValue(orderedAt, new Date())
    if (startDate) {
      let diffMs = Date.now() - startDate.getTime()
      if (diffMs < -60000) diffMs += 24 * 60 * 60 * 1000
      else if (diffMs < 0) diffMs = 0
      const totalSec = Math.max(0, Math.floor(diffMs / 1000))
      const h = Math.floor(totalSec / 3600)
      const m = Math.floor((totalSec % 3600) / 60)
      const s = totalSec % 60
      formatted =
        h > 0
          ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
  }

  return (
    <span className="pt-kot-timer-pill" title={isFinished ? 'Completed time' : 'Elapsed time since ordered'}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>{formatted}</span>
    </span>
  )
}

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
  const [isLive, setIsLive] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'combine'>('list')
  const [cardStageFilters, setCardStageFilters] = useState<Record<string, StageKey | null>>({})
  const [selectedTableFilterKey, setSelectedTableFilterKey] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null)
  const [selectedCardItems, setSelectedCardItems] = useState<Record<string, string[]>>({})
  const [updatingCardKey, setUpdatingCardKey] = useState<string | null>(null)
  const [activeStageFilter, setActiveStageFilter] = useState<StageKey | null>(null)
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

  useEffect(() => {
    let active = true
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/users/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          user?: { id?: string; _id?: string; name?: string; email?: string; role?: string }
        }
        const u = data?.user
        const id = u?.id || u?._id || ''
        if (active && id) {
          setCurrentUser({
            id: String(id),
            name: String(u?.name || u?.email || 'Admin'),
            role: String(u?.role || ''),
          })
        }
      } catch {
        // ignore auth lookup errors
      }
    }
    fetchCurrentUser()
    return () => {
      active = false
    }
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
      return filteredKitchens[0]?.id || ''
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

  const isFetchingDetailsRef = useRef(false)

  const fetchBillDetails = useCallback(
    async (isBackground = false) => {
      const requiresKitchen = stationType === 'kitchen'
      if (!rangeStartDate || !rangeEndDate || !selectedBranch || (requiresKitchen && !selectedKitchen)) {
        if (!isBackground) {
          setBillDetails([])
          setBillDetailsError('')
          setSelectedBillRow(null)
          setSelectedBill(null)
          setSelectedBillError('')
          setIsReceiptModalOpen(false)
        }
        return
      }

      if (isBackground && isFetchingDetailsRef.current) {
        return
      }
      isFetchingDetailsRef.current = true

      const startDate = toLocalDateStr(rangeStartDate)
      const endDate = toLocalDateStr(rangeEndDate)
      const categoryParam =
        selectedCategory === 'all'
          ? (stationType === 'kitchen' ? kitchenCategoryIDs.join(',') : 'all')
          : selectedCategory
      const normalizedStatus = normalizeStatusFilter(selectedStatus)

      if (!isBackground) {
        setLoadingBillDetails(true)
        setBillDetailsError('')
        setLoading(true)
      }

      try {
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
          cache: 'no-store',
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
                isLive,
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
                billStatus: typeof entry.billStatus === 'string' ? entry.billStatus : '',
                kotNumber: typeof entry.kotNumber === 'string' ? entry.kotNumber : '',
                tableNumber: typeof entry.tableNumber === 'string' ? entry.tableNumber : '',
                section: typeof entry.section === 'string' ? entry.section : '',
                itemStatus: typeof entry.itemStatus === 'string' ? entry.itemStatus : '',
                itemId: typeof entry.itemId === 'string' ? entry.itemId : '',
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
          if (previous && previous.billingId.length > 0) {
            const found =
              details.find(
                (entry) =>
                  entry.billingId === previous.billingId &&
                  (!previous.productId || entry.productId === previous.productId),
              ) || details.find((entry) => entry.billingId === previous.billingId)

            if (found) {
              if (
                previous.status === found.status &&
                previous.chefStatus === found.chefStatus &&
                previous.supervisorStatus === found.supervisorStatus &&
                previous.waiterStatus === found.waiterStatus &&
                previous.preparedAt === found.preparedAt &&
                previous.confirmedAt === found.confirmedAt &&
                previous.deliveredAt === found.deliveredAt
              ) {
                return previous
              }
              return found
            }
          }
          return details[0]
        })
        if (details.length === 0 && !isBackground) {
          setSelectedBill(null)
          setSelectedBillError('')
          setIsReceiptModalOpen(false)
        }
      } catch (detailsError) {
        console.error(detailsError)
        if (!isBackground) {
          setBillDetails([])
          setBillDetailsError(
            detailsError instanceof Error ? detailsError.message : 'Failed to load bill details',
          )
          setSelectedBillRow(null)
          setSelectedBill(null)
          setSelectedBillError('')
          setIsReceiptModalOpen(false)
        }
      } finally {
        isFetchingDetailsRef.current = false
        if (!isBackground) {
          setLoadingBillDetails(false)
          setLoading(false)
        }
      }
    },
    [
      stationType,
      rangeStartDate,
      rangeEndDate,
      selectedBranch,
      selectedKitchen,
      selectedCategory,
      kitchenCategoryIDs,
      selectedChef,
      selectedStatus,
      selectedProduct,
      isLive,
    ],
  )

  useEffect(() => {
    let isMounted = true

    fetchBillDetails(false)

    if (isLive) {
      const intervalId = setInterval(() => {
        if (isMounted) {
          fetchBillDetails(true)
        }
      }, 5000)

      return () => {
        isMounted = false
        clearInterval(intervalId)
      }
    }

    return () => {
      isMounted = false
    }
  }, [fetchBillDetails, isLive])

  useEffect(() => {
    let isCancelled = false
    const fetchSelectedBill = async () => {
      if (!selectedBillRow || !selectedBillRow.billingId) {
        setSelectedBill(null)
        setSelectedBillError('')
        return
      }

      const isSameBill =
        selectedBill != null &&
        (selectedBill.id === selectedBillRow.billingId ||
          (selectedBill as unknown as { _id?: string })._id === selectedBillRow.billingId)

      if (!isSameBill) {
        setLoadingSelectedBill(true)
        setSelectedBillError('')
      }

      try {
        const res = await fetch(`/api/billings/${encodeURIComponent(selectedBillRow.billingId)}?depth=2`)
        if (!res.ok) throw new Error('Failed to fetch bill preview')

        const raw = (await res.json()) as unknown
        const billPayload: unknown = isRecord(raw) && isRecord(raw.doc) ? raw.doc : raw
        if (!isRecord(billPayload)) throw new Error('Invalid bill response')

        if (!isCancelled) {
          setSelectedBill(billPayload as BillingDoc)
        }
      } catch (billError) {
        console.error(billError)
        if (!isCancelled && !isSameBill) {
          setSelectedBill(null)
          setSelectedBillError('Failed to load bill preview')
        }
      } finally {
        if (!isCancelled && !isSameBill) {
          setLoadingSelectedBill(false)
        }
      }
    }

    fetchSelectedBill()
    return () => {
      isCancelled = true
    }
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
    if (displayDetails.length === 0 || !rangeStartDate || !rangeEndDate) return

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
      ...displayDetails.map((row, index) =>
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

    // Live Filter: only show ongoing KOT bills products (exclude completed and settlement status)
    if (isLive) {
      filtered = filtered.filter((entry) => {
        const s = String(entry.billStatus || '').toLowerCase()
        return s !== 'completed' && s !== 'settled' && s !== 'settlement'
      })
    }

    return filtered
  }, [billDetails, selectedStatus, selectedCategory, selectedProduct, selectedChef, productToCategoryMap, stationType, isLive])

  const isTimestampPresent = (time: string | null | undefined): boolean => {
    if (!time) return false
    const t = time.trim()
    return t.length > 0 && t !== '--'
  }

  const getItemStage = (item: BillPreparationDetail, station: 'kitchen' | 'counter'): StageKey | 'completed' => {
    const s = String(item.billStatus || '').toLowerCase()
    if (s === 'completed' || s === 'settled' || s === 'settlement' || s === 'cancelled') {
      return 'completed'
    }
    if (isTimestampPresent(item.deliveredAt)) {
      return 'completed'
    }

    if (station !== 'counter') {
      if (!isTimestampPresent(item.preparedAt)) {
        return 'chef'
      }
      if (!isTimestampPresent(item.confirmedAt)) {
        return 'supervisor'
      }
      return 'waiter'
    } else {
      if (!isTimestampPresent(item.confirmedAt)) {
        return 'supervisor'
      }
      return 'waiter'
    }
  }

  const activeStagesData = useMemo(() => {
    let chefTotal = 0
    let supervisorTotal = 0
    let waiterTotal = 0

    const chefPersons: Record<string, number> = {}
    const supervisorPersons: Record<string, number> = {}
    const waiterPersons: Record<string, number> = {}

    displayDetails.forEach((item) => {
      const stage = getItemStage(item, stationType)
      const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1

      if (stage === 'chef') {
        chefTotal += qty
        const name = item.chefName && item.chefName !== '--' ? item.chefName : 'Chef (Unassigned)'
        chefPersons[name] = (chefPersons[name] || 0) + qty
      } else if (stage === 'supervisor') {
        supervisorTotal += qty
        const name = item.confirmedByName && item.confirmedByName !== '--' ? item.confirmedByName : 'Pending Confirmation'
        supervisorPersons[name] = (supervisorPersons[name] || 0) + qty
      } else if (stage === 'waiter') {
        waiterTotal += qty
        const name =
          item.waiterName && item.waiterName !== '--'
            ? item.waiterName
            : item.deliveredByName && item.deliveredByName !== '--'
              ? item.deliveredByName
              : 'Pending Delivery'
        waiterPersons[name] = (waiterPersons[name] || 0) + qty
      }
    })

    const formatPersons = (map: Record<string, number>) => {
      return Object.entries(map)
        .map(([name, count]) => `${name} (${count})`)
        .join(', ')
    }

    return {
      chef: {
        count: chefTotal,
        peopleSummary: formatPersons(chefPersons),
      },
      supervisor: {
        count: supervisorTotal,
        peopleSummary: formatPersons(supervisorPersons),
      },
      waiter: {
        count: waiterTotal,
        peopleSummary: formatPersons(waiterPersons),
      },
      hasAny: chefTotal > 0 || supervisorTotal > 0 || waiterTotal > 0,
    }
  }, [displayDetails, stationType])

  const activeStageItems = useMemo(() => {
    const list: { key: StageKey; role: string; count: number; className: string; title: string }[] = []
    if (activeStagesData.chef.count > 0) {
      list.push({
        key: 'chef',
        role: 'Chef',
        count: activeStagesData.chef.count,
        className: 'stage-chef',
        title: `Chef Pending: ${activeStagesData.chef.count} products to prepare. Click to filter.`,
      })
    }
    if (activeStagesData.supervisor.count > 0) {
      list.push({
        key: 'supervisor',
        role: 'Supervisor',
        count: activeStagesData.supervisor.count,
        className: 'stage-supervisor',
        title: `Supervisor Pending: ${activeStagesData.supervisor.count} products to confirm. Click to filter.`,
      })
    }
    if (activeStagesData.waiter.count > 0) {
      list.push({
        key: 'waiter',
        role: 'Waiter',
        count: activeStagesData.waiter.count,
        className: 'stage-waiter',
        title: `Waiter Pending: ${activeStagesData.waiter.count} products to deliver. Click to filter.`,
      })
    }
    return list
  }, [activeStagesData])

  useEffect(() => {
    if (activeStageFilter === 'chef' && activeStagesData.chef.count === 0) {
      setActiveStageFilter(null)
    } else if (activeStageFilter === 'supervisor' && activeStagesData.supervisor.count === 0) {
      setActiveStageFilter(null)
    } else if (activeStageFilter === 'waiter' && activeStagesData.waiter.count === 0) {
      setActiveStageFilter(null)
    }
  }, [activeStageFilter, activeStagesData])

  const tablePriorityButtons = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        label: string
        kotShort: string
        isShared: boolean
        orderedAt: string
        startMs: number
        isFinished: boolean
        maxElapsedMins: number | null
        hasExceeded: boolean
      }
    >()

    displayDetails.forEach((entry, idx) => {
      const key = entry.billingId || entry.billNumber || `row-${idx}`
      const rawTable = (entry.tableNumber || '').trim()
      const rawSection = (entry.section || '').trim()
      const isShared = /-s-/i.test(rawTable) || rawSection.toLowerCase() === 'shared tables'
      const cleanTable = isShared
        ? rawTable.replace(/-s-.*$/i, '').replace(/-[a-z0-9]+$/i, '').trim() || rawTable
        : rawTable
      const cleanSection = rawSection.toLowerCase() === 'shared tables' ? '' : rawSection
      const label = cleanTable
        ? `Table ${cleanSection ? `${cleanSection} ${cleanTable}` : cleanTable}`
        : rawSection || (stationType === 'counter' ? 'Counter' : `#${entry.billNumber}`)

      const rawKot = (entry.kotNumber || '').trim()
      const kotMatch = rawKot.match(/kot[\s\-_]*(\d+)$/i)
      const kotShort = kotMatch ? `KOT ${kotMatch[1]}` : /^\d+$/.test(rawKot) ? `KOT ${rawKot}` : ''

      const parsedStart =
        entry.orderedAt && entry.orderedAt !== '--'
          ? parseBillTimeValue(entry.orderedAt, new Date())
          : null
      const startMs = parsedStart ? parsedStart.getTime() : Number.MAX_SAFE_INTEGER

      const billDone = ['completed', 'settled', 'settlement', 'cancelled'].includes(
        String(entry.billStatus || '').toLowerCase(),
      )
      const itemDone =
        billDone ||
        isTimestampPresent(entry.deliveredAt) ||
        entry.waiterDeliverTime != null ||
        String(entry.itemStatus || '').toLowerCase() === 'delivered'
      const itemElapsed =
        entry.waiterDeliverTime ??
        entry.supervisorConfirmingTime ??
        entry.preparationTime ??
        null
      const itemExceeded =
        entry.status === 'exceeded' ||
        entry.chefStatus === 'exceeded' ||
        entry.supervisorStatus === 'exceeded' ||
        entry.waiterStatus === 'exceeded'

      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          key,
          label,
          kotShort,
          isShared,
          orderedAt: entry.orderedAt,
          startMs,
          isFinished: itemDone,
          maxElapsedMins: itemElapsed,
          hasExceeded: itemExceeded,
        })
      } else {
        if (startMs < existing.startMs) {
          existing.startMs = startMs
          existing.orderedAt = entry.orderedAt
        }
        if (!itemDone) existing.isFinished = false
        if (itemExceeded) existing.hasExceeded = true
        if (itemElapsed != null) {
          existing.maxElapsedMins =
            existing.maxElapsedMins == null ? itemElapsed : Math.max(existing.maxElapsedMins, itemElapsed)
        }
      }
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1
      if (a.hasExceeded !== b.hasExceeded) return a.hasExceeded ? -1 : 1
      return a.startMs - b.startMs
    })
  }, [displayDetails, stationType])

  useEffect(() => {
    if (
      selectedTableFilterKey &&
      !tablePriorityButtons.some((btn) => btn.key === selectedTableFilterKey)
    ) {
      setSelectedTableFilterKey(null)
    }
  }, [selectedTableFilterKey, tablePriorityButtons])

  const tableRows = useMemo(() => {
    let rows = displayDetails
    if (activeStageFilter) {
      rows = rows.filter((item) => getItemStage(item, stationType) === activeStageFilter)
    }
    if (selectedTableFilterKey) {
      rows = rows.filter((item, idx) => (item.billingId || item.billNumber || `row-${idx}`) === selectedTableFilterKey)
    }
    return rows
  }, [displayDetails, activeStageFilter, stationType, selectedTableFilterKey])

  const tableWiseGroups = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        key: string
        billingId: string
        billNumber: string
        kotNumber: string
        tableNumber: string
        section: string
        orderedAt: string
        waiterName: string
        billStatus: string
        items: BillPreparationDetail[]
        primaryEntry: BillPreparationDetail
      }
    >()

    tableRows.forEach((entry, idx) => {
      const groupKey = entry.billingId || entry.billNumber || `row-${idx}`
      const existing = groupsMap.get(groupKey)
      if (!existing) {
        const resolvedWaiter =
          entry.waiterName && entry.waiterName !== '--'
            ? entry.waiterName
            : entry.deliveredByName && entry.deliveredByName !== '--'
              ? entry.deliveredByName
              : ''
        groupsMap.set(groupKey, {
          key: groupKey,
          billingId: entry.billingId,
          billNumber: entry.billNumber,
          kotNumber: entry.kotNumber || '',
          tableNumber: entry.tableNumber || '',
          section: entry.section || '',
          orderedAt: entry.orderedAt,
          waiterName: resolvedWaiter,
          billStatus: entry.billStatus || '',
          items: [entry],
          primaryEntry: entry,
        })
      } else {
        existing.items.push(entry)
        if (entry.orderedAt && entry.orderedAt !== '--') {
          const existingDate = parseBillTimeValue(existing.orderedAt, new Date())
          const entryDate = parseBillTimeValue(entry.orderedAt, new Date())
          if (!existingDate || (entryDate && entryDate.getTime() < existingDate.getTime())) {
            existing.orderedAt = entry.orderedAt
          }
        }
        if (!existing.kotNumber && entry.kotNumber) existing.kotNumber = entry.kotNumber
        if (!existing.tableNumber && entry.tableNumber) existing.tableNumber = entry.tableNumber
        if (!existing.section && entry.section) existing.section = entry.section
        if (!existing.waiterName) {
          const w =
            entry.waiterName && entry.waiterName !== '--'
              ? entry.waiterName
              : entry.deliveredByName && entry.deliveredByName !== '--'
                ? entry.deliveredByName
                : ''
          if (w) existing.waiterName = w
        }
      }
    })

    return Array.from(groupsMap.values())
  }, [tableRows])

  const productWiseGroups = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        key: string
        productId: string
        productName: string
        totalQuantity: number
        billIds: Set<string>
        items: BillPreparationDetail[]
      }
    >()

    tableRows.forEach((entry, idx) => {
      const groupKey = entry.productId || entry.productName || `prod-${idx}`
      const qty = typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1
      const billKey = entry.billingId || entry.billNumber || `bill-${idx}`
      const existing = groupsMap.get(groupKey)
      if (!existing) {
        const billIds = new Set<string>()
        billIds.add(billKey)
        groupsMap.set(groupKey, {
          key: groupKey,
          productId: entry.productId,
          productName: entry.productName || '--',
          totalQuantity: qty,
          billIds,
          items: [entry],
        })
      } else {
        existing.totalQuantity += qty
        existing.billIds.add(billKey)
        existing.items.push(entry)
      }
    })

    return Array.from(groupsMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity)
  }, [tableRows])

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
    isLive ||
    activeStageFilter !== null ||
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

  const handleToggleLive = () => {
    setIsLive((prev) => {
      const next = !prev
      if (next) {
        const now = new Date()
        const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        setDateRange([currentDay, currentDay])
        setDateRangePreset('today')
      }
      return next
    })
  }

  const toggleCardItemSelection = (cardKey: string, itemKey: string) => {
    setSelectedCardItems((prev) => {
      const current = prev[cardKey] || []
      const exists = current.includes(itemKey)
      const next = exists ? current.filter((k) => k !== itemKey) : [...current, itemKey]
      return {
        ...prev,
        [cardKey]: next,
      }
    })
  }

  const handleUpdateSelectedCardItems = async (
    billingId: string,
    cardKey: string,
    entriesToUpdate: BillPreparationDetail[],
  ) => {
    if (!billingId || entriesToUpdate.length === 0 || updatingCardKey) return
    setUpdatingCardKey(cardKey)
    try {
      const getRes = await fetch(`/api/billings/${encodeURIComponent(billingId)}?depth=0`, {
        cache: 'no-store',
      })
      if (!getRes.ok) {
        throw new Error(`Failed to load bill (HTTP ${getRes.status})`)
      }
      const billDoc = (await getRes.json()) as { items?: Array<Record<string, unknown>> }
      const existingItems = Array.isArray(billDoc?.items) ? billDoc.items : []
      const nowIso = new Date().toISOString()

      const matchedEntries = [...entriesToUpdate]
      const updatedItems = existingItems.map((rawItem) => {
        const rawItemId = String(rawItem._id || rawItem.id || '')
        const rawProductId =
          typeof rawItem.product === 'object' && rawItem.product !== null
            ? String((rawItem.product as { id?: unknown; _id?: unknown }).id || (rawItem.product as { _id?: unknown })._id || '')
            : String(rawItem.product || '')

        let matchIdx = -1
        if (rawItemId) {
          matchIdx = matchedEntries.findIndex((e) => e.itemId && e.itemId === rawItemId)
        }
        if (matchIdx === -1) {
          matchIdx = matchedEntries.findIndex((e) => !e.itemId && e.productId === rawProductId)
        }
        if (matchIdx === -1) return rawItem

        const [matchedEntry] = matchedEntries.splice(matchIdx, 1)
        const currentStage = getItemStage(matchedEntry, stationType)
        if (currentStage === 'completed') return rawItem

        const nextStatus =
          currentStage === 'chef'
            ? 'prepared'
            : currentStage === 'supervisor'
              ? 'confirmed'
              : 'delivered'

        const patchFields: Record<string, unknown> = {
          ...rawItem,
          status: nextStatus,
        }

        if (nextStatus === 'prepared') {
          patchFields.preparedAt = nowIso
          if (currentUser?.id) patchFields.preparedBy = currentUser.id
        } else if (nextStatus === 'confirmed') {
          patchFields.confirmedAt = nowIso
          if (currentUser?.id) patchFields.confirmedBy = currentUser.id
        } else if (nextStatus === 'delivered') {
          patchFields.deliveredAt = nowIso
          if (currentUser?.id) patchFields.deliveredBy = currentUser.id
        }

        return patchFields
      })

      const patchRes = await fetch(`/api/billings/${encodeURIComponent(billingId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: updatedItems,
          ...(currentUser?.id ? { actorUserId: currentUser.id } : {}),
        }),
      })
      if (!patchRes.ok) {
        throw new Error(`Failed to update bill items (HTTP ${patchRes.status})`)
      }

      setSelectedCardItems((prev) => {
        const next = { ...prev }
        delete next[cardKey]
        return next
      })
      await fetchBillDetails(true)
    } catch (err) {
      setBillDetailsError(err instanceof Error ? err.message : 'Failed to update items')
    } finally {
      setUpdatingCardKey(null)
    }
  }

  const handleClearAllFilters = () => {
    setIsLive(false)
    setActiveStageFilter(null)
    setSelectedTableFilterKey(null)
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

        <div className="header-controls">
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

          <label className="chef-filter">
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

          <label className="category-filter">
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

          <label className="product-filter">
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

          <button
            type="button"
            className="export-icon-btn"
            onClick={handleExportCSV}
            disabled={displayDetails.length === 0 || loading || loadingMeta}
            title="Export CSV"
            aria-label="Export CSV"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          <button
            type="button"
            className="reset-icon-btn"
            onClick={handleClearAllFilters}
            disabled={!hasAnyFilterSelection || loading || loadingMeta || loadingBillDetails}
            title="Reset All Filters"
            aria-label="Reset All Filters"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="pt-filter-and-stages-row">
        <div className="filters-wrap">
          <button
            type="button"
            className={`live-btn ${isLive ? 'active' : ''}`}
            onClick={handleToggleLive}
            aria-pressed={isLive}
            title={
              isLive
                ? 'Live Mode Active: Auto-updating orders and counts in real-time. Click to stop.'
                : 'Click to start real-time live mode (auto-refreshes orders and counts).'
            }
          >
            <span className="live-dot" />
            Live
          </button>

          <label className="station-filter">
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

          <label className="kitchen-filter">
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

          <div className="pt-view-toggle-wrap">
            <span className="pt-view-toggle-label">View</span>
            <div className="pt-view-toggle" role="group" aria-label="Layout view mode">
              <button
                type="button"
                className={`pt-view-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                title="List View (Table)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span>List</span>
              </button>
              <button
                type="button"
                className={`pt-view-toggle-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                title="Grid View (Table-Wise Cards)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`pt-view-toggle-btn ${viewMode === 'combine' ? 'is-active' : ''}`}
                onClick={() => setViewMode('combine')}
                aria-pressed={viewMode === 'combine'}
                title="Combine View (Product-Wise Cards)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                <span>Combine</span>
              </button>
            </div>
          </div>
        </div>

        {activeStageItems.length > 0 && (
          <div className="pt-active-stages-row">
            <div className="pt-active-stages-buttons">
              {activeStageItems.map((item, index) => (
                <React.Fragment key={item.key}>
                  {index > 0 && <span className="pt-stage-connector-line" aria-hidden="true" />}
                  <button
                    type="button"
                    className={`pt-stage-box-btn ${item.className} ${activeStageFilter === item.key ? 'is-active' : ''}`}
                    onClick={() => setActiveStageFilter((prev) => (prev === item.key ? null : item.key))}
                    title={item.title}
                  >
                    <span className="pt-stage-role-top">{item.role}</span>
                    <div className="pt-stage-square-box">
                      <span className="pt-stage-count-big">{item.count}</span>
                    </div>
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {tablePriorityButtons.length > 0 && (
        <div className="pt-table-priority-bar" role="group" aria-label="Filter by table priority">
          <button
            type="button"
            className={`pt-table-priority-btn ${selectedTableFilterKey === null ? 'is-active' : ''}`}
            onClick={() => setSelectedTableFilterKey(null)}
            aria-pressed={selectedTableFilterKey === null}
          >
            <span>All Tables</span>
            <span className="pt-table-priority-count">{tablePriorityButtons.length}</span>
          </button>
          {tablePriorityButtons.map((btn) => {
            const isSelected = selectedTableFilterKey === btn.key
            return (
              <button
                key={btn.key}
                type="button"
                className={`pt-table-priority-btn ${isSelected ? 'is-active' : ''} ${btn.hasExceeded ? 'is-exceeded' : ''} ${btn.isFinished ? 'is-done' : ''}`}
                onClick={() =>
                  setSelectedTableFilterKey((prev) => (prev === btn.key ? null : btn.key))
                }
                aria-pressed={isSelected}
                title={`${btn.label}${btn.kotShort ? ` (${btn.kotShort})` : ''}`}
              >
                <span className="pt-table-priority-name">
                  {btn.label}
                  {btn.isShared && btn.kotShort ? ` (${btn.kotShort})` : ''}
                </span>
                <LiveElapsedTimer
                  orderedAt={btn.orderedAt}
                  isFinished={btn.isFinished}
                  fallbackMinutes={btn.maxElapsedMins}
                />
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="state error">{error}</p>}
      {hasRequiredFilters && (loading || loadingBillDetails) && <p className="state">Loading report...</p>}

      {hasRequiredFilters && !loading && !loadingMeta && !loadingBillDetails && billDetails.length === 0 && (
        <p className="state">No data found for selected filters.</p>
      )}

      {billDetails.length > 0 && (
        <div className="report-panels">
          {viewMode === 'list' ? (
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

                  {!loadingBillDetails && !billDetailsError && tableRows.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        {activeStageFilter ? `No products currently in ${activeStageFilter} stage.` : 'No details found.'}
                      </td>
                    </tr>
                  )}

                  {!loadingBillDetails &&
                    !billDetailsError &&
                    tableRows.map((entry, index) => {
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

                      const isDelivered =
                        isTimestampPresent(entry.deliveredAt) || entry.waiterDeliverTime != null
                      const isConfirmed =
                        isTimestampPresent(entry.confirmedAt) || entry.supervisorConfirmingTime != null
                      const isPrepared =
                        isTimestampPresent(entry.preparedAt) || entry.preparationTime != null

                      const isBillDone =
                        String(entry.billStatus || '').toLowerCase() === 'completed' ||
                        String(entry.billStatus || '').toLowerCase() === 'settled' ||
                        String(entry.billStatus || '').toLowerCase() === 'settlement' ||
                        String(entry.billStatus || '').toLowerCase() === 'cancelled'

                      // Stage 1: Chef (runs countdown from orderedAt until prepared)
                      const isChefFinished = isPrepared || isConfirmed || isDelivered || isBillDone
                      const isChefActive =
                        !isChefFinished &&
                        isTimestampPresent(entry.orderedAt) &&
                        stationType === 'kitchen'

                      // Stage 2: Supervisor (runs countdown from preparedAt until confirmed)
                      const isSupervisorFinished = isConfirmed || isDelivered || isBillDone
                      const isSupervisorActive =
                        !isSupervisorFinished &&
                        (stationType === 'counter'
                          ? isTimestampPresent(entry.orderedAt)
                          : isPrepared)

                      // Stage 3: Waiter (runs countdown from confirmedAt until delivered)
                      const isWaiterFinished = isDelivered || isBillDone
                      const isWaiterActive = !isWaiterFinished && isConfirmed

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
                            <StageTimeCell
                              startTimeStr={entry.confirmedAt || entry.orderedAt}
                              standardMinutes={entry.waiterStandardTime}
                              isFinished={isWaiterFinished}
                              finishedMinutes={entry.waiterDeliverTime}
                              subName={resolvedWaiter !== '--' ? resolvedWaiter : undefined}
                              tooltipTime={entry.deliveredAt ? `Delivered at ${formatRailwayTime(entry.deliveredAt)}` : undefined}
                              roleStatus={entry.waiterStatus}
                              isActiveStage={isWaiterActive}
                              fallbackStandardMinutes={3}
                            />
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
                          <StageTimeCell
                            startTimeStr={entry.orderedAt}
                            standardMinutes={entry.chefPreparationTime ?? entry.productStandardPreparationTime}
                            isFinished={isChefFinished}
                            finishedMinutes={entry.preparationTime}
                            subName={entry.chefName}
                            tooltipTime={entry.preparedAt ? `Prepared at ${formatRailwayTime(entry.preparedAt)}` : undefined}
                            roleStatus={entry.chefStatus}
                            isActiveStage={isChefActive}
                            fallbackStandardMinutes={5}
                          />
                          <StageTimeCell
                            startTimeStr={entry.preparedAt || entry.orderedAt}
                            standardMinutes={entry.supervisorStandardTime}
                            isFinished={isSupervisorFinished}
                            finishedMinutes={entry.supervisorConfirmingTime}
                            subName={entry.confirmedByName}
                            tooltipTime={entry.confirmedAt ? `Confirmed at ${formatRailwayTime(entry.confirmedAt)}` : undefined}
                            roleStatus={entry.supervisorStatus}
                            isActiveStage={isSupervisorActive}
                            fallbackStandardMinutes={2}
                          />
                          <StageTimeCell
                            startTimeStr={entry.confirmedAt}
                            standardMinutes={entry.waiterStandardTime}
                            isFinished={isWaiterFinished}
                            finishedMinutes={entry.waiterDeliverTime}
                            subName={entry.deliveredByName}
                            tooltipTime={entry.deliveredAt ? `Delivered at ${formatRailwayTime(entry.deliveredAt)}` : undefined}
                            roleStatus={entry.waiterStatus}
                            isActiveStage={isWaiterActive}
                            fallbackStandardMinutes={3}
                          />
                          <td>{entry.waiterName}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
          </div>
          ) : viewMode === 'grid' ? (
            <div className="pt-kot-grid-wrap">
              {loadingBillDetails && <p className="state">Loading...</p>}
              {!loadingBillDetails && billDetailsError && <p className="state error">{billDetailsError}</p>}
              {!loadingBillDetails && !billDetailsError && tableWiseGroups.length === 0 && (
                <p className="state">
                  {activeStageFilter ? `No products currently in ${activeStageFilter} stage.` : 'No details found.'}
                </p>
              )}
              {!loadingBillDetails && !billDetailsError && tableWiseGroups.length > 0 && (
                <div className="pt-kot-grid">
                  {tableWiseGroups.map((group) => {
                    const hasAnyExceeded = group.items.some(
                      (item) =>
                        item.status === 'exceeded' ||
                        item.chefStatus === 'exceeded' ||
                        item.supervisorStatus === 'exceeded' ||
                        item.waiterStatus === 'exceeded',
                    )
                    const billDone = ['completed', 'settled', 'settlement', 'cancelled'].includes(
                      String(group.billStatus || '').toLowerCase(),
                    )
                    const allItemsDelivered =
                      billDone ||
                      group.items.every(
                        (item) =>
                          isTimestampPresent(item.deliveredAt) ||
                          item.waiterDeliverTime != null ||
                          String(item.itemStatus || '').toLowerCase() === 'delivered',
                      )
                    const allItemsPrepared =
                      allItemsDelivered ||
                      group.items.every(
                        (item) =>
                          isTimestampPresent(item.preparedAt) ||
                          isTimestampPresent(item.confirmedAt) ||
                          item.preparationTime != null,
                      )

                    const cardToneClass = hasAnyExceeded ? 'tone-exceeded' : 'tone-ontime'
                    const displayBillNumber = group.billNumber.startsWith('#')
                      ? group.billNumber
                      : `#${group.billNumber}`
                    const shortKotLabel = (() => {
                      const raw = (group.kotNumber || '').trim()
                      if (!raw) return ''
                      const kotMatch = raw.match(/kot[\s\-_]*(\d+)$/i)
                      if (kotMatch) return `KOT ${kotMatch[1]}`
                      if (/^\d+$/.test(raw)) return `KOT ${raw}`
                      return raw.toUpperCase().startsWith('KOT') ? raw : `KOT ${raw}`
                    })()
                    const isSharedTable =
                      /-s-/i.test(group.tableNumber) ||
                      group.section.trim().toLowerCase() === 'shared tables'
                    const cleanTableNumber = isSharedTable
                      ? group.tableNumber
                          .replace(/-s-.*$/i, '')
                          .replace(/-[a-z0-9]+$/i, '')
                          .trim() || group.tableNumber.trim()
                      : group.tableNumber.trim()
                    const cleanSection =
                      group.section.trim().toLowerCase() === 'shared tables'
                        ? ''
                        : group.section.trim()
                    const orderTypeLabel =
                      group.tableNumber || group.section
                        ? 'Dine In'
                        : stationType === 'counter'
                          ? 'Counter'
                          : 'Takeaway'
                    const tableDisplay = cleanTableNumber
                      ? `Table ${cleanSection ? `${cleanSection} ${cleanTableNumber}` : cleanTableNumber}`
                      : group.section.trim()
                    const servingLabel = allItemsDelivered
                      ? 'Serving: Delivered'
                      : allItemsPrepared
                        ? 'Serving: Ready'
                        : 'Serving: Pending'

                    const maxElapsedMins = group.items.reduce<number | null>((acc, item) => {
                      const val =
                        item.waiterDeliverTime ??
                        item.supervisorConfirmingTime ??
                        item.preparationTime ??
                        null
                      if (val == null) return acc
                      return acc == null ? val : Math.max(acc, val)
                    }, null)

                    const activeCardRole = cardStageFilters[group.key] || null
                    const roleCounts: Record<StageKey, number> = {
                      chef: 0,
                      supervisor: 0,
                      waiter: 0,
                    }
                    group.items.forEach((item) => {
                      const st = getItemStage(item, stationType)
                      if (st === 'chef' || st === 'supervisor' || st === 'waiter') {
                        roleCounts[st] += 1
                      }
                    })
                    const visibleCardItems = activeCardRole
                      ? group.items.filter((item) => getItemStage(item, stationType) === activeCardRole)
                      : group.items
                    const cardRoleOptions: { key: StageKey; label: string }[] =
                      stationType === 'counter'
                        ? [
                            { key: 'supervisor', label: 'SUPERVISOR' },
                            {
                              key: 'waiter',
                              label: group.waiterName
                                ? `WAITER - ${group.waiterName.toUpperCase()}`
                                : 'WAITER',
                            },
                          ]
                        : [
                            { key: 'chef', label: 'CHEF' },
                            { key: 'supervisor', label: 'SUPERVISOR' },
                            {
                              key: 'waiter',
                              label: group.waiterName
                                ? `WAITER - ${group.waiterName.toUpperCase()}`
                                : 'WAITER',
                            },
                          ]

                    const primaryTitle = shortKotLabel
                      ? `${tableDisplay || orderTypeLabel} - ${shortKotLabel}`
                      : tableDisplay || displayBillNumber

                    return (
                      <div key={group.key} className={`pt-kot-card ${cardToneClass}`}>
                        <div className="pt-kot-card-header">
                          <div className="pt-kot-card-top-row">
                            <div className="pt-kot-card-title-group">
                              <span className="pt-kot-bill-num" title={displayBillNumber}>
                                {primaryTitle}
                              </span>
                              {isSharedTable && (
                                <span className="pt-kot-shared-pill">Shared Table</span>
                              )}
                              <span className="pt-kot-header-dining">
                                <span className={`pt-kot-order-type ${group.tableNumber || group.section ? 'is-dinein' : ''}`}>
                                  {orderTypeLabel}
                                </span>
                                <span className="pt-kot-meta-dot">·</span>
                                <span className="pt-kot-meta-time">{formatRailwayTime(group.orderedAt)}</span>
                              </span>
                            </div>
                            <LiveElapsedTimer
                              orderedAt={group.orderedAt}
                              isFinished={allItemsDelivered}
                              fallbackMinutes={maxElapsedMins}
                            />
                          </div>

                          <div className="pt-kot-card-status-row">
                            <div className="pt-kot-role-filter-group" role="group" aria-label="Filter items by role">
                              {cardRoleOptions.map((roleOpt) => {
                                const isActiveRole = activeCardRole === roleOpt.key
                                const count = roleCounts[roleOpt.key]
                                return (
                                  <button
                                    key={roleOpt.key}
                                    type="button"
                                    className={`pt-kot-role-filter-btn role-${roleOpt.key} ${isActiveRole ? 'is-active' : ''}`}
                                    onClick={() =>
                                      setCardStageFilters((prev) => ({
                                        ...prev,
                                        [group.key]: prev[group.key] === roleOpt.key ? null : roleOpt.key,
                                      }))
                                    }
                                    aria-pressed={isActiveRole}
                                  >
                                    <span>{roleOpt.label}</span>
                                    {count > 0 && <span className="pt-kot-role-count">{count}</span>}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="pt-kot-card-items">
                          {visibleCardItems.length === 0 ? (
                            <p className="pt-kot-empty-stage">
                              No items in {activeCardRole} stage.
                            </p>
                          ) : (
                            visibleCardItems.map((item, itemIdx) => {
                            const itemStage = getItemStage(item, stationType)
                            const itemDone = itemStage === 'completed'
                            const itemReady = itemStage === 'supervisor' || itemStage === 'waiter'
                            const itemExceeded =
                              item.status === 'exceeded' ||
                              item.chefStatus === 'exceeded' ||
                              item.supervisorStatus === 'exceeded' ||
                              item.waiterStatus === 'exceeded'

                            const stageHint = itemDone
                              ? 'Delivered'
                              : itemStage === 'waiter'
                                ? 'Waiter'
                                : itemStage === 'supervisor'
                                  ? 'Supervisor'
                                  : 'Chef'

                            const deliveryPersonName =
                              item.deliveredByName && item.deliveredByName !== '--'
                                ? item.deliveredByName
                                : item.waiterName && item.waiterName !== '--'
                                  ? item.waiterName
                                  : '--'
                            const chefTimeDisplay =
                              item.preparationTime != null
                                ? formatMinutes(item.preparationTime).replace(/\s*mins?$/i, '')
                                : isTimestampPresent(item.preparedAt)
                                  ? formatRailwayTime(item.preparedAt)
                                  : '--'
                            const supTimeDisplay =
                              item.supervisorConfirmingTime != null
                                ? formatMinutes(item.supervisorConfirmingTime).replace(/\s*mins?$/i, '')
                                : isTimestampPresent(item.confirmedAt)
                                  ? formatRailwayTime(item.confirmedAt)
                                  : '--'
                            const delTimeDisplay =
                              item.waiterDeliverTime != null
                                ? formatMinutes(item.waiterDeliverTime).replace(/\s*mins?$/i, '')
                                : isTimestampPresent(item.deliveredAt)
                                  ? formatRailwayTime(item.deliveredAt)
                                  : '--'

                            const itemKey = item.itemId || `${item.productId}-${itemIdx}`
                            const selectedForCard = selectedCardItems[group.key] || []
                            const isSelectedForUpdate = selectedForCard.includes(itemKey)

                            return (
                              <div
                                key={`${group.key}-item-${itemIdx}`}
                                className={`pt-kot-item-row ${itemDone ? 'is-done' : ''} ${itemExceeded ? 'is-exceeded' : ''}`}
                                title={`Stage: ${stageHint}${item.chefName && item.chefName !== '--' ? ` · Chef: ${item.chefName}` : ''}`}
                              >
                                <div className="pt-kot-item-main">
                                  <div className="pt-kot-item-left">
                                    <span className="pt-kot-qty-badge">{item.quantity}</span>
                                    <span className="pt-kot-item-name">{item.productName}</span>
                                  </div>
                                  <div className="pt-kot-item-right">
                                    <button
                                      type="button"
                                      className={`pt-kot-check-box ${
                                        itemDone
                                          ? 'is-checked'
                                          : isSelectedForUpdate
                                            ? 'is-selected'
                                            : itemReady
                                              ? 'is-ready'
                                              : itemExceeded
                                                ? 'is-exceeded'
                                                : 'is-pending'
                                      } ${!itemDone && group.billingId ? 'is-clickable' : ''}`}
                                      onClick={() => {
                                        if (itemDone || !group.billingId) return
                                        toggleCardItemSelection(group.key, itemKey)
                                      }}
                                      disabled={itemDone || !group.billingId || updatingCardKey === group.key}
                                      aria-label={
                                        itemDone
                                          ? 'Delivered'
                                          : isSelectedForUpdate
                                            ? `Selected for update (${stageHint})`
                                            : `Select to advance from ${stageHint}`
                                      }
                                      aria-pressed={!itemDone ? isSelectedForUpdate : undefined}
                                      title={
                                        itemDone
                                          ? 'Delivered'
                                          : isSelectedForUpdate
                                            ? 'Selected — click Update below'
                                            : `Click to mark ${stageHint} done`
                                      }
                                    >
                                      {(itemDone || isSelectedForUpdate) && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </div>

                                <div className="pt-kot-item-stages-inline">
                                  {stationType !== 'counter' && (
                                    <span
                                      className={`pt-kot-stage-inline status-${item.chefStatus || 'neutral'}`}
                                      title={`${item.chefName && item.chefName !== '--' ? item.chefName : '--'} - ${chefTimeDisplay}`}
                                    >
                                      <span className="pt-kot-stage-name">
                                        {item.chefName && item.chefName !== '--' ? item.chefName : '--'}
                                      </span>
                                      <span className="pt-kot-stage-dur"> - {chefTimeDisplay}</span>
                                    </span>
                                  )}
                                  <span
                                    className={`pt-kot-stage-inline status-${item.supervisorStatus || 'neutral'}`}
                                    title={`${item.confirmedByName && item.confirmedByName !== '--' ? item.confirmedByName : '--'} - ${supTimeDisplay}`}
                                  >
                                    <span className="pt-kot-stage-name">
                                      {item.confirmedByName && item.confirmedByName !== '--' ? item.confirmedByName : '--'}
                                    </span>
                                    <span className="pt-kot-stage-dur"> - {supTimeDisplay}</span>
                                  </span>
                                  <span
                                    className={`pt-kot-stage-inline status-${item.waiterStatus || 'neutral'}`}
                                    title={`${deliveryPersonName} - ${delTimeDisplay}`}
                                  >
                                    <span className="pt-kot-stage-name">{deliveryPersonName}</span>
                                    <span className="pt-kot-stage-dur"> - {delTimeDisplay}</span>
                                  </span>
                                </div>
                              </div>
                            )
                          })
                          )}
                        </div>

                        <div className="pt-kot-card-footer">
                          {(() => {
                            const selectedKeys = selectedCardItems[group.key] || []
                            const selectedEntries = group.items.filter((item, idx) =>
                              selectedKeys.includes(item.itemId || `${item.productId}-${idx}`),
                            )
                            const isUpdating = updatingCardKey === group.key

                            if (selectedEntries.length > 0) {
                              return (
                                <button
                                  type="button"
                                  className="pt-kot-primary-btn is-update"
                                  onClick={() =>
                                    handleUpdateSelectedCardItems(group.billingId, group.key, selectedEntries)
                                  }
                                  disabled={!group.billingId || isUpdating}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>{isUpdating ? 'Updating...' : 'Update'}</span>
                                  <span className="pt-kot-btn-badge">
                                    {selectedEntries.length} {selectedEntries.length === 1 ? 'item' : 'items'}
                                  </span>
                                </button>
                              )
                            }

                            return (
                              <button
                                type="button"
                                className="pt-kot-primary-btn"
                                onClick={() => {
                                  if (!group.billingId) return
                                  setSelectedBillRow(group.primaryEntry)
                                  setIsReceiptModalOpen(true)
                                }}
                                disabled={!group.billingId}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="9 12 11 14 15 10" />
                                </svg>
                                <span>View Bill</span>
                                <span className="pt-kot-btn-badge">
                                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                                </span>
                              </button>
                            )
                          })()}

                          <button
                            type="button"
                            className="pt-kot-secondary-btn"
                            onClick={() => {
                              if (!group.billingId) return
                              setSelectedBillRow(group.primaryEntry)
                              setIsReceiptModalOpen(true)
                            }}
                            disabled={!group.billingId}
                            title="Open Receipt Details"
                            aria-label="Open Receipt Details"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="pt-kot-grid-wrap">
              {loadingBillDetails && <p className="state">Loading...</p>}
              {!loadingBillDetails && billDetailsError && <p className="state error">{billDetailsError}</p>}
              {!loadingBillDetails && !billDetailsError && productWiseGroups.length === 0 && (
                <p className="state">
                  {activeStageFilter ? `No products currently in ${activeStageFilter} stage.` : 'No details found.'}
                </p>
              )}
              {!loadingBillDetails && !billDetailsError && productWiseGroups.length > 0 && (
                <div className="pt-kot-grid">
                  {productWiseGroups.map((prodGroup) => {
                    const filterKey = `combine-${prodGroup.key}`
                    const activeCardRole = cardStageFilters[filterKey] || null
                    const roleCounts: Record<StageKey, number> = {
                      chef: 0,
                      supervisor: 0,
                      waiter: 0,
                    }
                    prodGroup.items.forEach((item) => {
                      const st = getItemStage(item, stationType)
                      if (st === 'chef' || st === 'supervisor' || st === 'waiter') {
                        roleCounts[st] += 1
                      }
                    })
                    const visibleItems = activeCardRole
                      ? prodGroup.items.filter((item) => getItemStage(item, stationType) === activeCardRole)
                      : prodGroup.items
                    const cardRoleOptions: { key: StageKey; label: string }[] =
                      stationType === 'counter'
                        ? [
                            { key: 'supervisor', label: 'SUPERVISOR' },
                            { key: 'waiter', label: 'WAITER' },
                          ]
                        : [
                            { key: 'chef', label: 'CHEF' },
                            { key: 'supervisor', label: 'SUPERVISOR' },
                            { key: 'waiter', label: 'WAITER' },
                          ]
                    const hasAnyExceeded = prodGroup.items.some(
                      (item) =>
                        item.status === 'exceeded' ||
                        item.chefStatus === 'exceeded' ||
                        item.supervisorStatus === 'exceeded' ||
                        item.waiterStatus === 'exceeded',
                    )
                    const cardToneClass = hasAnyExceeded ? 'tone-exceeded' : 'tone-ontime'

                    return (
                      <div key={prodGroup.key} className={`pt-kot-card ${cardToneClass}`}>
                        <div className="pt-kot-card-header">
                          <div className="pt-kot-card-top-row">
                            <div className="pt-kot-card-title-group">
                              <span className="pt-kot-bill-num pt-combine-prod-title" title={prodGroup.productName}>
                                {prodGroup.productName}
                              </span>
                            </div>
                            <span className="pt-kot-qty-badge pt-combine-total-badge" title="Total Combined Quantity">
                              {prodGroup.totalQuantity}
                            </span>
                          </div>

                          <div className="pt-kot-card-meta-row">
                            <div className="pt-kot-meta-left">
                              <span className="pt-kot-meta-table">
                                {prodGroup.billIds.size} {prodGroup.billIds.size === 1 ? 'Table' : 'Tables'}
                              </span>
                            </div>
                          </div>

                          <div className="pt-kot-card-status-row">
                            <div className="pt-kot-role-filter-group" role="group" aria-label="Filter tables by role">
                              {cardRoleOptions.map((roleOpt) => {
                                const isActiveRole = activeCardRole === roleOpt.key
                                const count = roleCounts[roleOpt.key]
                                return (
                                  <button
                                    key={roleOpt.key}
                                    type="button"
                                    className={`pt-kot-role-filter-btn role-${roleOpt.key} ${isActiveRole ? 'is-active' : ''}`}
                                    onClick={() =>
                                      setCardStageFilters((prev) => ({
                                        ...prev,
                                        [filterKey]: prev[filterKey] === roleOpt.key ? null : roleOpt.key,
                                      }))
                                    }
                                    aria-pressed={isActiveRole}
                                  >
                                    <span>{roleOpt.label}</span>
                                    {count > 0 && <span className="pt-kot-role-count">{count}</span>}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="pt-kot-card-items">
                          {visibleItems.length === 0 ? (
                            <p className="pt-kot-empty-stage">
                              No tables in {activeCardRole} stage.
                            </p>
                          ) : (
                            visibleItems.map((item, itemIdx) => {
                              const itemStage = getItemStage(item, stationType)
                              const itemDone = itemStage === 'completed'
                              const itemRawTable = (item.tableNumber || '').trim()
                              const itemRawSection = (item.section || '').trim()
                              const itemIsShared =
                                /-s-/i.test(itemRawTable) ||
                                itemRawSection.toLowerCase() === 'shared tables'
                              const itemCleanTable = itemIsShared
                                ? itemRawTable
                                    .replace(/-s-.*$/i, '')
                                    .replace(/-[a-z0-9]+$/i, '')
                                    .trim() || itemRawTable
                                : itemRawTable
                              const itemCleanSection =
                                itemRawSection.toLowerCase() === 'shared tables' ? '' : itemRawSection
                              const itemTableLabel = itemCleanTable
                                ? `TABLE ${itemCleanSection ? `${itemCleanSection} ${itemCleanTable}` : itemCleanTable}`
                                : itemRawSection || `#${item.billNumber}`

                              const deliveryPersonName =
                                item.deliveredByName && item.deliveredByName !== '--'
                                  ? item.deliveredByName
                                  : item.waiterName && item.waiterName !== '--'
                                    ? item.waiterName
                                    : '--'
                              const chefTimeDisplay =
                                item.preparationTime != null
                                  ? formatMinutes(item.preparationTime).replace(/\s*mins?$/i, '')
                                  : isTimestampPresent(item.preparedAt)
                                    ? formatRailwayTime(item.preparedAt)
                                    : '--'
                              const supTimeDisplay =
                                item.supervisorConfirmingTime != null
                                  ? formatMinutes(item.supervisorConfirmingTime).replace(/\s*mins?$/i, '')
                                  : isTimestampPresent(item.confirmedAt)
                                    ? formatRailwayTime(item.confirmedAt)
                                    : '--'
                              const delTimeDisplay =
                                item.waiterDeliverTime != null
                                  ? formatMinutes(item.waiterDeliverTime).replace(/\s*mins?$/i, '')
                                  : isTimestampPresent(item.deliveredAt)
                                    ? formatRailwayTime(item.deliveredAt)
                                    : '--'
                              const itemElapsedMins =
                                item.waiterDeliverTime ??
                                item.supervisorConfirmingTime ??
                                item.preparationTime ??
                                null

                              return (
                                <div key={`${prodGroup.key}-row-${itemIdx}`} className="pt-kot-item-row">
                                  <div className="pt-kot-item-main">
                                    <div className="pt-kot-item-left">
                                      <span className="pt-kot-qty-badge">{item.quantity}</span>
                                      <span
                                        className="pt-kot-item-name pt-combine-table-link"
                                        onClick={() => {
                                          if (!item.billingId) return
                                          setSelectedBillRow(item)
                                          setIsReceiptModalOpen(true)
                                        }}
                                        title={`Click to view bill #${item.billNumber}`}
                                      >
                                        {itemTableLabel}
                                      </span>
                                    </div>
                                    <div className="pt-kot-item-right">
                                      <LiveElapsedTimer
                                        orderedAt={item.orderedAt}
                                        isFinished={itemDone}
                                        fallbackMinutes={itemElapsedMins}
                                      />
                                      <span
                                        className={`pt-kot-check-box ${itemDone ? 'is-checked' : ''}`}
                                        aria-label={itemDone ? 'Delivered' : 'Pending'}
                                      >
                                        {itemDone && (
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pt-kot-item-stages-inline">
                                    {stationType !== 'counter' && (
                                      <span
                                        className={`pt-kot-stage-inline status-${item.chefStatus || 'neutral'}`}
                                        title={`${item.chefName && item.chefName !== '--' ? item.chefName : '--'} - ${chefTimeDisplay}`}
                                      >
                                        <span className="pt-kot-stage-name">
                                          {item.chefName && item.chefName !== '--' ? item.chefName : '--'}
                                        </span>
                                        <span className="pt-kot-stage-dur"> - {chefTimeDisplay}</span>
                                      </span>
                                    )}
                                    <span
                                      className={`pt-kot-stage-inline status-${item.supervisorStatus || 'neutral'}`}
                                      title={`${item.confirmedByName && item.confirmedByName !== '--' ? item.confirmedByName : '--'} - ${supTimeDisplay}`}
                                    >
                                      <span className="pt-kot-stage-name">
                                        {item.confirmedByName && item.confirmedByName !== '--' ? item.confirmedByName : '--'}
                                      </span>
                                      <span className="pt-kot-stage-dur"> - {supTimeDisplay}</span>
                                    </span>
                                    <span
                                      className={`pt-kot-stage-inline status-${item.waiterStatus || 'neutral'}`}
                                      title={`${deliveryPersonName} - ${delTimeDisplay}`}
                                    >
                                      <span className="pt-kot-stage-name">{deliveryPersonName}</span>
                                      <span className="pt-kot-stage-dur"> - {delTimeDisplay}</span>
                                    </span>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>

                        <div className="pt-kot-card-footer">
                          <div className="pt-combine-footer-summary">
                            <span>Total Qty: <strong>{prodGroup.totalQuantity}</strong></span>
                            <span>{prodGroup.billIds.size} {prodGroup.billIds.size === 1 ? 'Table' : 'Tables'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="pt-status-summary-row">
            {statusSummaryCards.map((card) => (
              <div key={card.key} className={`pt-status-summary-card tone-${card.tone}`}>
                <p className="pt-status-summary-title">{card.label}</p>
                <p className="pt-status-summary-value">{formatSummaryAmount(card.amount)}</p>
                <p className="pt-status-summary-count">order count: {formatCount(card.count)}</p>
              </div>
            ))}
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
