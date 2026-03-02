'use client'

import React, { useCallback, useEffect, useState } from 'react'
import AsyncSelect from 'react-select/async'
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import './customer-offer-widget.scss'

type Option = { value: string; label: string }
type ProductOptionsResponse = { options?: Option[] }
type OfferRule = Record<string, unknown>

type CustomerOfferSettings = {
  enabled?: boolean
  allowCustomerCreditOfferOnBillings?: boolean
  allowCustomerCreditOfferOnTableOrders?: boolean
  spendAmountPerStep?: number
  pointsPerStep?: number
  pointsNeededForOffer?: number
  offerAmount?: number
  resetOnRedeem?: boolean

  enableProductToProductOffer?: boolean
  allowProductToProductOfferOnBillings?: boolean
  allowProductToProductOfferOnTableOrders?: boolean
  productToProductOffers?: OfferRule[]

  enableProductPriceOffer?: boolean
  allowProductPriceOfferOnBillings?: boolean
  allowProductPriceOfferOnTableOrders?: boolean
  productPriceOffers?: OfferRule[]

  enableRandomCustomerProductOffer?: boolean
  allowRandomCustomerProductOfferOnBillings?: boolean
  allowRandomCustomerProductOfferOnTableOrders?: boolean
  randomCustomerOfferCampaignCode?: string
  randomCustomerOfferTimezone?: string
  reselectRandomCustomerOffer?: boolean
  randomCustomerOfferProducts?: OfferRule[]

  enableTotalPercentageOffer?: boolean
  allowTotalPercentageOfferOnBillings?: boolean
  allowTotalPercentageOfferOnTableOrders?: boolean
  totalPercentageOfferPercent?: number
  totalPercentageOfferRandomSelectionChancePercent?: number
  totalPercentageOfferMaxOfferCount?: number
  totalPercentageOfferMaxCustomerCount?: number
  totalPercentageOfferMaxUsagePerCustomer?: number
  totalPercentageOfferAvailableFromDate?: string | null
  totalPercentageOfferAvailableToDate?: string | null
  totalPercentageOfferDailyStartTime?: string | null
  totalPercentageOfferDailyEndTime?: string | null
  totalPercentageOfferGivenCount?: number
  totalPercentageOfferCustomerCount?: number

  enableCustomerEntryPercentageOffer?: boolean
  allowCustomerEntryPercentageOfferOnBillings?: boolean
  allowCustomerEntryPercentageOfferOnTableOrders?: boolean
  customerEntryPercentageOfferPercent?: number
  customerEntryPercentageOfferTimezone?: string
  customerEntryPercentageOfferAvailableFromDate?: string | null
  customerEntryPercentageOfferAvailableToDate?: string | null
  customerEntryPercentageOfferDailyStartTime?: string | null
  customerEntryPercentageOfferDailyEndTime?: string | null
  customerEntryPercentageOfferGivenCount?: number
  customerEntryPercentageOfferCustomerCount?: number
} & Record<string, unknown>

type ArrayFieldKey =
  | 'productToProductOffers'
  | 'productPriceOffers'
  | 'randomCustomerOfferProducts'

const getRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id?: unknown }).id === 'string'
  ) {
    return (value as { id: string }).id
  }
  return null
}

const toNumberInput = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : ''

const parseNumberInput = (value: string): number | undefined => {
  const normalized = value.trim()
  if (!normalized) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

const toDateInput = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) return ''
  return value.length >= 10 ? value.slice(0, 10) : value
}

const toTimeInput = (value: unknown): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : ''

const normalizeDateOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return value ? String(value) : null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeTimeOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return value ? String(value) : null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const hydrateSettings = (input: CustomerOfferSettings): CustomerOfferSettings => ({
  ...input,
  productToProductOffers: Array.isArray(input.productToProductOffers) ? input.productToProductOffers : [],
  productPriceOffers: Array.isArray(input.productPriceOffers) ? input.productPriceOffers : [],
  randomCustomerOfferProducts: Array.isArray(input.randomCustomerOfferProducts)
    ? input.randomCustomerOfferProducts
    : [],
})

