import type { Payload } from 'payload'

export const DEFAULT_RANDOM_OFFER_TIMEZONE = 'Asia/Kolkata'
export const DEFAULT_RANDOM_OFFER_SELECTION_CHANCE_PERCENT = 50

export type CustomerRewardSettings = {
  enabled: boolean
  allowCustomerCreditOfferOnTableOrders: boolean
  allowCustomerCreditOfferOnBillings: boolean
  customerCreditOfferBranches: string[]
  spendAmountPerStep: number
  pointsPerStep: number
  pointsNeededForOffer: number
  offerAmount: number
  resetOnRedeem: boolean
  enableProductToProductOffer: boolean
  allowProductToProductOfferOnTableOrders: boolean
  allowProductToProductOfferOnBillings: boolean
  productToProductOffers: ProductToProductOfferRule[]
  enableProductPriceOffer: boolean
  allowProductPriceOfferOnTableOrders: boolean
  allowProductPriceOfferOnBillings: boolean
  productPriceOffers: ProductPriceOfferRule[]
  enableRandomCustomerProductOffer: boolean
  allowRandomCustomerProductOfferOnTableOrders: boolean
  allowRandomCustomerProductOfferOnBillings: boolean
  randomCustomerOfferTimezone: string
  randomCustomerOfferProducts: RandomCustomerOfferProductRule[]
  randomCustomerOfferCampaignCode: string
  randomCustomerOfferRedeemedCount: number
  enableTotalPercentageOffer: boolean
  allowTotalPercentageOfferOnTableOrders: boolean
  allowTotalPercentageOfferOnBillings: boolean
  totalPercentageOfferBranches: string[]
  totalPercentageOfferPercent: number
  totalPercentageOfferMaxOfferCount: number
  totalPercentageOfferMaxCustomerCount: number
  totalPercentageOfferMaxUsagePerCustomer: number
  totalPercentageOfferRandomOnly: boolean
  totalPercentageOfferRandomSelectionChancePercent: number
  totalPercentageOfferTimezone: string
  totalPercentageOfferAvailableFromDate: string | null
  totalPercentageOfferAvailableToDate: string | null
  totalPercentageOfferDailyStartTime: string | null
  totalPercentageOfferDailyEndTime: string | null
  totalPercentageOfferGivenCount: number
  totalPercentageOfferCustomerCount: number
  totalPercentageOfferCustomers: string[]
  totalPercentageOfferCustomerUsage: OfferCustomerUsageCounter[]
  enableCustomerEntryPercentageOffer: boolean
  allowCustomerEntryPercentageOfferOnTableOrders: boolean
  allowCustomerEntryPercentageOfferOnBillings: boolean
  customerEntryPercentageOfferBranches: string[]
  customerEntryPercentageOfferPercent: number
  customerEntryPercentageOfferTimezone: string
  customerEntryPercentageOfferAvailableFromDate: string | null
  customerEntryPercentageOfferAvailableToDate: string | null
  customerEntryPercentageOfferDailyStartTime: string | null
  customerEntryPercentageOfferDailyEndTime: string | null
  customerEntryPercentageOfferGivenCount: number
  customerEntryPercentageOfferCustomerCount: number
  customerEntryPercentageOfferCustomers: string[]
  customerEntryPercentageOfferCustomerUsage: OfferCustomerUsageCounter[]
}

export type ProductToProductOfferRule = {
  id: string
  enabled: boolean
  allowOnTableOrders: boolean
  allowOnBillings: boolean
  branches: string[]
  buyProduct: string
  buyQuantity: number
  freeProduct: string
  freeQuantity: number
  maxOfferCount: number
  maxCustomerCount: number
  maxUsagePerCustomer: number
  offerGivenCount: number
  offerCustomerCount: number
  offerCustomers: string[]
  offerCustomerUsage: OfferCustomerUsageCounter[]
}

export type OfferCustomerUsageCounter = {
  customer: string
  usageCount: number
}

