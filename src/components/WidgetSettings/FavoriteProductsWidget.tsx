'use client'

import React, { useCallback, useEffect, useState } from 'react'
import AsyncSelect from 'react-select/async'
import Select, { components as selectComponents } from 'react-select'
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import './favorite-products-widget.scss'

type Option = { value: string; label: string }
type BranchOptionsResponse = { docs?: Array<{ id?: string; name?: string }> }
type CategoryOptionsResponse = { docs?: Array<{ id?: string; name?: string }> }
type ProductOptionsResponse = { options?: Option[] }
type FavoriteProductsRule = {
  id?: string
  enabled: boolean
  ruleName: string
  branches: string[]
  category: string[]
  products: string[]
}
type WidgetSettingsResponse = {
  favoriteProductsByBranchRules?: unknown
}

type FavoriteProductsWidgetProps = {
  preloadedBranchOptions?: Option[]
}

type DraggingProductState = {
  ruleIndex: number
  sourceIndex: number
}

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

const getRelationshipIDs = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const ids = value
      .map((entry) => getRelationshipID(entry))
      .filter((id): id is string => typeof id === 'string')
    return Array.from(new Set(ids))
  }

  const singleID = getRelationshipID(value)
  return singleID ? [singleID] : []
}

const normalizeRules = (value: unknown): FavoriteProductsRule[] => {
  if (!Array.isArray(value)) return []

  return value.map((row, index) => {
    const raw = (row || {}) as Record<string, unknown>
    return {
      id: typeof raw.id === 'string' ? raw.id : undefined,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      ruleName:
        typeof raw.ruleName === 'string' && raw.ruleName.trim().length > 0
          ? raw.ruleName.trim()
          : `Rule ${index + 1}`,
      branches: getRelationshipIDs(raw.branches),
      category: getRelationshipIDs(raw.category),
      products: getRelationshipIDs(raw.products),
    }
  })
}

const clearRuleCategoryFilters = (rules: FavoriteProductsRule[]): FavoriteProductsRule[] =>
  rules.map((rule) => ({
    ...rule,
    category: [],
  }))

const cloneRules = (rules: FavoriteProductsRule[]): FavoriteProductsRule[] =>
  rules.map((rule) => ({
    ...rule,
    branches: [...rule.branches],
    category: [...rule.category],
    products: [...rule.products],
  }))

const extractPreselectedBranchIDs = (rules: FavoriteProductsRule[]): string[] => {
  const ids = new Set<string>()
  for (const rule of rules) {
    for (const id of rule.branches) ids.add(id)
  }
  return Array.from(ids)
}

const extractPreselectedProductIDs = (rules: FavoriteProductsRule[]): string[] => {
  const ids = new Set<string>()
  for (const rule of rules) {
    for (const id of rule.products) ids.add(id)
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
    zIndex: 9999,
  }),
  menuPortal: (base: any) => ({
    ...base,
    zIndex: 9999,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? '#27272a' : 'transparent',
    color: '#fff',
    '&:active': { backgroundColor: '#3b82f6' },
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.45)',
  }),
  multiValueLabel: (base: any) => ({ ...base, color: '#bfdbfe' }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: '#93c5fd',
    ':hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      color: '#fca5a5',
    },
  }),
  placeholder: (base: any) => ({ ...base, color: '#71717a' }),
  singleValue: (base: any) => ({ ...base, color: '#fff' }),
  input: (base: any) => ({ ...base, color: '#fff' }),
}

const CheckboxOption = (props: any) => (
  <selectComponents.Option {...props}>
    <div className="fp-select-option-with-check">
      <input type="checkbox" checked={Boolean(props.isSelected)} readOnly />
      <span>{props.label}</span>
    </div>
  </selectComponents.Option>
)

const NoIndicatorSeparator = () => null

let cachedFavoriteRules: FavoriteProductsRule[] | null = null
let cachedDefaultProductOptions: Option[] = []
let cachedProductOptionsByID: Record<string, Option> = {}
const cachedProductQueryCache: Record<string, Option[]> = {}
const cachedProductQueryPromises: Record<string, Promise<Option[]>> = {}
let cachedBranchOptions: Option[] = []
let cachedBranchOptionsByID: Record<string, Option> = {}
let cachedCategoryOptions: Option[] = []
let cachedCategoryOptionsByID: Record<string, Option> = {}