const normalizeForSave = (input: CustomerOfferSettings): CustomerOfferSettings => {
  const normalizeRuleProduct = (rule: OfferRule, key: string) => ({
    ...rule,
    [key]: getRelationshipID(rule[key]) || rule[key] || null,
  })

  return {
    ...input,
    productToProductOffers: (input.productToProductOffers || []).map((row) =>
      normalizeRuleProduct(normalizeRuleProduct(row, 'buyProduct'), 'freeProduct'),
    ),
    productPriceOffers: (input.productPriceOffers || []).map((row) =>
      normalizeRuleProduct(row, 'product'),
    ),
    randomCustomerOfferProducts: (input.randomCustomerOfferProducts || []).map((row) => ({
      ...normalizeRuleProduct(row, 'product'),
      availableFromDate: normalizeDateOrNull(row.availableFromDate),
      availableToDate: normalizeDateOrNull(row.availableToDate),
      dailyStartTime: normalizeTimeOrNull(row.dailyStartTime),
      dailyEndTime: normalizeTimeOrNull(row.dailyEndTime),
    })),
    totalPercentageOfferAvailableFromDate: normalizeDateOrNull(
      input.totalPercentageOfferAvailableFromDate,
    ),
    totalPercentageOfferAvailableToDate: normalizeDateOrNull(input.totalPercentageOfferAvailableToDate),
    totalPercentageOfferDailyStartTime: normalizeTimeOrNull(input.totalPercentageOfferDailyStartTime),
    totalPercentageOfferDailyEndTime: normalizeTimeOrNull(input.totalPercentageOfferDailyEndTime),
    customerEntryPercentageOfferAvailableFromDate: normalizeDateOrNull(
      input.customerEntryPercentageOfferAvailableFromDate,
    ),
    customerEntryPercentageOfferAvailableToDate: normalizeDateOrNull(
      input.customerEntryPercentageOfferAvailableToDate,
    ),
    customerEntryPercentageOfferDailyStartTime: normalizeTimeOrNull(
      input.customerEntryPercentageOfferDailyStartTime,
    ),
    customerEntryPercentageOfferDailyEndTime: normalizeTimeOrNull(
      input.customerEntryPercentageOfferDailyEndTime,
    ),
  }
}

const extractPreselectedProductIDs = (input: CustomerOfferSettings): string[] => {
  const ids = new Set<string>()

  const productToProductRules = Array.isArray(input.productToProductOffers)
    ? input.productToProductOffers
    : []
  const productPriceRules = Array.isArray(input.productPriceOffers) ? input.productPriceOffers : []
  const randomRules = Array.isArray(input.randomCustomerOfferProducts)
    ? input.randomCustomerOfferProducts
    : []

  for (const rule of productToProductRules) {
    const buyProductID = getRelationshipID((rule as OfferRule).buyProduct)
    const freeProductID = getRelationshipID((rule as OfferRule).freeProduct)
    if (buyProductID) ids.add(buyProductID)
    if (freeProductID) ids.add(freeProductID)
  }

  for (const rule of productPriceRules) {
    const productID = getRelationshipID((rule as OfferRule).product)
    if (productID) ids.add(productID)
  }

  for (const rule of randomRules) {
    const productID = getRelationshipID((rule as OfferRule).product)
    if (productID) ids.add(productID)
  }

  return Array.from(ids)
}

const customSelectStyles = {
  control: (base: any) => ({
    ...base,
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    color: '#fff',
    minHeight: '44px',
    '&:hover': { borderColor: '#3b82f6' },
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    zIndex: 1001,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? '#27272a' : 'transparent',
    color: '#fff',
    '&:active': { backgroundColor: '#3b82f6' },
  }),
  singleValue: (base: any) => ({ ...base, color: '#fff' }),
  input: (base: any) => ({ ...base, color: '#fff' }),
}

let cachedCustomerOfferSettings: CustomerOfferSettings | null = null
let cachedDefaultProductOptions: Option[] = []
let cachedProductOptionsByID: Record<string, Option> = {}
const cachedProductQueryCache: Record<string, Option[]> = {}
const cachedProductQueryPromises: Record<string, Promise<Option[]>> = {}