export type ProductPriceOfferRule = {
  id: string
  enabled: boolean
  allowOnTableOrders: boolean
  allowOnBillings: boolean
  branches: string[]
  product: string
  discountAmount: number
  maxOfferCount: number
  maxCustomerCount: number
  maxUsagePerCustomer: number
  offerGivenCount: number
  offerCustomerCount: number
  offerCustomers: string[]
  offerCustomerUsage: OfferCustomerUsageCounter[]
}

export type RandomCustomerOfferProductRule = {
  id: string
  enabled: boolean
  allowOnTableOrders: boolean
  allowOnBillings: boolean
  branches: string[]
  product: string
  winnerCount: number
  randomSelectionChancePercent: number
  maxUsagePerCustomer: number
  availableFromDate: string | null
  availableToDate: string | null
  dailyStartTime: string | null
  dailyEndTime: string | null
  assignedCount: number
  redeemedCount: number
  selectedCustomers: string[]
  offerCustomerUsage: OfferCustomerUsageCounter[]
}

export const DEFAULT_CUSTOMER_REWARD_SETTINGS: CustomerRewardSettings = {
  enabled: true,
  allowCustomerCreditOfferOnTableOrders: true,
  allowCustomerCreditOfferOnBillings: true,
  customerCreditOfferBranches: [],
  spendAmountPerStep: 1000,
  pointsPerStep: 10,
  pointsNeededForOffer: 50,
  offerAmount: 50,
  resetOnRedeem: true,
  enableProductToProductOffer: false,
  allowProductToProductOfferOnTableOrders: true,
  allowProductToProductOfferOnBillings: true,
  productToProductOffers: [],
  enableProductPriceOffer: false,
  allowProductPriceOfferOnTableOrders: true,
  allowProductPriceOfferOnBillings: true,
  productPriceOffers: [],
  enableRandomCustomerProductOffer: false,
  allowRandomCustomerProductOfferOnTableOrders: true,
  allowRandomCustomerProductOfferOnBillings: true,
  randomCustomerOfferTimezone: DEFAULT_RANDOM_OFFER_TIMEZONE,
  randomCustomerOfferProducts: [],
  randomCustomerOfferCampaignCode: 'campaign-1',
  randomCustomerOfferRedeemedCount: 0,
  enableTotalPercentageOffer: false,
  allowTotalPercentageOfferOnTableOrders: true,
  allowTotalPercentageOfferOnBillings: true,
  totalPercentageOfferBranches: [],
  totalPercentageOfferPercent: 5,
  totalPercentageOfferMaxOfferCount: 0,
  totalPercentageOfferMaxCustomerCount: 0,
  totalPercentageOfferMaxUsagePerCustomer: 0,
  totalPercentageOfferRandomOnly: true,
  totalPercentageOfferRandomSelectionChancePercent: 50,
  totalPercentageOfferTimezone: DEFAULT_RANDOM_OFFER_TIMEZONE,
  totalPercentageOfferAvailableFromDate: null,
  totalPercentageOfferAvailableToDate: null,
  totalPercentageOfferDailyStartTime: null,
  totalPercentageOfferDailyEndTime: null,
  totalPercentageOfferGivenCount: 0,
  totalPercentageOfferCustomerCount: 0,
  totalPercentageOfferCustomers: [],
  totalPercentageOfferCustomerUsage: [],
  enableCustomerEntryPercentageOffer: false,
  allowCustomerEntryPercentageOfferOnTableOrders: true,
  allowCustomerEntryPercentageOfferOnBillings: true,
  customerEntryPercentageOfferBranches: [],
  customerEntryPercentageOfferPercent: 5,
  customerEntryPercentageOfferTimezone: DEFAULT_RANDOM_OFFER_TIMEZONE,
  customerEntryPercentageOfferAvailableFromDate: null,
  customerEntryPercentageOfferAvailableToDate: null,
  customerEntryPercentageOfferDailyStartTime: null,
  customerEntryPercentageOfferDailyEndTime: null,
  customerEntryPercentageOfferGivenCount: 0,
  customerEntryPercentageOfferCustomerCount: 0,
  customerEntryPercentageOfferCustomers: [],
  customerEntryPercentageOfferCustomerUsage: [],
}

const toPositiveNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

const toNonNegativeNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback
  }
  return value
}

const toChancePercent = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(100, Math.max(0, value))
}

const isValidTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

const normalizeTimezone = (
  value: unknown,
  fallback = DEFAULT_RANDOM_OFFER_TIMEZONE,
): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback
  }

  const trimmedValue = value.trim()
  return isValidTimezone(trimmedValue) ? trimmedValue : fallback
}

const normalizeDateString = (value: unknown): string | null => {
  if (!value) return null

  const dateValue = new Date(String(value))
  if (Number.isNaN(dateValue.getTime())) {
    return null
  }

  return dateValue.toISOString()
}

const normalizeTimeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null

  return `${match[1].padStart(2, '0')}:${match[2]}`
}

const toDateKeyInTimezone = (value: unknown, timezone: string): string | null => {
  const normalizedDate = normalizeDateString(value)
  if (!normalizedDate) return null

  const dateValue = new Date(normalizedDate)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(dateValue)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

const toCurrentDateAndMinutesInTimezone = (
  timezone: string,
  now: Date,
): { dateKey: string; minutes: number } | null => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  const hour = parts.find((part) => part.type === 'hour')?.value
  const minute = parts.find((part) => part.type === 'minute')?.value

  if (!year || !month || !day || !hour || !minute) return null

  const parsedHour = parseInt(hour, 10)
  const parsedMinute = parseInt(minute, 10)
  if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) return null

  return {
    dateKey: `${year}-${month}-${day}`,
    minutes: parsedHour * 60 + parsedMinute,
  }
}

const toMinutes = (value: string | null): number | null => {
  if (!value) return null
  const [hourPart, minutePart] = value.split(':')
  const hour = parseInt(hourPart, 10)
  const minute = parseInt(minutePart, 10)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

const isWithinDailyWindow = (
  currentMinutes: number,
  startMinutes: number | null,
  endMinutes: number | null,
): boolean => {
  if (startMinutes == null && endMinutes == null) return true
  if (startMinutes != null && endMinutes == null) return currentMinutes >= startMinutes
  if (startMinutes == null && endMinutes != null) return currentMinutes < endMinutes
  if (startMinutes === endMinutes) return true
  if ((startMinutes as number) < (endMinutes as number)) {
    return currentMinutes >= (startMinutes as number) && currentMinutes < (endMinutes as number)
  }
  return currentMinutes >= (startMinutes as number) || currentMinutes < (endMinutes as number)
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

const normalizeRelationshipIDs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  const ids = value
    .map((entry) => getRelationshipID(entry))
    .filter((id): id is string => typeof id === 'string')

  return Array.from(new Set(ids))
}

const normalizeOfferCustomerUsage = (value: unknown): OfferCustomerUsageCounter[] => {
  if (!Array.isArray(value)) return []

  const usageByCustomer = new Map<string, number>()

  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const rawRow = row as Record<string, unknown>
    const customerID = getRelationshipID(rawRow.customer)
    if (!customerID) continue

    const usageCount = toNonNegativeNumber(rawRow.usageCount, 0)
    usageByCustomer.set(customerID, (usageByCustomer.get(customerID) || 0) + usageCount)
  }

  return Array.from(usageByCustomer.entries()).map(([customer, usageCount]) => ({
    customer,
    usageCount,
  }))
}