const FavoriteProductsWidget: React.FC<FavoriteProductsWidgetProps> = ({
  preloadedBranchOptions = [],
}) => {
  const selectMenuPortalTarget = typeof document !== 'undefined' ? document.body : undefined
  const [rules, setRules] = useState<FavoriteProductsRule[] | null>(
    cachedFavoriteRules ? cloneRules(cachedFavoriteRules) : null,
  )
  const [settingsLoading, setSettingsLoading] = useState(!cachedFavoriteRules)
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openRules, setOpenRules] = useState<Record<string, boolean>>({})
  const [productsLoading, setProductsLoading] = useState(false)
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [defaultProductOptions, setDefaultProductOptions] = useState<Option[]>(cachedDefaultProductOptions)
  const [productOptionsByID, setProductOptionsByID] = useState<Record<string, Option>>(
    cachedProductOptionsByID,
  )
  const [branchOptions, setBranchOptions] = useState<Option[]>(cachedBranchOptions)
  const [branchOptionsByID, setBranchOptionsByID] = useState<Record<string, Option>>(
    cachedBranchOptionsByID,
  )
  const [categoryOptions, setCategoryOptions] = useState<Option[]>(cachedCategoryOptions)
  const [categoryOptionsByID, setCategoryOptionsByID] = useState<Record<string, Option>>(
    cachedCategoryOptionsByID,
  )
  const [draggingProduct, setDraggingProduct] = useState<DraggingProductState | null>(null)

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

  const upsertBranchOptionsCache = useCallback((options: Option[]) => {
    if (!Array.isArray(options) || options.length === 0) return

    const nextEntries: Record<string, Option> = {}
    for (const option of options) {
      if (!option?.value) continue
      nextEntries[option.value] = option
    }

    if (Object.keys(nextEntries).length === 0) return

    cachedBranchOptions = options
    cachedBranchOptionsByID = { ...cachedBranchOptionsByID, ...nextEntries }
    setBranchOptions(options)
    setBranchOptionsByID((previous) => ({ ...previous, ...nextEntries }))
  }, [])

  const upsertCategoryOptionsCache = useCallback((options: Option[]) => {
    if (!Array.isArray(options) || options.length === 0) return

    const nextEntries: Record<string, Option> = {}
    for (const option of options) {
      if (!option?.value) continue
      nextEntries[option.value] = option
    }

    if (Object.keys(nextEntries).length === 0) return

    cachedCategoryOptions = options
    cachedCategoryOptionsByID = { ...cachedCategoryOptionsByID, ...nextEntries }
    setCategoryOptions(options)
    setCategoryOptionsByID((previous) => ({ ...previous, ...nextEntries }))
  }, [])

  useEffect(() => {
    if (!Array.isArray(preloadedBranchOptions) || preloadedBranchOptions.length === 0) return
    upsertBranchOptionsCache(preloadedBranchOptions)
  }, [preloadedBranchOptions, upsertBranchOptionsCache])

  useEffect(() => {
    if (!saveNotice) return
    const timer = window.setTimeout(() => {
      setSaveNotice(null)
    }, 2600)
    return () => window.clearTimeout(timer)
  }, [saveNotice])

  const fetchBranchOptions = useCallback(
    async (ids: string[] = []): Promise<Option[]> => {
      if (cachedBranchOptions.length > 0) {
        const missingIDs = ids.filter((id) => id && !cachedBranchOptionsByID[id])
        if (missingIDs.length === 0) {
          return cachedBranchOptions
        }
      }

      const response = await fetch('/api/branches?limit=1000&depth=0&sort=name')
      if (!response.ok) return cachedBranchOptions

      const json = (await response.json()) as BranchOptionsResponse
      const options = Array.isArray(json?.docs)
        ? json.docs
            .map((doc) => {
              const id = typeof doc?.id === 'string' ? doc.id : null
              if (!id) return null
              const label =
                typeof doc?.name === 'string' && doc.name.trim().length > 0 ? doc.name : id
              return { value: id, label }
            })
            .filter((option): option is Option => Boolean(option))
        : []

      upsertBranchOptionsCache(options)
      return options
    },
    [upsertBranchOptionsCache],
  )

  const fetchCategoryOptions = useCallback(async (): Promise<Option[]> => {
    if (cachedCategoryOptions.length > 0) {
      return cachedCategoryOptions
    }

    const response = await fetch('/api/categories?limit=1000&depth=0&sort=name')
    if (!response.ok) return cachedCategoryOptions

    const json = (await response.json()) as CategoryOptionsResponse
    const options = Array.isArray(json?.docs)
      ? json.docs
          .map((doc) => {
            const id = typeof doc?.id === 'string' ? doc.id : null
            if (!id) return null
            const label = typeof doc?.name === 'string' && doc.name.trim().length > 0 ? doc.name : id
            return { value: id, label }
          })
          .filter((option): option is Option => Boolean(option))
      : []

    upsertCategoryOptionsCache(options)
    return options
  }, [upsertCategoryOptionsCache])

  const fetchProductOptions = useCallback(
    async (query: string, ids: string[] = [], categoryIDs: string[] = []): Promise<Option[]> => {
      const normalizedQuery = query.trim().toLowerCase()
      const filteredIDs = ids.map((id) => id.trim()).filter(Boolean)
      const normalizedCategoryIDs = Array.from(
        new Set(
          categoryIDs
            .map((categoryID) => categoryID.trim())
            .filter((categoryID) => categoryID.length > 0),
        ),
      ).sort()
      const normalizedCategoryKey =
        normalizedCategoryIDs.length > 0 ? normalizedCategoryIDs.join(',') : 'all'

      const categoryQueryCacheKey = `categories:${normalizedCategoryKey}|q:${normalizedQuery}`

      if (filteredIDs.length === 0 && cachedProductQueryCache[categoryQueryCacheKey]) {
        return cachedProductQueryCache[categoryQueryCacheKey]
      }

      const requestKey =
        filteredIDs.length > 0
          ? `ids:${[...new Set(filteredIDs)].sort().join(',')}`
          : `categories:${normalizedCategoryKey}|q:${normalizedQuery}`

      if (!cachedProductQueryPromises[requestKey]) {
        cachedProductQueryPromises[requestKey] = (async () => {
          const params = new URLSearchParams()

          if (filteredIDs.length > 0) {
            params.set('ids', filteredIDs.join(','))
            params.set('limit', String(Math.min(120, Math.max(20, filteredIDs.length))))
          } else {
            if (normalizedQuery.length > 0) params.set('q', normalizedQuery)
            if (normalizedCategoryIDs.length > 0) {
              params.set('categoryIds', normalizedCategoryIDs.join(','))
            }
            params.set('limit', normalizedQuery.length > 0 ? '60' : '80')
          }

          const response = await fetch(`/api/widgets/product-options?${params.toString()}`)
          if (!response.ok) return []

          const json = (await response.json()) as ProductOptionsResponse
          const options = Array.isArray(json?.options) ? json.options : []

          if (filteredIDs.length === 0) {
            cachedProductQueryCache[categoryQueryCacheKey] = options
            if (normalizedQuery === '' && normalizedCategoryIDs.length === 0) {
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

  useEffect(() => {
    let cancelled = false

    const fetchSettings = async () => {
      if (!cachedFavoriteRules) {
        setSettingsLoading(true)
      }

      try {
        const response = await fetch('/api/globals/widget-settings?depth=0')
        if (!response.ok) {
          throw new Error('Failed to load favorite products settings')
        }

        const json = (await response.json()) as WidgetSettingsResponse
        const normalizedRules = normalizeRules(json.favoriteProductsByBranchRules)
        const uiRules = clearRuleCategoryFilters(normalizedRules)
        cachedFavoriteRules = cloneRules(uiRules)

        if (!cancelled) {
          setRules(cloneRules(uiRules))
          setLoadError(null)
        }

        const preselectedBranchIDs = extractPreselectedBranchIDs(uiRules)
        const missingBranchIDs = preselectedBranchIDs.filter(
          (id) => id && !cachedBranchOptionsByID[id],
        )

        if (cachedBranchOptions.length === 0 || missingBranchIDs.length > 0) {
          setBranchesLoading(true)
          void fetchBranchOptions(missingBranchIDs).finally(() => {
            if (!cancelled) {
              setBranchesLoading(false)
            }
          })
        } else {
          setBranchesLoading(false)
        }

        if (cachedCategoryOptions.length === 0) {
          setCategoriesLoading(true)
          void fetchCategoryOptions().finally(() => {
            if (!cancelled) {
              setCategoriesLoading(false)
            }
          })
        }

        const preselectedProductIDs = extractPreselectedProductIDs(uiRules)
        if (preselectedProductIDs.length > 0) {
          setProductsLoading(true)
          void fetchProductOptions('', preselectedProductIDs).finally(() => {
            if (!cancelled) {
              setProductsLoading(false)
            }
          })
        } else if (cachedDefaultProductOptions.length === 0) {
          void fetchProductOptions('')
            .then((options) => {
              if (!cancelled) {
                setDefaultProductOptions(options)
              }
            })
            .catch((error) => {
              console.error('Failed preloading product options for favorite products widget:', error)
            })
        }
      } catch (error) {
        console.error('Failed loading favorite products widget settings:', error)
        if (!cancelled && !cachedFavoriteRules) {
          setLoadError('Unable to load favorite products settings.')
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
  }, [fetchBranchOptions, fetchCategoryOptions, fetchProductOptions])

  const setRule = (index: number, patch: Partial<FavoriteProductsRule>) => {
    setRules((previous) => {
      if (!previous) return previous
      const next = [...previous]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const addRule = () => {
    setRules((previous) => {
      const current = Array.isArray(previous) ? [...previous] : []
      current.push({
        enabled: true,
        ruleName: `Rule ${current.length + 1}`,
        branches: [],
        category: [],
        products: [],
      })
      return current
    })
  }

  const removeRule = (index: number) => {
    setRules((previous) => {
      if (!previous) return previous
      return previous.filter((_, currentIndex) => currentIndex !== index)
    })
  }

  const removeProductFromRule = (ruleIndex: number, productID: string) => {
    setRules((previous) => {
      if (!previous) return previous
      const rule = previous[ruleIndex]
      if (!rule) return previous

      const next = [...previous]
      next[ruleIndex] = {
        ...rule,
        products: rule.products.filter((id) => id !== productID),
      }
      return next
    })
  }

  const moveProductInRule = useCallback(
    (ruleIndex: number, sourceIndex: number, targetIndex: number) => {
      if (sourceIndex === targetIndex) return

      setRules((previous) => {
        if (!previous) return previous
        const rule = previous[ruleIndex]
        if (!rule) return previous
        if (
          sourceIndex < 0 ||
          sourceIndex >= rule.products.length ||
          targetIndex < 0 ||
          targetIndex >= rule.products.length
        ) {
          return previous
        }

        const nextProducts = [...rule.products]
        const [movedProductID] = nextProducts.splice(sourceIndex, 1)
        if (!movedProductID) return previous

        nextProducts.splice(targetIndex, 0, movedProductID)

        const next = [...previous]
        next[ruleIndex] = {
          ...rule,
          products: nextProducts,
        }
        return next
      })
    },
    [],
  )

  const getDragSourceIndex = (event: React.DragEvent<HTMLElement>, ruleIndex: number): number | null => {
    if (draggingProduct && draggingProduct.ruleIndex === ruleIndex) {
      return draggingProduct.sourceIndex
    }

    const draggedIndex = Number.parseInt(event.dataTransfer.getData('text/plain'), 10)
    return Number.isNaN(draggedIndex) ? null : draggedIndex
  }

  const handleProductDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    ruleIndex: number,
    productIndex: number,
  ) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(productIndex))
    setDraggingProduct({ ruleIndex, sourceIndex: productIndex })
  }

  const handleProductDragOver = (event: React.DragEvent<HTMLElement>, ruleIndex: number) => {
    if (draggingProduct && draggingProduct.ruleIndex !== ruleIndex) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleProductDropOnChip = (
    event: React.DragEvent<HTMLDivElement>,
    ruleIndex: number,
    targetIndex: number,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const sourceIndex = getDragSourceIndex(event, ruleIndex)
    if (sourceIndex === null) {
      setDraggingProduct(null)
      return
    }

    moveProductInRule(ruleIndex, sourceIndex, targetIndex)
    setDraggingProduct(null)
  }

  const handleProductDropToEnd = (
    event: React.DragEvent<HTMLDivElement>,
    ruleIndex: number,
    productCount: number,
  ) => {
    event.preventDefault()

    const sourceIndex = getDragSourceIndex(event, ruleIndex)
    if (sourceIndex === null) {
      setDraggingProduct(null)
      return
    }

    const targetIndex = Math.max(productCount - 1, 0)
    moveProductInRule(ruleIndex, sourceIndex, targetIndex)
    setDraggingProduct(null)
  }

  const handleProductDragEnd = () => {
    setDraggingProduct(null)
  }

  const buildRuleKey = (rule: FavoriteProductsRule, index: number): string =>
    rule.id && rule.id.trim().length > 0 ? rule.id : String(index)

  const isRuleOpen = (rule: FavoriteProductsRule, index: number): boolean =>
    Boolean(openRules[buildRuleKey(rule, index)])

  const toggleRule = (rule: FavoriteProductsRule, index: number) => {
    const key = buildRuleKey(rule, index)
    setOpenRules((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  const getBranchValues = (rule: FavoriteProductsRule): Option[] =>
    rule.branches.map((id) => branchOptionsByID[id] || { value: id, label: id })

  const getCategoryValue = (rule: FavoriteProductsRule): Option | null => {
    const categoryID = rule.category[0]
    if (!categoryID) return null
    return categoryOptionsByID[categoryID] || { value: categoryID, label: categoryID }
  }

  const getProductValues = (rule: FavoriteProductsRule): Option[] =>
    rule.products.map((id) => productOptionsByID[id] || { value: id, label: id })

  const loadProductOptionsForRule = (rule: FavoriteProductsRule) => async (inputValue: string) =>
    fetchProductOptions(inputValue, [], rule.category)

  const getRuleSelectionPlaceholder = (
    count: number,
    singularLabel: string,
    emptyPlaceholder: string,
  ): string =>
    count > 0
      ? `${count} ${singularLabel}${count === 1 ? '' : 's'} selected`
      : emptyPlaceholder

  const saveRules = async () => {
    if (!rules) return

    for (let index = 0; index < rules.length; index += 1) {
      if (rules[index].branches.length === 0 || rules[index].products.length === 0) {
        alert(`Rule ${index + 1} must include at least one branch and one product.`)
        return
      }
    }

    setSaving(true)
    try {
      const payloadRules = rules.map((rule, index) => ({
        ...(rule.id ? { id: rule.id } : {}),
        enabled: rule.enabled !== false,
        ruleName:
          typeof rule.ruleName === 'string' && rule.ruleName.trim().length > 0
            ? rule.ruleName.trim()
            : `Rule ${index + 1}`,
        branches: Array.from(new Set(rule.branches.filter(Boolean))),
        category: Array.from(new Set(rule.category.filter(Boolean))),
        products: Array.from(new Set(rule.products.filter(Boolean))),
      }))

      let response: Response | null = null

      for (const method of ['POST', 'PATCH']) {
        const attempted = await fetch('/api/globals/widget-settings', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            favoriteProductsByBranchRules: payloadRules,
          }),
        })

        if (attempted.ok || ![404, 405].includes(attempted.status)) {
          response = attempted
          break
        }
      }

      if (!response) {
        throw new Error('Unable to save favorite products rules')
      }

      const json = (await response.json()) as WidgetSettingsResponse
      if (!response.ok) {
        throw new Error((json as { message?: string })?.message || 'Failed to save favorite rules')
      }

      let latestRulesRaw: unknown = json.favoriteProductsByBranchRules
      if (!Array.isArray(latestRulesRaw)) {
        try {
          const refreshResponse = await fetch('/api/globals/widget-settings?depth=0')
          if (refreshResponse.ok) {
            const refreshJSON = (await refreshResponse.json()) as WidgetSettingsResponse
            latestRulesRaw = refreshJSON.favoriteProductsByBranchRules
          }
        } catch (refreshError) {
          console.error('Failed refreshing favorite products settings after save:', refreshError)
        }
      }

      const normalizedRules = Array.isArray(latestRulesRaw)
        ? normalizeRules(latestRulesRaw)
        : cloneRules(rules)
      const uiRules = clearRuleCategoryFilters(normalizedRules)
      cachedFavoriteRules = cloneRules(uiRules)
      setRules(cloneRules(uiRules))
      setSaveNotice('Favorite Products rules saved')
    } catch (error) {
      console.error('Failed saving favorite products rules:', error)
      alert(error instanceof Error ? error.message : 'Failed to save favorite product rules')
    } finally {
      setSaving(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="favorite-products-widget loading">
        <Loader2 className="animate-spin" size={18} />
        <span>Loading favorite product rules...</span>
      </div>
    )
  }

  if (!rules) {
    return (
      <div className="favorite-products-widget loading">
        <span>{loadError || 'Unable to load favorite product rules.'}</span>
      </div>
    )
  }

  return (
    <div className="favorite-products-widget">
      <div className="fp-toolbar">
        <p>
          Create branch-wise favorite product rules.
          {productsLoading ? <span className="fp-loading-info"> Loading products...</span> : null}
          {branchesLoading && branchOptions.length === 0 ? (
            <span className="fp-loading-info"> Loading branches...</span>
          ) : null}
          {categoriesLoading && categoryOptions.length === 0 ? (
            <span className="fp-loading-info"> Loading categories...</span>
          ) : null}
          {saveNotice ? <span className="fp-success-info"> {saveNotice}</span> : null}
        </p>
        <button type="button" className="fp-save-btn" onClick={saveRules} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={15} /> Saving...
            </>
          ) : (
            <>
              <Save size={15} /> Save Rules
            </>
          )}
        </button>
      </div>

      <div className="fp-rule-list">
        {rules.map((rule, index) => (
          <div className="fp-rule-card" key={rule.id || `favorite-rule-${index}`}>
            <div className="fp-rule-head">
              <button type="button" className="fp-rule-toggle" onClick={() => toggleRule(rule, index)}>
                <span>{rule.ruleName || `Rule ${index + 1}`}</span>
                <span className="fp-rule-meta">
                  {rule.branches.length} branch{rule.branches.length === 1 ? '' : 'es'} | {rule.products.length}{' '}
                  product{rule.products.length === 1 ? '' : 's'}
                </span>
                {isRuleOpen(rule, index) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button type="button" className="fp-remove-btn" onClick={() => removeRule(index)}>
                <Trash2 size={14} /> Remove
              </button>
            </div>

            {isRuleOpen(rule, index) && (
              <div className="fp-rule-body">
                <div className="fp-grid fp-grid-2">
                  <label>
                    Rule Name
                    <input
                      type="text"
                      value={rule.ruleName}
                      onChange={(e) => setRule(index, { ruleName: e.target.value })}
                      placeholder={`Rule ${index + 1}`}
                    />
                  </label>
                  <label className="fp-inline-toggle">
                    <input
                      type="checkbox"
                      checked={rule.enabled !== false}
                      onChange={(e) => setRule(index, { enabled: e.target.checked })}
                    />
                    Rule Enabled
                  </label>
                </div>

                <div className="fp-grid">
                  <label>
                    Branches
                    <Select
                      isMulti
                      isClearable={false}
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      menuPortalTarget={selectMenuPortalTarget}
                      menuPosition="fixed"
                      menuPlacement="auto"
                      maxMenuHeight={280}
                      options={branchOptions}
                      value={getBranchValues(rule)}
                      onChange={(selected) =>
                        setRule(index, {
                          branches: Array.isArray(selected)
                            ? selected.map((option) => option.value).filter(Boolean)
                            : [],
                        })
                      }
                      styles={customSelectStyles}
                      components={{ Option: CheckboxOption, IndicatorSeparator: NoIndicatorSeparator }}
                      placeholder={getRuleSelectionPlaceholder(
                        rule.branches.length,
                        'branch',
                        'Select one or more branches',
                      )}
                      isLoading={branchesLoading && branchOptions.length === 0}
                      noOptionsMessage={() =>
                        branchesLoading && branchOptions.length === 0
                          ? 'Loading branches...'
                          : 'No branches found'
                      }
                    />
                  </label>

                  <label>
                    Category
                    <Select
                      isClearable
                      menuPortalTarget={selectMenuPortalTarget}
                      menuPosition="fixed"
                      menuPlacement="auto"
                      maxMenuHeight={280}
                      options={categoryOptions}
                      value={getCategoryValue(rule)}
                      onChange={(selected) => {
                        const selectedOption = selected as Option | null
                        const nextCategoryIDs = selectedOption?.value
                          ? [selectedOption.value]
                          : []
                        setRule(index, {
                          category: nextCategoryIDs,
                        })
                        setProductsLoading(true)
                        void fetchProductOptions('', [], nextCategoryIDs)
                          .then((options) => {
                            if (nextCategoryIDs.length === 0) {
                              setDefaultProductOptions(options)
                            }
                          })
                          .finally(() => {
                            setProductsLoading(false)
                          })
                      }}
                      styles={customSelectStyles}
                      components={{ IndicatorSeparator: NoIndicatorSeparator }}
                      placeholder="Select category to filter products"
                      isLoading={categoriesLoading}
                      noOptionsMessage={() =>
                        categoriesLoading ? 'Loading categories...' : 'No categories found'
                      }
                    />
                  </label>

                  <label>
                    Favorite Products
                    <AsyncSelect
                      key={`${buildRuleKey(rule, index)}-${rule.category.join(',') || 'all-categories'}`}
                      isMulti
                      controlShouldRenderValue={false}
                      isClearable={false}
                      cacheOptions
                      defaultOptions={rule.category.length > 0 ? true : defaultProductOptions}
                      loadOptions={loadProductOptionsForRule(rule)}
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      menuPortalTarget={selectMenuPortalTarget}
                      menuPosition="fixed"
                      menuPlacement="auto"
                      maxMenuHeight={280}
                      value={getProductValues(rule)}
                      onChange={(selected) =>
                        setRule(index, {
                          products: Array.isArray(selected)
                            ? selected.map((option) => option.value).filter(Boolean)
                            : [],
                        })
                      }
                      styles={customSelectStyles}
                      components={{ Option: CheckboxOption, IndicatorSeparator: NoIndicatorSeparator }}
                      isLoading={productsLoading}
                      placeholder={getRuleSelectionPlaceholder(
                        rule.products.length,
                        'product',
                        rule.category.length > 0
                          ? 'Select one or more products'
                          : 'Select products (use category filter to narrow)',
                      )}
                      noOptionsMessage={() =>
                        productsLoading ? 'Loading products...' : 'No products found'
                      }
                    />
                  </label>
                </div>

                <div className="fp-products-selected-row">
                  <span className="fp-products-selected-title">Selected Products</span>
                  <div className="fp-selected-list">
                    {rule.products.length === 0 ? (
                      <span className="fp-selected-empty">No products selected yet</span>
                    ) : (
                      <div
                        className={`fp-selected-chip-list ${draggingProduct?.ruleIndex === index ? 'is-dragging' : ''}`}
                        onDragOver={(event) => handleProductDragOver(event, index)}
                        onDrop={(event) => handleProductDropToEnd(event, index, rule.products.length)}
                      >
                        {rule.products.map((productID, productIndex) => {
                          const productLabel = productOptionsByID[productID]?.label || productID
                          const isDraggingCurrentProduct =
                            draggingProduct?.ruleIndex === index &&
                            draggingProduct.sourceIndex === productIndex
                          return (
                            <div
                              key={`${productID}-${index}-${productIndex}`}
                              className={`fp-selected-chip ${isDraggingCurrentProduct ? 'is-dragging' : ''}`}
                              draggable
                              onDragStart={(event) => handleProductDragStart(event, index, productIndex)}
                              onDragOver={(event) => handleProductDragOver(event, index)}
                              onDrop={(event) => handleProductDropOnChip(event, index, productIndex)}
                              onDragEnd={handleProductDragEnd}
                            >
                              <span>{productLabel}</span>
                              <button
                                type="button"
                                className="fp-chip-remove-btn"
                                onClick={() => removeProductFromRule(index, productID)}
                                aria-label={`Remove ${productLabel}`}
                              >
                                <span className="fp-chip-remove">x</span>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="fp-add-btn" onClick={addRule}>
        <Plus size={14} /> Add Favorite Rule
      </button>
    </div>
  )
}

export default FavoriteProductsWidget
