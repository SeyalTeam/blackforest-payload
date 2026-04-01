import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { PipelineStage } from 'mongoose'
import { CollectionConfig, APIError, type Payload } from 'payload'
import { getProductStock } from '../utilities/inventory'
import { updateItemStatus } from '../endpoints/updateItemStatus'
import { getItemPreparationTime } from '../endpoints/getItemPreparationTime'
import {
  type AmountBasedFreeProductOfferRule,
  calculatePointsForSpend,
  type CustomerRewardSettings,
  getCustomerRewardSettings,
  isOfferAllowedForBranch,
  isRandomOfferProductAvailableNow,
  type ProductPriceOfferRule,
  type ProductToProductOfferRule,
} from '../utilities/customerRewards'
import { withWriteConflictRetry } from '../utilities/mongoRetry'

dayjs.extend(utc)
dayjs.extend(timezone)

const BILLING_TIMEZONE = 'Asia/Kolkata'

type BillingNumberField = 'invoiceNumber' | 'kotNumber'

const getBillingDateStamp = (): string => dayjs().tz(BILLING_TIMEZONE).format('YYYYMMDD')

const getNextBillingSequence = async (
  payload: Payload,
  field: BillingNumberField,
  prefix: string,
): Promise<number> => {
  const suffixStart = prefix.length
  const pipeline: PipelineStage[] = [
    {
      $match: {
        [field]: {
          $gte: prefix,
          $lt: `${prefix}:`,
        },
      },
    },
    {
      $project: {
        numericSuffix: {
          $convert: {
            input: {
              $substrCP: [
                `$${field}`,
                suffixStart,
                {
                  $subtract: [{ $strLenCP: `$${field}` }, suffixStart],
                },
              ],
            },
            to: 'int',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        maxSeq: { $max: '$numericSuffix' },
      },
    },
  ]
  const BillingModel = payload.db.collections['billings']
  const [result] = (await BillingModel.aggregate(pipeline)) as Array<{
    _id: null
    maxSeq: number | null
  }>

  return typeof result?.maxSeq === 'number' && Number.isFinite(result.maxSeq)
    ? result.maxSeq + 1
    : 1
}

const toSafeNonNegativeNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return value
}

const toMoneyValue = (value: number): number => {
  return parseFloat(value.toFixed(2))
}

const roundUpToRupee = (value: number): number => {
  return Math.ceil(toSafeNonNegativeNumber(value))
}

const getRoundOffAmount = (roundedValue: number, originalValue: number): number => {
  return toMoneyValue(Math.max(0, roundedValue - toSafeNonNegativeNumber(originalValue)))
}

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const isPayloadNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    status?: unknown
    message?: unknown
    name?: unknown
  }

  if (candidate.status === 404) return true

  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  const name = typeof candidate.name === 'string' ? candidate.name.toLowerCase() : ''

  return (
    message.includes('not found') ||
    message.includes('document not found') ||
    name.includes('notfound')
  )
}

const scheduleDeferredBillingFlagUpdate = (
  payload: Payload,
  billID: string,
  data: Record<string, unknown>,
  reason: string,
): void => {
  setTimeout(() => {
    void (async () => {
      const maxAttempts = 8
      let lastError: unknown

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await withWriteConflictRetry(() =>
            payload.update({
              collection: 'billings',
              id: billID,
              data: data as any,
              depth: 0,
              overrideAccess: true,
              context: {
                skipOfferRecalculation: true,
                skipPricingRecalculation: true,
                skipInventoryValidation: true,
                skipCustomerRewardProcessing: true,
                skipOfferCounterProcessing: true,
              },
            }),
          )

          return
        } catch (error) {
          lastError = error
          const retryableNotFound = isPayloadNotFoundError(error) && attempt < maxAttempts
          if (!retryableNotFound) {
            break
          }
          await wait(150 * attempt)
        }
      }

      console.error('Deferred billing flag update failed.', {
        billID,
        reason,
        data,
        error: lastError,
      })
    })()
  }, 0)
}

const extractBillIDs = (bills: unknown): string[] => {
  if (!Array.isArray(bills)) return []

  return bills
    .map((bill) => {
      if (typeof bill === 'string') return bill
      if (bill && typeof bill === 'object' && 'id' in bill && typeof bill.id === 'string') {
        return bill.id
      }
      return null
    })
    .filter((billId): billId is string => typeof billId === 'string')
}

type BillingItemInput = {
  id?: string
  product?: unknown
  status?: string
  name?: string
  notes?: string
  quantity?: number | string
  unitPrice?: number | string
  subtotal?: number
  isOfferFreeItem?: boolean
  offerRuleKey?: string
  offerTriggerProduct?: unknown
  isPriceOfferApplied?: boolean
  priceOfferRuleKey?: string
  priceOfferDiscountPerUnit?: number
  priceOfferAppliedUnits?: number
  effectiveUnitPrice?: number
  gstRate?: number
  taxableAmount?: number
  gstAmount?: number
  finalLineTotal?: number
  isRandomCustomerOfferItem?: boolean
  randomCustomerOfferCampaignCode?: string
  isAmountBasedFreeOfferItem?: boolean
  amountBasedFreeOfferRuleKey?: string
  [key: string]: unknown
}

type BillingRequestContext = {
  skipOfferRecalculation?: boolean
  skipPricingRecalculation?: boolean
  skipInventoryValidation?: boolean
  offersAppliedInBeforeValidate?: boolean
}

const getBillingRequestContext = (req: unknown): BillingRequestContext => {
  const mutableReq = req as { context?: Record<string, unknown> }

  if (!mutableReq.context || typeof mutableReq.context !== 'object') {
    mutableReq.context = {}
  }

  return mutableReq.context as BillingRequestContext
}

const getRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof (value as { id?: unknown }).id === 'string' ||
      typeof (value as { id?: unknown }).id === 'number')
  ) {
    return String((value as { id: string | number }).id)
  }

  if (value && typeof value === 'object' && 'value' in value) {
    return getRelationshipID((value as { value?: unknown }).value)
  }

  return null
}

const getPositiveNumericValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return 0
}

const getNumericValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

const clampPercentage = (value: unknown): number => {
  return Math.max(0, Math.min(100, getNumericValue(value)))
}

type ProductGSTInput = {
  defaultPriceDetails?: {
    gst?: unknown
  } | null
  branchOverrides?: Array<{
    branch?: unknown
    gst?: unknown
  } | null> | null
}

const getGSTRateFromProduct = (product: ProductGSTInput | null, branchID: string | null): number => {
  if (!product) {
    return 0
  }

  let gstRate = clampPercentage(product.defaultPriceDetails?.gst)

  if (branchID && Array.isArray(product.branchOverrides)) {
    const override = product.branchOverrides.find(
      (row) => getRelationshipID(row?.branch) === branchID && row?.gst != null,
    )
    if (override?.gst != null) {
      gstRate = clampPercentage(override.gst)
    }
  }

  return toMoneyValue(gstRate)
}

type BillingGSTBreakdown = {
  items: BillingItemInput[]
  totalTaxableAmount: number
  totalGSTAmount: number
}

const computeBillingGSTBreakdown = async (
  payload: Payload,
  items: BillingItemInput[],
  branchID: string | null,
  totalDiscountAmount: number,
): Promise<BillingGSTBreakdown> => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      items: [],
      totalTaxableAmount: 0,
      totalGSTAmount: 0,
    }
  }

  const itemLineTotals = items.map((item) =>
    item.status === 'cancelled' ? 0 : toSafeNonNegativeNumber(item.subtotal),
  )
  const grossLineTotal = itemLineTotals.reduce((sum, lineTotal) => sum + lineTotal, 0)
  const normalizedDiscount = Math.min(grossLineTotal, toSafeNonNegativeNumber(totalDiscountAmount))
  const discountRatio = grossLineTotal > 0 ? normalizedDiscount / grossLineTotal : 0

  const productIDs = [
    ...new Set(
      items
        .map((item) => getRelationshipID(item.product))
        .filter((productID): productID is string => Boolean(productID)),
    ),
  ]

  const productCache = new Map<string, ProductGSTInput | null>()
  await Promise.all(
    productIDs.map(async (productID) => {
      try {
        const product = (await payload.findByID({
          collection: 'products',
          id: productID,
          depth: 0,
          overrideAccess: true,
        })) as ProductGSTInput
        productCache.set(productID, product)
      } catch {
        productCache.set(productID, null)
      }
    }),
  )

  let totalTaxableAmount = 0
  let totalGSTAmount = 0

  const updatedItems = items.map((item) => {
    const taxableBeforeDiscount =
      item.status === 'cancelled' ? 0 : toSafeNonNegativeNumber(item.subtotal)
    const taxableAmount = toMoneyValue(taxableBeforeDiscount * (1 - discountRatio))
    const productID = getRelationshipID(item.product)
    const productDoc = productID ? (productCache.get(productID) ?? null) : null
    const gstRate = getGSTRateFromProduct(productDoc, branchID)
    const gstAmount = toMoneyValue((taxableAmount * gstRate) / 100)
    const finalLineTotal = toMoneyValue(taxableAmount + gstAmount)

    totalTaxableAmount += taxableAmount
    totalGSTAmount += gstAmount

    return {
      ...item,
      gstRate,
      taxableAmount,
      gstAmount,
      finalLineTotal,
    }
  })

  return {
    items: updatedItems,
    totalTaxableAmount: toMoneyValue(totalTaxableAmount),
    totalGSTAmount: toMoneyValue(totalGSTAmount),
  }
}

const normalizePhoneNumber = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const getQuantityByProduct = (items: unknown): Map<string, number> => {
  const quantityByProduct = new Map<string, number>()
  if (!Array.isArray(items)) return quantityByProduct

  for (const item of items as BillingItemInput[]) {
    if (!item || item.status === 'cancelled') continue

    const productID = getRelationshipID(item.product)
    if (!productID) continue

    const quantity = getPositiveNumericValue(item.quantity)
    if (quantity <= 0) continue

    quantityByProduct.set(productID, (quantityByProduct.get(productID) || 0) + quantity)
  }

  return quantityByProduct
}

const hasTableOrderValue = (value: unknown): boolean => {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return value
  return true
}

const isTableOrderBill = (
  data: {
    tableDetails?: { section?: unknown; tableNumber?: unknown } | null
    section?: unknown
    tableNumber?: unknown
  } | null,
  originalDoc?: { tableDetails?: { section?: unknown; tableNumber?: unknown } | null } | null,
): boolean => {
  const current = data || {}
  const previous = originalDoc || {}

  const section =
    current.section ?? current.tableDetails?.section ?? previous.tableDetails?.section ?? null
  const tableNumber =
    current.tableNumber ??
    current.tableDetails?.tableNumber ??
    previous.tableDetails?.tableNumber ??
    null

  return hasTableOrderValue(section) || hasTableOrderValue(tableNumber)
}

const getBranchIDFromBillingData = (
  data: { branch?: unknown } | null,
  originalDoc?: { branch?: unknown } | null,
): string | null => {
  return getRelationshipID(data?.branch ?? originalDoc?.branch)
}

const shouldShowCustomerDetailsForTableOrders = async (
  payload: Payload,
  branchID: string | null,
): Promise<boolean> => {
  if (!branchID) return true

  try {
    const widgetSettings = (await payload.findGlobal({
      slug: 'widget-settings',
      depth: 0,
      overrideAccess: true,
    })) as {
      tableOrderCustomerDetailsByBranch?: Array<{
        branch?: unknown
        showCustomerDetailsForTableOrders?: unknown
      }>
    }

    const rows = Array.isArray(widgetSettings?.tableOrderCustomerDetailsByBranch)
      ? widgetSettings.tableOrderCustomerDetailsByBranch
      : []

    const branchRow = rows.find((row) => getRelationshipID(row?.branch) === branchID)
    if (branchRow && typeof branchRow.showCustomerDetailsForTableOrders === 'boolean') {
      return branchRow.showCustomerDetailsForTableOrders
    }
  } catch (error) {
    console.error('[Billings hook] Failed to fetch widget customer detail setting.', {
      branchID,
      error,
    })
  }

  return true
}

const isOfferAllowedByOrderType = (
  isTableOrder: boolean,
  allowForTableOrders: boolean,
  allowForBillings: boolean,
): boolean => {
  return isTableOrder ? allowForTableOrders : allowForBillings
}

const getDeterministicPercentFromSeed = (seed: string): number => {
  let hash = 2166136261

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return ((hash >>> 0) / 4294967295) * 100
}

const isDeterministicRandomSelection = (seed: string, chancePercent: number): boolean => {
  const safeChance = Math.min(100, Math.max(0, chancePercent))
  if (safeChance <= 0) return false
  if (safeChance >= 100) return true

  return getDeterministicPercentFromSeed(seed) < safeChance
}

const getDeterministicIndexFromSeed = (seed: string, totalItems: number): number => {
  if (!Number.isFinite(totalItems) || totalItems <= 1) {
    return 0
  }

  const normalized = Math.min(0.999999, Math.max(0, getDeterministicPercentFromSeed(seed) / 100))
  return Math.floor(normalized * totalItems)
}

const isTotalPercentageOfferAvailableNow = (settings: CustomerRewardSettings): boolean => {
  return isRandomOfferProductAvailableNow(
    {
      enabled: true,
      availableFromDate: settings.totalPercentageOfferAvailableFromDate,
      availableToDate: settings.totalPercentageOfferAvailableToDate,
      dailyStartTime: settings.totalPercentageOfferDailyStartTime,
      dailyEndTime: settings.totalPercentageOfferDailyEndTime,
    },
    settings.totalPercentageOfferTimezone,
  )
}