const normalizeProductOfferRules = (value: unknown): ProductToProductOfferRule[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((rule, index) => {
      const rawRule = (rule || {}) as Record<string, unknown>
      const buyProduct = getRelationshipID(rawRule.buyProduct)
      const freeProduct = getRelationshipID(rawRule.freeProduct)

      if (!buyProduct || !freeProduct) return null

      const idFromRow = typeof rawRule.id === 'string' ? rawRule.id : null

      return {
        id: idFromRow || `rule-${index + 1}`,
        enabled: typeof rawRule.enabled === 'boolean' ? rawRule.enabled : true,
        allowOnTableOrders:
          typeof rawRule.allowOnTableOrders === 'boolean' ? rawRule.allowOnTableOrders : true,
        allowOnBillings:
          typeof rawRule.allowOnBillings === 'boolean' ? rawRule.allowOnBillings : true,
        branches: normalizeRelationshipIDs(rawRule.branches),
        buyProduct,
        buyQuantity: toPositiveNumber(rawRule.buyQuantity, 1),
        freeProduct,
        freeQuantity: toPositiveNumber(rawRule.freeQuantity, 1),
        maxOfferCount: toNonNegativeNumber(rawRule.maxOfferCount, 0),
        maxCustomerCount: toNonNegativeNumber(rawRule.maxCustomerCount, 0),
        maxUsagePerCustomer: toNonNegativeNumber(rawRule.maxUsagePerCustomer, 0),
        offerGivenCount: toNonNegativeNumber(rawRule.offerGivenCount, 0),
        offerCustomerCount: toNonNegativeNumber(rawRule.offerCustomerCount, 0),
        offerCustomers: Array.isArray(rawRule.offerCustomers)
          ? rawRule.offerCustomers
              .map((entry) => getRelationshipID(entry))
              .filter((id): id is string => typeof id === 'string')
          : [],
        offerCustomerUsage: normalizeOfferCustomerUsage(rawRule.offerCustomerUsage),
      }
    })
    .filter((rule): rule is ProductToProductOfferRule => Boolean(rule))
}

const normalizeProductPriceOfferRules = (value: unknown): ProductPriceOfferRule[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((rule, index) => {
      const rawRule = (rule || {}) as Record<string, unknown>
      const product = getRelationshipID(rawRule.product)
      if (!product) return null

      const idFromRow = typeof rawRule.id === 'string' ? rawRule.id : null

      return {
        id: idFromRow || `price-rule-${index + 1}`,
        enabled: typeof rawRule.enabled === 'boolean' ? rawRule.enabled : true,
        allowOnTableOrders:
          typeof rawRule.allowOnTableOrders === 'boolean' ? rawRule.allowOnTableOrders : true,
        allowOnBillings:
          typeof rawRule.allowOnBillings === 'boolean' ? rawRule.allowOnBillings : true,
        branches: normalizeRelationshipIDs(rawRule.branches),
        product,
        discountAmount: toPositiveNumber(rawRule.discountAmount, 1),
        maxOfferCount: toNonNegativeNumber(rawRule.maxOfferCount, 0),
        maxCustomerCount: toNonNegativeNumber(rawRule.maxCustomerCount, 0),
        maxUsagePerCustomer: toNonNegativeNumber(rawRule.maxUsagePerCustomer, 0),
        offerGivenCount: toNonNegativeNumber(rawRule.offerGivenCount, 0),
        offerCustomerCount: toNonNegativeNumber(rawRule.offerCustomerCount, 0),
        offerCustomers: Array.isArray(rawRule.offerCustomers)
          ? rawRule.offerCustomers
              .map((entry) => getRelationshipID(entry))
              .filter((id): id is string => typeof id === 'string')
          : [],
        offerCustomerUsage: normalizeOfferCustomerUsage(rawRule.offerCustomerUsage),
      }
    })
    .filter((rule): rule is ProductPriceOfferRule => Boolean(rule))
}

