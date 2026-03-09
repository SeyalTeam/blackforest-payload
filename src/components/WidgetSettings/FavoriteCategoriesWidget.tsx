'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Select, {
  components as selectComponents,
  type OptionProps,
  type StylesConfig,
} from 'react-select'
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import './favorite-products-widget.scss'

type Option = { value: string; label: string }
type BranchOptionsResponse = { docs?: Array<{ id?: string; name?: string }> }
type CategoryOptionsResponse = { docs?: Array<{ id?: string; name?: string }> }

type FavoriteCategoriesRule = {
  id?: string
  enabled: boolean
  ruleName: string
  branches: string[]
  categories: string[]
}

type WidgetSettingsResponse = {
  favoriteCategoriesByBranchRules?: unknown
}

type FavoriteCategoriesWidgetProps = {
  preloadedBranchOptions?: Option[]
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
  if (!Array.isArray(value)) return []

  const ids = value
    .map((entry) => getRelationshipID(entry))
    .filter((id): id is string => typeof id === 'string')

  return Array.from(new Set(ids))
}

const normalizeRules = (value: unknown): FavoriteCategoriesRule[] => {
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
      categories: getRelationshipIDs(raw.categories),
    }
  })
}

const cloneRules = (rules: FavoriteCategoriesRule[]): FavoriteCategoriesRule[] =>
  rules.map((rule) => ({
    ...rule,
    branches: [...rule.branches],
    categories: [...rule.categories],
  }))

const extractPreselectedBranchIDs = (rules: FavoriteCategoriesRule[]): string[] => {
  const ids = new Set<string>()
  for (const rule of rules) {
    for (const id of rule.branches) ids.add(id)
  }
  return Array.from(ids)
}

const extractPreselectedCategoryIDs = (rules: FavoriteCategoriesRule[]): string[] => {
  const ids = new Set<string>()
  for (const rule of rules) {
    for (const id of rule.categories) ids.add(id)
  }
  return Array.from(ids)
}

const customSelectStyles: StylesConfig<Option, true> = {
  control: (base) => ({
    ...base,
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    color: '#fff',
    minHeight: '44px',
    '&:hover': { borderColor: '#3b82f6' },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    zIndex: 9999,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#27272a' : 'transparent',
    color: '#fff',
    '&:active': { backgroundColor: '#3b82f6' },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.45)',
  }),
  multiValueLabel: (base) => ({ ...base, color: '#bfdbfe' }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#93c5fd',
    ':hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      color: '#fca5a5',
    },
  }),
  placeholder: (base) => ({ ...base, color: '#71717a' }),
  singleValue: (base) => ({ ...base, color: '#fff' }),
  input: (base) => ({ ...base, color: '#fff' }),
}

const CheckboxOption = (props: OptionProps<Option, true>) => (
  <selectComponents.Option {...props}>
    <div className="fp-select-option-with-check">
      <input type="checkbox" checked={Boolean(props.isSelected)} readOnly />
      <span>{props.label}</span>
    </div>
  </selectComponents.Option>
)

const NoIndicatorSeparator = () => null

let cachedFavoriteCategoryRules: FavoriteCategoriesRule[] | null = null
let cachedBranchOptions: Option[] = []
let cachedBranchOptionsByID: Record<string, Option> = {}
let cachedCategoryOptions: Option[] = []
let cachedCategoryOptionsByID: Record<string, Option> = {}

