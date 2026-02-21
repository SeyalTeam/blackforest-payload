import { CollectionConfig, APIError, type Payload } from 'payload'
import { getProductStock } from '../utilities/inventory'
import { updateItemStatus } from '../endpoints/updateItemStatus'
import {
  calculatePointsForSpend,
  type CustomerRewardSettings,
  getCustomerRewardSettings,
  type ProductPriceOfferRule,
  type ProductToProductOfferRule,
} from '../utilities/customerRewards'
import { withWriteConflictRetry } from '../utilities/mongoRetry'

const toSafeNonNegativeNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return value
}

const toMoneyValue = (value: number): number => {
  return parseFloat(value.toFixed(2))
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
  effectiveUnitPrice?: number
  isRandomCustomerOfferItem?: boolean
  randomCustomerOfferCampaignCode?: string
  [key: string]: unknown
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

const getProductNameMap = async (payload: Payload, productIDs: string[]): Promise<Record<string, string>> => {
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

const canApplyRuleWithinLimits = (
  maxOfferCount: number,
  offerGivenCount: number,
  maxCustomerCount: number,
  offerCustomerCount: number,
  offerCustomers: string[],
  customerID: string | null,
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

const applyProductToProductOffers = async (
  items: BillingItemInput[],
  payload: Payload,
  status: string,
  settings: CustomerRewardSettings,
  customerID: string | null,
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
      canApplyRuleWithinLimits(
        rule.maxOfferCount,
        rule.offerGivenCount,
        rule.maxCustomerCount,
        rule.offerCustomerCount,
        rule.offerCustomers,
        customerID,
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

  const desiredOffers = new Map<
    string,
    { rule: ProductToProductOfferRule; freeQuantity: number }
  >()

  for (const rule of activeRules) {
    const purchasedQty = purchasedByProduct.get(rule.buyProduct) || 0
    const ruleTriggerCount = Math.floor(purchasedQty / rule.buyQuantity)
    const freeQuantity = ruleTriggerCount * rule.freeQuantity
    if (freeQuantity <= 0) continue

    desiredOffers.set(buildRuleKey(rule), { rule, freeQuantity })
  }

  if (desiredOffers.size === 0) {
    return manualItems
  }

  const existingAutoItemByRule = new Map<string, BillingItemInput>()
  for (const item of items) {
    if (!item.isOfferFreeItem || typeof item.offerRuleKey !== 'string') continue
    if (!existingAutoItemByRule.has(item.offerRuleKey)) {
      existingAutoItemByRule.set(item.offerRuleKey, item)
    }
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
      effectiveUnitPrice: getPositiveNumericValue(item.unitPrice),
    }))
  }

  const activeRules = settings.productPriceOffers.filter(
    (rule) =>
      rule.enabled &&
      canApplyRuleWithinLimits(
        rule.maxOfferCount,
        rule.offerGivenCount,
        rule.maxCustomerCount,
        rule.offerCustomerCount,
        rule.offerCustomers,
        customerID,
      ),
  )
  if (activeRules.length === 0) {
    return items.map((item) => ({
      ...item,
      isPriceOfferApplied: false,
      priceOfferRuleKey: undefined,
      priceOfferDiscountPerUnit: 0,
      effectiveUnitPrice: getPositiveNumericValue(item.unitPrice),
    }))
  }

  const ruleByProduct = new Map<string, ProductPriceOfferRule>()
  for (const rule of activeRules) {
    if (!ruleByProduct.has(rule.product)) {
      ruleByProduct.set(rule.product, rule)
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
        effectiveUnitPrice: unitPrice,
      }
    }

    const rule = ruleByProduct.get(productID)
    if (!rule) {
      return {
        ...item,
        isPriceOfferApplied: false,
        priceOfferRuleKey: undefined,
        priceOfferDiscountPerUnit: 0,
        effectiveUnitPrice: unitPrice,
      }
    }

    const discountPerUnit = Math.min(unitPrice, rule.discountAmount)
    const effectiveUnitPrice = toMoneyValue(Math.max(0, unitPrice - discountPerUnit))

    return {
      ...item,
      isPriceOfferApplied: discountPerUnit > 0,
      priceOfferRuleKey: buildPriceOfferRuleKey(rule),
      priceOfferDiscountPerUnit: toMoneyValue(discountPerUnit),
      effectiveUnitPrice,
    }
  })
}