const normalizeRandomCustomerOfferProductRules = (value: unknown): RandomCustomerOfferProductRule[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((row, index) => {
      const rawRow = (row || {}) as Record<string, unknown>
      const product = getRelationshipID(rawRow.product)
      if (!product) return null

      const idFromRow = typeof rawRow.id === 'string' ? rawRow.id : null
      const selectedCustomers = Array.isArray(rawRow.selectedCustomers)
        ? rawRow.selectedCustomers
            .map((entry) => getRelationshipID(entry))
            .filter((id): id is string => typeof id === 'string')
        : []

      return {
        id: idFromRow || `random-product-${index + 1}`,
        enabled: typeof rawRow.enabled === 'boolean' ? rawRow.enabled : true,
        allowOnTableOrders:
          typeof rawRow.allowOnTableOrders === 'boolean' ? rawRow.allowOnTableOrders : true,
        allowOnBillings:
          typeof rawRow.allowOnBillings === 'boolean' ? rawRow.allowOnBillings : true,
        branches: normalizeRelationshipIDs(rawRow.branches),
        product,
        winnerCount: toPositiveNumber(rawRow.winnerCount, 1),
        randomSelectionChancePercent: toChancePercent(
          rawRow.randomSelectionChancePercent,
          DEFAULT_RANDOM_OFFER_SELECTION_CHANCE_PERCENT,
        ),
        maxUsagePerCustomer: toNonNegativeNumber(rawRow.maxUsagePerCustomer, 1),
        availableFromDate: normalizeDateString(rawRow.availableFromDate),
        availableToDate: normalizeDateString(rawRow.availableToDate),
        dailyStartTime: normalizeTimeString(rawRow.dailyStartTime),
        dailyEndTime: normalizeTimeString(rawRow.dailyEndTime),
        assignedCount: typeof rawRow.assignedCount === 'number' ? Math.max(0, rawRow.assignedCount) : 0,
        redeemedCount: typeof rawRow.redeemedCount === 'number' ? Math.max(0, rawRow.redeemedCount) : 0,
        selectedCustomers,
        offerCustomerUsage: normalizeOfferCustomerUsage(rawRow.offerCustomerUsage),
      }
    })
    .filter((row): row is RandomCustomerOfferProductRule => Boolean(row))
}