const isCustomerEntryPercentageOfferAvailableNow = (settings: CustomerRewardSettings): boolean => {
  return isRandomOfferProductAvailableNow(
    {
      enabled: true,
      availableFromDate: settings.customerEntryPercentageOfferAvailableFromDate,
      availableToDate: settings.customerEntryPercentageOfferAvailableToDate,
      dailyStartTime: settings.customerEntryPercentageOfferDailyStartTime,
      dailyEndTime: settings.customerEntryPercentageOfferDailyEndTime,
    },
    settings.customerEntryPercentageOfferTimezone,
  )
}

const clearPriceOfferMetadata = (item: BillingItemInput): BillingItemInput => ({
  ...item,
  isPriceOfferApplied: false,
  priceOfferRuleKey: undefined,
  priceOfferDiscountPerUnit: 0,
  priceOfferAppliedUnits: 0,
  effectiveUnitPrice: getPositiveNumericValue(item.unitPrice),
})

const buildSingleOfferBaseItems = (items: BillingItemInput[]): BillingItemInput[] => {
  return items
    .filter(
      (item) =>
        !item.isOfferFreeItem && !item.isRandomCustomerOfferItem && !item.isAmountBasedFreeOfferItem,
    )
    .map((item) => ({
      ...clearPriceOfferMetadata(item),
      isOfferFreeItem: false,
      offerRuleKey: undefined,
      offerTriggerProduct: undefined,
      isRandomCustomerOfferItem: false,
      randomCustomerOfferCampaignCode: undefined,
      isAmountBasedFreeOfferItem: false,
      amountBasedFreeOfferRuleKey: undefined,
    }))
}

const hasProductToProductOfferApplied = (items: BillingItemInput[]): boolean =>
  items.some((item) => item.isOfferFreeItem)

const hasProductPriceOfferApplied = (items: BillingItemInput[]): boolean =>
  items.some(
    (item) =>
      Boolean(item.isPriceOfferApplied) &&
      getPositiveNumericValue(item.priceOfferDiscountPerUnit) > 0,
  )

const hasRandomProductOfferApplied = (items: BillingItemInput[]): boolean =>
  items.some((item) => item.isRandomCustomerOfferItem)

const hasAmountBasedFreeOfferApplied = (items: BillingItemInput[]): boolean =>
  items.some((item) => item.isAmountBasedFreeOfferItem)

const hasAnyItemLevelOfferApplied = (items: BillingItemInput[]): boolean =>
  hasProductToProductOfferApplied(items) ||
  hasProductPriceOfferApplied(items) ||
  hasRandomProductOfferApplied(items) ||
  hasAmountBasedFreeOfferApplied(items)

const getProductNameMap = async (
  payload: Payload,
  productIDs: string[],
): Promise<Record<string, string>> => {
  const uniqueProductIDs = [...new Set(productIDs)]
  const rows = await Promise.all(
    uniqueProductIDs.map(async (productID) => {
      try {
        const product = (await payload.findByID({
          collection: 'products',
          id: productID,
          depth: 0,
          overrideAccess: true,
        })) as { name?: string }

        return [productID, product?.name || 'Free Product'] as const
      } catch {
        return [productID, 'Free Product'] as const
      }
    }),
  )

  return Object.fromEntries(rows)
}

const buildRuleKey = (rule: ProductToProductOfferRule): string => {
  return `${rule.id}:${rule.buyProduct}:${rule.freeProduct}`
}

const buildPriceOfferRuleKey = (rule: ProductPriceOfferRule): string => {
  return `${rule.id}:${rule.product}`
}

const buildAmountBasedFreeOfferRuleKey = (rule: AmountBasedFreeProductOfferRule): string => {
  return `${rule.id}:${rule.minimumBillAmount}:${rule.freeProduct}`
}

const getCustomerUsageCount = (
  offerCustomerUsage: Array<{ customer: string; usageCount: number }>,
  customerID: string | null,
): number => {
  if (!customerID) return 0

  const usageRow = offerCustomerUsage.find((row) => row.customer === customerID)
  return usageRow ? toSafeNonNegativeNumber(usageRow.usageCount) : 0
}

const canApplyRuleWithinLimits = (
  maxOfferCount: number,
  offerGivenCount: number,
  maxCustomerCount: number,
  offerCustomerCount: number,
  offerCustomers: string[],
  customerID: string | null,
  maxUsagePerCustomer = 0,
  offerCustomerUsage: Array<{ customer: string; usageCount: number }> = [],
): boolean => {
  if (maxOfferCount > 0 && offerGivenCount >= maxOfferCount) {
    return false
  }

  if (maxCustomerCount > 0) {
    if (!customerID) return false
    const isExistingCustomer = offerCustomers.includes(customerID)
    if (!isExistingCustomer && offerCustomerCount >= maxCustomerCount) {
      return false
    }
  }

  if (maxUsagePerCustomer > 0) {
    if (!customerID) return false
    const currentUsageCount = getCustomerUsageCount(offerCustomerUsage, customerID)
    if (currentUsageCount >= maxUsagePerCustomer) {
      return false
    }
  }

  return true
}

const computeRewardSnapshotFromCompletedHistory = async (
  payload: Payload,
  customerPhoneNumber: string,
  settings: CustomerRewardSettings,
): Promise<{ rewardPoints: number; rewardProgressAmount: number }> => {
  if (
    !customerPhoneNumber ||
    !settings.enabled ||
    settings.spendAmountPerStep <= 0 ||
    settings.pointsPerStep <= 0
  ) {
    return { rewardPoints: 0, rewardProgressAmount: 0 }
  }

  let page = 1
  let hasNextPage = true
  let rewardPoints = 0
  let rewardProgressAmount = 0

  while (hasNextPage) {
    const result = await payload.find({
      collection: 'billings',
      where: {
        and: [
          {
            ['customerDetails.phoneNumber']: {
              equals: customerPhoneNumber,
            },
          } as any,
          {
            status: {
              equals: 'completed',
            },
          },
        ],
      },
      sort: 'createdAt',
      page,
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })

    for (const row of result.docs as any[]) {
      const grossAmount = toSafeNonNegativeNumber(row?.grossAmount ?? row?.totalAmount)
      const offerDiscount = toSafeNonNegativeNumber(row?.customerOfferDiscount)
      const offerWasApplied = Boolean(row?.customerOfferApplied) && offerDiscount > 0

      if (offerWasApplied && settings.resetOnRedeem) {
        rewardPoints = 0
        rewardProgressAmount = 0
        continue
      }

      const totalProgressAmount = rewardProgressAmount + grossAmount
      const { earnedPoints, consumedAmount } = calculatePointsForSpend(
        totalProgressAmount,
        settings.spendAmountPerStep,
        settings.pointsPerStep,
      )

      rewardPoints += earnedPoints
      rewardProgressAmount = toMoneyValue(Math.max(0, totalProgressAmount - consumedAmount))
    }

    hasNextPage = result.hasNextPage
    page += 1
  }

  return {
    rewardPoints,
    rewardProgressAmount,
  }
}

const markBillingProcessingFlags = async (
  payload: Payload,
  billID: string,
  data: Record<string, unknown>,
  reason: string,
): Promise<boolean> => {
  const maxAttempts = 5
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await withWriteConflictRetry(() =>
        payload.update({
          collection: 'billings',
          id: billID,
          data: data as any,
          depth: 0,
          overrideAccess: true,
          context: {
            skipOfferRecalculation: true,
            skipPricingRecalculation: true,
            skipInventoryValidation: true,
            skipCustomerRewardProcessing: true,
            skipOfferCounterProcessing: true,
          },
        }),
      )

      return true
    } catch (error) {
      lastError = error
      const shouldRetry = isPayloadNotFoundError(error) && attempt < maxAttempts
      if (!shouldRetry) {
        break
      }
      await wait(120 * attempt)
    }
  }

  if (isPayloadNotFoundError(lastError)) {
    scheduleDeferredBillingFlagUpdate(payload, billID, data, reason)
    console.warn('Billing flag update deferred because bill was temporarily not found.', {
      billID,
      reason,
      data,
    })
    return true
  }

  console.error('Failed to mark billing processing flags.', {
    billID,
    reason,
    data,
    error: lastError,
  })

  return false
}

const applyProductToProductOffers = async (
  items: BillingItemInput[],
  payload: Payload,
  status: string,
  settings: CustomerRewardSettings,
  customerID: string | null,
  branchID: string | null,
  isTableOrder: boolean,
): Promise<BillingItemInput[]> => {
  const manualItems = items.filter((item) => !item.isOfferFreeItem)

  if (
    status === 'cancelled' ||
    !settings.enableProductToProductOffer ||
    settings.productToProductOffers.length === 0
  ) {
    return manualItems
  }

  const activeRules = settings.productToProductOffers.filter(
    (rule) =>
      rule.enabled &&
      isOfferAllowedByOrderType(isTableOrder, rule.allowOnTableOrders, rule.allowOnBillings) &&
      isOfferAllowedForBranch(branchID, rule.branches) &&
      canApplyRuleWithinLimits(
        rule.maxOfferCount,
        rule.offerGivenCount,
        rule.maxCustomerCount,
        rule.offerCustomerCount,
        rule.offerCustomers,
        customerID,
        rule.maxUsagePerCustomer,
        rule.offerCustomerUsage,
      ),
  )
  if (activeRules.length === 0) {
    return manualItems
  }

  const purchasedByProduct = new Map<string, number>()

  for (const item of manualItems) {
    if (item.isRandomCustomerOfferItem) continue
    if (item.status === 'cancelled') continue

    const productID = getRelationshipID(item.product)
    if (!productID) continue

    const quantity = getPositiveNumericValue(item.quantity)
    if (quantity <= 0) continue

    purchasedByProduct.set(productID, (purchasedByProduct.get(productID) || 0) + quantity)
  }

  const existingAutoItemByRule = new Map<string, BillingItemInput>()
  for (const item of items) {
    if (!item.isOfferFreeItem || typeof item.offerRuleKey !== 'string') continue
    if (!existingAutoItemByRule.has(item.offerRuleKey)) {
      existingAutoItemByRule.set(item.offerRuleKey, item)
    }
  }

  const desiredOffers = new Map<string, { rule: ProductToProductOfferRule; freeQuantity: number }>()

  for (const rule of activeRules) {
    const ruleKey = buildRuleKey(rule)
    const purchasedQty = purchasedByProduct.get(rule.buyProduct) || 0
    const ruleTriggerCount = Math.floor(purchasedQty / rule.buyQuantity)
    if (ruleTriggerCount <= 0) continue

    const remainingGlobalUses =
      rule.maxOfferCount > 0
        ? Math.max(0, rule.maxOfferCount - toSafeNonNegativeNumber(rule.offerGivenCount))
        : Number.MAX_SAFE_INTEGER

    const remainingCustomerUses =
      rule.maxUsagePerCustomer > 0
        ? Math.max(
            0,
            rule.maxUsagePerCustomer - getCustomerUsageCount(rule.offerCustomerUsage, customerID),
          )
        : Number.MAX_SAFE_INTEGER

    const applicableTriggerCount = Math.floor(
      Math.min(ruleTriggerCount, remainingGlobalUses, remainingCustomerUses),
    )
    if (applicableTriggerCount <= 0) continue

    const freeQuantity = applicableTriggerCount * rule.freeQuantity
    if (freeQuantity <= 0) continue

    desiredOffers.set(ruleKey, { rule, freeQuantity })
  }

  if (desiredOffers.size === 0) {
    return manualItems
  }

  const productNameMap = await getProductNameMap(
    payload,
    Array.from(desiredOffers.values()).map((entry) => entry.rule.freeProduct),
  )

  const computedAutoItems: BillingItemInput[] = []
  for (const [ruleKey, desiredOffer] of desiredOffers.entries()) {
    const existing = existingAutoItemByRule.get(ruleKey)

    computedAutoItems.push({
      ...(existing || {}),
      product: desiredOffer.rule.freeProduct,
      status: existing?.status || 'ordered',
      name: productNameMap[desiredOffer.rule.freeProduct] || 'Free Product',
      notes: `FREE ITEM OFFER: Buy ${desiredOffer.rule.buyQuantity} Get ${desiredOffer.rule.freeQuantity}`,
      quantity: desiredOffer.freeQuantity,
      unitPrice: 0,
      subtotal: 0,
      isOfferFreeItem: true,
      offerRuleKey: ruleKey,
      offerTriggerProduct: desiredOffer.rule.buyProduct,
    })
  }

  return [...manualItems, ...computedAutoItems]
}