const applyRandomCustomerProductOffer = async (
  items: BillingItemInput[],
  payload: Payload,
  status: string,
  customerPhoneNumber: string | null,
  settings: CustomerRewardSettings,
): Promise<BillingItemInput[]> => {
  const nonRandomOfferItems = items.filter((item) => !item.isRandomCustomerOfferItem)

  if (
    status === 'cancelled' ||
    !settings.enableRandomCustomerProductOffer ||
    settings.randomCustomerOfferProducts.length === 0 ||
    !customerPhoneNumber
  ) {
    return nonRandomOfferItems
  }

  const activeRandomProductIDs = new Set(
    settings.randomCustomerOfferProducts
      .filter((row) => row.enabled)
      .map((row) => row.product),
  )

  if (activeRandomProductIDs.size === 0) {
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
        randomCustomerOfferAssigned?: boolean
        randomCustomerOfferRedeemed?: boolean
        randomCustomerOfferProduct?: unknown
        randomCustomerOfferCampaignCode?: string | null
      }
    | undefined

  if (!customer?.randomCustomerOfferAssigned || customer.randomCustomerOfferRedeemed) {
    return nonRandomOfferItems
  }

  const customerAssignedProductID = getRelationshipID(customer.randomCustomerOfferProduct)
  const campaignCode = customer.randomCustomerOfferCampaignCode || null

  if (
    !customerAssignedProductID ||
    campaignCode !== settings.randomCustomerOfferCampaignCode ||
    !activeRandomProductIDs.has(customerAssignedProductID)
  ) {
    return nonRandomOfferItems
  }

  const existingRandomOfferItem = items.find((item) => item.isRandomCustomerOfferItem)
  const productNameMap = await getProductNameMap(payload, [customerAssignedProductID])
  const productName = productNameMap[customerAssignedProductID] || 'Random Offer Product'

  const randomOfferItem: BillingItemInput = {
    ...(existingRandomOfferItem || {}),
    product: customerAssignedProductID,
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
    isRandomCustomerOfferItem: true,
    randomCustomerOfferCampaignCode: campaignCode || settings.randomCustomerOfferCampaignCode,
  }

  return [...nonRandomOfferItems, randomOfferItem]
}

