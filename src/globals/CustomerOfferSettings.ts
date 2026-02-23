import type { GlobalConfig } from 'payload'
import {
  DEFAULT_CUSTOMER_REWARD_SETTINGS,
  DEFAULT_RANDOM_OFFER_SELECTION_CHANCE_PERCENT,
} from '../utilities/customerRewards'
import { withWriteConflictRetry } from '../utilities/mongoRetry'

const toRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value

  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

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
    return toRelationshipID((value as { value?: unknown }).value)
  }

  return null
}

const extractRelationshipIDs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => toRelationshipID(entry))
    .filter((id): id is string => typeof id === 'string')
}

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback
  return Math.floor(value)
}

const toNonNegativeInteger = (value: unknown, fallback = 0): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback
  return Math.floor(value)
}

const toChancePercent = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(0, value))
}

const normalizeDateString = (value: unknown): string | null => {
  if (!value) return null

  const dateValue = new Date(String(value))
  if (Number.isNaN(dateValue.getTime())) return null

  return dateValue.toISOString()
}

const normalizeTimeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null

  return `${match[1].padStart(2, '0')}:${match[2]}`
}

const RAILWAY_TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return { label: value, value }
})

type RandomOfferRow = {
  id: string
  enabled: boolean
  productID: string | null
  winnerCount: number
  randomSelectionChancePercent: number
  maxUsagePerCustomer: number
  availableFromDate: string | null
  availableToDate: string | null
  dailyStartTime: string | null
  dailyEndTime: string | null
  selectedCustomers: string[]
  assignedCount: number
  redeemedCount: number
  offerCustomerUsage: Array<{ customer: string; usageCount: number }>
}

const parseOfferCustomerUsageRows = (
  value: unknown,
): Array<{ customer: string; usageCount: number }> => {
  if (!Array.isArray(value)) return []

  const usageByCustomer = new Map<string, number>()

  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const raw = row as Record<string, unknown>
    const customerID = toRelationshipID(raw.customer)
    if (!customerID) continue

    const usageCount = toNonNegativeInteger(raw.usageCount, 0)
    usageByCustomer.set(customerID, (usageByCustomer.get(customerID) || 0) + usageCount)
  }

  return Array.from(usageByCustomer.entries())
    .filter(([, usageCount]) => usageCount > 0)
    .map(([customer, usageCount]) => ({ customer, usageCount }))
}

const parseRandomOfferRows = (value: unknown): RandomOfferRow[] => {
  if (!Array.isArray(value)) return []

  return value.map((row, index) => {
    const raw = (row || {}) as Record<string, unknown>
    return {
      id: typeof raw.id === 'string' ? raw.id : `random-row-${index + 1}`,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      productID: toRelationshipID(raw.product),
      winnerCount: toPositiveInteger(raw.winnerCount, 1),
      randomSelectionChancePercent: toChancePercent(
        raw.randomSelectionChancePercent,
        DEFAULT_RANDOM_OFFER_SELECTION_CHANCE_PERCENT,
      ),
      maxUsagePerCustomer: toNonNegativeInteger(raw.maxUsagePerCustomer, 1),
      availableFromDate: normalizeDateString(raw.availableFromDate),
      availableToDate: normalizeDateString(raw.availableToDate),
      dailyStartTime: normalizeTimeString(raw.dailyStartTime),
      dailyEndTime: normalizeTimeString(raw.dailyEndTime),
      selectedCustomers: extractRelationshipIDs(raw.selectedCustomers),
      assignedCount: toNonNegativeInteger(raw.assignedCount, 0),
      redeemedCount: toNonNegativeInteger(raw.redeemedCount, 0),
      offerCustomerUsage: parseOfferCustomerUsageRows(raw.offerCustomerUsage),
    }
  })
}

export const CustomerOfferSettings: GlobalConfig = {
  slug: 'customer-offer-settings',
  label: 'Customer Offer Settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: ({ req }) => ['superadmin', 'admin', 'branch'].includes(req.user?.role || ''),
  },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return data

        const mutableData = data as {
          productPriceOffers?: Array<{
            product?: unknown
            discountAmount?: number
            productCurrentPrice?: number
            finalPricePreview?: number
          }>
        }

        if (!Array.isArray(mutableData.productPriceOffers)) {
          return data
        }

        const priceCache = new Map<string, number>()

        const getProductID = (value: unknown): string | null => {
          if (typeof value === 'string' && value.trim().length > 0) return value

          if (typeof value === 'number' && Number.isFinite(value)) return String(value)

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
            return getProductID((value as { value?: unknown }).value)
          }

          return null
        }

        const getProductPrice = async (productID: string): Promise<number> => {
          if (priceCache.has(productID)) {
            return priceCache.get(productID) || 0
          }

          try {
            const product = (await req.payload.findByID({
              collection: 'products',
              id: productID,
              depth: 0,
              overrideAccess: true,
            })) as {
              defaultPriceDetails?: {
                price?: number
              }
            }

            const price =
              typeof product?.defaultPriceDetails?.price === 'number' &&
              Number.isFinite(product.defaultPriceDetails.price)
                ? product.defaultPriceDetails.price
                : 0

            priceCache.set(productID, price)
            return price
          } catch {
            priceCache.set(productID, 0)
            return 0
          }
        }

        for (const rule of mutableData.productPriceOffers) {
          const productID = getProductID(rule.product)
          if (!productID) {
            rule.productCurrentPrice = 0
            rule.finalPricePreview = 0
            continue
          }

          const productPrice = await getProductPrice(productID)
          const discount =
            typeof rule.discountAmount === 'number' && Number.isFinite(rule.discountAmount)
              ? Math.max(0, rule.discountAmount)
              : 0

          rule.productCurrentPrice = parseFloat(productPrice.toFixed(2))
          rule.finalPricePreview = parseFloat(Math.max(0, productPrice - discount).toFixed(2))
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, context }) => {
        const requestContext =
          (context as Record<string, unknown> | undefined) ||
          ((req as any).context as Record<string, unknown> | undefined)

        if (requestContext?.skipRandomOfferAssignment) {
          return doc
        }

        const mutableDoc = doc as {
          enableRandomCustomerProductOffer?: boolean
          randomCustomerOfferProducts?: unknown[]
          randomCustomerOfferCampaignCode?: string
          reselectRandomCustomerOffer?: boolean
          randomCustomerOfferAssignedCount?: number
          randomCustomerOfferRedeemedCount?: number
          randomCustomerOfferLastAssignedAt?: string
        }

        const previousMutableDoc = (previousDoc || {}) as {
          randomCustomerOfferCampaignCode?: string
        }

        const isEnabled = Boolean(mutableDoc.enableRandomCustomerProductOffer)
        const currentRows = parseRandomOfferRows(mutableDoc.randomCustomerOfferProducts)
        const rowsWithProducts = currentRows.filter(
          (row): row is RandomOfferRow & { productID: string } => Boolean(row.productID),
        )

        const campaignCode =
          typeof mutableDoc.randomCustomerOfferCampaignCode === 'string' &&
          mutableDoc.randomCustomerOfferCampaignCode.trim().length > 0
            ? mutableDoc.randomCustomerOfferCampaignCode.trim()
            : DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferCampaignCode

        const previousCampaignCode =
          typeof previousMutableDoc.randomCustomerOfferCampaignCode === 'string'
            ? previousMutableDoc.randomCustomerOfferCampaignCode
            : DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferCampaignCode

        const shouldResetProgress =
          Boolean(mutableDoc.reselectRandomCustomerOffer) || campaignCode !== previousCampaignCode

        const scheduleSettingsRefresh = (updateData: Record<string, unknown>) => {
          setTimeout(() => {
            void withWriteConflictRetry(
              () =>
                req.payload.updateGlobal({
                  slug: 'customer-offer-settings' as any,
                  data: updateData as any,
                  depth: 0,
                  overrideAccess: true,
                  context: {
                    skipRandomOfferAssignment: true,
                  },
                }),
              5,
              150,
            ).catch((error) => {
              console.error(
                '[CustomerOfferSettings] Failed deferred updateGlobal for random offer settings.',
                error,
              )
            })
          }, 0)
        }

        const buildStoredRows = (resetProgress: boolean) =>
          rowsWithProducts.map((row) => {
            const selectedCustomers = resetProgress
              ? []
              : [...new Set(row.selectedCustomers.filter((id) => id.trim().length > 0))]
            const offerCustomerUsage = resetProgress
              ? []
              : row.offerCustomerUsage
                  .map((entry) => ({
                    customer: entry.customer,
                    usageCount: toNonNegativeInteger(entry.usageCount, 0),
                  }))
                  .filter(
                    (entry): entry is { customer: string; usageCount: number } =>
                      entry.customer.trim().length > 0 && entry.usageCount > 0,
                  )
            const redeemedCount = resetProgress
              ? 0
              : Math.min(row.winnerCount, toNonNegativeInteger(row.redeemedCount, 0))
            const assignedCount = resetProgress
              ? 0
              : Math.max(selectedCustomers.length, redeemedCount, toNonNegativeInteger(row.assignedCount, 0))

            return {
              id: row.id,
              enabled: row.enabled,
              product: row.productID,
              winnerCount: row.winnerCount,
              randomSelectionChancePercent: row.randomSelectionChancePercent,
              maxUsagePerCustomer: toNonNegativeInteger(row.maxUsagePerCustomer, 1),
              availableFromDate: row.availableFromDate,
              availableToDate: row.availableToDate,
              dailyStartTime: row.dailyStartTime,
              dailyEndTime: row.dailyEndTime,
              selectedCustomers,
              assignedCount,
              redeemedCount,
              offerCustomerUsage,
            }
          })

        if (!isEnabled || rowsWithProducts.length === 0) {
          scheduleSettingsRefresh({
            randomCustomerOfferAssignedCount: 0,
            randomCustomerOfferRedeemedCount: 0,
            randomCustomerOfferLastAssignedAt: null,
            reselectRandomCustomerOffer: false,
            randomCustomerOfferProducts: buildStoredRows(true),
          })
          return doc
        }

        if (shouldResetProgress) {
          scheduleSettingsRefresh({
            randomCustomerOfferAssignedCount: 0,
            randomCustomerOfferRedeemedCount: 0,
            randomCustomerOfferLastAssignedAt: null,
            reselectRandomCustomerOffer: false,
            randomCustomerOfferProducts: buildStoredRows(true),
          })
          return doc
        }

        return doc
      },
    ],
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Offer 1: Customer Credit Offer',
      admin: {
        initCollapsed: false,
        description:
          'Customer earns points by spend amount and can redeem fixed discount once eligible.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable Customer Credit Offer',
          defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.enabled,
        },
        {
          type: 'row',
          admin: {
            condition: (data) => Boolean(data?.enabled),
          },
          fields: [
            {
              name: 'spendAmountPerStep',
              type: 'number',
              label: 'Spend Amount per Step (Rs)',
              min: 1,
              required: true,
              defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.spendAmountPerStep,
              admin: {
                width: '50%',
                description: 'Example: 1000 means points are granted for every Rs 1000 spent.',
              },
            },
            {
              name: 'pointsPerStep',
              type: 'number',
              label: 'Credit Points per Step',
              min: 1,
              required: true,
              defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.pointsPerStep,
              admin: {
                width: '50%',
                description: 'Example: 10 points for each spend step.',
              },
            },
          ],
        },
        {
          type: 'row',
          admin: {
            condition: (data) => Boolean(data?.enabled),
          },
          fields: [
            {
              name: 'pointsNeededForOffer',
              type: 'number',
              label: 'Points Needed to Redeem Offer',
              min: 1,
              required: true,
              defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.pointsNeededForOffer,
              admin: {
                width: '50%',
                description: 'Example: 50 points required before offer can be applied.',
              },
            },
            {
              name: 'offerAmount',
              type: 'number',
              label: 'Offer Amount (Rs)',
              min: 1,
              required: true,
              defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.offerAmount,
              admin: {
                width: '50%',
                description: 'Discount amount applied when customer redeems points.',
              },
            },
          ],
        },
        {
          name: 'resetOnRedeem',
          type: 'checkbox',
          label: 'Reset Points and Progress After Offer Redemption',
          defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.resetOnRedeem,
          admin: {
            condition: (data) => Boolean(data?.enabled),
            description:
              'When enabled, customer points/progress are reset after the offer is used. They must purchase again to earn fresh points.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Offer 2: Product to Product Offer (Buy A -> Get B Free)',
      admin: {
        initCollapsed: true,
        description: 'Configure rules where buying product A gives product B free.',
      },
      fields: [
        {
          name: 'enableProductToProductOffer',
          type: 'checkbox',
          label: 'Enable Product to Product Offer (Buy A -> Get B Free)',
          defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.enableProductToProductOffer,
          admin: {
            description:
              'Second offer type. Enable this alone, or enable both offer types at the same time.',
          },
        },
        {
          name: 'productToProductOffers',
          type: 'array',
          label: 'Product to Product Rules',
          labels: {
            singular: 'Product Offer Rule',
            plural: 'Product Offer Rules',
          },
          admin: {
            condition: (data) => Boolean(data?.enableProductToProductOffer),
          },
          fields: [
            {
              name: 'enabled',
              type: 'checkbox',
              label: 'Rule Enabled',
              defaultValue: true,
            },
            {
              name: 'buyProduct',
              type: 'relationship',
              relationTo: 'products',
              required: true,
              label: 'Buy Product (A)',
              admin: {
                description: 'Search/filter and choose product A.',
              },
            },
            {
              name: 'buyQuantity',
              type: 'number',
              required: true,
              min: 1,
              defaultValue: 1,
              label: 'Buy Quantity',
            },
            {
              name: 'freeProduct',
              type: 'relationship',
              relationTo: 'products',
              required: true,
              label: 'Free Product (B)',
              admin: {
                description: 'Search/filter and choose product B.',
              },
            },
            {
              name: 'freeQuantity',
              type: 'number',
              required: true,
              min: 1,
              defaultValue: 1,
              label: 'Free Quantity',
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'maxOfferCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Max Offer Uses',
                  admin: {
                    width: '33%',
                    description: '0 means unlimited.',
                  },
                },
                {
                  name: 'maxCustomerCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Max Customers',
                  admin: {
                    width: '33%',
                    description: '0 means unlimited.',
                  },
                },
                {
                  name: 'maxUsagePerCustomer',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Max Uses per Customer',
                  admin: {
                    width: '34%',
                    description: '0 means unlimited per customer.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'offerGivenCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Given Count',
                  admin: {
                    width: '50%',
                    readOnly: true,
                  },
                },
                {
                  name: 'offerCustomerCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Customer Count',
                  admin: {
                    width: '50%',
                    readOnly: true,
                  },
                },
              ],
            },
            {
              name: 'offerCustomers',
              type: 'relationship',
              relationTo: 'customers',
              hasMany: true,
              admin: {
                readOnly: true,
              },
            },
            {
              name: 'offerCustomerUsage',
              type: 'array',
              label: 'Customer Usage',
              admin: {
                readOnly: true,
                description: 'Per-customer usage count for this rule.',
              },
              fields: [
                {
                  name: 'customer',
                  type: 'relationship',
                  relationTo: 'customers',
                  required: true,
                  admin: {
                    width: '70%',
                    readOnly: true,
                  },
                },
                {
                  name: 'usageCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  required: true,
                  admin: {
                    width: '30%',
                    readOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Offer 3: Product Price Offer (Per Product Discount)',
      admin: {
        initCollapsed: true,
        description:
          'Set fixed per-product discount. Example: Tea Rs 12 with Rs 2 discount gives final Rs 10.',
      },
      fields: [
        {
          name: 'enableProductPriceOffer',
          type: 'checkbox',
          label: 'Enable Product Price Offer (Per Product Discount)',
          defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.enableProductPriceOffer,
          admin: {
            description:
              'Third offer type. Example: Tea Rs 12 with Rs 2 discount, customer pays Rs 10.',
          },
        },
        {
          name: 'productPriceOffers',
          type: 'array',
          label: 'Product Price Offer Rules',
          labels: {
            singular: 'Price Offer Rule',
            plural: 'Price Offer Rules',
          },
          admin: {
            condition: (data) => Boolean(data?.enableProductPriceOffer),
          },
          fields: [
            {
              name: 'enabled',
              type: 'checkbox',
              label: 'Rule Enabled',
              defaultValue: true,
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'product',
                  type: 'relationship',
                  relationTo: 'products',
                  required: true,
                  label: 'Product',
                  admin: {
                    width: '40%',
                    description: 'Search/filter and choose the product (e.g., Tea).',
                  },
                },
                {
                  name: 'productCurrentPrice',
                  type: 'number',
                  label: 'Current Price (Rs)',
                  min: 0,
                  admin: {
                    width: '20%',
                    readOnly: true,
                    components: {
                      Field: '/components/ProductPriceOfferPreviewField/index.tsx#default',
                    },
                  },
                },
                {
                  name: 'discountAmount',
                  type: 'number',
                  required: true,
                  min: 0.01,
                  defaultValue: 1,
                  label: 'Discount (Rs)',
                  admin: {
                    width: '20%',
                  },
                },
                {
                  name: 'finalPricePreview',
                  type: 'number',
                  label: 'Final Price (Rs)',
                  min: 0,
                  admin: {
                    width: '20%',
                    readOnly: true,
                    description: 'Auto preview after discount.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'maxOfferCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Max Offer Uses',
                  admin: {
                    width: '33%',
                    description: '0 means unlimited.',
                  },
                },
                {
                  name: 'maxCustomerCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Max Customers',
                  admin: {
                    width: '33%',
                    description: '0 means unlimited.',
                  },
                },
                {
                  name: 'maxUsagePerCustomer',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Max Uses per Customer',
                  admin: {
                    width: '34%',
                    description: '0 means unlimited per customer.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'offerGivenCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Given Count',
                  admin: {
                    width: '50%',
                    readOnly: true,
                  },
                },
                {
                  name: 'offerCustomerCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  label: 'Customer Count',
                  admin: {
                    width: '50%',
                    readOnly: true,
                  },
                },
              ],
            },
            {
              name: 'offerCustomers',
              type: 'relationship',
              relationTo: 'customers',
              hasMany: true,
              admin: {
                readOnly: true,
              },
            },
            {
              name: 'offerCustomerUsage',
              type: 'array',
              label: 'Customer Usage',
              admin: {
                readOnly: true,
                description: 'Per-customer usage count for this rule.',
              },
              fields: [
                {
                  name: 'customer',
                  type: 'relationship',
                  relationTo: 'customers',
                  required: true,
                  admin: {
                    width: '70%',
                    readOnly: true,
                  },
                },
                {
                  name: 'usageCount',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  required: true,
                  admin: {
                    width: '30%',
                    readOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Offer 4: Random Customer Product Offer',
      admin: {
        initCollapsed: true,
        description:
          'Configure random product awards, date/time windows, and per-product customer limits.',
      },
      fields: [
        {
          type: 'tabs',
          tabs: [
            {
              label: 'Setup',
              fields: [
                {
                  name: 'enableRandomCustomerProductOffer',
                  type: 'checkbox',
                  label: 'Enable Random Customer Product Offer',
                  defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.enableRandomCustomerProductOffer,
                  admin: {
                    description:
                      'Fourth offer type. System checks this offer in real-time during billing for both new and existing customers.',
                  },
                },
                {
                  type: 'row',
                  admin: {
                    condition: (data) => Boolean(data?.enableRandomCustomerProductOffer),
                  },
                  fields: [
                    {
                      name: 'randomCustomerOfferCampaignCode',
                      type: 'text',
                      required: true,
                      defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferCampaignCode,
                      label: 'Campaign Code',
                      admin: {
                        width: '60%',
                        description:
                          'Change this code to start a fresh campaign and reset random offer progress.',
                      },
                    },
                    {
                      name: 'randomCustomerOfferTimezone',
                      type: 'text',
                      required: true,
                      defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferTimezone,
                      label: 'Timezone',
                      admin: {
                        width: '40%',
                        description: 'IANA timezone for schedule checks (e.g., Asia/Kolkata).',
                      },
                    },
                  ],
                },
                {
                  name: 'reselectRandomCustomerOffer',
                  type: 'checkbox',
                  label: 'Reset Random Offer Progress on Save',
                  defaultValue: false,
                  admin: {
                    condition: (data) => Boolean(data?.enableRandomCustomerProductOffer),
                    description:
                      'Tick and save to clear random offer counters and start a fresh cycle.',
                  },
                },
                {
                  type: 'row',
                  admin: {
                    condition: (data) => Boolean(data?.enableRandomCustomerProductOffer),
                  },
                  fields: [
                    {
                      name: 'randomCustomerOfferAssignedCount',
                      type: 'number',
                      min: 0,
                      defaultValue: 0,
                      label: 'Awarded Customers',
                      admin: {
                        width: '33%',
                        readOnly: true,
                      },
                    },
                    {
                      name: 'randomCustomerOfferRedeemedCount',
                      type: 'number',
                      min: 0,
                      defaultValue: 0,
                      label: 'Redeemed Customers',
                      admin: {
                        width: '33%',
                        readOnly: true,
                      },
                    },
                    {
                      name: 'randomCustomerOfferLastAssignedAt',
                      type: 'date',
                      label: 'Last Awarded At',
                      admin: {
                        width: '34%',
                        readOnly: true,
                      },
                    },
                  ],
                },
              ],
            },
            {
              label: 'Rules',
              fields: [
                {
                  name: 'randomCustomerOfferProducts',
                  type: 'array',
                  label: 'Random Offer Products and Counts',
                  labels: {
                    singular: 'Random Customer Offer Product',
                    plural: 'Random Customer Offer Products',
                  },
                  admin: {
                    condition: (data) => Boolean(data?.enableRandomCustomerProductOffer),
                    description:
                      'Add rules for product, winners, random chance, schedule, and usage limits.',
                  },
                  fields: [
                    {
                      type: 'tabs',
                      tabs: [
                        {
                          label: 'Rule Setup',
                          fields: [
                            {
                              name: 'enabled',
                              type: 'checkbox',
                              label: 'Rule Enabled',
                              defaultValue: true,
                            },
                            {
                              type: 'row',
                              fields: [
                                {
                                  name: 'product',
                                  type: 'relationship',
                                  relationTo: 'products',
                                  required: true,
                                  label: 'Product',
                                  admin: {
                                    width: '40%',
                                  },
                                },
                                {
                                  name: 'winnerCount',
                                  type: 'number',
                                  required: true,
                                  min: 1,
                                  defaultValue: 1,
                                  label: 'Winner Count',
                                  admin: {
                                    width: '20%',
                                  },
                                },
                                {
                                  name: 'randomSelectionChancePercent',
                                  type: 'number',
                                  required: true,
                                  min: 0.01,
                                  max: 100,
                                  defaultValue: DEFAULT_RANDOM_OFFER_SELECTION_CHANCE_PERCENT,
                                  label: 'Random Chance (%)',
                                  admin: {
                                    width: '20%',
                                    description:
                                      'Chance to award this rule for an eligible customer bill.',
                                  },
                                },
                                {
                                  name: 'maxUsagePerCustomer',
                                  type: 'number',
                                  required: true,
                                  min: 0,
                                  defaultValue: 1,
                                  label: 'Max Uses per Customer',
                                  admin: {
                                    width: '20%',
                                    description: '0 means unlimited for this product rule.',
                                  },
                                },
                              ],
                            },
                          ],
                        },
                        {
                          label: 'Schedule',
                          fields: [
                            {
                              type: 'row',
                              fields: [
                                {
                                  name: 'availableFromDate',
                                  type: 'date',
                                  label: 'Available From Date',
                                  admin: {
                                    width: '25%',
                                    date: {
                                      pickerAppearance: 'dayOnly',
                                    },
                                    description: 'Optional start date.',
                                  },
                                },
                                {
                                  name: 'availableToDate',
                                  type: 'date',
                                  label: 'Available To Date',
                                  admin: {
                                    width: '25%',
                                    date: {
                                      pickerAppearance: 'dayOnly',
                                    },
                                    description: 'Optional end date.',
                                  },
                                },
                                {
                                  name: 'dailyStartTime',
                                  type: 'select',
                                  options: RAILWAY_TIME_OPTIONS,
                                  label: 'Daily Start Time',
                                  admin: {
                                    width: '25%',
                                    description: 'Select 24-hour (railway) time.',
                                  },
                                },
                                {
                                  name: 'dailyEndTime',
                                  type: 'select',
                                  options: RAILWAY_TIME_OPTIONS,
                                  label: 'Daily End Time',
                                  admin: {
                                    width: '25%',
                                    description: 'Select 24-hour (railway) time.',
                                  },
                                },
                              ],
                            },
                          ],
                        },
                        {
                          label: 'Progress',
                          fields: [
                            {
                              type: 'row',
                              fields: [
                                {
                                  name: 'assignedCount',
                                  type: 'number',
                                  min: 0,
                                  defaultValue: 0,
                                  label: 'Awarded',
                                  admin: {
                                    width: '50%',
                                    readOnly: true,
                                  },
                                },
                                {
                                  name: 'redeemedCount',
                                  type: 'number',
                                  min: 0,
                                  defaultValue: 0,
                                  label: 'Redeemed',
                                  admin: {
                                    width: '50%',
                                    readOnly: true,
                                  },
                                },
                                {
                                  name: 'selectedCustomers',
                                  type: 'relationship',
                                  relationTo: 'customers',
                                  hasMany: true,
                                  label: 'Awarded Customers',
                                  admin: {
                                    hidden: true,
                                    readOnly: true,
                                  },
                                },
                              ],
                            },
                            {
                              name: 'offerCustomerUsage',
                              type: 'array',
                              label: 'Customer Usage',
                              admin: {
                                readOnly: true,
                                description: 'Per-customer usage count for this product rule.',
                              },
                              fields: [
                                {
                                  name: 'customer',
                                  type: 'relationship',
                                  relationTo: 'customers',
                                  required: true,
                                  admin: {
                                    width: '70%',
                                    readOnly: true,
                                  },
                                },
                                {
                                  name: 'usageCount',
                                  type: 'number',
                                  min: 0,
                                  defaultValue: 0,
                                  required: true,
                                  admin: {
                                    width: '30%',
                                    readOnly: true,
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Offer 5: Total Amount Percentage Offer',
      admin: {
        initCollapsed: true,
        description:
          'Apply percentage discount on total bill amount with optional random-only and schedule controls.',
      },
      fields: [
        {
          type: 'tabs',
          tabs: [
            {
              label: 'Setup',
              fields: [
                {
                  name: 'enableTotalPercentageOffer',
                  type: 'checkbox',
                  label: 'Enable Total Amount Percentage Offer',
                  defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.enableTotalPercentageOffer,
                  admin: {
                    description:
                      'Fifth offer type. Applies percentage discount on final bill total after other discounts.',
                  },
                },
                {
                  type: 'row',
                  admin: {
                    condition: (data) => Boolean(data?.enableTotalPercentageOffer),
                  },
                  fields: [
                    {
                      name: 'totalPercentageOfferPercent',
                      type: 'number',
                      required: true,
                      min: 0.01,
                      max: 100,
                      defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferPercent,
                      label: 'Discount Percentage (%)',
                      admin: {
                        width: '25%',
                        description: 'Example: 10 means 10% discount on total amount.',
                      },
                    },
                    {
                      name: 'totalPercentageOfferRandomSelectionChancePercent',
                      type: 'number',
                      min: 0.01,
                      max: 100,
                      defaultValue:
                        DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferRandomSelectionChancePercent,
                      label: 'Random Chance (%)',
                      admin: {
                        width: '25%',
                        description: 'Probability of selecting a customer for this offer.',
                      },
                    },
                    {
                      name: 'totalPercentageOfferMaxOfferCount',
                      type: 'number',
                      min: 0,
                      defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferMaxOfferCount,
                      label: 'Max Offer Uses',
                      admin: {
                        width: '25%',
                        description: '0 means unlimited.',
                      },
                    },
                    {
                      name: 'totalPercentageOfferMaxCustomerCount',
                      type: 'number',
                      min: 0,
                      defaultValue:
                        DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferMaxCustomerCount,
                      label: 'Max Customers',
                      admin: {
                        width: '25%',
                        description: '0 means unlimited.',
                      },
                    },
                  ],
                },
                {
                  type: 'row',
                  admin: {
                    condition: (data) => Boolean(data?.enableTotalPercentageOffer),
                  },
                  fields: [
                    {
                      name: 'totalPercentageOfferMaxUsagePerCustomer',
                      type: 'number',
                      min: 0,
                      defaultValue:
                        DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferMaxUsagePerCustomer,
                      label: 'Max Uses per Customer',
                      admin: {
                        width: '100%',
                        description: '0 means unlimited per customer.',
                      },
                    },
                  ],
                },
              ],
            },
            {
              label: 'Targeting & Schedule',
              fields: [
                {
                  type: 'row',
                  admin: {
                    condition: (data) => Boolean(data?.enableTotalPercentageOffer),
                  },
                  fields: [
                    {
                      name: 'totalPercentageOfferAvailableFromDate',
                      type: 'date',
                      label: 'Available From Date',
                      admin: {
                        width: '25%',
                        date: {
                          pickerAppearance: 'dayOnly',
                        },
                        description: 'Optional start date.',
                      },
                    },
                    {
                      name: 'totalPercentageOfferAvailableToDate',
                      type: 'date',
                      label: 'Available To Date',
                      admin: {
                        width: '25%',
                        date: {
                          pickerAppearance: 'dayOnly',
                        },
                        description: 'Optional end date.',
                      },
                    },
                    {
                      name: 'totalPercentageOfferDailyStartTime',
                      type: 'select',
                      options: RAILWAY_TIME_OPTIONS,
                      label: 'Daily Start Time',
                      admin: {
                        width: '25%',
                        description: 'Select 24-hour (railway) time.',
                      },
                    },
                    {
                      name: 'totalPercentageOfferDailyEndTime',
                      type: 'select',
                      options: RAILWAY_TIME_OPTIONS,
                      label: 'Daily End Time',
                      admin: {
                        width: '25%',
                        description: 'Select 24-hour (railway) time.',
                      },
                    },
                  ],
                },
              ],
            },
            {
              label: 'Progress',
              fields: [
                {
                  type: 'row',
                  admin: {
                    condition: (data) => Boolean(data?.enableTotalPercentageOffer),
                  },
                  fields: [
                    {
                      name: 'totalPercentageOfferGivenCount',
                      type: 'number',
                      min: 0,
                      defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferGivenCount,
                      label: 'Given Count',
                      admin: {
                        width: '50%',
                        readOnly: true,
                      },
                    },
                    {
                      name: 'totalPercentageOfferCustomerCount',
                      type: 'number',
                      min: 0,
                      defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferCustomerCount,
                      label: 'Customer Count',
                      admin: {
                        width: '50%',
                        readOnly: true,
                      },
                    },
                  ],
                },
                {
                  name: 'totalPercentageOfferCustomers',
                  type: 'relationship',
                  relationTo: 'customers',
                  hasMany: true,
                  admin: {
                    condition: (data) => Boolean(data?.enableTotalPercentageOffer),
                    hidden: true,
                    readOnly: true,
                  },
                },
                {
                  name: 'totalPercentageOfferCustomerUsage',
                  type: 'array',
                  label: 'Customer Usage',
                  admin: {
                    condition: (data) => Boolean(data?.enableTotalPercentageOffer),
                    hidden: true,
                    readOnly: true,
                    description: 'Per-customer usage count for total percentage offer.',
                  },
                  fields: [
                    {
                      name: 'customer',
                      type: 'relationship',
                      relationTo: 'customers',
                      required: true,
                      admin: {
                        width: '70%',
                        readOnly: true,
                      },
                    },
                    {
                      name: 'usageCount',
                      type: 'number',
                      min: 0,
                      defaultValue: 0,
                      required: true,
                      admin: {
                        width: '30%',
                        readOnly: true,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