const CustomerOfferWidget: React.FC = () => {
  const [settings, setSettings] = useState<CustomerOfferSettings | null>(
    cachedCustomerOfferSettings ? hydrateSettings(cachedCustomerOfferSettings) : null,
  )
  const [defaultProductOptions, setDefaultProductOptions] = useState<Option[]>(
    cachedDefaultProductOptions,
  )
  const [productOptionsByID, setProductOptionsByID] = useState<Record<string, Option>>(
    cachedProductOptionsByID,
  )
  const [settingsLoading, setSettingsLoading] = useState(!cachedCustomerOfferSettings)
  const [productsLoading, setProductsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    offer1: true,
    offer2: false,
    offer3: false,
    offer4: false,
    offer5: false,
    offer6: false,
  })

  const upsertProductOptionsCache = useCallback((options: Option[]) => {
    if (!Array.isArray(options) || options.length === 0) return

    const nextEntries: Record<string, Option> = {}
    for (const option of options) {
      if (!option?.value) continue
      nextEntries[option.value] = option
    }

    if (Object.keys(nextEntries).length === 0) return

    cachedProductOptionsByID = { ...cachedProductOptionsByID, ...nextEntries }
    setProductOptionsByID((previous) => ({ ...previous, ...nextEntries }))
  }, [])

  const fetchProductOptions = useCallback(
    async (query: string, ids: string[] = []): Promise<Option[]> => {
      const normalizedQuery = query.trim().toLowerCase()
      const filteredIDs = ids.map((id) => id.trim()).filter(Boolean)

      if (filteredIDs.length === 0 && cachedProductQueryCache[normalizedQuery]) {
        return cachedProductQueryCache[normalizedQuery]
      }

      const requestKey =
        filteredIDs.length > 0
          ? `ids:${[...new Set(filteredIDs)].sort().join(',')}`
          : `q:${normalizedQuery}`

      if (!cachedProductQueryPromises[requestKey]) {
        cachedProductQueryPromises[requestKey] = (async () => {
          const params = new URLSearchParams()

          if (filteredIDs.length > 0) {
            params.set('ids', filteredIDs.join(','))
            params.set('limit', String(Math.min(120, Math.max(20, filteredIDs.length))))
          } else {
            if (normalizedQuery.length > 0) params.set('q', normalizedQuery)
            params.set('limit', normalizedQuery.length > 0 ? '60' : '80')
          }

          const response = await fetch(`/api/widgets/product-options?${params.toString()}`)
          if (!response.ok) return []

          const json = (await response.json()) as ProductOptionsResponse
          const options = Array.isArray(json?.options) ? json.options : []

          if (filteredIDs.length === 0) {
            cachedProductQueryCache[normalizedQuery] = options
            if (normalizedQuery === '') {
              cachedDefaultProductOptions = options
            }
          }

          upsertProductOptionsCache(options)
          return options
        })().finally(() => {
          delete cachedProductQueryPromises[requestKey]
        })
      }

      return cachedProductQueryPromises[requestKey]
    },
    [upsertProductOptionsCache],
  )

  const loadProductOptions = useCallback(
    async (inputValue: string) => {
      return fetchProductOptions(inputValue)
    },
    [fetchProductOptions],
  )

  const getProductValue = (value: unknown): Option | null => {
    const id = getRelationshipID(value)
    if (!id) return null
    return productOptionsByID[id] || { value: id, label: id }
  }

  useEffect(() => {
    let cancelled = false

    const fetchSettings = async () => {
      if (!cachedCustomerOfferSettings) {
        setSettingsLoading(true)
      }

      try {
        const settingsResponse = await fetch('/api/globals/customer-offer-settings?depth=1')

        if (!settingsResponse.ok) {
          throw new Error('Failed to load customer offer settings')
        }

        const settingsJSON = (await settingsResponse.json()) as CustomerOfferSettings
        const hydratedSettings = hydrateSettings(settingsJSON)
        cachedCustomerOfferSettings = hydratedSettings

        if (!cancelled) {
          setSettings(hydratedSettings)
          setLoadError(null)
        }

        const preselectedProductIDs = extractPreselectedProductIDs(hydratedSettings)
        if (preselectedProductIDs.length > 0) {
          setProductsLoading(true)
          void fetchProductOptions('', preselectedProductIDs).finally(() => {
            if (!cancelled) {
              setProductsLoading(false)
            }
          })
        }
      } catch (error) {
        console.error('Failed loading customer offer settings:', error)
        if (!cancelled && !cachedCustomerOfferSettings) {
          setLoadError('Unable to load customer offer settings.')
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false)
        }
      }
    }

    void fetchSettings()
    return () => {
      cancelled = true
    }
  }, [fetchProductOptions])

  const shouldLoadProducts = openSections.offer2 || openSections.offer3 || openSections.offer4

  useEffect(() => {
    if (!shouldLoadProducts) return
    if (defaultProductOptions.length > 0) {
      return
    }

    let cancelled = false

    const fetchProducts = async () => {
      setProductsLoading(true)

      try {
        const options = await fetchProductOptions('')
        if (!cancelled) {
          setDefaultProductOptions(options)
        }
      } catch (error) {
        console.error('Failed loading products for customer offer widget:', error)
      } finally {
        if (!cancelled) {
          setProductsLoading(false)
        }
      }
    }

    void fetchProducts()
    return () => {
      cancelled = true
    }
  }, [shouldLoadProducts, defaultProductOptions.length, fetchProductOptions])

  const setField = (field: keyof CustomerOfferSettings, value: unknown) => {
    setSettings((previous) => (previous ? { ...previous, [field]: value } : previous))
  }

  const getArrayRows = (field: ArrayFieldKey): OfferRule[] => {
    if (!settings) return []
    const rows = settings[field]
    return Array.isArray(rows) ? (rows as OfferRule[]) : []
  }

  const addArrayRow = (field: ArrayFieldKey, row: OfferRule) => {
    setSettings((previous) => {
      if (!previous) return previous
      const current = Array.isArray(previous[field]) ? [...(previous[field] as OfferRule[])] : []
      current.push(row)
      return { ...previous, [field]: current }
    })
  }

  const updateArrayRow = (field: ArrayFieldKey, index: number, patch: OfferRule) => {
    setSettings((previous) => {
      if (!previous) return previous
      const current = Array.isArray(previous[field]) ? [...(previous[field] as OfferRule[])] : []
      current[index] = { ...(current[index] || {}), ...patch }
      return { ...previous, [field]: current }
    })
  }

  const removeArrayRow = (field: ArrayFieldKey, index: number) => {
    setSettings((previous) => {
      if (!previous) return previous
      const current = Array.isArray(previous[field]) ? [...(previous[field] as OfferRule[])] : []
      const next = current.filter((_, itemIndex) => itemIndex !== index)
      return { ...previous, [field]: next }
    })
  }

  const toggleSection = (key: string) => {
    setOpenSections((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  const saveSettings = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const payloadData = normalizeForSave(settings)
      let response: Response | null = null

      for (const method of ['POST', 'PATCH']) {
        const attempted = await fetch('/api/globals/customer-offer-settings', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadData),
        })

        if (attempted.ok || ![404, 405].includes(attempted.status)) {
          response = attempted
          break
        }
      }

      if (!response) {
        throw new Error('Unable to save customer offers')
      }

      const json = (await response.json()) as CustomerOfferSettings
      if (!response.ok) {
        throw new Error((json as { message?: string })?.message || 'Failed to save settings')
      }

      const hydratedSettings = hydrateSettings(json)
      cachedCustomerOfferSettings = hydratedSettings
      setSettings(hydratedSettings)
      alert('Customer Offer Settings saved')
    } catch (error) {
      console.error('Failed saving customer offer settings:', error)
      alert(error instanceof Error ? error.message : 'Failed to save Customer Offer Settings')
    } finally {
      setSaving(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="customer-offer-widget loading">
        <Loader2 className="animate-spin" size={18} />
        <span>Loading customer offer settings...</span>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="customer-offer-widget loading">
        <span>{loadError || 'Unable to load customer offer settings.'}</span>
      </div>
    )
  }

  const productToProductOffers = getArrayRows('productToProductOffers')
  const productPriceOffers = getArrayRows('productPriceOffers')
  const randomCustomerOfferProducts = getArrayRows('randomCustomerOfferProducts')

  return (
    <div className="customer-offer-widget">
      <div className="co-toolbar">
        <p>
          Custom offer designer for all 6 customer offers.
          {productsLoading ? <span className="co-loading-products"> Loading products...</span> : null}
        </p>
        <button type="button" className="co-save-btn" onClick={saveSettings} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={15} /> Saving...
            </>
          ) : (
            <>
              <Save size={15} /> Save Offers
            </>
          )}
        </button>
      </div>

      <div className="co-section">
        <button type="button" className="co-section-head" onClick={() => toggleSection('offer1')}>
          <span>Offer 1: Customer Credit Offer</span>
          {openSections.offer1 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {openSections.offer1 && (
          <div className="co-section-body">
            <div className="co-toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.enabled)}
                  onChange={(e) => setField('enabled', e.target.checked)}
                />
                Enable Offer
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowCustomerCreditOfferOnBillings)}
                  onChange={(e) => setField('allowCustomerCreditOfferOnBillings', e.target.checked)}
                />
                Allow Billings
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowCustomerCreditOfferOnTableOrders)}
                  onChange={(e) =>
                    setField('allowCustomerCreditOfferOnTableOrders', e.target.checked)
                  }
                />
                Allow Table Orders
              </label>
            </div>

            <div className="co-grid">
              <label>
                Spend Amount per Step (Rs)
                <input
                  type="number"
                  min={1}
                  value={toNumberInput(settings.spendAmountPerStep)}
                  onChange={(e) => setField('spendAmountPerStep', parseNumberInput(e.target.value))}
                />
              </label>
              <label>
                Points per Step
                <input
                  type="number"
                  min={1}
                  value={toNumberInput(settings.pointsPerStep)}
                  onChange={(e) => setField('pointsPerStep', parseNumberInput(e.target.value))}
                />
              </label>
              <label>
                Points Needed
                <input
                  type="number"
                  min={1}
                  value={toNumberInput(settings.pointsNeededForOffer)}
                  onChange={(e) =>
                    setField('pointsNeededForOffer', parseNumberInput(e.target.value))
                  }
                />
              </label>
              <label>
                Offer Amount (Rs)
                <input
                  type="number"
                  min={1}
                  value={toNumberInput(settings.offerAmount)}
                  onChange={(e) => setField('offerAmount', parseNumberInput(e.target.value))}
                />
              </label>
            </div>

            <label className="co-single-toggle">
              <input
                type="checkbox"
                checked={Boolean(settings.resetOnRedeem)}
                onChange={(e) => setField('resetOnRedeem', e.target.checked)}
              />
              Reset points/progress on redeem
            </label>
          </div>
        )}
      </div>

      <div className="co-section">
        <button type="button" className="co-section-head" onClick={() => toggleSection('offer2')}>
          <span>Offer 2: Product to Product (Buy A - Get B)</span>
          {openSections.offer2 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {openSections.offer2 && (
          <div className="co-section-body">
            <div className="co-toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.enableProductToProductOffer)}
                  onChange={(e) => setField('enableProductToProductOffer', e.target.checked)}
                />
                Enable Offer
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowProductToProductOfferOnBillings)}
                  onChange={(e) =>
                    setField('allowProductToProductOfferOnBillings', e.target.checked)
                  }
                />
                Allow Billings
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowProductToProductOfferOnTableOrders)}
                  onChange={(e) =>
                    setField('allowProductToProductOfferOnTableOrders', e.target.checked)
                  }
                />
                Allow Table Orders
              </label>
            </div>

            <div className="co-rule-list">
              {productToProductOffers.map((rule, index) => (
                <div className="co-rule-card" key={rule.id ? String(rule.id) : `p2p-${index}`}>
                  <div className="co-rule-head">
                    <h4>Rule {index + 1}</h4>
                    <button
                      type="button"
                      className="co-remove-btn"
                      onClick={() => removeArrayRow('productToProductOffers', index)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>

                  <div className="co-toggle-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.enabled !== false}
                        onChange={(e) =>
                          updateArrayRow('productToProductOffers', index, { enabled: e.target.checked })
                        }
                      />
                      Rule Enabled
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.allowOnBillings !== false}
                        onChange={(e) =>
                          updateArrayRow('productToProductOffers', index, {
                            allowOnBillings: e.target.checked,
                          })
                        }
                      />
                      Allow Billings
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.allowOnTableOrders !== false}
                        onChange={(e) =>
                          updateArrayRow('productToProductOffers', index, {
                            allowOnTableOrders: e.target.checked,
                          })
                        }
                      />
                      Allow Table Orders
                    </label>
                  </div>

                  <div className="co-grid co-grid-2">
                    <label>
                      Buy Product (A)
                      <AsyncSelect
                        cacheOptions
                        defaultOptions={defaultProductOptions}
                        loadOptions={loadProductOptions}
                        value={getProductValue(rule.buyProduct)}
                        isLoading={productsLoading}
                        onChange={(option) =>
                          updateArrayRow('productToProductOffers', index, {
                            buyProduct: (option as Option | null)?.value || null,
                          })
                        }
                        styles={customSelectStyles}
                        placeholder="Select product..."
                      />
                    </label>
                    <label>
                      Buy Quantity
                      <input
                        className="co-match-select-height"
                        type="number"
                        min={1}
                        value={toNumberInput(rule.buyQuantity)}
                        onChange={(e) =>
                          updateArrayRow('productToProductOffers', index, {
                            buyQuantity: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="co-grid co-grid-2">
                    <label>
                      Free Product (B)
                      <AsyncSelect
                        cacheOptions
                        defaultOptions={defaultProductOptions}
                        loadOptions={loadProductOptions}
                        value={getProductValue(rule.freeProduct)}
                        isLoading={productsLoading}
                        onChange={(option) =>
                          updateArrayRow('productToProductOffers', index, {
                            freeProduct: (option as Option | null)?.value || null,
                          })
                        }
                        styles={customSelectStyles}
                        placeholder="Select product..."
                      />
                    </label>
                    <label>
                      Free Quantity
                      <input
                        className="co-match-select-height"
                        type="number"
                        min={1}
                        value={toNumberInput(rule.freeQuantity)}
                        onChange={(e) =>
                          updateArrayRow('productToProductOffers', index, {
                            freeQuantity: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="co-grid">
                    <label>
                      Max Offer Uses (0 unlimited)
                      <input
                        type="number"
                        min={0}
                        value={toNumberInput(rule.maxOfferCount)}
                        onChange={(e) =>
                          updateArrayRow('productToProductOffers', index, {
                            maxOfferCount: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Max Customers (0 unlimited)
                      <input
                        type="number"
                        min={0}
                        value={toNumberInput(rule.maxCustomerCount)}
                        onChange={(e) =>
                          updateArrayRow('productToProductOffers', index, {
                            maxCustomerCount: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Max Uses / Customer (0 unlimited)
                      <input
                        type="number"
                        min={0}
                        value={toNumberInput(rule.maxUsagePerCustomer)}
                        onChange={(e) =>
                          updateArrayRow('productToProductOffers', index, {
                            maxUsagePerCustomer: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="co-add-btn"
              onClick={() =>
                addArrayRow('productToProductOffers', {
                  enabled: true,
                  allowOnBillings: true,
                  allowOnTableOrders: true,
                  buyQuantity: 1,
                  freeQuantity: 1,
                  maxOfferCount: 0,
                  maxCustomerCount: 0,
                  maxUsagePerCustomer: 0,
                })
              }
            >
              <Plus size={14} /> Add Product Rule
            </button>
          </div>
        )}
      </div>

      <div className="co-section">
        <button type="button" className="co-section-head" onClick={() => toggleSection('offer3')}>
          <span>Offer 3: Product Price Discount</span>
          {openSections.offer3 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {openSections.offer3 && (
          <div className="co-section-body">
            <div className="co-toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.enableProductPriceOffer)}
                  onChange={(e) => setField('enableProductPriceOffer', e.target.checked)}
                />
                Enable Offer
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowProductPriceOfferOnBillings)}
                  onChange={(e) => setField('allowProductPriceOfferOnBillings', e.target.checked)}
                />
                Allow Billings
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowProductPriceOfferOnTableOrders)}
                  onChange={(e) =>
                    setField('allowProductPriceOfferOnTableOrders', e.target.checked)
                  }
                />
                Allow Table Orders
              </label>
            </div>

            <div className="co-rule-list">
              {productPriceOffers.map((rule, index) => (
                <div className="co-rule-card" key={rule.id ? String(rule.id) : `price-${index}`}>
                  <div className="co-rule-head">
                    <h4>Rule {index + 1}</h4>
                    <button
                      type="button"
                      className="co-remove-btn"
                      onClick={() => removeArrayRow('productPriceOffers', index)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>

                  <div className="co-toggle-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.enabled !== false}
                        onChange={(e) =>
                          updateArrayRow('productPriceOffers', index, { enabled: e.target.checked })
                        }
                      />
                      Rule Enabled
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.allowOnBillings !== false}
                        onChange={(e) =>
                          updateArrayRow('productPriceOffers', index, {
                            allowOnBillings: e.target.checked,
                          })
                        }
                      />
                      Allow Billings
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.allowOnTableOrders !== false}
                        onChange={(e) =>
                          updateArrayRow('productPriceOffers', index, {
                            allowOnTableOrders: e.target.checked,
                          })
                        }
                      />
                      Allow Table Orders
                    </label>
                  </div>

                  <div className="co-grid">
                    <label>
                      Product
                      <AsyncSelect
                        cacheOptions
                        defaultOptions={defaultProductOptions}
                        loadOptions={loadProductOptions}
                        value={getProductValue(rule.product)}
                        isLoading={productsLoading}
                        onChange={(option) =>
                          updateArrayRow('productPriceOffers', index, {
                            product: (option as Option | null)?.value || null,
                          })
                        }
                        styles={customSelectStyles}
                        placeholder="Select product..."
                      />
                    </label>
                    <label>
                      Discount (Rs)
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={toNumberInput(rule.discountAmount)}
                        onChange={(e) =>
                          updateArrayRow('productPriceOffers', index, {
                            discountAmount: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Max Offer Uses (0 unlimited)
                      <input
                        type="number"
                        min={0}
                        value={toNumberInput(rule.maxOfferCount)}
                        onChange={(e) =>
                          updateArrayRow('productPriceOffers', index, {
                            maxOfferCount: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Max Customers (0 unlimited)
                      <input
                        type="number"
                        min={0}
                        value={toNumberInput(rule.maxCustomerCount)}
                        onChange={(e) =>
                          updateArrayRow('productPriceOffers', index, {
                            maxCustomerCount: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Max Uses / Customer (0 unlimited)
                      <input
                        type="number"
                        min={0}
                        value={toNumberInput(rule.maxUsagePerCustomer)}
                        onChange={(e) =>
                          updateArrayRow('productPriceOffers', index, {
                            maxUsagePerCustomer: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="co-add-btn"
              onClick={() =>
                addArrayRow('productPriceOffers', {
                  enabled: true,
                  allowOnBillings: true,
                  allowOnTableOrders: true,
                  discountAmount: 1,
                  maxOfferCount: 0,
                  maxCustomerCount: 0,
                  maxUsagePerCustomer: 0,
                })
              }
            >
              <Plus size={14} /> Add Price Rule
            </button>
          </div>
        )}
      </div>

      <div className="co-section">
        <button type="button" className="co-section-head" onClick={() => toggleSection('offer4')}>
          <span>Offer 4: Random Customer Product Offer</span>
          {openSections.offer4 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {openSections.offer4 && (
          <div className="co-section-body">
            <div className="co-toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.enableRandomCustomerProductOffer)}
                  onChange={(e) =>
                    setField('enableRandomCustomerProductOffer', e.target.checked)
                  }
                />
                Enable Offer
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowRandomCustomerProductOfferOnBillings)}
                  onChange={(e) =>
                    setField('allowRandomCustomerProductOfferOnBillings', e.target.checked)
                  }
                />
                Allow Billings
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowRandomCustomerProductOfferOnTableOrders)}
                  onChange={(e) =>
                    setField('allowRandomCustomerProductOfferOnTableOrders', e.target.checked)
                  }
                />
                Allow Table Orders
              </label>
            </div>

            <div className="co-grid">
              <label>
                Campaign Code
                <input
                  type="text"
                  value={typeof settings.randomCustomerOfferCampaignCode === 'string'
                    ? settings.randomCustomerOfferCampaignCode
                    : ''}
                  onChange={(e) => setField('randomCustomerOfferCampaignCode', e.target.value)}
                />
              </label>
              <label>
                Timezone
                <input
                  type="text"
                  value={typeof settings.randomCustomerOfferTimezone === 'string'
                    ? settings.randomCustomerOfferTimezone
                    : ''}
                  onChange={(e) => setField('randomCustomerOfferTimezone', e.target.value)}
                  placeholder="Asia/Kolkata"
                />
              </label>
              <label className="co-inline-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(settings.reselectRandomCustomerOffer)}
                  onChange={(e) => setField('reselectRandomCustomerOffer', e.target.checked)}
                />
                Reset progress on save
              </label>
            </div>

            <div className="co-rule-list">
              {randomCustomerOfferProducts.map((rule, index) => (
                <div className="co-rule-card" key={rule.id ? String(rule.id) : `random-${index}`}>
                  <div className="co-rule-head">
                    <h4>Random Rule {index + 1}</h4>
                    <button
                      type="button"
                      className="co-remove-btn"
                      onClick={() => removeArrayRow('randomCustomerOfferProducts', index)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>

                  <div className="co-toggle-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.enabled !== false}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            enabled: e.target.checked,
                          })
                        }
                      />
                      Rule Enabled
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.allowOnBillings !== false}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            allowOnBillings: e.target.checked,
                          })
                        }
                      />
                      Allow Billings
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.allowOnTableOrders !== false}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            allowOnTableOrders: e.target.checked,
                          })
                        }
                      />
                      Allow Table Orders
                    </label>
                  </div>

                  <div className="co-grid">
                    <label>
                      Product
                      <AsyncSelect
                        cacheOptions
                        defaultOptions={defaultProductOptions}
                        loadOptions={loadProductOptions}
                        value={getProductValue(rule.product)}
                        isLoading={productsLoading}
                        onChange={(option) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            product: (option as Option | null)?.value || null,
                          })
                        }
                        styles={customSelectStyles}
                        placeholder="Select product..."
                      />
                    </label>
                    <label>
                      Winner Count
                      <input
                        type="number"
                        min={1}
                        value={toNumberInput(rule.winnerCount)}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            winnerCount: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Random Chance (%)
                      <input
                        type="number"
                        min={0.01}
                        max={100}
                        step={0.01}
                        value={toNumberInput(rule.randomSelectionChancePercent)}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            randomSelectionChancePercent: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Max Uses / Customer
                      <input
                        type="number"
                        min={0}
                        value={toNumberInput(rule.maxUsagePerCustomer)}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            maxUsagePerCustomer: parseNumberInput(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Available From Date
                      <input
                        type="date"
                        value={toDateInput(rule.availableFromDate)}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            availableFromDate: e.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label>
                      Available To Date
                      <input
                        type="date"
                        value={toDateInput(rule.availableToDate)}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            availableToDate: e.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label>
                      Daily Start Time
                      <input
                        type="time"
                        value={toTimeInput(rule.dailyStartTime)}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            dailyStartTime: e.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label>
                      Daily End Time
                      <input
                        type="time"
                        value={toTimeInput(rule.dailyEndTime)}
                        onChange={(e) =>
                          updateArrayRow('randomCustomerOfferProducts', index, {
                            dailyEndTime: e.target.value || null,
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="co-add-btn"
              onClick={() =>
                addArrayRow('randomCustomerOfferProducts', {
                  enabled: true,
                  allowOnBillings: true,
                  allowOnTableOrders: true,
                  winnerCount: 1,
                  randomSelectionChancePercent: 10,
                  maxUsagePerCustomer: 1,
                })
              }
            >
              <Plus size={14} /> Add Random Rule
            </button>
          </div>
        )}
      </div>

      <div className="co-section">
        <button type="button" className="co-section-head" onClick={() => toggleSection('offer5')}>
          <span>Offer 5: Total Amount Percentage Offer</span>
          {openSections.offer5 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {openSections.offer5 && (
          <div className="co-section-body">
            <div className="co-toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.enableTotalPercentageOffer)}
                  onChange={(e) => setField('enableTotalPercentageOffer', e.target.checked)}
                />
                Enable Offer
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowTotalPercentageOfferOnBillings)}
                  onChange={(e) =>
                    setField('allowTotalPercentageOfferOnBillings', e.target.checked)
                  }
                />
                Allow Billings
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowTotalPercentageOfferOnTableOrders)}
                  onChange={(e) =>
                    setField('allowTotalPercentageOfferOnTableOrders', e.target.checked)
                  }
                />
                Allow Table Orders
              </label>
            </div>

            <div className="co-grid">
              <label>
                Discount Percentage (%)
                <input
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  value={toNumberInput(settings.totalPercentageOfferPercent)}
                  onChange={(e) =>
                    setField('totalPercentageOfferPercent', parseNumberInput(e.target.value))
                  }
                />
              </label>
              <label>
                Random Chance (%)
                <input
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  value={toNumberInput(settings.totalPercentageOfferRandomSelectionChancePercent)}
                  onChange={(e) =>
                    setField(
                      'totalPercentageOfferRandomSelectionChancePercent',
                      parseNumberInput(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Max Offer Uses
                <input
                  type="number"
                  min={0}
                  value={toNumberInput(settings.totalPercentageOfferMaxOfferCount)}
                  onChange={(e) =>
                    setField('totalPercentageOfferMaxOfferCount', parseNumberInput(e.target.value))
                  }
                />
              </label>
              <label>
                Max Customers
                <input
                  type="number"
                  min={0}
                  value={toNumberInput(settings.totalPercentageOfferMaxCustomerCount)}
                  onChange={(e) =>
                    setField(
                      'totalPercentageOfferMaxCustomerCount',
                      parseNumberInput(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Max Uses / Customer
                <input
                  type="number"
                  min={0}
                  value={toNumberInput(settings.totalPercentageOfferMaxUsagePerCustomer)}
                  onChange={(e) =>
                    setField(
                      'totalPercentageOfferMaxUsagePerCustomer',
                      parseNumberInput(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Available From Date
                <input
                  type="date"
                  value={toDateInput(settings.totalPercentageOfferAvailableFromDate)}
                  onChange={(e) =>
                    setField('totalPercentageOfferAvailableFromDate', e.target.value || null)
                  }
                />
              </label>
              <label>
                Available To Date
                <input
                  type="date"
                  value={toDateInput(settings.totalPercentageOfferAvailableToDate)}
                  onChange={(e) =>
                    setField('totalPercentageOfferAvailableToDate', e.target.value || null)
                  }
                />
              </label>
              <label>
                Daily Start Time
                <input
                  type="time"
                  value={toTimeInput(settings.totalPercentageOfferDailyStartTime)}
                  onChange={(e) =>
                    setField('totalPercentageOfferDailyStartTime', e.target.value || null)
                  }
                />
              </label>
              <label>
                Daily End Time
                <input
                  type="time"
                  value={toTimeInput(settings.totalPercentageOfferDailyEndTime)}
                  onChange={(e) =>
                    setField('totalPercentageOfferDailyEndTime', e.target.value || null)
                  }
                />
              </label>
            </div>

            <div className="co-progress">
              <span>Given: {toNumberInput(settings.totalPercentageOfferGivenCount) || '0'}</span>
              <span>Customers: {toNumberInput(settings.totalPercentageOfferCustomerCount) || '0'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="co-section">
        <button type="button" className="co-section-head" onClick={() => toggleSection('offer6')}>
          <span>Offer 6: Customer Entry Percentage Offer</span>
          {openSections.offer6 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {openSections.offer6 && (
          <div className="co-section-body">
            <div className="co-toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.enableCustomerEntryPercentageOffer)}
                  onChange={(e) =>
                    setField('enableCustomerEntryPercentageOffer', e.target.checked)
                  }
                />
                Enable Offer
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowCustomerEntryPercentageOfferOnBillings)}
                  onChange={(e) =>
                    setField('allowCustomerEntryPercentageOfferOnBillings', e.target.checked)
                  }
                />
                Allow Billings
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(settings.allowCustomerEntryPercentageOfferOnTableOrders)}
                  onChange={(e) =>
                    setField('allowCustomerEntryPercentageOfferOnTableOrders', e.target.checked)
                  }
                />
                Allow Table Orders
              </label>
            </div>

            <div className="co-grid">
              <label>
                Discount Percentage (%)
                <input
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  value={toNumberInput(settings.customerEntryPercentageOfferPercent)}
                  onChange={(e) =>
                    setField(
                      'customerEntryPercentageOfferPercent',
                      parseNumberInput(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Timezone
                <input
                  type="text"
                  value={typeof settings.customerEntryPercentageOfferTimezone === 'string'
                    ? settings.customerEntryPercentageOfferTimezone
                    : ''}
                  onChange={(e) =>
                    setField('customerEntryPercentageOfferTimezone', e.target.value)
                  }
                  placeholder="Asia/Kolkata"
                />
              </label>
              <label>
                Available From Date
                <input
                  type="date"
                  value={toDateInput(settings.customerEntryPercentageOfferAvailableFromDate)}
                  onChange={(e) =>
                    setField('customerEntryPercentageOfferAvailableFromDate', e.target.value || null)
                  }
                />
              </label>
              <label>
                Available To Date
                <input
                  type="date"
                  value={toDateInput(settings.customerEntryPercentageOfferAvailableToDate)}
                  onChange={(e) =>
                    setField('customerEntryPercentageOfferAvailableToDate', e.target.value || null)
                  }
                />
              </label>
              <label>
                Daily Start Time
                <input
                  type="time"
                  value={toTimeInput(settings.customerEntryPercentageOfferDailyStartTime)}
                  onChange={(e) =>
                    setField('customerEntryPercentageOfferDailyStartTime', e.target.value || null)
                  }
                />
              </label>
              <label>
                Daily End Time
                <input
                  type="time"
                  value={toTimeInput(settings.customerEntryPercentageOfferDailyEndTime)}
                  onChange={(e) =>
                    setField('customerEntryPercentageOfferDailyEndTime', e.target.value || null)
                  }
                />
              </label>
            </div>

            <div className="co-progress">
              <span>Given: {toNumberInput(settings.customerEntryPercentageOfferGivenCount) || '0'}</span>
              <span>
                Customers: {toNumberInput(settings.customerEntryPercentageOfferCustomerCount) || '0'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerOfferWidget
