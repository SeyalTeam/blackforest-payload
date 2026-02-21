import type { GlobalConfig, Payload } from 'payload'
import { DEFAULT_CUSTOMER_REWARD_SETTINGS } from '../utilities/customerRewards'
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

const shuffleArray = <T,>(input: T[]): T[] => {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }
  return arr
}

const getAllCustomerIDs = async (payload: Payload): Promise<string[]> => {
  const ids: string[] = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await payload.find({
      collection: 'customers',
      page,
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })

    for (const row of result.docs) {
      if (typeof row.id === 'string') {
        ids.push(row.id)
      }
    }

    hasNextPage = result.hasNextPage
    page += 1
  }

  return ids
}

type RandomOfferRow = {
  id: string
  enabled: boolean
  productID: string | null
  winnerCount: number
  selectedCustomers: string[]
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
      selectedCustomers: extractRelationshipIDs(raw.selectedCustomers),
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
          enableRandomCustomerProductOffer?: boolean
          randomCustomerOfferProducts?: unknown[]
          randomCustomerOfferCampaignCode?: string
        }

        const isEnabled = Boolean(mutableDoc.enableRandomCustomerProductOffer)
        const currentRows = parseRandomOfferRows(mutableDoc.randomCustomerOfferProducts)
        const previousRows = parseRandomOfferRows(previousMutableDoc.randomCustomerOfferProducts)

        const activeCurrentRows = currentRows.filter((row) => row.enabled && row.productID)
        const activePreviousRows = previousRows.filter((row) => row.enabled && row.productID)

        const campaignCode =
          typeof mutableDoc.randomCustomerOfferCampaignCode === 'string' &&
          mutableDoc.randomCustomerOfferCampaignCode.trim().length > 0
            ? mutableDoc.randomCustomerOfferCampaignCode.trim()
            : DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferCampaignCode

        const previousCampaignCode =
          typeof previousMutableDoc.randomCustomerOfferCampaignCode === 'string'
            ? previousMutableDoc.randomCustomerOfferCampaignCode
            : DEFAULT_CUSTOMER_REWARD_SETTINGS.randomCustomerOfferCampaignCode

        const previousWinnerIDs = [
          ...new Set(activePreviousRows.flatMap((row) => row.selectedCustomers)),
        ]
        const currentWinnerIDs = [...new Set(activeCurrentRows.flatMap((row) => row.selectedCustomers))]

        const currentRowSignature = activeCurrentRows
          .map((row) => `${row.id}:${row.productID}:${row.winnerCount}`)
          .sort()
          .join('|')

        const previousRowSignature = activePreviousRows
          .map((row) => `${row.id}:${row.productID}:${row.winnerCount}`)
          .sort()
          .join('|')

        const configChanged =
          isEnabled !== Boolean(previousMutableDoc.enableRandomCustomerProductOffer) ||
          currentRowSignature !== previousRowSignature ||
          campaignCode !== previousCampaignCode

        const shouldReselect = configChanged || Boolean(mutableDoc.reselectRandomCustomerOffer)

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
                '[CustomerOfferSettings] Failed deferred updateGlobal after random assignment.',
                error,
              )
            })
          }, 0)
        }

        const clearCustomerAssignments = async (customerIDs: string[]) => {
          if (customerIDs.length === 0) return

          await Promise.all(
            customerIDs.map((customerID) =>
              req.payload.update({
                collection: 'customers',
                id: customerID,
                data: {
                  randomCustomerOfferAssigned: false,
                  randomCustomerOfferRedeemed: false,
                  randomCustomerOfferProduct: null,
                  randomCustomerOfferCampaignCode: null,
                  randomCustomerOfferAssignedAt: null,
                } as any,
                depth: 0,
                overrideAccess: true,
              }),
            ),
          )
        }

        if (!isEnabled || activeCurrentRows.length === 0) {
          const idsToClear = [...new Set([...previousWinnerIDs, ...currentWinnerIDs])]

          await clearCustomerAssignments(idsToClear)

          scheduleSettingsRefresh({
            randomCustomerOfferAssignedCount: 0,
            randomCustomerOfferRedeemedCount: 0,
            randomCustomerOfferLastAssignedAt: null,
            reselectRandomCustomerOffer: false,
            randomCustomerOfferProducts: [],
          })

          return doc
        }

        if (!shouldReselect) {
          return doc
        }

        const allCustomerIDs = await getAllCustomerIDs(req.payload)
        let remainingPool = shuffleArray(allCustomerIDs)

        const assignmentByRow = new Map<string, string[]>()
        for (const row of activeCurrentRows) {
          const count = Math.min(row.winnerCount, remainingPool.length)
          const selected = remainingPool.slice(0, count)
          remainingPool = remainingPool.slice(count)
          assignmentByRow.set(row.id, selected)
        }

        const idsToClear = [...new Set([...previousWinnerIDs, ...currentWinnerIDs])]
        await clearCustomerAssignments(idsToClear)

        const assignedAt = new Date().toISOString()
        const assignedCustomerIDs = [...new Set(Array.from(assignmentByRow.values()).flat())]
        const assignedProductByCustomer = new Map<string, string>()

        for (const row of activeCurrentRows) {
          const selected = assignmentByRow.get(row.id) || []
          if (!row.productID) continue
          for (const customerID of selected) {
            assignedProductByCustomer.set(customerID, row.productID)
          }
        }

        await Promise.all(
          assignedCustomerIDs.map((customerID) =>
            req.payload.update({
              collection: 'customers',
              id: customerID,
              data: {
                randomCustomerOfferAssigned: true,
                randomCustomerOfferRedeemed: false,
                randomCustomerOfferProduct: assignedProductByCustomer.get(customerID) || null,
                randomCustomerOfferCampaignCode: campaignCode,
                randomCustomerOfferAssignedAt: assignedAt,
              } as any,
              depth: 0,
              overrideAccess: true,
            }),
          ),
        )

        const updatedRows = currentRows.map((row) => {
          const selected = assignmentByRow.get(row.id) || []
          return {
            id: row.id,
            enabled: row.enabled,
            product: row.productID,
            winnerCount: row.winnerCount,
            selectedCustomers: selected,
            assignedCount: selected.length,
            redeemedCount: 0,
          }
        })

        scheduleSettingsRefresh({
          randomCustomerOfferProducts: updatedRows,
          randomCustomerOfferAssignedCount: assignedCustomerIDs.length,
          randomCustomerOfferRedeemedCount: 0,
          randomCustomerOfferLastAssignedAt: assignedAt,
          reselectRandomCustomerOffer: false,
        })

        return doc
      },
    ],
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Enable Customer Credit Offer',
      defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.enabled,
      admin: {
        description:
          'Credit-point offer type. Can be used independently or together with product-to-product offer.',
      },
    },
    {
      type: 'row',
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
        description:
          'When enabled, customer points/progress are reset after the offer is used. They must purchase again to earn fresh points.',
      },
    },
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
                width: '25%',
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
                width: '25%',
                description: '0 means unlimited.',
              },
            },
            {
              name: 'offerGivenCount',
              type: 'number',
              min: 0,
              defaultValue: 0,
              label: 'Given Count',
              admin: {
                width: '25%',
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
                width: '25%',
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
      ],
    },
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
                width: '25%',
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
                width: '25%',
                description: '0 means unlimited.',
              },
            },
            {
              name: 'offerGivenCount',
              type: 'number',
              min: 0,
              defaultValue: 0,
              label: 'Given Count',
              admin: {
                width: '25%',
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
                width: '25%',
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
      ],
    },
    {
      name: 'enableRandomCustomerProductOffer',
      type: 'checkbox',
      label: 'Enable Random Customer Product Offer',
      defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.enableRandomCustomerProductOffer,
      admin: {
        description:
          'Fourth offer type. Add multiple products with winner counts; system assigns each to random customers.',
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
            width: '100%',
            description: 'Change this code to start a new random campaign.',
          },
        },
      ],
    },
    {
      name: 'randomCustomerOfferProducts',
      type: 'array',
      label: 'Random Offer Products and Counts',
      admin: {
        condition: (data) => Boolean(data?.enableRandomCustomerProductOffer),
        description: 'Add multiple products and set how many random customers should get each.',
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
                width: '35%',
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
              name: 'assignedCount',
              type: 'number',
              min: 0,
              defaultValue: 0,
              label: 'Assigned',
              admin: {
                width: '15%',
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
                width: '15%',
                readOnly: true,
              },
            },
            {
              name: 'selectedCustomers',
              type: 'relationship',
              relationTo: 'customers',
              hasMany: true,
              label: 'Selected Customers',
              admin: {
                width: '15%',
                readOnly: true,
              },
            },
          ],
        },
      ],
    },
    {
      name: 'reselectRandomCustomerOffer',
      type: 'checkbox',
      label: 'Re-pick Random Winners on Save',
      defaultValue: false,
      admin: {
        condition: (data) => Boolean(data?.enableRandomCustomerProductOffer),
        description: 'Tick and save to generate a fresh random customer list.',
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
          label: 'Assigned Customers',
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
          label: 'Last Assigned At',
          admin: {
            width: '34%',
            readOnly: true,
          },
        },
      ],
    },
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
            width: '50%',
            description: 'Example: 10 means 10% discount on total amount.',
          },
        },
        {
          name: 'totalPercentageOfferMaxOfferCount',
          type: 'number',
          min: 0,
          defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferMaxOfferCount,
          label: 'Max Offer Uses',
          admin: {
            width: '50%',
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
          name: 'totalPercentageOfferMaxCustomerCount',
          type: 'number',
          min: 0,
          defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferMaxCustomerCount,
          label: 'Max Customers',
          admin: {
            width: '34%',
            description: '0 means unlimited.',
          },
        },
        {
          name: 'totalPercentageOfferGivenCount',
          type: 'number',
          min: 0,
          defaultValue: DEFAULT_CUSTOMER_REWARD_SETTINGS.totalPercentageOfferGivenCount,
          label: 'Given Count',
          admin: {
            width: '33%',
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
            width: '33%',
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
        readOnly: true,
      },
    },
  ],
}