const applyProductPriceOffers = (
  items: BillingItemInput[],
  status: string,
  settings: CustomerRewardSettings,
  customerID: string | null,
  branchID: string | null,
  isTableOrder: boolean,
): BillingItemInput[] => {
  if (
    status === 'cancelled' ||
    !settings.enableProductPriceOffer ||
    settings.productPriceOffers.length === 0
  ) {
    return items.map((item) => ({
      ...item,
      isPriceOfferApplied: false,
      priceOfferRuleKey: undefined,
      priceOfferDiscountPerUnit: 0,
      priceOfferAppliedUnits: 0,
      effectiveUnitPrice: getPositiveNumericValue(item.unitPrice),
    }))
  }

  const activeRules = settings.productPriceOffers.filter(
    (rule) =>
      rule.enabled &&
      isOfferAllowedByOrderType(isTableOrder, rule.allowOnTableOrders, rule.allowOnBillings) &&
      isOfferAllowedForBranch(branchID, rule.branches) &&
      canApplyRuleWithinLimits(
        rule.maxOfferCount,
        rule.offerGivenCount,
        rule.maxCustomerCount,
        rule.offerCustomerCount,
        rule.offerCustomers,
        customerID,
        rule.maxUsagePerCustomer,
        rule.offerCustomerUsage,
      ),
  )
  if (activeRules.length === 0) {
    return items.map((item) => ({
      ...item,
      isPriceOfferApplied: false,
      priceOfferRuleKey: undefined,
      priceOfferDiscountPerUnit: 0,
      priceOfferAppliedUnits: 0,
      effectiveUnitPrice: getPositiveNumericValue(item.unitPrice),
    }))
  }

  const ruleByProduct = new Map<
    string,
    {
      rule: ProductPriceOfferRule
      remainingGlobalUses: number
      remainingCustomerUses: number
    }
  >()
  for (const rule of activeRules) {
    if (!ruleByProduct.has(rule.product)) {
      ruleByProduct.set(rule.product, {
        rule,
        remainingGlobalUses:
          rule.maxOfferCount > 0
            ? Math.max(0, rule.maxOfferCount - toSafeNonNegativeNumber(rule.offerGivenCount))
            : Number.MAX_SAFE_INTEGER,
        remainingCustomerUses:
          rule.maxUsagePerCustomer > 0
            ? Math.max(
                0,
                rule.maxUsagePerCustomer -
                  getCustomerUsageCount(rule.offerCustomerUsage, customerID),
              )
            : Number.MAX_SAFE_INTEGER,
      })
    }
  }

  return items.map((item) => {
    const unitPrice = getPositiveNumericValue(item.unitPrice)

    if (item.isOfferFreeItem || item.isRandomCustomerOfferItem) {
      return {
        ...item,
        isPriceOfferApplied: false,
        priceOfferRuleKey: undefined,
        priceOfferDiscountPerUnit: 0,
        priceOfferAppliedUnits: 0,
        effectiveUnitPrice: 0,
      }
    }

    const productID = getRelationshipID(item.product)
    if (!productID) {
      return {
        ...item,
        isPriceOfferApplied: false,
        priceOfferRuleKey: undefined,
        priceOfferDiscountPerUnit: 0,
        priceOfferAppliedUnits: 0,
        effectiveUnitPrice: unitPrice,
      }
    }

    const ruleState = ruleByProduct.get(productID)
    if (!ruleState) {
      return {
        ...item,
        isPriceOfferApplied: false,
        priceOfferRuleKey: undefined,
        priceOfferDiscountPerUnit: 0,
        priceOfferAppliedUnits: 0,
        effectiveUnitPrice: unitPrice,
      }
    }

    const quantity = getPositiveNumericValue(item.quantity)
    const eligibleQuantity = quantity > 0 ? quantity : 1
    const availableUses = Math.min(ruleState.remainingGlobalUses, ruleState.remainingCustomerUses)
    const appliedUnits = Math.max(0, Math.min(eligibleQuantity, availableUses))
    const baseDiscountPerUnit = Math.min(unitPrice, ruleState.rule.discountAmount)

    if (appliedUnits <= 0 || baseDiscountPerUnit <= 0) {
      return {
        ...item,
        isPriceOfferApplied: false,
        priceOfferRuleKey: undefined,
        priceOfferDiscountPerUnit: 0,
        priceOfferAppliedUnits: 0,
        effectiveUnitPrice: unitPrice,
      }
    }

    const discountRatio = appliedUnits / eligibleQuantity
    const effectiveDiscountPerUnit = toMoneyValue(baseDiscountPerUnit * discountRatio)
    const effectiveUnitPrice = toMoneyValue(Math.max(0, unitPrice - effectiveDiscountPerUnit))

    ruleState.remainingGlobalUses = Math.max(0, ruleState.remainingGlobalUses - appliedUnits)
    ruleState.remainingCustomerUses = Math.max(0, ruleState.remainingCustomerUses - appliedUnits)

    return {
      ...item,
      isPriceOfferApplied: effectiveDiscountPerUnit > 0,
      priceOfferRuleKey: buildPriceOfferRuleKey(ruleState.rule),
      priceOfferDiscountPerUnit: effectiveDiscountPerUnit,
      priceOfferAppliedUnits: toMoneyValue(appliedUnits),
      effectiveUnitPrice,
    }
  })
}

const applyAmountBasedFreeProductOffer = async (
  items: BillingItemInput[],
  payload: Payload,
  status: string,
  settings: CustomerRewardSettings,
  customerID: string | null,
  branchID: string | null,
  isTableOrder: boolean,
): Promise<BillingItemInput[]> => {
  const manualItems = buildSingleOfferBaseItems(items)
  const existingAmountBasedItem = items.find((item) => item.isAmountBasedFreeOfferItem)
  const existingAmountBasedProductID = getRelationshipID(existingAmountBasedItem?.product)

  if (
    status === 'cancelled' ||
    !settings.enableAmountBasedFreeProductOffer ||
    settings.amountBasedFreeProductOffers.length === 0
  ) {
    return manualItems
  }

  if (status === 'completed' && existingAmountBasedItem && existingAmountBasedProductID) {
    const productNameMap = await getProductNameMap(payload, [existingAmountBasedProductID])
    const productName =
      productNameMap[existingAmountBasedProductID] || 'Amount Based Free Product'

    return [
      ...manualItems,
      {
        ...existingAmountBasedItem,
        product: existingAmountBasedProductID,
        name: productName,
        quantity: getPositiveNumericValue(existingAmountBasedItem.quantity) || 1,
        unitPrice: 0,
        effectiveUnitPrice: 0,
        subtotal: 0,
        isOfferFreeItem: false,
        offerRuleKey: undefined,
        offerTriggerProduct: undefined,
        isPriceOfferApplied: false,
        priceOfferRuleKey: undefined,
        priceOfferDiscountPerUnit: 0,
        priceOfferAppliedUnits: 0,
        isRandomCustomerOfferItem: false,
        randomCustomerOfferCampaignCode: undefined,
        isAmountBasedFreeOfferItem: true,
      },
    ]
  }

  const grossAmount = manualItems.reduce((sum, item) => {
    if (item.status === 'cancelled') return sum
    const quantity = getPositiveNumericValue(item.quantity)
    const unitPrice = getPositiveNumericValue(item.unitPrice)
    return sum + quantity * unitPrice
  }, 0)

  const activeRules = settings.amountBasedFreeProductOffers.filter(
    (rule) =>
      rule.enabled &&
      grossAmount >= rule.minimumBillAmount &&
      isOfferAllowedByOrderType(isTableOrder, rule.allowOnTableOrders, rule.allowOnBillings) &&
      isOfferAllowedForBranch(branchID, rule.branches) &&
      canApplyRuleWithinLimits(
        rule.maxOfferCount,
        rule.offerGivenCount,
        rule.maxCustomerCount,
        rule.offerCustomerCount,
        rule.offerCustomers,
        customerID,
        rule.maxUsagePerCustomer,
        rule.offerCustomerUsage,
      ),
  )

  if (activeRules.length === 0) {
    return manualItems
  }

  const selectedRule = [...activeRules].sort((left, right) => {
    if (right.minimumBillAmount !== left.minimumBillAmount) {
      return right.minimumBillAmount - left.minimumBillAmount
    }

    return left.id.localeCompare(right.id)
  })[0]

  const productNameMap = await getProductNameMap(payload, [selectedRule.freeProduct])
  const productName = productNameMap[selectedRule.freeProduct] || 'Amount Based Free Product'
  const ruleKey = buildAmountBasedFreeOfferRuleKey(selectedRule)

  const amountOfferItem: BillingItemInput = {
    ...(existingAmountBasedItem || {}),
    product: selectedRule.freeProduct,
    status: existingAmountBasedItem?.status || 'ordered',
    name: productName,
    notes: `AMOUNT OFFER: Spend Rs ${selectedRule.minimumBillAmount} and get free product`,
    quantity: selectedRule.freeQuantity,
    unitPrice: 0,
    effectiveUnitPrice: 0,
    subtotal: 0,
    isOfferFreeItem: false,
    offerRuleKey: undefined,
    offerTriggerProduct: undefined,
    isPriceOfferApplied: false,
    priceOfferRuleKey: undefined,
    priceOfferDiscountPerUnit: 0,
    priceOfferAppliedUnits: 0,
    isRandomCustomerOfferItem: false,
    randomCustomerOfferCampaignCode: undefined,
    isAmountBasedFreeOfferItem: true,
    amountBasedFreeOfferRuleKey: ruleKey,
  }

  return [...manualItems, amountOfferItem]
}