const applyConfiguredItemOffers = async (
  items: BillingItemInput[],
  payload: Payload,
  status: string,
  customerPhoneNumber: string | null,
): Promise<BillingItemInput[]> => {
  const settings = await getCustomerRewardSettings(payload)
  let customerID: string | null = null
  if (customerPhoneNumber) {
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
    const customer = customerResult.docs[0]
    if (customer?.id) {
      customerID = customer.id
    }
  }

  const itemsWithProductOffers = await applyProductToProductOffers(
    items,
    payload,
    status,
    settings,
    customerID,
  )
  const itemsWithRandomOffer = await applyRandomCustomerProductOffer(
    itemsWithProductOffers,
    payload,
    status,
    customerPhoneNumber,
    settings,
  )
  return applyProductPriceOffers(itemsWithRandomOffer, status, settings, customerID)
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
  endpoints: [
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

        // 🪑 Map table details from Flutter app (top-level section/tableNumber) to nested group
        const rawData = data as any
        const hasTableDetails =
          rawData.section ||
          rawData.tableNumber ||
          data.tableDetails?.section ||
          data.tableDetails?.tableNumber

        if (rawData.section || rawData.tableNumber) {
          data.tableDetails = {
            ...data.tableDetails,
            section: rawData.section || data.tableDetails?.section,
            tableNumber: rawData.tableNumber || data.tableDetails?.tableNumber,
          }
        }

        // 🎯 Ensure default status for table/KOT orders
        if (hasTableDetails && (!data.status || data.status === 'pending')) {
          data.status = 'ordered'
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
        if (Array.isArray(mutableValidateData.items)) {
          const effectiveStatus = mutableValidateData.status || originalDoc?.status || 'ordered'
          const customerPhoneNumber =
            (data as any)?.customerDetails?.phoneNumber || originalDoc?.customerDetails?.phoneNumber
          mutableValidateData.items = await applyConfiguredItemOffers(
            mutableValidateData.items,
            req.payload,
            effectiveStatus,
            customerPhoneNumber || null,
          )
        }

        // 1️⃣ Fix missing data for validation (Auto-set fields early)

        if (operation === 'create') {
          // 🏢 Auto-set company from branch early to pass validation
          const branchId = data.branch
          if (branchId) {
            const branch = await req.payload.findByID({
              collection: 'branches',
              id: typeof branchId === 'object' ? branchId.id : branchId,
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
        if ((operation === 'create' || operation === 'update') && data.status !== 'cancelled') {
          const items = data.items || []
          const branchId = data.branch || originalDoc?.branch

          if (branchId && items.length > 0) {
            for (const item of items) {
              const productId = typeof item.product === 'object' ? item.product.id : item.product
              if (!productId) continue

              // 🚫 Skip inventory check for cancelled items
              if (item.status === 'cancelled') continue

              const currentStock = await getProductStock(req.payload, productId, branchId)

              // If it's an update, we need to account for the quantity already in this document
              let existingQty = 0
              if (operation === 'update' && originalDoc?.items) {
                const originalItem = (
                  originalDoc.items as Array<{ product: any; quantity: number }>
                ).find((oi) => {
                  const oiId = typeof oi.product === 'object' ? oi.product.id : oi.product
                  return oiId === productId
                })
                if (originalItem) {
                  existingQty = originalItem.quantity || 0
                }
              }

              const requestedQty = item.quantity || 0
              const additionalQtyNeeded = requestedQty - existingQty

              if (additionalQtyNeeded > currentStock) {
                console.log(
                  `[Inventory] WARNING: ${item.name} (${requestedQty} needed, ${currentStock} available). Proceeding due to override.`,
                )
                // throw new APIError(
                //   `Insufficient stock for ${item.name}. Current stock: ${currentStock}, Requested: ${requestedQty}${operation === 'update' ? ` (Additional: ${additionalQtyNeeded})` : ''}`,
                //   400,
                // )
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

        const mutableData = data as { items?: BillingItemInput[]; status?: string }
        if (Array.isArray(mutableData.items)) {
          const effectiveStatus = mutableData.status || originalDoc?.status || 'ordered'
          const customerPhoneNumber =
            (data as any)?.customerDetails?.phoneNumber || originalDoc?.customerDetails?.phoneNumber
          mutableData.items = await applyConfiguredItemOffers(
            mutableData.items,
            req.payload,
            effectiveStatus,
            customerPhoneNumber || null,
          )
        }

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
          const date = new Date()
          const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '')

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

              if (isKOT) {
                // KOT Numbering: PREFIX-YYYYMMDD-KOTxx
                // We find the latest KOT number to avoid collisions if documents were deleted
                const lastKOT = await req.payload.find({
                  collection: 'billings',
                  where: {
                    kotNumber: {
                      like: `${prefix}-${formattedDate}-KOT`,
                    },
                  },
                  sort: '-kotNumber',
                  limit: 1,
                  depth: 0,
                })

                let seq = 1
                if (lastKOT.docs.length > 0) {
                  const lastNumStr = lastKOT.docs[0].kotNumber?.split('KOT')[1]
                  if (lastNumStr) {
                    seq = parseInt(lastNumStr, 10) + 1
                  }
                }

                const kotNum = `${prefix}-${formattedDate}-KOT${seq.toString().padStart(2, '0')}`
                data.invoiceNumber = kotNum
                data.kotNumber = kotNum
              } else {
                // Regular Numbering: PREFIX-YYYYMMDD-xxx (independent of KOT)
                const lastInvoice = await req.payload.find({
                  collection: 'billings',
                  where: {
                    and: [
                      {
                        invoiceNumber: {
                          like: `${prefix}-${formattedDate}-`,
                        },
                      },
                      {
                        invoiceNumber: {
                          not_like: '-KOT',
                        },
                      },
                    ],
                  },
                  sort: '-invoiceNumber',
                  limit: 1,
                  depth: 0,
                })

                let seq = 1
                if (lastInvoice.docs.length > 0) {
                  const lastInvoiceNumber = lastInvoice.docs[0].invoiceNumber
                  if (lastInvoiceNumber) {
                    const parts = lastInvoiceNumber.split('-')
                    const lastSeq = parts[parts.length - 1]
                    if (lastSeq && !isNaN(parseInt(lastSeq, 10))) {
                      seq = parseInt(lastSeq, 10) + 1
                    }
                  }
                }
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

        const pricingData = data as any
        const effectiveStatus = pricingData.status || originalDoc?.status || 'ordered'

        // 🧮 Final subtotal & total calculation (gross amount before customer offer)
        let calculatedGrossAmount = toSafeNonNegativeNumber(
          (originalDoc as any)?.grossAmount ?? originalDoc?.totalAmount,
        )

        if (pricingData.items && Array.isArray(pricingData.items)) {
          pricingData.items = pricingData.items.map(
            (item: {
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
              return {
                ...item,
                effectiveUnitPrice: toMoneyValue(Math.max(0, effectiveUnitPrice || 0)),
                subtotal: parseFloat(((qty || 0) * (effectiveUnitPrice || 0)).toFixed(2)),
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

        if (effectiveStatus === 'completed') {
          const phoneNumber =
            pricingData.customerDetails?.phoneNumber || originalDoc?.customerDetails?.phoneNumber

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

            if (!phoneNumber) return null

            const customerResult = await req.payload.find({
              collection: 'customers',
              where: {
                phoneNumber: {
                  equals: phoneNumber,
                },
              },
              depth: 0,
              limit: 1,
            })

            customerCache = customerResult.docs[0] || null
            return customerCache
          }

          if (originalOfferWasApplied) {
            offerApplied = true
            offerDiscount = Math.min(existingAppliedDiscount, pricingData.grossAmount)
            pricingData.applyCustomerOffer = true
          } else if (pricingData.applyCustomerOffer && !rewardAlreadyProcessed) {
            if (phoneNumber) {
              const settings = await getSettings()

              if (settings.enabled) {
                const customer = await getCustomer()
                let rewardPoints = toSafeNonNegativeNumber(customer?.rewardPoints)
                let rewardProgressAmount = toSafeNonNegativeNumber(customer?.rewardProgressAmount)

                if (rewardPoints < settings.pointsNeededForOffer) {
                  const historySnapshot = await computeRewardSnapshotFromCompletedHistory(
                    req.payload,
                    phoneNumber,
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

          const amountAfterCustomerOffer = toMoneyValue(Math.max(0, pricingData.grossAmount - offerDiscount))

          if (originalTotalPercentageOfferWasApplied) {
            totalPercentageOfferApplied = true
            totalPercentageOfferDiscount = Math.min(
              existingTotalPercentageOfferDiscount,
              amountAfterCustomerOffer,
            )
          } else {
            const settings = await getSettings()
            if (settings.enableTotalPercentageOffer && settings.totalPercentageOfferPercent > 0) {
              const customer = await getCustomer()
              const customerID = typeof customer?.id === 'string' ? customer.id : null

              const canApplyPercentageOffer = canApplyRuleWithinLimits(
                settings.totalPercentageOfferMaxOfferCount,
                settings.totalPercentageOfferGivenCount,
                settings.totalPercentageOfferMaxCustomerCount,
                settings.totalPercentageOfferCustomerCount,
                settings.totalPercentageOfferCustomers,
                customerID,
              )

              if (canApplyPercentageOffer) {
                const discountAmount = toMoneyValue(
                  (amountAfterCustomerOffer * settings.totalPercentageOfferPercent) / 100,
                )
                totalPercentageOfferDiscount = Math.min(amountAfterCustomerOffer, discountAmount)
                totalPercentageOfferApplied = totalPercentageOfferDiscount > 0
              }
            }
          }
        }

        pricingData.customerOfferApplied = offerApplied
        pricingData.customerOfferDiscount = toMoneyValue(offerDiscount)
        pricingData.totalPercentageOfferApplied = totalPercentageOfferApplied
        pricingData.totalPercentageOfferDiscount = toMoneyValue(totalPercentageOfferDiscount)
        pricingData.totalAmount = toMoneyValue(
          Math.max(
            0,
            pricingData.grossAmount -
              pricingData.customerOfferDiscount -
              pricingData.totalPercentageOfferDiscount,
          ),
        )

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (!doc) return

        const requestContext = (req as any).context as Record<string, unknown> | undefined
        if (requestContext?.skipCustomerRewardProcessing || requestContext?.skipOfferCounterProcessing) {
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

              const randomOfferWasApplied =
                doc.status === 'completed' &&
                Array.isArray(doc.items) &&
                doc.items.some((item: any) => item?.isRandomCustomerOfferItem)

              if (
                randomOfferWasApplied &&
                customerDoc?.randomCustomerOfferAssigned &&
                !customerDoc?.randomCustomerOfferRedeemed
              ) {
                const redeemedCustomerID =
                  typeof customerDoc?.id === 'string' ? customerDoc.id : undefined
                const redeemedProductID = getRelationshipID(customerDoc?.randomCustomerOfferProduct)

                customerDoc = await req.payload.update({
                  collection: 'customers',
                  id: customerDoc.id,
                  data: {
                    randomCustomerOfferRedeemed: true,
                  } as any,
                  depth: 0,
                  overrideAccess: true,
                })

                const settings = await getSettings()
                const campaignCode =
                  customerDoc?.randomCustomerOfferCampaignCode ||
                  settings.randomCustomerOfferCampaignCode

                if (campaignCode === settings.randomCustomerOfferCampaignCode) {
                  const currentRedeemedCount = toSafeNonNegativeNumber(
                    settings.randomCustomerOfferRedeemedCount,
                  )

                  let rowUpdated = false
                  const updatedRandomOfferRows = settings.randomCustomerOfferProducts.map((row) => {
                    const shouldIncrement =
                      !rowUpdated &&
                      Boolean(redeemedCustomerID) &&
                      Boolean(redeemedProductID) &&
                      row.product === redeemedProductID &&
                      row.selectedCustomers.includes(redeemedCustomerID || '')

                    if (!shouldIncrement) {
                      return {
                        id: row.id,
                        enabled: row.enabled,
                        product: row.product,
                        winnerCount: row.winnerCount,
                        selectedCustomers: row.selectedCustomers,
                        assignedCount: row.assignedCount,
                        redeemedCount: row.redeemedCount,
                      }
                    }

                    rowUpdated = true

                    return {
                      id: row.id,
                      enabled: row.enabled,
                      product: row.product,
                      winnerCount: row.winnerCount,
                      selectedCustomers: row.selectedCustomers,
                      assignedCount: row.assignedCount,
                      redeemedCount: row.redeemedCount + 1,
                    }
                  })

                  await withWriteConflictRetry(() =>
                    req.payload.updateGlobal({
                      slug: 'customer-offer-settings' as any,
                      data: {
                        randomCustomerOfferRedeemedCount: currentRedeemedCount + 1,
                        randomCustomerOfferProducts: updatedRandomOfferRows,
                      } as any,
                      depth: 0,
                      overrideAccess: true,
                    }),
                  )
                }
              }

              const shouldProcessOfferCounters =
                doc.status === 'completed' && !Boolean((doc as any).offerCountersProcessed)

              if (shouldProcessOfferCounters) {
                try {
                  const settings = await getSettings()
                  const customerID = typeof customerDoc?.id === 'string' ? customerDoc.id : null
                  const billItems = Array.isArray(doc.items) ? (doc.items as any[]) : []

                  const p2pUsageByRule = new Map<string, number>()
                  const priceUsageByRule = new Map<string, number>()

                  const p2pRuleByKey = new Map(
                    settings.productToProductOffers.map((rule) => [buildRuleKey(rule), rule]),
                  )
                  const priceRuleByKey = new Map(
                    settings.productPriceOffers.map((rule) => [buildPriceOfferRuleKey(rule), rule]),
                  )

                  for (const item of billItems) {
                    if (item?.isOfferFreeItem && typeof item?.offerRuleKey === 'string') {
                      const rule = p2pRuleByKey.get(item.offerRuleKey)
                      const quantity = toSafeNonNegativeNumber(item?.quantity)
                      const divisor = rule?.freeQuantity ? Math.max(1, rule.freeQuantity) : 1
                      const increment = quantity > 0 ? Math.max(1, Math.floor(quantity / divisor)) : 1
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
                      const quantity = toSafeNonNegativeNumber(item?.quantity)
                      const increment = quantity > 0 ? quantity : 1
                      priceUsageByRule.set(
                        item.priceOfferRuleKey,
                        (priceUsageByRule.get(item.priceOfferRuleKey) || 0) + increment,
                      )
                    }
                  }

                  let settingsChanged = false

                  const updatedProductToProductRules = settings.productToProductOffers.map((rule) => {
                    const key = buildRuleKey(rule)
                    const usageIncrement = p2pUsageByRule.get(key) || 0
                    const nextCustomers = [...rule.offerCustomers]

                    if (usageIncrement > 0 && customerID && !nextCustomers.includes(customerID)) {
                      nextCustomers.push(customerID)
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
                      buyProduct: rule.buyProduct,
                      buyQuantity: rule.buyQuantity,
                      freeProduct: rule.freeProduct,
                      freeQuantity: rule.freeQuantity,
                      maxOfferCount: rule.maxOfferCount,
                      maxCustomerCount: rule.maxCustomerCount,
                      offerGivenCount: nextGivenCount,
                      offerCustomerCount: nextCustomerCount,
                      offerCustomers: nextCustomers,
                    }
                  })

                  const updatedProductPriceRules = settings.productPriceOffers.map((rule) => {
                    const key = buildPriceOfferRuleKey(rule)
                    const usageIncrement = priceUsageByRule.get(key) || 0
                    const nextCustomers = [...rule.offerCustomers]

                    if (usageIncrement > 0 && customerID && !nextCustomers.includes(customerID)) {
                      nextCustomers.push(customerID)
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
                      product: rule.product,
                      discountAmount: rule.discountAmount,
                      maxOfferCount: rule.maxOfferCount,
                      maxCustomerCount: rule.maxCustomerCount,
                      offerGivenCount: nextGivenCount,
                      offerCustomerCount: nextCustomerCount,
                      offerCustomers: nextCustomers,
                    }
                  })

                  const totalPercentageOfferUsageIncrement =
                    Boolean((doc as any).totalPercentageOfferApplied) &&
                    toSafeNonNegativeNumber((doc as any).totalPercentageOfferDiscount) > 0
                      ? 1
                      : 0

                  const nextTotalPercentageOfferCustomers = [...settings.totalPercentageOfferCustomers]
                  if (
                    totalPercentageOfferUsageIncrement > 0 &&
                    customerID &&
                    !nextTotalPercentageOfferCustomers.includes(customerID)
                  ) {
                    nextTotalPercentageOfferCustomers.push(customerID)
                  }

                  const nextTotalPercentageOfferGivenCount =
                    totalPercentageOfferUsageIncrement > 0
                      ? settings.totalPercentageOfferGivenCount + totalPercentageOfferUsageIncrement
                      : settings.totalPercentageOfferGivenCount
                  const nextTotalPercentageOfferCustomerCount = nextTotalPercentageOfferCustomers.length

                  if (
                    totalPercentageOfferUsageIncrement > 0 ||
                    nextTotalPercentageOfferGivenCount !== settings.totalPercentageOfferGivenCount ||
                    nextTotalPercentageOfferCustomerCount !==
                      settings.totalPercentageOfferCustomerCount
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
                          totalPercentageOfferGivenCount: nextTotalPercentageOfferGivenCount,
                          totalPercentageOfferCustomerCount: nextTotalPercentageOfferCustomerCount,
                          totalPercentageOfferCustomers: nextTotalPercentageOfferCustomers,
                        } as any,
                        depth: 0,
                        overrideAccess: true,
                      }),
                    )
                  }

                  await req.payload.update({
                    collection: 'billings',
                    id: doc.id,
                    data: {
                      offerCountersProcessed: true,
                    } as any,
                    depth: 0,
                    overrideAccess: true,
                    context: {
                      skipCustomerRewardProcessing: true,
                      skipOfferCounterProcessing: true,
                    },
                  })
                } catch (offerCounterError) {
                  console.error('Offer counter processing failed. Reward processing will continue.', {
                    billID: doc.id,
                    error: offerCounterError,
                  })
                }
              }

              const shouldProcessRewards =
                doc.status === 'completed' && !Boolean((doc as any).customerRewardProcessed)

              if (shouldProcessRewards) {
                const settings = await getSettings()

                if (!settings.enabled) {
                  await req.payload.update({
                    collection: 'billings',
                    id: doc.id,
                    data: {
                      customerRewardProcessed: true,
                      customerRewardPointsEarned: 0,
                    } as any,
                    depth: 0,
                    overrideAccess: true,
                    context: {
                      skipCustomerRewardProcessing: true,
                    },
                  })
                  return doc
                }

                let rewardPoints = toSafeNonNegativeNumber(customerDoc?.rewardPoints)
                let rewardProgressAmount = toSafeNonNegativeNumber(customerDoc?.rewardProgressAmount)
                const offerDiscount = toSafeNonNegativeNumber((doc as any).customerOfferDiscount)
                const offerWasApplied = Boolean((doc as any).customerOfferApplied) && offerDiscount > 0
                const grossAmount = toSafeNonNegativeNumber((doc as any).grossAmount ?? doc.totalAmount)
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

                await req.payload.update({
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
                })

                await req.payload.update({
                  collection: 'billings',
                  id: doc.id,
                  data: {
                    customerRewardProcessed: true,
                    customerRewardPointsEarned: earnedPointsForBill,
                  } as any,
                  depth: 0,
                  overrideAccess: true,
                  context: {
                    skipCustomerRewardProcessing: true,
                  },
                })
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
            condition: (data) =>
              ['ordered', 'prepared', 'delivered'].includes(data.status),
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