const normalizeCustomerRewardSettings = (settings: unknown): CustomerRewardSettings => {
  const raw = (settings || {}) as Record<string, unknown>

  return {
    enabled:
      typeof raw.enabled === 'boolean'
        ? raw.enabled
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.enabled,
    allowCustomerCreditOfferOnTableOrders:
      typeof raw.allowCustomerCreditOfferOnTableOrders === 'boolean'
        ? raw.allowCustomerCreditOfferOnTableOrders
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowCustomerCreditOfferOnTableOrders,
    allowCustomerCreditOfferOnBillings:
      typeof raw.allowCustomerCreditOfferOnBillings === 'boolean'
        ? raw.allowCustomerCreditOfferOnBillings
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowCustomerCreditOfferOnBillings,
    customerCreditOfferBranches: normalizeRelationshipIDs(raw.customerCreditOfferBranches),
    spendAmountPerStep: toPositiveNumber(
      raw.spendAmountPerStep,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.spendAmountPerStep,
    ),
    pointsPerStep: toPositiveNumber(raw.pointsPerStep, DEFAULT_CUSTOMER_REWARD_SETTINGS.pointsPerStep),
    pointsNeededForOffer: toPositiveNumber(
      raw.pointsNeededForOffer,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.pointsNeededForOffer,
    ),
    offerAmount: toPositiveNumber(raw.offerAmount, DEFAULT_CUSTOMER_REWARD_SETTINGS.offerAmount),
    resetOnRedeem:
      typeof raw.resetOnRedeem === 'boolean'
        ? raw.resetOnRedeem
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.resetOnRedeem,
    enableProductToProductOffer:
      typeof raw.enableProductToProductOffer === 'boolean'
        ? raw.enableProductToProductOffer
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.enableProductToProductOffer,
    allowProductToProductOfferOnTableOrders:
      typeof raw.allowProductToProductOfferOnTableOrders === 'boolean'
        ? raw.allowProductToProductOfferOnTableOrders
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowProductToProductOfferOnTableOrders,
    allowProductToProductOfferOnBillings:
      typeof raw.allowProductToProductOfferOnBillings === 'boolean'
        ? raw.allowProductToProductOfferOnBillings
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowProductToProductOfferOnBillings,
    productToProductOffers: normalizeProductOfferRules(raw.productToProductOffers),
    enableProductPriceOffer:
      typeof raw.enableProductPriceOffer === 'boolean'
        ? raw.enableProductPriceOffer
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.enableProductPriceOffer,
    allowProductPriceOfferOnTableOrders:
      typeof raw.allowProductPriceOfferOnTableOrders === 'boolean'
        ? raw.allowProductPriceOfferOnTableOrders
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowProductPriceOfferOnTableOrders,
    allowProductPriceOfferOnBillings:
      typeof raw.allowProductPriceOfferOnBillings === 'boolean'
        ? raw.allowProductPriceOfferOnBillings
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowProductPriceOfferOnBillings,
    productPriceOffers: normalizeProductPriceOfferRules(raw.productPriceOffers),
    enableRandomCustomerProductOffer:
      typeof raw.enableRandomCustomerProductOffer === 'boolean'
        ? raw.enableRandomCustomerProductOffer
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.enableRandomCustomerProductOffer,
    allowRandomCustomerProductOfferOnTableOrders:
      typeof raw.allowRandomCustomerProductOfferOnTableOrders === 'boolean'
        ? raw.allowRandomCustomerProductOfferOnTableOrders
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowRandomCustomerProductOfferOnTableOrders,
    allowRandomCustomerProductOfferOnBillings:
      typeof raw.allowRandomCustomerProductOfferOnBillings === 'boolean'
        ? raw.allowRandomCustomerProductOfferOnBillings
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowRandomCustomerProductOfferOnBillings,
    randomCustomerOfferTimezone: normalizeTimezone(
      raw.randomCustomerOfferTimezone,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferTimezone,
    ),
    randomCustomerOfferProducts: normalizeRandomCustomerOfferProductRules(raw.randomCustomerOfferProducts),
    randomCustomerOfferCampaignCode:
      typeof raw.randomCustomerOfferCampaignCode === 'string' &&
      raw.randomCustomerOfferCampaignCode.trim().length > 0
        ? raw.randomCustomerOfferCampaignCode.trim()
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferCampaignCode,
    randomCustomerOfferRedeemedCount: toPositiveNumber(raw.randomCustomerOfferRedeemedCount, 0),
    enableTotalPercentageOffer:
      typeof raw.enableTotalPercentageOffer === 'boolean'
        ? raw.enableTotalPercentageOffer
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.enableTotalPercentageOffer,
    allowTotalPercentageOfferOnTableOrders:
      typeof raw.allowTotalPercentageOfferOnTableOrders === 'boolean'
        ? raw.allowTotalPercentageOfferOnTableOrders
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowTotalPercentageOfferOnTableOrders,
    allowTotalPercentageOfferOnBillings:
      typeof raw.allowTotalPercentageOfferOnBillings === 'boolean'
        ? raw.allowTotalPercentageOfferOnBillings
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowTotalPercentageOfferOnBillings,
    totalPercentageOfferBranches: normalizeRelationshipIDs(raw.totalPercentageOfferBranches),
    totalPercentageOfferPercent: toPositiveNumber(
      raw.totalPercentageOfferPercent,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferPercent,
    ),
    totalPercentageOfferMaxOfferCount: toNonNegativeNumber(
      raw.totalPercentageOfferMaxOfferCount,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferMaxOfferCount,
    ),
    totalPercentageOfferMaxCustomerCount: toNonNegativeNumber(
      raw.totalPercentageOfferMaxCustomerCount,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferMaxCustomerCount,
    ),
    totalPercentageOfferMaxUsagePerCustomer: toNonNegativeNumber(
      raw.totalPercentageOfferMaxUsagePerCustomer,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferMaxUsagePerCustomer,
    ),
    // Offer 5 is always random-only.
    totalPercentageOfferRandomOnly: true,
    totalPercentageOfferRandomSelectionChancePercent: Math.min(
      100,
      Math.max(
        0,
        toPositiveNumber(
          raw.totalPercentageOfferRandomSelectionChancePercent,
          DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferRandomSelectionChancePercent,
        ),
      ),
    ),
    // Offer 5 timezone is fixed to the default timezone.
    totalPercentageOfferTimezone: DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferTimezone,
    totalPercentageOfferAvailableFromDate: normalizeDateString(
      raw.totalPercentageOfferAvailableFromDate,
    ),
    totalPercentageOfferAvailableToDate: normalizeDateString(raw.totalPercentageOfferAvailableToDate),
    totalPercentageOfferDailyStartTime: normalizeTimeString(raw.totalPercentageOfferDailyStartTime),
    totalPercentageOfferDailyEndTime: normalizeTimeString(raw.totalPercentageOfferDailyEndTime),
    totalPercentageOfferGivenCount: toNonNegativeNumber(
      raw.totalPercentageOfferGivenCount,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferGivenCount,
    ),
    totalPercentageOfferCustomerCount: toNonNegativeNumber(
      raw.totalPercentageOfferCustomerCount,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferCustomerCount,
    ),
    totalPercentageOfferCustomers: Array.isArray(raw.totalPercentageOfferCustomers)
      ? raw.totalPercentageOfferCustomers
          .map((entry) => getRelationshipID(entry))
          .filter((id): id is string => typeof id === 'string')
      : [],
    totalPercentageOfferCustomerUsage: normalizeOfferCustomerUsage(
      raw.totalPercentageOfferCustomerUsage,
    ),
    enableCustomerEntryPercentageOffer:
      typeof raw.enableCustomerEntryPercentageOffer === 'boolean'
        ? raw.enableCustomerEntryPercentageOffer
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.enableCustomerEntryPercentageOffer,
    allowCustomerEntryPercentageOfferOnTableOrders:
      typeof raw.allowCustomerEntryPercentageOfferOnTableOrders === 'boolean'
        ? raw.allowCustomerEntryPercentageOfferOnTableOrders
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowCustomerEntryPercentageOfferOnTableOrders,
    allowCustomerEntryPercentageOfferOnBillings:
      typeof raw.allowCustomerEntryPercentageOfferOnBillings === 'boolean'
        ? raw.allowCustomerEntryPercentageOfferOnBillings
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.allowCustomerEntryPercentageOfferOnBillings,
    customerEntryPercentageOfferBranches: normalizeRelationshipIDs(
      raw.customerEntryPercentageOfferBranches,
    ),
    customerEntryPercentageOfferPercent: toChancePercent(
      raw.customerEntryPercentageOfferPercent,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.customerEntryPercentageOfferPercent,
    ),
    customerEntryPercentageOfferTimezone: normalizeTimezone(
      raw.customerEntryPercentageOfferTimezone,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.customerEntryPercentageOfferTimezone,
    ),
    customerEntryPercentageOfferAvailableFromDate: normalizeDateString(
      raw.customerEntryPercentageOfferAvailableFromDate,
    ),
    customerEntryPercentageOfferAvailableToDate: normalizeDateString(
      raw.customerEntryPercentageOfferAvailableToDate,
    ),
    customerEntryPercentageOfferDailyStartTime: normalizeTimeString(
      raw.customerEntryPercentageOfferDailyStartTime,
    ),
    customerEntryPercentageOfferDailyEndTime: normalizeTimeString(
      raw.customerEntryPercentageOfferDailyEndTime,
    ),
    customerEntryPercentageOfferGivenCount: toNonNegativeNumber(
      raw.customerEntryPercentageOfferGivenCount,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.customerEntryPercentageOfferGivenCount,
    ),
    customerEntryPercentageOfferCustomerCount: toNonNegativeNumber(
      raw.customerEntryPercentageOfferCustomerCount,
      DEFAULT_CUSTOMER_REWARD_SETTINGS.customerEntryPercentageOfferCustomerCount,
    ),
    customerEntryPercentageOfferCustomers: Array.isArray(raw.customerEntryPercentageOfferCustomers)
      ? raw.customerEntryPercentageOfferCustomers
          .map((entry) => getRelationshipID(entry))
          .filter((id): id is string => typeof id === 'string')
      : [],
    customerEntryPercentageOfferCustomerUsage: normalizeOfferCustomerUsage(
      raw.customerEntryPercentageOfferCustomerUsage,
    ),
  }
}