const FavoriteCategoriesWidget: React.FC<FavoriteCategoriesWidgetProps> = ({
  preloadedBranchOptions = [],
}) => {
  const selectMenuPortalTarget = typeof document !== 'undefined' ? document.body : undefined
  const [rules, setRules] = useState<FavoriteCategoriesRule[] | null>(
    cachedFavoriteCategoryRules ? cloneRules(cachedFavoriteCategoryRules) : null,
  )
  const [settingsLoading, setSettingsLoading] = useState(!cachedFavoriteCategoryRules)
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openRules, setOpenRules] = useState<Record<string, boolean>>({})
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [branchOptions, setBranchOptions] = useState<Option[]>(cachedBranchOptions)
  const [branchOptionsByID, setBranchOptionsByID] = useState<Record<string, Option>>(
    cachedBranchOptionsByID,
  )
  const [categoryOptions, setCategoryOptions] = useState<Option[]>(cachedCategoryOptions)
  const [categoryOptionsByID, setCategoryOptionsByID] = useState<Record<string, Option>>(
    cachedCategoryOptionsByID,
  )

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

  const fetchCategoryOptions = useCallback(
    async (ids: string[] = []): Promise<Option[]> => {
      if (cachedCategoryOptions.length > 0) {
        const missingIDs = ids.filter((id) => id && !cachedCategoryOptionsByID[id])
        if (missingIDs.length === 0) {
          return cachedCategoryOptions
        }
      }

      const response = await fetch('/api/categories?limit=1000&depth=0&sort=name')
      if (!response.ok) return cachedCategoryOptions

      const json = (await response.json()) as CategoryOptionsResponse
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

      upsertCategoryOptionsCache(options)
      return options
    },
    [upsertCategoryOptionsCache],
  )

  useEffect(() => {
    let cancelled = false

    const fetchSettings = async () => {
      if (!cachedFavoriteCategoryRules) {
        setSettingsLoading(true)
      }

      try {
        const response = await fetch('/api/globals/widget-settings?depth=0')
        if (!response.ok) {
          throw new Error('Failed to load favorite categories settings')
        }

        const json = (await response.json()) as WidgetSettingsResponse
        const normalizedRules = normalizeRules(json.favoriteCategoriesByBranchRules)
        cachedFavoriteCategoryRules = cloneRules(normalizedRules)

        if (!cancelled) {
          setRules(cloneRules(normalizedRules))
          setLoadError(null)
        }

        const preselectedBranchIDs = extractPreselectedBranchIDs(normalizedRules)
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

        const preselectedCategoryIDs = extractPreselectedCategoryIDs(normalizedRules)
        const missingCategoryIDs = preselectedCategoryIDs.filter(
          (id) => id && !cachedCategoryOptionsByID[id],
        )
        if (cachedCategoryOptions.length === 0 || missingCategoryIDs.length > 0) {
          setCategoriesLoading(true)
          void fetchCategoryOptions(missingCategoryIDs).finally(() => {
            if (!cancelled) {
              setCategoriesLoading(false)
            }
          })
        } else {
          setCategoriesLoading(false)
        }
      } catch (error) {
        console.error('Failed loading favorite categories widget settings:', error)
        if (!cancelled && !cachedFavoriteCategoryRules) {
          setLoadError('Unable to load favorite categories settings.')
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
  }, [fetchBranchOptions, fetchCategoryOptions])

  const setRule = (index: number, patch: Partial<FavoriteCategoriesRule>) => {
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
        categories: [],
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

  const buildRuleKey = (rule: FavoriteCategoriesRule, index: number): string =>
    rule.id && rule.id.trim().length > 0 ? rule.id : String(index)

  const isRuleOpen = (rule: FavoriteCategoriesRule, index: number): boolean =>
    Boolean(openRules[buildRuleKey(rule, index)])

  const toggleRule = (rule: FavoriteCategoriesRule, index: number) => {
    const key = buildRuleKey(rule, index)
    setOpenRules((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  const getBranchValues = (rule: FavoriteCategoriesRule): Option[] =>
    rule.branches.map((id) => branchOptionsByID[id] || { value: id, label: id })

  const getCategoryValues = (rule: FavoriteCategoriesRule): Option[] =>
    rule.categories.map((id) => categoryOptionsByID[id] || { value: id, label: id })

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
      if (rules[index].branches.length === 0 || rules[index].categories.length === 0) {
        alert(`Rule ${index + 1} must include at least one branch and one category.`)
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
        categories: Array.from(new Set(rule.categories.filter(Boolean))),
      }))

      let response: Response | null = null

      for (const method of ['POST', 'PATCH']) {
        const attempted = await fetch('/api/globals/widget-settings', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            favoriteCategoriesByBranchRules: payloadRules,
          }),
        })

        if (attempted.ok || ![404, 405].includes(attempted.status)) {
          response = attempted
          break
        }
      }

      if (!response) {
        throw new Error('Unable to save favorite categories rules')
      }

      const json = (await response.json()) as WidgetSettingsResponse
      if (!response.ok) {
        throw new Error((json as { message?: string })?.message || 'Failed to save favorite categories rules')
      }

      let latestRulesRaw: unknown = json.favoriteCategoriesByBranchRules
      if (!Array.isArray(latestRulesRaw)) {
        try {
          const refreshResponse = await fetch('/api/globals/widget-settings?depth=0')
          if (refreshResponse.ok) {
            const refreshJSON = (await refreshResponse.json()) as WidgetSettingsResponse
            latestRulesRaw = refreshJSON.favoriteCategoriesByBranchRules
          }
        } catch (refreshError) {
          console.error('Failed refreshing favorite categories settings after save:', refreshError)
        }
      }

      const normalizedRules = Array.isArray(latestRulesRaw)
        ? normalizeRules(latestRulesRaw)
        : cloneRules(rules)
      cachedFavoriteCategoryRules = cloneRules(normalizedRules)
      setRules(cloneRules(normalizedRules))
      setSaveNotice('Favorite Categories rules saved')
    } catch (error) {
      console.error('Failed saving favorite categories rules:', error)
      alert(error instanceof Error ? error.message : 'Failed to save favorite category rules')
    } finally {
      setSaving(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="favorite-products-widget loading">
        <Loader2 className="animate-spin" size={18} />
        <span>Loading favorite category rules...</span>
      </div>
    )
  }

  if (!rules) {
    return (
      <div className="favorite-products-widget loading">
        <span>{loadError || 'Unable to load favorite category rules.'}</span>
      </div>
    )
  }

  return (
    <div className="favorite-products-widget">
      <div className="fp-toolbar">
        <p>
          Create branch-wise favorite category rules.
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
          <div className="fp-rule-card" key={rule.id || `favorite-category-rule-${index}`}>
            <div className="fp-rule-head">
              <button
                type="button"
                className="fp-rule-toggle"
                onClick={() => toggleRule(rule, index)}
              >
                <span>{rule.ruleName || `Rule ${index + 1}`}</span>
                <span className="fp-rule-meta">
                  {rule.branches.length} branch{rule.branches.length === 1 ? '' : 'es'} |{' '}
                  {rule.categories.length} categor{rule.categories.length === 1 ? 'y' : 'ies'}
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

                <div className="fp-grid fp-grid-2">
                  <label>
                    Branches
                    <Select
                      isMulti
                      isClearable={false}
                      controlShouldRenderValue={false}
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
                      components={{
                        Option: CheckboxOption,
                        IndicatorSeparator: NoIndicatorSeparator,
                      }}
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
                    Favorite Categories
                    <Select
                      isMulti
                      isClearable={false}
                      controlShouldRenderValue={false}
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      menuPortalTarget={selectMenuPortalTarget}
                      menuPosition="fixed"
                      menuPlacement="auto"
                      maxMenuHeight={280}
                      options={categoryOptions}
                      value={getCategoryValues(rule)}
                      onChange={(selected) =>
                        setRule(index, {
                          categories: Array.isArray(selected)
                            ? selected.map((option) => option.value).filter(Boolean)
                            : [],
                        })
                      }
                      styles={customSelectStyles}
                      components={{
                        Option: CheckboxOption,
                        IndicatorSeparator: NoIndicatorSeparator,
                      }}
                      placeholder={getRuleSelectionPlaceholder(
                        rule.categories.length,
                        'category',
                        'Select one or more categories',
                      )}
                      isLoading={categoriesLoading && categoryOptions.length === 0}
                      noOptionsMessage={() =>
                        categoriesLoading && categoryOptions.length === 0
                          ? 'Loading categories...'
                          : 'No categories found'
                      }
                    />
                  </label>
                </div>

                <div className="fp-products-selected-row">
                  <span className="fp-products-selected-title">Selected Categories</span>
                  <div className="fp-selected-list">
                    {rule.categories.length === 0 ? (
                      <span className="fp-selected-empty">No categories selected yet</span>
                    ) : (
                      <div className="fp-selected-chip-list">
                        {rule.categories.map((categoryID) => {
                          const categoryLabel = categoryOptionsByID[categoryID]?.label || categoryID
                          return (
                            <button
                              key={`${categoryID}-${index}`}
                              type="button"
                              className="fp-selected-chip"
                              onClick={() =>
                                setRule(index, {
                                  categories: rule.categories.filter((id) => id !== categoryID),
                                })
                              }
                            >
                              <span>{categoryLabel}</span>
                              <span className="fp-chip-remove">x</span>
                            </button>
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
        <Plus size={14} /> Add Favorite Category Rule
      </button>
    </div>
  )
}

export default FavoriteCategoriesWidget
