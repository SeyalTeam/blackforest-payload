import type { Payload } from 'payload'

export type CustomerRewardSettings = {
  enabled: boolean
  spendAmountPerStep: number
  pointsPerStep: number
  pointsNeededForOffer: number
  offerAmount: number
  resetOnRedeem: boolean
  enableProductToProductOffer: boolean
  productToProductOffers: ProductToProductOfferRule[]
  enableProductPriceOffer: boolean
  productPriceOffers: ProductPriceOfferRule[]
  enableRandomCustomerProductOffer: boolean
  randomCustomerOfferProducts: RandomCustomerOfferProductRule[]
  randomCustomerOfferCampaignCode: string
  randomCustomerOfferRedeemedCount: number
  enableTotalPercentageOffer: boolean
  totalPercentageOfferPercent: number
  totalPercentageOfferMaxOfferCount: number
  totalPercentageOfferMaxCustomerCount: number
  totalPercentageOfferGivenCount: number
  totalPercentageOfferCustomerCount: number
  totalPercentageOfferCustomers: string[]
}

export type ProductToProductOfferRule = {
  id: string
  enabled: boolean
  buyProduct: string
  buyQuantity: number
  freeProduct: string
  freeQuantity: number
  maxOfferCount: number
  maxCustomerCount: number
  offerGivenCount: number
  offerCustomerCount: number
  offerCustomers: string[]
}

export type ProductPriceOfferRule = {
  id: string
  enabled: boolean
  product: string
  discountAmount: number
  maxOfferCount: number
  maxCustomerCount: number
  offerGivenCount: number
  offerCustomerCount: number
  offerCustomers: string[]
}

export type RandomCustomerOfferProductRule = {
  id: string
  enabled: boolean
  product: string
  winnerCount: number
  assignedCount: number
  redeemedCount: number
  selectedCustomers: string[]
}

export const DEFAULT_CUSTOMER_REWARD_SETTINGS: CustomerRewardSettings = {
  enabled: true,
  spendAmountPerStep: 1000,
  pointsPerStep: 10,
  pointsNeededForOffer: 50,
  offerAmount: 50,
  resetOnRedeem: true,
  enableProductToProductOffer: false,
  productToProductOffers: [],
  enableProductPriceOffer: false,
  productPriceOffers: [],
  enableRandomCustomerProductOffer: false,
  randomCustomerOfferProducts: [],
  randomCustomerOfferCampaignCode: 'campaign-1',
  randomCustomerOfferRedeemedCount: 0,
  enableTotalPercentageOffer: false,
  totalPercentageOfferPercent: 5,
  totalPercentageOfferMaxOfferCount: 0,
  totalPercentageOfferMaxCustomerCount: 0,
  totalPercentageOfferGivenCount: 0,
  totalPercentageOfferCustomerCount: 0,
  totalPercentageOfferCustomers: [],
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
        buyProduct,
        buyQuantity: toPositiveNumber(rawRule.buyQuantity, 1),
        freeProduct,
        freeQuantity: toPositiveNumber(rawRule.freeQuantity, 1),
        maxOfferCount: toNonNegativeNumber(rawRule.maxOfferCount, 0),
        maxCustomerCount: toNonNegativeNumber(rawRule.maxCustomerCount, 0),
        offerGivenCount: toNonNegativeNumber(rawRule.offerGivenCount, 0),
        offerCustomerCount: toNonNegativeNumber(rawRule.offerCustomerCount, 0),
        offerCustomers: Array.isArray(rawRule.offerCustomers)
          ? rawRule.offerCustomers
              .map((entry) => getRelationshipID(entry))
              .filter((id): id is string => typeof id === 'string')
          : [],
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
        product,
        discountAmount: toPositiveNumber(rawRule.discountAmount, 1),
        maxOfferCount: toNonNegativeNumber(rawRule.maxOfferCount, 0),
        maxCustomerCount: toNonNegativeNumber(rawRule.maxCustomerCount, 0),
        offerGivenCount: toNonNegativeNumber(rawRule.offerGivenCount, 0),
        offerCustomerCount: toNonNegativeNumber(rawRule.offerCustomerCount, 0),
        offerCustomers: Array.isArray(rawRule.offerCustomers)
          ? rawRule.offerCustomers
              .map((entry) => getRelationshipID(entry))
              .filter((id): id is string => typeof id === 'string')
          : [],
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
        product,
        winnerCount: toPositiveNumber(rawRow.winnerCount, 1),
        assignedCount: typeof rawRow.assignedCount === 'number' ? Math.max(0, rawRow.assignedCount) : 0,
        redeemedCount: typeof rawRow.redeemedCount === 'number' ? Math.max(0, rawRow.redeemedCount) : 0,
        selectedCustomers,
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
    productToProductOffers: normalizeProductOfferRules(raw.productToProductOffers),
    enableProductPriceOffer:
      typeof raw.enableProductPriceOffer === 'boolean'
        ? raw.enableProductPriceOffer
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.enableProductPriceOffer,
    productPriceOffers: normalizeProductPriceOfferRules(raw.productPriceOffers),
    enableRandomCustomerProductOffer:
      typeof raw.enableRandomCustomerProductOffer === 'boolean'
        ? raw.enableRandomCustomerProductOffer
        : DEFAULT_CUSTOMER_REWARD_SETTINGS.enableRandomCustomerProductOffer,
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
  }
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