const applyRandomCustomerProductOffer = async (
  items: BillingItemInput[],
  payload: Payload,
  status: string,
  customerPhoneNumber: string | null,
  settings: CustomerRewardSettings,
  branchID: string | null,
  isTableOrder: boolean,
): Promise<BillingItemInput[]> => {
  const nonRandomOfferItems = items.filter((item) => !item.isRandomCustomerOfferItem)
  const existingRandomOfferItem = items.find((item) => item.isRandomCustomerOfferItem)
  const existingRandomOfferProductID = getRelationshipID(existingRandomOfferItem?.product)

  if (
    status === 'cancelled' ||
    !settings.enableRandomCustomerProductOffer ||
    settings.randomCustomerOfferProducts.length === 0 ||
    !customerPhoneNumber
  ) {
    return nonRandomOfferItems
  }

  if (status === 'completed' && existingRandomOfferItem && existingRandomOfferProductID) {
    const productNameMap = await getProductNameMap(payload, [existingRandomOfferProductID])
    const productName = productNameMap[existingRandomOfferProductID] || 'Random Offer Product'
    const existingCampaignCode =
      typeof existingRandomOfferItem.randomCustomerOfferCampaignCode === 'string' &&
      existingRandomOfferItem.randomCustomerOfferCampaignCode.trim().length > 0
        ? existingRandomOfferItem.randomCustomerOfferCampaignCode.trim()
        : settings.randomCustomerOfferCampaignCode

    return [
      ...nonRandomOfferItems,
      {
        ...existingRandomOfferItem,
        product: existingRandomOfferProductID,
        name: productName,
        notes: 'RANDOM CUSTOMER OFFER',
        quantity: 1,
        unitPrice: 0,
        effectiveUnitPrice: 0,
        subtotal: 0,
        isOfferFreeItem: false,
        isPriceOfferApplied: false,
        priceOfferRuleKey: undefined,
        priceOfferDiscountPerUnit: 0,
        priceOfferAppliedUnits: 0,
        isRandomCustomerOfferItem: true,
        randomCustomerOfferCampaignCode: existingCampaignCode,
      },
    ]
  }

  const activeRandomRows = settings.randomCustomerOfferProducts.filter(
    (row) =>
      isOfferAllowedByOrderType(isTableOrder, row.allowOnTableOrders, row.allowOnBillings) &&
      isOfferAllowedForBranch(branchID, row.branches) &&
      isRandomOfferProductAvailableNow(row, settings.randomCustomerOfferTimezone),
  )

  if (activeRandomRows.length === 0) {
    return nonRandomOfferItems
  }

  const customerResult = await payload.find({
    collection: 'customers',
    where: {
      phoneNumber: {
        equals: customerPhoneNumber,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  const customer = customerResult.docs[0] as
    | {
        id?: string
      }
    | undefined

  const customerID = typeof customer?.id === 'string' ? customer.id : null
  const customerRandomKey = customerID || customerPhoneNumber

  const passesRandomSelection = (
    row: (typeof settings.randomCustomerOfferProducts)[number],
  ): boolean => {
    return isDeterministicRandomSelection(
      [settings.randomCustomerOfferCampaignCode, row.id, customerRandomKey].join('|'),
      row.randomSelectionChancePercent,
    )
  }

  const hasRemainingCapacity = (row: (typeof settings.randomCustomerOfferProducts)[number]) => {
    const hasRemainingRedeems =
      Math.max(0, row.winnerCount - toSafeNonNegativeNumber(row.redeemedCount)) > 0
    if (!hasRemainingRedeems) return false

    const maxUsagePerCustomer = toSafeNonNegativeNumber(row.maxUsagePerCustomer)
    if (maxUsagePerCustomer <= 0 || !customerID) return true

    const currentUsage = getCustomerUsageCount(row.offerCustomerUsage, customerID)
    return currentUsage < maxUsagePerCustomer
  }

  let selectedProductID: string | null = null

  if (existingRandomOfferProductID) {
    const existingRow = activeRandomRows.find((row) => row.product === existingRandomOfferProductID)
    if (existingRow && hasRemainingCapacity(existingRow)) {
      selectedProductID = existingRow.product
    }
  }

  if (!selectedProductID) {
    const eligibleRows = activeRandomRows.filter(
      (row) => hasRemainingCapacity(row) && passesRandomSelection(row),
    )
    if (eligibleRows.length === 0) {
      return nonRandomOfferItems
    }

    const randomIndex = getDeterministicIndexFromSeed(
      [settings.randomCustomerOfferCampaignCode, customerRandomKey, 'random-offer-row'].join('|'),
      eligibleRows.length,
    )
    selectedProductID = eligibleRows[randomIndex]?.product || null
  }

  if (!selectedProductID) {
    return nonRandomOfferItems
  }

  const productNameMap = await getProductNameMap(payload, [selectedProductID])
  const productName = productNameMap[selectedProductID] || 'Random Offer Product'

  const randomOfferItem: BillingItemInput = {
    ...(existingRandomOfferItem || {}),
    product: selectedProductID,
    name: productName,
    notes: 'RANDOM CUSTOMER OFFER',
    quantity: 1,
    unitPrice: 0,
    effectiveUnitPrice: 0,
    subtotal: 0,
    isOfferFreeItem: false,
    isPriceOfferApplied: false,
    priceOfferRuleKey: undefined,
    priceOfferDiscountPerUnit: 0,
    priceOfferAppliedUnits: 0,
    isRandomCustomerOfferItem: true,
    randomCustomerOfferCampaignCode: settings.randomCustomerOfferCampaignCode,
  }

  return [...nonRandomOfferItems, randomOfferItem]
}

const applyConfiguredItemOffers = async (
  items: BillingItemInput[],
  payload: Payload,
  status: string,
  customerPhoneNumber: string | null,
  branchID: string | null,
  isTableOrder: boolean,
): Promise<BillingItemInput[]> => {
  const normalizedCustomerPhoneNumber = normalizePhoneNumber(customerPhoneNumber)
  if (!normalizedCustomerPhoneNumber) {
    // All item-level offers require a customer phone number.
    return buildSingleOfferBaseItems(items)
  }

  const settings = await getCustomerRewardSettings(payload)
  const allowProductToProductOffer = isOfferAllowedByOrderType(
    isTableOrder,
    settings.allowProductToProductOfferOnTableOrders,
    settings.allowProductToProductOfferOnBillings,
  )
  const allowProductPriceOffer = isOfferAllowedByOrderType(
    isTableOrder,
    settings.allowProductPriceOfferOnTableOrders,
    settings.allowProductPriceOfferOnBillings,
  )
  const allowAmountBasedFreeProductOffer = isOfferAllowedByOrderType(
    isTableOrder,
    settings.allowAmountBasedFreeProductOfferOnTableOrders,
    settings.allowAmountBasedFreeProductOfferOnBillings,
  )
  const allowRandomProductOffer = isOfferAllowedByOrderType(
    isTableOrder,
    settings.allowRandomCustomerProductOfferOnTableOrders,
    settings.allowRandomCustomerProductOfferOnBillings,
  )

  let customerID: string | null = null
  const customerResult = await payload.find({
    collection: 'customers',
    where: {
      phoneNumber: {
        equals: normalizedCustomerPhoneNumber,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const customer = customerResult.docs[0]
  if (customer?.id) {
    customerID = customer.id
  }

  // One bill can carry only one offer type among item-level offers.
  // Priority: Product-to-product > Product price > Random product.
  const baseItems = buildSingleOfferBaseItems(items)
  const existingRandomItems = items.filter((item) => item.isRandomCustomerOfferItem)
  const existingSingleOfferType =
    (hasProductToProductOfferApplied(items) && 'product-to-product') ||
    (hasProductPriceOfferApplied(items) && 'product-price') ||
    (hasAmountBasedFreeOfferApplied(items) && 'amount-based-free') ||
    (hasRandomProductOfferApplied(items) && 'random-product') ||
    null

  const productToProductItems = allowProductToProductOffer
    ? await applyProductToProductOffers(
        items,
        payload,
        status,
        settings,
        customerID,
        branchID,
        isTableOrder,
      )
    : baseItems
  const productPriceItems = allowProductPriceOffer
    ? applyProductPriceOffers(items, status, settings, customerID, branchID, isTableOrder)
    : baseItems
  const amountBasedFreeProductItems = allowAmountBasedFreeProductOffer
    ? await applyAmountBasedFreeProductOffer(
        items,
        payload,
        status,
        settings,
        customerID,
        branchID,
        isTableOrder,
      )
    : baseItems
  const randomItems = allowRandomProductOffer
    ? await applyRandomCustomerProductOffer(
        [...baseItems, ...existingRandomItems],
        payload,
        status,
        normalizedCustomerPhoneNumber,
        settings,
        branchID,
        isTableOrder,
      )
    : baseItems

  if (status === 'completed' && existingSingleOfferType) {
    if (
      existingSingleOfferType === 'product-to-product' &&
      hasProductToProductOfferApplied(productToProductItems)
    ) {
      return productToProductItems
    }
    if (
      existingSingleOfferType === 'product-price' &&
      hasProductPriceOfferApplied(productPriceItems)
    ) {
      return productPriceItems
    }
    if (
      existingSingleOfferType === 'amount-based-free' &&
      hasAmountBasedFreeOfferApplied(amountBasedFreeProductItems)
    ) {
      return amountBasedFreeProductItems
    }
    if (existingSingleOfferType === 'random-product' && hasRandomProductOfferApplied(randomItems)) {
      return randomItems
    }
  }

  if (hasProductToProductOfferApplied(productToProductItems)) {
    return productToProductItems
  }

  if (hasProductPriceOfferApplied(productPriceItems)) {
    return productPriceItems
  }

  if (hasAmountBasedFreeOfferApplied(amountBasedFreeProductItems)) {
    return amountBasedFreeProductItems
  }

  if (hasRandomProductOfferApplied(randomItems)) {
    return randomItems
  }

  return baseItems
}

const Billings: CollectionConfig = {
  slug: 'billings',
  admin: {
    useAsTitle: 'invoiceNumber',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) =>
      user?.role != null && ['branch', 'waiter', 'superadmin'].includes(user.role),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  indexes: [
    {
      fields: ['customerDetails.phoneNumber', 'createdAt'],
    },
  ],
  endpoints: [
    {
      path: '/:id/items/preparation-time',
      method: 'get',
      handler: getItemPreparationTime,
    },
    {
      path: '/:id/items/status',
      method: 'patch',
      handler: updateItemStatus,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return
        const requestContext = getBillingRequestContext(req)
        const skipOfferRecalculation = Boolean(requestContext.skipOfferRecalculation)
        const skipInventoryValidation = Boolean(requestContext.skipInventoryValidation)

        // 🪑 Map table details from Flutter app (top-level section/tableNumber) to nested group
        const rawData = data as any
        const customerDetails = (rawData.customerDetails || {}) as {
          name?: unknown
          phoneNumber?: unknown
          address?: unknown
        }
        // Flutter can send customer fields at top level in counter billing flow.
        // Normalize them into customerDetails before offer checks.
        const topLevelCustomerName =
          typeof rawData.customerName === 'string' && rawData.customerName.trim().length > 0
            ? rawData.customerName.trim()
            : typeof rawData.name === 'string' && rawData.name.trim().length > 0
              ? rawData.name.trim()
              : null
        const topLevelCustomerPhone = normalizePhoneNumber(
          rawData.customerPhoneNumber ?? rawData.phoneNumber,
        )
        const topLevelCustomerAddress =
          typeof rawData.customerAddress === 'string' && rawData.customerAddress.trim().length > 0
            ? rawData.customerAddress.trim()
            : typeof rawData.address === 'string' && rawData.address.trim().length > 0
              ? rawData.address.trim()
              : null

        if (topLevelCustomerName || topLevelCustomerPhone || topLevelCustomerAddress) {
          data.customerDetails = {
            ...customerDetails,
            name:
              typeof customerDetails.name === 'string' && customerDetails.name.trim().length > 0
                ? customerDetails.name
                : topLevelCustomerName ?? undefined,
            phoneNumber:
              normalizePhoneNumber(customerDetails.phoneNumber) ??
              topLevelCustomerPhone ??
              undefined,
            address:
              typeof customerDetails.address === 'string' && customerDetails.address.trim().length > 0
                ? customerDetails.address
                : topLevelCustomerAddress ?? undefined,
          }
        }

        const hasTableDetails = isTableOrderBill(data as any, originalDoc as any)
        const branchID = getBranchIDFromBillingData(data as any, originalDoc as any)

        if (rawData.section || rawData.tableNumber) {
          data.tableDetails = {
            ...data.tableDetails,
            section: rawData.section || data.tableDetails?.section,
            tableNumber: rawData.tableNumber || data.tableDetails?.tableNumber,
          }
        }

        if (operation === 'create' && hasTableDetails) {
          const showCustomerDetails = await shouldShowCustomerDetailsForTableOrders(
            req.payload,
            branchID,
          )

          if (!showCustomerDetails) {
            data.customerDetails = undefined
          }
        }

        // 🎯 Ensure default status for table/KOT orders on create only.
        // Do not force-reset status during updates that omit `status` (e.g. item-only updates).
        if (
          operation === 'create' &&
          hasTableDetails &&
          (!data.status || data.status === 'pending')
        ) {
          data.status = 'ordered'
        }

        if (operation === 'create' && !hasTableDetails) {
          const normalizedCreateStatus =
            typeof data.status === 'string' ? data.status.toLowerCase() : 'pending'
          const shouldAutoCompleteBilling = [
            '',
            'pending',
            'ordered',
            'confirmed',
            'preparing',
            'prepared',
            'delivered',
          ].includes(normalizedCreateStatus)

          if (shouldAutoCompleteBilling) {
            // Counter/billing flow should finalize in one request so offer totals are immediately available.
            data.status = 'completed'
          }
        }

        // 🔄 Backward compatibility: Map legacy statuses
        if (data.status === 'pending') {
          data.status = 'ordered'
        }
        if (data.status === 'preparing') {
          data.status = 'prepared'
        }
        if (data.status === 'confirmed') {
          data.status = 'prepared'
        }

        // 🍱 Map item statuses for backward compatibility
        if (data.items && Array.isArray(data.items)) {
          data.items = data.items.map((item: any) => {
            if (item.status === 'preparing') {
              return { ...item, status: 'prepared' }
            }
            if (item.status === 'confirmed') {
              return { ...item, status: 'prepared' }
            }
            return item
          })
        }

        const mutableValidateData = data as { items?: BillingItemInput[]; status?: string }
        if (Array.isArray(mutableValidateData.items) && !skipOfferRecalculation) {
          const effectiveStatus = mutableValidateData.status || originalDoc?.status || 'ordered'
          const customerPhoneNumber =
            (data as any)?.customerDetails?.phoneNumber || originalDoc?.customerDetails?.phoneNumber
          const isTableOrder = isTableOrderBill(data as any, originalDoc as any)
          mutableValidateData.items = await applyConfiguredItemOffers(
            mutableValidateData.items,
            req.payload,
            effectiveStatus,
            customerPhoneNumber || null,
            branchID,
            isTableOrder,
          )
          requestContext.offersAppliedInBeforeValidate = true
        } else {
          requestContext.offersAppliedInBeforeValidate = false
        }

        // 1️⃣ Fix missing data for validation (Auto-set fields early)

        if (operation === 'create') {
          // 🏢 Auto-set company from branch early to pass validation
          const branchId = branchID
          if (branchId) {
            const branch = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })
            if (branch?.company) {
              data.company = typeof branch.company === 'object' ? branch.company.id : branch.company
            }
          }

          // 🧾 Placeholder for invoice number to pass validation
          if (!data.invoiceNumber) {
            data.invoiceNumber = 'TEMP-' + Date.now()
          }

          // 💰 Total amount placeholder
          if (data.totalAmount === undefined) {
            data.totalAmount = 0
          }

          const mutableCreateData = data as any
          if (mutableCreateData.grossAmount === undefined) {
            mutableCreateData.grossAmount = data.totalAmount || 0
          }
        }

        // 🛑 Inventory Validation
        if (!skipInventoryValidation && data.status !== 'cancelled') {
          const items = Array.isArray(data.items) ? (data.items as BillingItemInput[]) : []
          const branchId = getRelationshipID(data.branch || originalDoc?.branch)

          if (branchId && items.length > 0) {
            const requestedQtyByProduct = getQuantityByProduct(items)
            const existingQtyByProduct =
              operation === 'update'
                ? getQuantityByProduct((originalDoc?.items as BillingItemInput[] | undefined) || [])
                : new Map<string, number>()

            const productNameByID = new Map<string, string>()
            for (const item of items) {
              const productID = getRelationshipID(item.product)
              if (!productID) continue

              if (!productNameByID.has(productID) && typeof item.name === 'string' && item.name) {
                productNameByID.set(productID, item.name)
              }
            }

            const stockChecks = Array.from(requestedQtyByProduct.entries())
              .map(([productID, requestedQty]) => {
                const existingQty = existingQtyByProduct.get(productID) || 0
                const additionalQtyNeeded = requestedQty - existingQty
                return {
                  productID,
                  requestedQty,
                  additionalQtyNeeded,
                  existingQty,
                }
              })
              .filter((row) => row.additionalQtyNeeded > 0)

            if (stockChecks.length > 0) {
              const stockRows = await Promise.all(
                stockChecks.map(async (row) => ({
                  ...row,
                  currentStock: await getProductStock(req.payload, row.productID, branchId),
                })),
              )

              for (const row of stockRows) {
                if (row.additionalQtyNeeded > row.currentStock) {
                  console.log(
                    `[Inventory] WARNING: ${productNameByID.get(row.productID) || row.productID} (${row.requestedQty} needed, ${row.currentStock} available). Proceeding due to override.`,
                  )
                  // throw new APIError(
                  //   `Insufficient stock for ${productNameByID.get(row.productID) || row.productID}. Current stock: ${row.currentStock}, Requested: ${row.requestedQty}${operation === 'update' ? ` (Additional: ${row.additionalQtyNeeded})` : ''}`,
                  //   400,
                  // )
                }
              }
            }
          }
        }

        // 🚦 Enforce Global Linear Status Transitions
        if (
          operation === 'update' &&
          data.items &&
          Array.isArray(data.items) &&
          originalDoc?.items
        ) {
          const statusSequence = ['ordered', 'prepared', 'delivered']
          const normalizeStatus = (status?: string) => {
            if (!status || status === 'pending') return 'ordered'
            if (status === 'preparing' || status === 'confirmed') return 'prepared'
            return status
          }
          for (const item of data.items) {
            // Only validate items that existed in the original document
            const originalItems = (originalDoc.items as any[]) || []
            const originalItem = originalItems.find((oi) => oi.id === item.id)

            if (originalItem) {
              const currentStatus = normalizeStatus(originalItem.status || 'ordered')
              const newStatus = normalizeStatus(item.status || 'ordered')

              if (
                newStatus !== 'cancelled' &&
                currentStatus !== 'cancelled' &&
                currentStatus !== newStatus
              ) {
                const currentIndex = statusSequence.indexOf(currentStatus)
                const newIndex = statusSequence.indexOf(newStatus)

                if (currentIndex !== -1 && newIndex !== -1 && newIndex < currentIndex) {
                  throw new APIError(
                    `Cannot reverse status for ${item.name || 'item'} from "${currentStatus}" back to "${newStatus}".`,
                    400,
                  )
                }
              }
            }
          }
        }

        return data
      },
    ],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return

        const requestContext = getBillingRequestContext(req)
        const skipOfferRecalculation = Boolean(requestContext.skipOfferRecalculation)
        const skipPricingRecalculation = Boolean(requestContext.skipPricingRecalculation)
        const mutableData = data as { items?: BillingItemInput[]; status?: string }
        const isTableOrder = isTableOrderBill(data as any, originalDoc as any)
        const branchID = getBranchIDFromBillingData(data as any, originalDoc as any)

        if (
          Array.isArray(mutableData.items) &&
          !skipOfferRecalculation &&
          !requestContext.offersAppliedInBeforeValidate
        ) {
          const effectiveStatus = mutableData.status || originalDoc?.status || 'ordered'
          const customerPhoneNumber =
            (data as any)?.customerDetails?.phoneNumber || originalDoc?.customerDetails?.phoneNumber
          mutableData.items = await applyConfiguredItemOffers(
            mutableData.items,
            req.payload,
            effectiveStatus,
            customerPhoneNumber || null,
            branchID,
            isTableOrder,
          )
        }
        requestContext.offersAppliedInBeforeValidate = false

        // 🍱 Ensure each item has a status (Ordered by default) and timestamps
        if (data.items && Array.isArray(data.items)) {
          const now = new Date().toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
          })
          data.items = data.items.map((item: any) => {
            const status = item.status || 'ordered'
            const updatedItem = {
              ...item,
              status,
            }

            // Automatically set the timestamp for the current status if not already set
            const timestampField = `${status}At`
            if (!updatedItem[timestampField]) {
              updatedItem[timestampField] = now
            }

            return updatedItem
          })
        }

        if (
          operation === 'create' ||
          (operation === 'update' &&
            data.status === 'completed' &&
            ['ordered', 'confirmed', 'prepared', 'delivered', 'pending'].includes(
              originalDoc?.status || '',
            ))
        ) {
          // 🧾 Invoice Number generation
          const formattedDate = getBillingDateStamp()

          const status = data.status || originalDoc?.status || 'ordered'
          const isKOT = ['ordered', 'prepared', 'delivered'].includes(status)

          // Only generate a new number if it's a creation OR if we're moving out of a KOT status
          // and currently have a KOT number (or no number yet).
          const currentInvoiceNumber = data.invoiceNumber || originalDoc?.invoiceNumber
          const wasKOT = ['ordered', 'confirmed', 'prepared', 'delivered', 'pending'].includes(
            originalDoc?.status || '',
          )

          const needsNewNumber =
            operation === 'create' ||
            (data.status === 'completed' && wasKOT && currentInvoiceNumber?.includes('-KOT')) ||
            !currentInvoiceNumber

          if (needsNewNumber && (data.branch || originalDoc?.branch)) {
            let branchId: string
            const branchRef = data.branch || originalDoc.branch
            if (typeof branchRef === 'string') {
              branchId = branchRef
            } else if (typeof branchRef === 'object' && branchRef !== null) {
              branchId = branchRef.id
            } else {
              return data
            }

            const branch = await req.payload.findByID({
              collection: 'branches',
              id: branchId,
              depth: 0,
            })

            if (branch?.name) {
              const prefix = branch.name.substring(0, 3).toUpperCase()
              const dailyPrefix = `${prefix}-${formattedDate}-`

              if (isKOT) {
                // KOT Numbering: PREFIX-YYYYMMDD-KOTxx
                const kotPrefix = `${dailyPrefix}KOT`
                const seq = await getNextBillingSequence(req.payload, 'kotNumber', kotPrefix)
                const kotNum = `${prefix}-${formattedDate}-KOT${seq.toString().padStart(2, '0')}`
                data.invoiceNumber = kotNum
                data.kotNumber = kotNum
              } else {
                // Regular Numbering: PREFIX-YYYYMMDD-xxx (independent of KOT)
                const seq = await getNextBillingSequence(req.payload, 'invoiceNumber', dailyPrefix)
                data.invoiceNumber = `${prefix}-${formattedDate}-${seq.toString().padStart(3, '0')}`
              }
            }
          }
        }

        // 📝 Distribute root notes to items if applicable (e.g. "Product: Note")
        if (data.notes && data.items && Array.isArray(data.items)) {
          data.items = data.items.map((item: any) => {
            if (!item.notes && data.notes.startsWith(item.name + ':')) {
              const parts = data.notes.split(':')
              if (parts.length > 1) {
                item.notes = parts[1].trim()
              }
            } else if (!item.notes && data.items.length === 1 && !data.notes.includes(':')) {
              // If only one item and no colon, assume it's for that item
              item.notes = data.notes
            }
            return item
          })
        }

        if (skipPricingRecalculation) {
          return data
        }

        const pricingData = data as any
        const effectiveStatus = pricingData.status || originalDoc?.status || 'ordered'

        // 🧮 Final subtotal & total calculation (gross amount before customer offer)
        let calculatedGrossAmount = toSafeNonNegativeNumber(
          (originalDoc as any)?.grossAmount ?? originalDoc?.totalAmount,
        )

        if (pricingData.items && Array.isArray(pricingData.items)) {
          pricingData.items = pricingData.items.map(
            (item: {
              status?: string
              quantity: number | string
              unitPrice: number | string
              effectiveUnitPrice?: number | string
              subtotal?: number
            }) => {
              const qty =
                typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity
              const unitPrice =
                typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : item.unitPrice
              const effectiveUnitPriceRaw =
                typeof item.effectiveUnitPrice === 'string'
                  ? parseFloat(item.effectiveUnitPrice)
                  : item.effectiveUnitPrice
              const effectiveUnitPrice =
                typeof effectiveUnitPriceRaw === 'number' && Number.isFinite(effectiveUnitPriceRaw)
                  ? effectiveUnitPriceRaw
                  : unitPrice
              const isCancelled = item.status === 'cancelled'
              return {
                ...item,
                effectiveUnitPrice: toMoneyValue(
                  isCancelled ? 0 : Math.max(0, effectiveUnitPrice || 0),
                ),
                subtotal: parseFloat(
                  (
                    ((isCancelled ? 0 : qty) || 0) *
                    ((isCancelled ? 0 : effectiveUnitPrice) || 0)
                  ).toFixed(2),
                ),
              }
            },
          )

          calculatedGrossAmount = pricingData.items.reduce(
            (sum: number, item: { subtotal?: number }) => sum + (item.subtotal || 0),
            0,
          )
        }

        pricingData.grossAmount = toMoneyValue(calculatedGrossAmount)

        let offerDiscount = 0
        let offerApplied = false
        let customerEntryPercentageOfferDiscount = 0
        let customerEntryPercentageOfferApplied = false
        let totalPercentageOfferDiscount = 0
        let totalPercentageOfferApplied = false
        const rewardAlreadyProcessed = Boolean((originalDoc as any)?.customerRewardProcessed)
        const existingAppliedDiscount = toSafeNonNegativeNumber(
          (originalDoc as any)?.customerOfferDiscount,
        )
        const originalOfferWasApplied =
          Boolean((originalDoc as any)?.customerOfferApplied) && existingAppliedDiscount > 0
        const existingTotalPercentageOfferDiscount = toSafeNonNegativeNumber(
          (originalDoc as any)?.totalPercentageOfferDiscount,
        )
        const originalTotalPercentageOfferWasApplied =
          Boolean((originalDoc as any)?.totalPercentageOfferApplied) &&
          existingTotalPercentageOfferDiscount > 0
        const existingCustomerEntryPercentageOfferDiscount = toSafeNonNegativeNumber(
          (originalDoc as any)?.customerEntryPercentageOfferDiscount,
        )
        const originalCustomerEntryPercentageOfferWasApplied =
          Boolean((originalDoc as any)?.customerEntryPercentageOfferApplied) &&
          existingCustomerEntryPercentageOfferDiscount > 0
        const hasItemLevelOfferApplied =
          Array.isArray(pricingData.items) &&
          hasAnyItemLevelOfferApplied(pricingData.items as BillingItemInput[])
        const normalizedPhoneNumber = normalizePhoneNumber(
          pricingData.customerDetails?.phoneNumber || originalDoc?.customerDetails?.phoneNumber,
        )
        const hasCustomerPhone = Boolean(normalizedPhoneNumber)

        if (effectiveStatus === 'completed') {
          let settingsCache: CustomerRewardSettings | null = null
          const getSettings = async (): Promise<CustomerRewardSettings> => {
            if (!settingsCache) {
              settingsCache = await getCustomerRewardSettings(req.payload)
            }
            return settingsCache
          }

          let customerCache: any | null = null
          let customerResolved = false
          const getCustomer = async (): Promise<any | null> => {
            if (customerResolved) return customerCache
            customerResolved = true

            if (!normalizedPhoneNumber) return null

            const customerResult = await req.payload.find({
              collection: 'customers',
              where: {
                phoneNumber: {
                  equals: normalizedPhoneNumber,
                },
              },
              depth: 0,
              limit: 1,
            })

            customerCache = customerResult.docs[0] || null
            return customerCache
          }

          if (!hasCustomerPhone) {
            pricingData.applyCustomerOffer = false
          }

          if (hasItemLevelOfferApplied) {
            pricingData.applyCustomerOffer = false
          } else if (originalOfferWasApplied && hasCustomerPhone) {
            offerApplied = true
            offerDiscount = Math.min(existingAppliedDiscount, pricingData.grossAmount)
            pricingData.applyCustomerOffer = true
          } else if (pricingData.applyCustomerOffer && !rewardAlreadyProcessed && hasCustomerPhone) {
            const settings = await getSettings()

            const canUseCustomerCreditOffer = isOfferAllowedByOrderType(
              isTableOrder,
              settings.allowCustomerCreditOfferOnTableOrders,
              settings.allowCustomerCreditOfferOnBillings,
            )

            if (settings.enabled && canUseCustomerCreditOffer) {
              const isAllowedByBranch = isOfferAllowedForBranch(
                branchID,
                settings.customerCreditOfferBranches,
              )
              if (!isAllowedByBranch) {
                pricingData.applyCustomerOffer = false
              } else {
                const customer = await getCustomer()
                let rewardPoints = toSafeNonNegativeNumber(customer?.rewardPoints)
                let rewardProgressAmount = toSafeNonNegativeNumber(customer?.rewardProgressAmount)

                if (rewardPoints < settings.pointsNeededForOffer) {
                  const historySnapshot = await computeRewardSnapshotFromCompletedHistory(
                    req.payload,
                    normalizedPhoneNumber as string,
                    settings,
                  )

                  if (
                    historySnapshot.rewardPoints > rewardPoints ||
                    historySnapshot.rewardProgressAmount > rewardProgressAmount
                  ) {
                    rewardPoints = historySnapshot.rewardPoints
                    rewardProgressAmount = historySnapshot.rewardProgressAmount

                    if (customer?.id) {
                      try {
                        await req.payload.update({
                          collection: 'customers',
                          id: customer.id,
                          data: {
                            rewardPoints,
                            rewardProgressAmount,
                            isOfferEligible: rewardPoints >= settings.pointsNeededForOffer,
                          } as any,
                          depth: 0,
                          overrideAccess: true,
                        })
                      } catch (historySyncError) {
                        console.error(
                          'Failed to sync customer reward snapshot before applying credit offer.',
                          historySyncError,
                        )
                      }
                    }
                  }
                }

                if (rewardPoints >= settings.pointsNeededForOffer) {
                  offerApplied = true
                  offerDiscount = Math.min(settings.offerAmount, pricingData.grossAmount)
                }
              }
            }
          }

          const amountAfterCustomerOffer = toMoneyValue(
            Math.max(0, pricingData.grossAmount - offerDiscount),
          )

          if (originalCustomerEntryPercentageOfferWasApplied && hasCustomerPhone) {
            customerEntryPercentageOfferApplied = true
            customerEntryPercentageOfferDiscount = Math.min(
              existingCustomerEntryPercentageOfferDiscount,
              amountAfterCustomerOffer,
            )
          } else if (hasCustomerPhone) {
            const settings = await getSettings()
            const canUseCustomerEntryPercentageOffer = isOfferAllowedByOrderType(
              isTableOrder,
              settings.allowCustomerEntryPercentageOfferOnTableOrders,
              settings.allowCustomerEntryPercentageOfferOnBillings,
            )
            const isWithinCustomerEntrySchedule =
              isCustomerEntryPercentageOfferAvailableNow(settings)

            if (
              settings.enableCustomerEntryPercentageOffer &&
              settings.customerEntryPercentageOfferPercent > 0 &&
              canUseCustomerEntryPercentageOffer &&
              isOfferAllowedForBranch(branchID, settings.customerEntryPercentageOfferBranches) &&
              isWithinCustomerEntrySchedule
            ) {
              const discountAmount = toMoneyValue(
                (amountAfterCustomerOffer * settings.customerEntryPercentageOfferPercent) / 100,
              )
              customerEntryPercentageOfferDiscount = Math.min(
                amountAfterCustomerOffer,
                discountAmount,
              )
              customerEntryPercentageOfferApplied = customerEntryPercentageOfferDiscount > 0
            }
          }

          const amountAfterCustomerEntryPercentageOffer = toMoneyValue(
            Math.max(0, amountAfterCustomerOffer - customerEntryPercentageOfferDiscount),
          )

          if (!hasItemLevelOfferApplied && !offerApplied && hasCustomerPhone) {
            if (originalTotalPercentageOfferWasApplied) {
              totalPercentageOfferApplied = true
              totalPercentageOfferDiscount = Math.min(
                existingTotalPercentageOfferDiscount,
                amountAfterCustomerEntryPercentageOffer,
              )
            } else {
              const settings = await getSettings()
              const canUseTotalPercentageOffer = isOfferAllowedByOrderType(
                isTableOrder,
                settings.allowTotalPercentageOfferOnTableOrders,
                settings.allowTotalPercentageOfferOnBillings,
              )

              if (
                settings.enableTotalPercentageOffer &&
                settings.totalPercentageOfferPercent > 0 &&
                canUseTotalPercentageOffer &&
                isOfferAllowedForBranch(branchID, settings.totalPercentageOfferBranches)
              ) {
                const customer = await getCustomer()
                const customerID = typeof customer?.id === 'string' ? customer.id : null

                const canApplyPercentageOffer = canApplyRuleWithinLimits(
                  settings.totalPercentageOfferMaxOfferCount,
                  settings.totalPercentageOfferGivenCount,
                  settings.totalPercentageOfferMaxCustomerCount,
                  settings.totalPercentageOfferCustomerCount,
                  settings.totalPercentageOfferCustomers,
                  customerID,
                  settings.totalPercentageOfferMaxUsagePerCustomer,
                  settings.totalPercentageOfferCustomerUsage,
                )

                const isWithinSchedule = isTotalPercentageOfferAvailableNow(settings)
                const randomCustomerKey = customerID || normalizedPhoneNumber || null
                const randomSelectionPassed =
                  Boolean(randomCustomerKey) &&
                  isDeterministicRandomSelection(
                    [
                      'total-percentage-offer',
                      randomCustomerKey,
                      settings.totalPercentageOfferPercent,
                      settings.totalPercentageOfferRandomSelectionChancePercent,
                    ].join('|'),
                    settings.totalPercentageOfferRandomSelectionChancePercent,
                  )

                if (canApplyPercentageOffer && isWithinSchedule && randomSelectionPassed) {
                  const discountAmount = toMoneyValue(
                    (amountAfterCustomerEntryPercentageOffer *
                      settings.totalPercentageOfferPercent) /
                      100,
                  )
                  totalPercentageOfferDiscount = Math.min(
                    amountAfterCustomerEntryPercentageOffer,
                    discountAmount,
                  )
                  totalPercentageOfferApplied = totalPercentageOfferDiscount > 0
                }
              }
            }
          }
        }

        // Preview Offer 6 before completion
        if (effectiveStatus !== 'completed' && effectiveStatus !== 'cancelled') {
          const settings = await getCustomerRewardSettings(req.payload)
          const canUseCustomerEntryPercentageOffer = isOfferAllowedByOrderType(
            isTableOrder,
            settings.allowCustomerEntryPercentageOfferOnTableOrders,
            settings.allowCustomerEntryPercentageOfferOnBillings,
          )
          const isWithinCustomerEntrySchedule = isCustomerEntryPercentageOfferAvailableNow(settings)

          if (
            hasCustomerPhone &&
            settings.enableCustomerEntryPercentageOffer &&
            settings.customerEntryPercentageOfferPercent > 0 &&
            canUseCustomerEntryPercentageOffer &&
            isOfferAllowedForBranch(branchID, settings.customerEntryPercentageOfferBranches) &&
            isWithinCustomerEntrySchedule
          ) {
            const discountAmount = toMoneyValue(
              (pricingData.grossAmount * settings.customerEntryPercentageOfferPercent) / 100,
            )
            customerEntryPercentageOfferDiscount = Math.min(pricingData.grossAmount, discountAmount)
            customerEntryPercentageOfferApplied = customerEntryPercentageOfferDiscount > 0
          }
        }

        pricingData.customerOfferApplied = offerApplied
        pricingData.customerOfferDiscount = toMoneyValue(offerDiscount)
        pricingData.customerEntryPercentageOfferApplied = customerEntryPercentageOfferApplied
        pricingData.customerEntryPercentageOfferDiscount = toMoneyValue(
          customerEntryPercentageOfferDiscount,
        )
        pricingData.totalPercentageOfferApplied = totalPercentageOfferApplied
        pricingData.totalPercentageOfferDiscount = toMoneyValue(totalPercentageOfferDiscount)
        const billingItemsForTax = Array.isArray(pricingData.items)
          ? (pricingData.items as BillingItemInput[])
          : Array.isArray((originalDoc as any)?.items)
            ? ((originalDoc as any).items as BillingItemInput[])
            : []
        const totalDiscountAmount = toMoneyValue(
          pricingData.customerOfferDiscount +
            pricingData.customerEntryPercentageOfferDiscount +
            pricingData.totalPercentageOfferDiscount,
        )
        const gstBreakdown = await computeBillingGSTBreakdown(
          req.payload,
          billingItemsForTax,
          branchID,
          totalDiscountAmount,
        )
        pricingData.items = gstBreakdown.items
        pricingData.totalTaxableAmount = gstBreakdown.totalTaxableAmount
        pricingData.totalGSTAmount = gstBreakdown.totalGSTAmount
        pricingData.totalAmountBeforeRoundOff = toMoneyValue(
          gstBreakdown.totalTaxableAmount + gstBreakdown.totalGSTAmount,
        )
        pricingData.totalAmount = roundUpToRupee(pricingData.totalAmountBeforeRoundOff)
        pricingData.roundOffAmount = getRoundOffAmount(
          pricingData.totalAmount,
          pricingData.totalAmountBeforeRoundOff,
        )

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (!doc) return

        const requestContext = (req as any).context as Record<string, unknown> | undefined
        const skipCustomerRewardProcessing = Boolean(requestContext?.skipCustomerRewardProcessing)
        const skipOfferCounterProcessing = Boolean(requestContext?.skipOfferCounterProcessing)

        if (skipCustomerRewardProcessing && skipOfferCounterProcessing) {
          return doc
        }

        // Sync Customer Data
        if (operation === 'create' || operation === 'update') {
          const phoneNumber = doc.customerDetails?.phoneNumber
          const customerName = doc.customerDetails?.name
          // const address = doc.customerDetails?.address

          if (phoneNumber) {
            const finalCustomerName = customerName || phoneNumber
            try {
              let settingsCache: CustomerRewardSettings | null = null
              const getSettings = async (): Promise<CustomerRewardSettings> => {
                if (!settingsCache) {
                  settingsCache = await getCustomerRewardSettings(req.payload)
                }
                return settingsCache
              }

              // 1. Check if customer exists
              const existingCustomers = await req.payload.find({
                collection: 'customers',
                where: {
                  phoneNumber: {
                    equals: phoneNumber,
                  },
                },
                depth: 0,
                limit: 1,
              })

              let customerDoc: any

              if (existingCustomers.totalDocs > 0) {
                // 2. Update existing customer
                const customer = existingCustomers.docs[0]
                const currentBills = extractBillIDs(customer.bills)
                const customerUpdateData: Record<string, unknown> = {}

                // Add current bill if not already present
                if (!currentBills.includes(doc.id)) {
                  customerUpdateData.bills = [...currentBills, doc.id]
                }

                if (customerName && customer.name !== customerName) {
                  customerUpdateData.name = customerName
                }

                if (Object.keys(customerUpdateData).length > 0) {
                  customerDoc = await req.payload.update({
                    collection: 'customers',
                    id: customer.id,
                    data: customerUpdateData,
                    depth: 0,
                    overrideAccess: true,
                  })
                } else {
                  customerDoc = customer
                }
              } else {
                // 3. Create new customer
                customerDoc = await req.payload.create({
                  collection: 'customers',
                  data: {
                    name: finalCustomerName,
                    phoneNumber: phoneNumber,
                    bills: [doc.id],
                    rewardPoints: 0,
                    rewardProgressAmount: 0,
                    isOfferEligible: false,
                    totalOffersRedeemed: 0,
                    randomCustomerOfferAssigned: false,
                    randomCustomerOfferRedeemed: false,
                    randomCustomerOfferProduct: null,
                    randomCustomerOfferCampaignCode: null,
                    randomCustomerOfferAssignedAt: null,
                  } as any,
                  depth: 0,
                  overrideAccess: true,
                })
              }

              const randomOfferItem =
                doc.status === 'completed' && Array.isArray(doc.items)
                  ? (doc.items as any[]).find((item) => item?.isRandomCustomerOfferItem)
                  : undefined

              const shouldProcessRandomOfferRedemption =
                randomOfferItem && customerDoc?.id && !Boolean((doc as any).offerCountersProcessed)

              if (shouldProcessRandomOfferRedemption) {
                const settings = await getSettings()
                const redeemedCustomerID =
                  typeof customerDoc?.id === 'string' ? customerDoc.id : undefined
                const redeemedProductID = getRelationshipID(randomOfferItem?.product)
                const redeemedCampaignCode =
                  typeof randomOfferItem?.randomCustomerOfferCampaignCode === 'string' &&
                  randomOfferItem.randomCustomerOfferCampaignCode.trim().length > 0
                    ? randomOfferItem.randomCustomerOfferCampaignCode.trim()
                    : settings.randomCustomerOfferCampaignCode

                if (
                  redeemedProductID &&
                  redeemedCampaignCode === settings.randomCustomerOfferCampaignCode &&
                  redeemedCustomerID
                ) {
                  const assignedAt =
                    typeof customerDoc?.randomCustomerOfferAssignedAt === 'string' &&
                    customerDoc.randomCustomerOfferAssignedAt.trim().length > 0
                      ? customerDoc.randomCustomerOfferAssignedAt
                      : new Date().toISOString()

                  let rowUpdated = false
                  const updatedRandomOfferRows = settings.randomCustomerOfferProducts.map((row) => {
                    const normalizedSelectedCustomers = [
                      ...new Set(row.selectedCustomers.filter((id) => id.trim().length > 0)),
                    ]
                    const normalizedOfferCustomerUsage = row.offerCustomerUsage
                      .map((entry) => ({
                        customer: entry.customer,
                        usageCount: toSafeNonNegativeNumber(entry.usageCount),
                      }))
                      .filter(
                        (entry): entry is { customer: string; usageCount: number } =>
                          entry.customer.trim().length > 0 && entry.usageCount > 0,
                      )
                    const normalizedRedeemedCount = Math.min(
                      row.winnerCount,
                      toSafeNonNegativeNumber(row.redeemedCount),
                    )
                    const normalizedAssignedCount = Math.max(
                      toSafeNonNegativeNumber(row.assignedCount),
                      normalizedSelectedCustomers.length,
                      normalizedRedeemedCount,
                    )
                    const normalizedMaxUsagePerCustomer = toSafeNonNegativeNumber(
                      row.maxUsagePerCustomer,
                    )

                    if (rowUpdated || row.product !== redeemedProductID) {
                      return {
                        id: row.id,
                        enabled: row.enabled,
                        product: row.product,
                        winnerCount: row.winnerCount,
                        randomSelectionChancePercent: row.randomSelectionChancePercent,
                        maxUsagePerCustomer: normalizedMaxUsagePerCustomer,
                        availableFromDate: row.availableFromDate,
                        availableToDate: row.availableToDate,
                        dailyStartTime: row.dailyStartTime,
                        dailyEndTime: row.dailyEndTime,
                        selectedCustomers: normalizedSelectedCustomers,
                        assignedCount: normalizedAssignedCount,
                        redeemedCount: normalizedRedeemedCount,
                        offerCustomerUsage: normalizedOfferCustomerUsage,
                      }
                    }

                    const currentUsage = getCustomerUsageCount(
                      normalizedOfferCustomerUsage,
                      redeemedCustomerID,
                    )
                    const limitReached =
                      normalizedMaxUsagePerCustomer > 0 &&
                      currentUsage >= normalizedMaxUsagePerCustomer
                    const redeemedCapacityReached = normalizedRedeemedCount >= row.winnerCount

                    if (limitReached || redeemedCapacityReached) {
                      return {
                        id: row.id,
                        enabled: row.enabled,
                        product: row.product,
                        winnerCount: row.winnerCount,
                        randomSelectionChancePercent: row.randomSelectionChancePercent,
                        maxUsagePerCustomer: normalizedMaxUsagePerCustomer,
                        availableFromDate: row.availableFromDate,
                        availableToDate: row.availableToDate,
                        dailyStartTime: row.dailyStartTime,
                        dailyEndTime: row.dailyEndTime,
                        selectedCustomers: normalizedSelectedCustomers,
                        assignedCount: normalizedAssignedCount,
                        redeemedCount: normalizedRedeemedCount,
                        offerCustomerUsage: normalizedOfferCustomerUsage,
                      }
                    }

                    rowUpdated = true
                    const nextSelectedCustomers = normalizedSelectedCustomers.includes(
                      redeemedCustomerID,
                    )
                      ? normalizedSelectedCustomers
                      : [...normalizedSelectedCustomers, redeemedCustomerID]
                    const nextRedeemedCount = Math.min(row.winnerCount, normalizedRedeemedCount + 1)
                    const nextAssignedCount = Math.max(
                      normalizedAssignedCount,
                      nextSelectedCustomers.length,
                      nextRedeemedCount,
                    )
                    const nextOfferCustomerUsage = [...normalizedOfferCustomerUsage]
                    const usageIndex = nextOfferCustomerUsage.findIndex(
                      (entry) => entry.customer === redeemedCustomerID,
                    )
                    if (usageIndex >= 0) {
                      nextOfferCustomerUsage[usageIndex] = {
                        customer: nextOfferCustomerUsage[usageIndex].customer,
                        usageCount: nextOfferCustomerUsage[usageIndex].usageCount + 1,
                      }
                    } else {
                      nextOfferCustomerUsage.push({
                        customer: redeemedCustomerID,
                        usageCount: 1,
                      })
                    }

                    return {
                      id: row.id,
                      enabled: row.enabled,
                      allowOnBillings: row.allowOnBillings,
                      allowOnTableOrders: row.allowOnTableOrders,
                      branches: row.branches,
                      product: row.product,
                      winnerCount: row.winnerCount,
                      randomSelectionChancePercent: row.randomSelectionChancePercent,
                      maxUsagePerCustomer: normalizedMaxUsagePerCustomer,
                      availableFromDate: row.availableFromDate,
                      availableToDate: row.availableToDate,
                      dailyStartTime: row.dailyStartTime,
                      dailyEndTime: row.dailyEndTime,
                      selectedCustomers: nextSelectedCustomers,
                      assignedCount: nextAssignedCount,
                      redeemedCount: nextRedeemedCount,
                      offerCustomerUsage: nextOfferCustomerUsage,
                    }
                  })

                  if (rowUpdated) {
                    customerDoc = await req.payload.update({
                      collection: 'customers',
                      id: customerDoc.id,
                      data: {
                        randomCustomerOfferAssigned: true,
                        randomCustomerOfferRedeemed: true,
                        randomCustomerOfferProduct: redeemedProductID,
                        randomCustomerOfferCampaignCode: redeemedCampaignCode,
                        randomCustomerOfferAssignedAt: assignedAt,
                      } as any,
                      depth: 0,
                      overrideAccess: true,
                    })

                    const uniqueAwardedCustomers = [
                      ...new Set(updatedRandomOfferRows.flatMap((row) => row.selectedCustomers)),
                    ]
                    const totalRedeemedCount = updatedRandomOfferRows.reduce(
                      (sum, row) => sum + toSafeNonNegativeNumber(row.redeemedCount),
                      0,
                    )

                    await withWriteConflictRetry(() =>
                      req.payload.updateGlobal({
                        slug: 'customer-offer-settings' as any,
                        data: {
                          randomCustomerOfferAssignedCount: uniqueAwardedCustomers.length,
                          randomCustomerOfferRedeemedCount: totalRedeemedCount,
                          randomCustomerOfferLastAssignedAt: assignedAt,
                          randomCustomerOfferProducts: updatedRandomOfferRows,
                        } as any,
                        depth: 0,
                        overrideAccess: true,
                      }),
                    )
                  }
                }
              }

              const shouldProcessOfferCounters =
                !skipOfferCounterProcessing &&
                doc.status === 'completed' &&
                !Boolean((doc as any).offerCountersProcessed)

              if (shouldProcessOfferCounters) {
                try {
                  const settings = await getSettings()
                  const customerID = typeof customerDoc?.id === 'string' ? customerDoc.id : null
                  const billItems = Array.isArray(doc.items) ? (doc.items as any[]) : []

                  const p2pUsageByRule = new Map<string, number>()
                  const priceUsageByRule = new Map<string, number>()
                  const amountBasedUsageByRule = new Map<string, number>()

                  const p2pRuleByKey = new Map(
                    settings.productToProductOffers.map((rule) => [buildRuleKey(rule), rule]),
                  )

                  for (const item of billItems) {
                    if (item?.isOfferFreeItem && typeof item?.offerRuleKey === 'string') {
                      const rule = p2pRuleByKey.get(item.offerRuleKey)
                      const quantity = toSafeNonNegativeNumber(item?.quantity)
                      const divisor = rule?.freeQuantity ? Math.max(1, rule.freeQuantity) : 1
                      const increment =
                        quantity > 0 ? Math.max(1, Math.floor(quantity / divisor)) : 1
                      p2pUsageByRule.set(
                        item.offerRuleKey,
                        (p2pUsageByRule.get(item.offerRuleKey) || 0) + increment,
                      )
                    }

                    if (
                      item?.isPriceOfferApplied &&
                      !item?.isOfferFreeItem &&
                      !item?.isRandomCustomerOfferItem &&
                      typeof item?.priceOfferRuleKey === 'string'
                    ) {
                      const appliedUnits = toSafeNonNegativeNumber(item?.priceOfferAppliedUnits)
                      const quantity = toSafeNonNegativeNumber(item?.quantity)
                      const increment =
                        appliedUnits > 0 ? appliedUnits : quantity > 0 ? quantity : 1
                      priceUsageByRule.set(
                        item.priceOfferRuleKey,
                        (priceUsageByRule.get(item.priceOfferRuleKey) || 0) + increment,
                      )
                    }

                    if (
                      item?.isAmountBasedFreeOfferItem &&
                      typeof item?.amountBasedFreeOfferRuleKey === 'string'
                    ) {
                      amountBasedUsageByRule.set(
                        item.amountBasedFreeOfferRuleKey,
                        (amountBasedUsageByRule.get(item.amountBasedFreeOfferRuleKey) || 0) + 1,
                      )
                    }
                  }

                  let settingsChanged = false

                  const updatedProductToProductRules = settings.productToProductOffers.map(
                    (rule) => {
                      const key = buildRuleKey(rule)
                      const usageIncrement = p2pUsageByRule.get(key) || 0
                      const nextCustomers = [...rule.offerCustomers]
                      const nextCustomerUsage = [...rule.offerCustomerUsage]

                      if (usageIncrement > 0 && customerID && !nextCustomers.includes(customerID)) {
                        nextCustomers.push(customerID)
                      }

                      if (usageIncrement > 0 && customerID) {
                        const usageIndex = nextCustomerUsage.findIndex(
                          (entry) => entry.customer === customerID,
                        )

                        if (usageIndex >= 0) {
                          const existingUsage = nextCustomerUsage[usageIndex]
                          nextCustomerUsage[usageIndex] = {
                            customer: existingUsage.customer,
                            usageCount: existingUsage.usageCount + usageIncrement,
                          }
                        } else {
                          nextCustomerUsage.push({
                            customer: customerID,
                            usageCount: usageIncrement,
                          })
                        }
                      }

                      const nextGivenCount =
                        usageIncrement > 0
                          ? rule.offerGivenCount + usageIncrement
                          : rule.offerGivenCount
                      const nextCustomerCount = nextCustomers.length

                      if (
                        usageIncrement > 0 ||
                        nextGivenCount !== rule.offerGivenCount ||
                        nextCustomerCount !== rule.offerCustomerCount
                      ) {
                        settingsChanged = true
                      }

                      return {
                        id: rule.id,
                        enabled: rule.enabled,
                        allowOnBillings: rule.allowOnBillings,
                        allowOnTableOrders: rule.allowOnTableOrders,
                        branches: rule.branches,
                        buyProduct: rule.buyProduct,
                        buyQuantity: rule.buyQuantity,
                        freeProduct: rule.freeProduct,
                        freeQuantity: rule.freeQuantity,
                        maxOfferCount: rule.maxOfferCount,
                        maxCustomerCount: rule.maxCustomerCount,
                        maxUsagePerCustomer: rule.maxUsagePerCustomer,
                        offerGivenCount: nextGivenCount,
                        offerCustomerCount: nextCustomerCount,
                        offerCustomers: nextCustomers,
                        offerCustomerUsage: nextCustomerUsage,
                      }
                    },
                  )

                  const updatedProductPriceRules = settings.productPriceOffers.map((rule) => {
                    const key = buildPriceOfferRuleKey(rule)
                    const usageIncrement = priceUsageByRule.get(key) || 0
                    const nextCustomers = [...rule.offerCustomers]
                    const nextCustomerUsage = [...rule.offerCustomerUsage]

                    if (usageIncrement > 0 && customerID && !nextCustomers.includes(customerID)) {
                      nextCustomers.push(customerID)
                    }

                    if (usageIncrement > 0 && customerID) {
                      const usageIndex = nextCustomerUsage.findIndex(
                        (entry) => entry.customer === customerID,
                      )

                      if (usageIndex >= 0) {
                        const existingUsage = nextCustomerUsage[usageIndex]
                        nextCustomerUsage[usageIndex] = {
                          customer: existingUsage.customer,
                          usageCount: existingUsage.usageCount + usageIncrement,
                        }
                      } else {
                        nextCustomerUsage.push({
                          customer: customerID,
                          usageCount: usageIncrement,
                        })
                      }
                    }

                    const nextGivenCount =
                      usageIncrement > 0
                        ? rule.offerGivenCount + usageIncrement
                        : rule.offerGivenCount
                    const nextCustomerCount = nextCustomers.length

                    if (
                      usageIncrement > 0 ||
                      nextGivenCount !== rule.offerGivenCount ||
                      nextCustomerCount !== rule.offerCustomerCount
                    ) {
                      settingsChanged = true
                    }

                    return {
                      id: rule.id,
                      enabled: rule.enabled,
                      allowOnBillings: rule.allowOnBillings,
                      allowOnTableOrders: rule.allowOnTableOrders,
                      branches: rule.branches,
                      product: rule.product,
                      discountAmount: rule.discountAmount,
                      maxOfferCount: rule.maxOfferCount,
                      maxCustomerCount: rule.maxCustomerCount,
                      maxUsagePerCustomer: rule.maxUsagePerCustomer,
                      offerGivenCount: nextGivenCount,
                      offerCustomerCount: nextCustomerCount,
                      offerCustomers: nextCustomers,
                      offerCustomerUsage: nextCustomerUsage,
                    }
                  })

                  const updatedAmountBasedFreeProductRules =
                    settings.amountBasedFreeProductOffers.map((rule) => {
                      const key = buildAmountBasedFreeOfferRuleKey(rule)
                      const usageIncrement = amountBasedUsageByRule.get(key) || 0
                      const nextCustomers = [...rule.offerCustomers]
                      const nextCustomerUsage = [...rule.offerCustomerUsage]

                      if (usageIncrement > 0 && customerID && !nextCustomers.includes(customerID)) {
                        nextCustomers.push(customerID)
                      }

                      if (usageIncrement > 0 && customerID) {
                        const usageIndex = nextCustomerUsage.findIndex(
                          (entry) => entry.customer === customerID,
                        )

                        if (usageIndex >= 0) {
                          const existingUsage = nextCustomerUsage[usageIndex]
                          nextCustomerUsage[usageIndex] = {
                            customer: existingUsage.customer,
                            usageCount: existingUsage.usageCount + usageIncrement,
                          }
                        } else {
                          nextCustomerUsage.push({
                            customer: customerID,
                            usageCount: usageIncrement,
                          })
                        }
                      }

                      const nextGivenCount =
                        usageIncrement > 0
                          ? rule.offerGivenCount + usageIncrement
                          : rule.offerGivenCount
                      const nextCustomerCount = nextCustomers.length

                      if (
                        usageIncrement > 0 ||
                        nextGivenCount !== rule.offerGivenCount ||
                        nextCustomerCount !== rule.offerCustomerCount
                      ) {
                        settingsChanged = true
                      }

                      return {
                        id: rule.id,
                        enabled: rule.enabled,
                        allowOnBillings: rule.allowOnBillings,
                        allowOnTableOrders: rule.allowOnTableOrders,
                        branches: rule.branches,
                        minimumBillAmount: rule.minimumBillAmount,
                        freeProduct: rule.freeProduct,
                        freeQuantity: rule.freeQuantity,
                        maxOfferCount: rule.maxOfferCount,
                        maxCustomerCount: rule.maxCustomerCount,
                        maxUsagePerCustomer: rule.maxUsagePerCustomer,
                        offerGivenCount: nextGivenCount,
                        offerCustomerCount: nextCustomerCount,
                        offerCustomers: nextCustomers,
                        offerCustomerUsage: nextCustomerUsage,
                      }
                    })

                  const totalPercentageOfferUsageIncrement =
                    Boolean((doc as any).totalPercentageOfferApplied) &&
                    getPositiveNumericValue((doc as any).totalPercentageOfferDiscount) > 0
                      ? 1
                      : 0

                  const nextTotalPercentageOfferCustomers = [
                    ...settings.totalPercentageOfferCustomers,
                  ]
                  const nextTotalPercentageOfferCustomerUsage = [
                    ...settings.totalPercentageOfferCustomerUsage,
                  ]
                  if (
                    totalPercentageOfferUsageIncrement > 0 &&
                    customerID &&
                    !nextTotalPercentageOfferCustomers.includes(customerID)
                  ) {
                    nextTotalPercentageOfferCustomers.push(customerID)
                  }

                  if (totalPercentageOfferUsageIncrement > 0 && customerID) {
                    const usageIndex = nextTotalPercentageOfferCustomerUsage.findIndex(
                      (entry) => entry.customer === customerID,
                    )

                    if (usageIndex >= 0) {
                      const existingUsage = nextTotalPercentageOfferCustomerUsage[usageIndex]
                      nextTotalPercentageOfferCustomerUsage[usageIndex] = {
                        customer: existingUsage.customer,
                        usageCount: existingUsage.usageCount + totalPercentageOfferUsageIncrement,
                      }
                    } else {
                      nextTotalPercentageOfferCustomerUsage.push({
                        customer: customerID,
                        usageCount: totalPercentageOfferUsageIncrement,
                      })
                    }
                  }

                  const nextTotalPercentageOfferGivenCount =
                    totalPercentageOfferUsageIncrement > 0
                      ? settings.totalPercentageOfferGivenCount + totalPercentageOfferUsageIncrement
                      : settings.totalPercentageOfferGivenCount
                  const nextTotalPercentageOfferCustomerCount =
                    nextTotalPercentageOfferCustomers.length

                  if (
                    totalPercentageOfferUsageIncrement > 0 ||
                    nextTotalPercentageOfferGivenCount !==
                      settings.totalPercentageOfferGivenCount ||
                    nextTotalPercentageOfferCustomerCount !==
                      settings.totalPercentageOfferCustomerCount
                  ) {
                    settingsChanged = true
                  }

                  const customerEntryPercentageOfferUsageIncrement =
                    Boolean((doc as any).customerEntryPercentageOfferApplied) &&
                    getPositiveNumericValue((doc as any).customerEntryPercentageOfferDiscount) > 0
                      ? 1
                      : 0

                  const nextCustomerEntryPercentageOfferCustomers = [
                    ...settings.customerEntryPercentageOfferCustomers,
                  ]
                  const nextCustomerEntryPercentageOfferCustomerUsage = [
                    ...settings.customerEntryPercentageOfferCustomerUsage,
                  ]

                  if (
                    customerEntryPercentageOfferUsageIncrement > 0 &&
                    customerID &&
                    !nextCustomerEntryPercentageOfferCustomers.includes(customerID)
                  ) {
                    nextCustomerEntryPercentageOfferCustomers.push(customerID)
                  }

                  if (customerEntryPercentageOfferUsageIncrement > 0 && customerID) {
                    const usageIndex = nextCustomerEntryPercentageOfferCustomerUsage.findIndex(
                      (entry) => entry.customer === customerID,
                    )

                    if (usageIndex >= 0) {
                      const existingUsage =
                        nextCustomerEntryPercentageOfferCustomerUsage[usageIndex]
                      nextCustomerEntryPercentageOfferCustomerUsage[usageIndex] = {
                        customer: existingUsage.customer,
                        usageCount:
                          existingUsage.usageCount + customerEntryPercentageOfferUsageIncrement,
                      }
                    } else {
                      nextCustomerEntryPercentageOfferCustomerUsage.push({
                        customer: customerID,
                        usageCount: customerEntryPercentageOfferUsageIncrement,
                      })
                    }
                  }

                  const nextCustomerEntryPercentageOfferGivenCount =
                    customerEntryPercentageOfferUsageIncrement > 0
                      ? settings.customerEntryPercentageOfferGivenCount +
                        customerEntryPercentageOfferUsageIncrement
                      : settings.customerEntryPercentageOfferGivenCount
                  const nextCustomerEntryPercentageOfferCustomerCount =
                    nextCustomerEntryPercentageOfferCustomers.length

                  if (
                    customerEntryPercentageOfferUsageIncrement > 0 ||
                    nextCustomerEntryPercentageOfferGivenCount !==
                      settings.customerEntryPercentageOfferGivenCount ||
                    nextCustomerEntryPercentageOfferCustomerCount !==
                      settings.customerEntryPercentageOfferCustomerCount
                  ) {
                    settingsChanged = true
                  }

                  if (settingsChanged) {
                    await withWriteConflictRetry(() =>
                      req.payload.updateGlobal({
                        slug: 'customer-offer-settings' as any,
                        data: {
                          productToProductOffers: updatedProductToProductRules,
                          productPriceOffers: updatedProductPriceRules,
                          amountBasedFreeProductOffers: updatedAmountBasedFreeProductRules,
                          totalPercentageOfferGivenCount: nextTotalPercentageOfferGivenCount,
                          totalPercentageOfferCustomerCount: nextTotalPercentageOfferCustomerCount,
                          totalPercentageOfferCustomers: nextTotalPercentageOfferCustomers,
                          totalPercentageOfferCustomerUsage: nextTotalPercentageOfferCustomerUsage,
                          customerEntryPercentageOfferGivenCount:
                            nextCustomerEntryPercentageOfferGivenCount,
                          customerEntryPercentageOfferCustomerCount:
                            nextCustomerEntryPercentageOfferCustomerCount,
                          customerEntryPercentageOfferCustomers:
                            nextCustomerEntryPercentageOfferCustomers,
                          customerEntryPercentageOfferCustomerUsage:
                            nextCustomerEntryPercentageOfferCustomerUsage,
                        } as any,
                        depth: 0,
                        overrideAccess: true,
                      }),
                    )
                  }

                  const offerCounterFlagUpdated = await markBillingProcessingFlags(
                    req.payload,
                    doc.id,
                    {
                      offerCountersProcessed: true,
                    },
                    'offer counters processed',
                  )

                  if (!offerCounterFlagUpdated) {
                    console.error('Offer counters were computed, but flag update failed.', {
                      billID: doc.id,
                    })
                  }
                } catch (offerCounterError) {
                  console.error(
                    'Offer counter processing failed. Reward processing will continue.',
                    {
                      billID: doc.id,
                      error: offerCounterError,
                    },
                  )
                }
              }

              const shouldProcessRewards =
                !skipCustomerRewardProcessing &&
                doc.status === 'completed' &&
                !Boolean((doc as any).customerRewardProcessed)

              if (shouldProcessRewards) {
                const settings = await getSettings()

                if (!settings.enabled) {
                  const rewardFlagUpdated = await markBillingProcessingFlags(
                    req.payload,
                    doc.id,
                    {
                      customerRewardProcessed: true,
                      customerRewardPointsEarned: 0,
                    },
                    'reward processing skipped because offer settings are disabled',
                  )

                  if (!rewardFlagUpdated) {
                    console.error(
                      'Failed to mark reward processing as complete for disabled settings.',
                      {
                        billID: doc.id,
                      },
                    )
                  }
                  return doc
                }

                const rewardPoints = toSafeNonNegativeNumber(customerDoc?.rewardPoints)
                const rewardProgressAmount = toSafeNonNegativeNumber(
                  customerDoc?.rewardProgressAmount,
                )
                const offerDiscount = toSafeNonNegativeNumber((doc as any).customerOfferDiscount)
                const offerWasApplied =
                  Boolean((doc as any).customerOfferApplied) && offerDiscount > 0
                const grossAmount = toSafeNonNegativeNumber(
                  (doc as any).grossAmount ?? doc.totalAmount,
                )
                const shouldResetProgressWithoutCarry = offerWasApplied && settings.resetOnRedeem

                let earnedPointsForBill = 0
                let updatedRewardPoints = rewardPoints
                let updatedProgressAmount = toMoneyValue(rewardProgressAmount)

                if (shouldResetProgressWithoutCarry) {
                  updatedRewardPoints = 0
                  updatedProgressAmount = 0
                } else {
                  const totalProgressAmount = rewardProgressAmount + grossAmount
                  const { earnedPoints, consumedAmount } = calculatePointsForSpend(
                    totalProgressAmount,
                    settings.spendAmountPerStep,
                    settings.pointsPerStep,
                  )

                  earnedPointsForBill = earnedPoints
                  updatedRewardPoints = rewardPoints + earnedPoints
                  updatedProgressAmount = toMoneyValue(
                    Math.max(0, totalProgressAmount - consumedAmount),
                  )
                }

                try {
                  await withWriteConflictRetry(() =>
                    req.payload.update({
                      collection: 'customers',
                      id: customerDoc.id,
                      data: {
                        rewardPoints: updatedRewardPoints,
                        rewardProgressAmount: updatedProgressAmount,
                        isOfferEligible: updatedRewardPoints >= settings.pointsNeededForOffer,
                        totalOffersRedeemed: offerWasApplied
                          ? toSafeNonNegativeNumber(customerDoc?.totalOffersRedeemed) + 1
                          : toSafeNonNegativeNumber(customerDoc?.totalOffersRedeemed),
                      } as any,
                      depth: 0,
                      overrideAccess: true,
                    }),
                  )
                } catch (customerRewardUpdateError) {
                  console.error('Failed to update customer reward snapshot.', {
                    billID: doc.id,
                    customerID: customerDoc?.id,
                    phoneNumber,
                    error: customerRewardUpdateError,
                  })
                  throw customerRewardUpdateError
                }

                const rewardFlagUpdated = await markBillingProcessingFlags(
                  req.payload,
                  doc.id,
                  {
                    customerRewardProcessed: true,
                    customerRewardPointsEarned: earnedPointsForBill,
                  },
                  'reward processing complete',
                )

                if (!rewardFlagUpdated) {
                  console.error(
                    'Customer reward update succeeded, but billing reward flag update failed.',
                    {
                      billID: doc.id,
                      customerID: customerDoc?.id,
                    },
                  )
                }
              }
            } catch (error) {
              console.error('Error syncing customer data:', error)
            }
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'invoiceNumber',
      type: 'text',
      unique: true,
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'kotNumber',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      label: 'KOT Invoice Number',
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'ordered',
          options: [
            { label: 'Ordered', value: 'ordered' },
            { label: 'Prepared', value: 'prepared' },
            { label: 'Delivered', value: 'delivered' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
          admin: {
            condition: (data) => ['ordered', 'prepared', 'delivered'].includes(data.status),
          },
        },

        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'notes',
          type: 'text',
          label: 'Instructions',
          admin: {
            placeholder: 'e.g., More sugar, Less spicy',
          },
        },
        {
          // ✅ Fractional quantities (e.g. 0.5 kg)
          name: 'quantity',
          type: 'number',
          required: true,
          min: 0.01,
          validate: (val?: number | null) => {
            if (typeof val !== 'number' || val <= 0) {
              return 'Quantity must be greater than 0'
            }
            return true
          },
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          // ✅ Calculated automatically
          name: 'subtotal',
          type: 'number',
          required: true,
          min: 0,
          admin: { readOnly: true },
        },
        {
          name: 'gstRate',
          type: 'number',
          min: 0,
          max: 100,
          admin: {
            readOnly: true,
            description: 'GST percentage applied for this item.',
          },
        },
        {
          name: 'taxableAmount',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            description: 'Taxable portion of this line after bill-level discounts.',
          },
        },
        {
          name: 'gstAmount',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            description: 'GST amount included in this line after bill-level discounts.',
          },
        },
        {
          name: 'finalLineTotal',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            description: 'Final payable total for this line (inclusive of GST).',
          },
        },
        {
          name: 'isOfferFreeItem',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'offerRuleKey',
          type: 'text',
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'offerTriggerProduct',
          type: 'relationship',
          relationTo: 'products',
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'isPriceOfferApplied',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'priceOfferRuleKey',
          type: 'text',
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'priceOfferDiscountPerUnit',
          type: 'number',
          min: 0,
          defaultValue: 0,
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'priceOfferAppliedUnits',
          type: 'number',
          min: 0,
          defaultValue: 0,
          admin: {
            readOnly: true,
            position: 'sidebar',
            description: 'Actual quantity that received price offer discount.',
          },
        },
        {
          name: 'effectiveUnitPrice',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            position: 'sidebar',
            description: 'Final unit price after product price offer discount.',
          },
        },
        {
          name: 'isRandomCustomerOfferItem',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'isAmountBasedFreeOfferItem',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'amountBasedFreeOfferRuleKey',
          type: 'text',
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'randomCustomerOfferCampaignCode',
          type: 'text',
          admin: {
            readOnly: true,
            position: 'sidebar',
          },
        },
        {
          name: 'orderedAt',
          type: 'text',
          admin: { readOnly: true, position: 'sidebar' },
        },
        {
          name: 'confirmedAt',
          type: 'text',
          admin: { readOnly: true, position: 'sidebar' },
        },
        {
          name: 'preparedAt',
          type: 'text',
          admin: { readOnly: true, position: 'sidebar' },
        },
        {
          name: 'deliveredAt',
          type: 'text',
          admin: { readOnly: true, position: 'sidebar' },
        },
        {
          name: 'cancelledAt',
          type: 'text',
          admin: { readOnly: true, position: 'sidebar' },
        },

        {
          name: 'branchOverride',
          type: 'checkbox',
          label: 'Branch-Specific Override Applied',
        },
      ],
    },
    {
      name: 'grossAmount',
      type: 'number',
      min: 0,
      admin: {
        readOnly: true,
        description: 'Total before customer/percentage discounts.',
      },
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        readOnly: true,
        description: 'Final payable total after all configured discounts.',
      },
    },
    {
      name: 'totalAmountBeforeRoundOff',
      type: 'number',
      min: 0,
      admin: {
        readOnly: true,
        description: 'Final payable amount before rupee round-off.',
      },
    },
    {
      name: 'roundOffAmount',
      type: 'number',
      min: 0,
      admin: {
        readOnly: true,
        description: 'Round-up difference added to final amount.',
      },
    },
    {
      name: 'totalTaxableAmount',
      type: 'number',
      min: 0,
      admin: {
        readOnly: true,
        description: 'Total taxable value across all billed products.',
      },
    },
    {
      name: 'totalGSTAmount',
      type: 'number',
      min: 0,
      admin: {
        readOnly: true,
        description: 'Total GST amount across all billed products.',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'createdBy',
          type: 'relationship',
          relationTo: 'users',
          required: true,
          defaultValue: ({ user }) => user?.id,
          admin: { readOnly: true },
        },
        {
          name: 'paymentMethod',
          type: 'select',
          admin: {
            width: '50%',
          },
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'Card', value: 'card' },
            { label: 'UPI', value: 'upi' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'applyCustomerOffer',
          type: 'checkbox',
          label: 'Apply Customer Offer',
          defaultValue: false,
          admin: {
            width: '50%',
            description:
              'Apply configured offer if customer has required points. Offer can be used only once before earning again.',
          },
        },
      ],
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'customerDetails',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'phoneNumber', type: 'text' },
        { name: 'address', type: 'text' },
      ],
    },

    {
      name: 'status',
      type: 'select',
      defaultValue: 'ordered',
      options: [
        { label: 'Ordered', value: 'ordered' },
        { label: 'Prepared', value: 'prepared' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'customerOfferApplied',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'customerOfferDiscount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'customerEntryPercentageOfferApplied',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'customerEntryPercentageOfferDiscount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'totalPercentageOfferApplied',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'totalPercentageOfferDiscount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'customerRewardPointsEarned',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'customerRewardProcessed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'offerCountersProcessed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },

    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'tableDetails',
      type: 'group',
      fields: [
        {
          name: 'section',
          type: 'text',
          admin: {
            placeholder: 'e.g., AC, Non-AC',
          },
        },
        {
          name: 'tableNumber',
          type: 'text',
          admin: {
            placeholder: 'e.g., 01, 10',
          },
        },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'billDetailView',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/BillDetailView/index.tsx#default',
        },
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}

export default Billings