export const isOfferAllowedForBranch = (
  branchID: string | null,
  selectedBranchIDs: string[],
): boolean => {
  if (!Array.isArray(selectedBranchIDs) || selectedBranchIDs.length === 0) {
    return true
  }

  if (!branchID) {
    return false
  }

  return selectedBranchIDs.includes(branchID)
}

export const getCustomerRewardSettings = async (
  payload: Payload,
): Promise<CustomerRewardSettings> => {
  try {
    const settings = await payload.findGlobal({
      slug: 'customer-offer-settings' as any,
      depth: 0,
    })

    return normalizeCustomerRewardSettings(settings)
  } catch (error) {
    console.error('Failed to read customer offer settings. Falling back to defaults.', error)
    return DEFAULT_CUSTOMER_REWARD_SETTINGS
  }
}

export const isRandomOfferProductAvailableNow = (
  row: Pick<
    RandomCustomerOfferProductRule,
    'enabled' | 'availableFromDate' | 'availableToDate' | 'dailyStartTime' | 'dailyEndTime'
  >,
  timezone: string,
  now: Date = new Date(),
): boolean => {
  if (!row.enabled) return false

  const effectiveTimezone = normalizeTimezone(
    timezone,
    DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferTimezone,
  )
  const nowInfo = toCurrentDateAndMinutesInTimezone(effectiveTimezone, now)
  if (!nowInfo) return true

  const fromDateKey = toDateKeyInTimezone(row.availableFromDate, effectiveTimezone)
  const toDateKey = toDateKeyInTimezone(row.availableToDate, effectiveTimezone)

  if (fromDateKey && nowInfo.dateKey < fromDateKey) {
    return false
  }
  if (toDateKey && nowInfo.dateKey > toDateKey) {
    return false
  }

  const startMinutes = toMinutes(normalizeTimeString(row.dailyStartTime))
  const endMinutes = toMinutes(normalizeTimeString(row.dailyEndTime))

  return isWithinDailyWindow(nowInfo.minutes, startMinutes, endMinutes)
}

export const calculatePointsForSpend = (
  spendAmount: number,
  spendAmountPerStep: number,
  pointsPerStep: number,
): { earnedPoints: number; consumedAmount: number } => {
  const safeSpendAmount = Math.max(0, Number.isFinite(spendAmount) ? spendAmount : 0)
  const safeStepAmount = toPositiveNumber(
    spendAmountPerStep,
    DEFAULT_CUSTOMER_REWARD_SETTINGS.spendAmountPerStep,
  )
  const safePointsPerStep = toPositiveNumber(
    pointsPerStep,
    DEFAULT_CUSTOMER_REWARD_SETTINGS.pointsPerStep,
  )

  const completedSteps = Math.floor(safeSpendAmount / safeStepAmount)
  const earnedPoints = completedSteps * safePointsPerStep
  const consumedAmount = completedSteps * safeStepAmount

  return {
    earnedPoints,
    consumedAmount,
  }
}
