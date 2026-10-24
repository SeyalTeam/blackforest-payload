'use client'

import React, { useEffect, useState } from 'react'
import { useRowLabel } from '@payloadcms/ui'

// In-memory cache across row re-renders to prevent redundant network requests
const chefNameCache = new Map<string, string>()
const categoryNameCache = new Map<string, string>()

type RowData = {
  chef?: string | { id?: string; _id?: string; name?: string; username?: string } | null
  chefName?: string | null
  assignmentType?: 'kitchen' | 'stock' | 'both' | null
  status?: 'active' | 'inactive' | null
  kitchenCategories?: Array<string | { id?: string; _id?: string; name?: string }> | null
  stockCategories?: Array<string | { id?: string; _id?: string; name?: string }> | null
  kitchenCategoryNames?: string | null
  stockCategoryNames?: string | null
}

const extractId = (val: unknown): string => {
  if (!val) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>
    if (obj.id) return extractId(obj.id)
    if (obj._id) return extractId(obj._id)
    if (obj.value) return extractId(obj.value)
  }
  return ''
}

const extractName = (val: unknown): string => {
  if (!val) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>
    if (typeof obj.name === 'string' && obj.name.trim()) return obj.name.trim()
    if (typeof obj.label === 'string' && obj.label.trim()) return obj.label.trim()
    if (typeof obj.title === 'string' && obj.title.trim()) return obj.title.trim()
    if (typeof obj.username === 'string' && obj.username.trim()) return obj.username.trim()
  }
  return ''
}

export const ChefRowLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<RowData>()

  const chefId = extractId(data?.chef)
  const initialChefName =
    (typeof data?.chefName === 'string' && data.chefName.trim()) ||
    extractName(data?.chef) ||
    (chefId ? chefNameCache.get(chefId) : undefined) ||
    ''

  const [chefDisplayName, setChefDisplayName] = useState<string>(initialChefName)

  // Fetch or cache chef name
  useEffect(() => {
    if (initialChefName) {
      setChefDisplayName(initialChefName)
      if (chefId) chefNameCache.set(chefId, initialChefName)
      return
    }

    if (!chefId) {
      setChefDisplayName('')
      return
    }

    if (chefNameCache.has(chefId)) {
      setChefDisplayName(chefNameCache.get(chefId) || '')
      return
    }

    let isMounted = true
    fetch(`/api/users/${chefId}?depth=0`)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (!isMounted) return
        const resolved = (doc?.name || doc?.username || '').trim()
        if (resolved) {
          chefNameCache.set(chefId, resolved)
          setChefDisplayName(resolved)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [chefId, initialChefName])

  // Extract kitchen categories
  const kCats = Array.isArray(data?.kitchenCategories) ? data.kitchenCategories : []
  const initialKitchenText =
    (typeof data?.kitchenCategoryNames === 'string' && data.kitchenCategoryNames.trim()) ||
    kCats
      .map((c) => (typeof c === 'object' && c !== null ? (c as any).name : undefined))
      .filter((n): n is string => Boolean(n))
      .join(', ')

  const [kitchenCategoriesText, setKitchenCategoriesText] = useState<string>(initialKitchenText)

  useEffect(() => {
    if (initialKitchenText) {
      setKitchenCategoriesText(initialKitchenText)
      return
    }

    const missingIds: string[] = []
    const resolvedNames: string[] = []

    for (const item of kCats) {
      const id = extractId(item)
      if (!id) continue
      const name = extractName(item) || categoryNameCache.get(id)
      if (name) {
        resolvedNames.push(name)
      } else {
        missingIds.push(id)
      }
    }

    if (missingIds.length === 0) {
      setKitchenCategoriesText(resolvedNames.join(', '))
      return
    }

    let isMounted = true
    Promise.all(
      missingIds.map((id) =>
        fetch(`/api/categories/${id}?depth=0`)
          .then((res) => (res.ok ? res.json() : null))
          .then((doc) => {
            if (doc?.name) {
              categoryNameCache.set(id, doc.name)
              return doc.name as string
            }
            return ''
          })
          .catch(() => ''),
      ),
    ).then((fetched) => {
      if (!isMounted) return
      const all = [...resolvedNames, ...fetched.filter(Boolean)]
      setKitchenCategoriesText(all.join(', '))
    })

    return () => {
      isMounted = false
    }
  }, [kCats, initialKitchenText])

  // Extract stock categories
  const sCats = Array.isArray(data?.stockCategories) ? data.stockCategories : []
  const initialStockText =
    (typeof data?.stockCategoryNames === 'string' && data.stockCategoryNames.trim()) ||
    sCats
      .map((c) => (typeof c === 'object' && c !== null ? (c as any).name : undefined))
      .filter((n): n is string => Boolean(n))
      .join(', ')

  const [stockCategoriesText, setStockCategoriesText] = useState<string>(initialStockText)

  useEffect(() => {
    if (initialStockText) {
      setStockCategoriesText(initialStockText)
      return
    }

    const missingIds: string[] = []
    const resolvedNames: string[] = []

    for (const item of sCats) {
      const id = extractId(item)
      if (!id) continue
      const name = extractName(item) || categoryNameCache.get(id)
      if (name) {
        resolvedNames.push(name)
      } else {
        missingIds.push(id)
      }
    }

    if (missingIds.length === 0) {
      setStockCategoriesText(resolvedNames.join(', '))
      return
    }

    let isMounted = true
    Promise.all(
      missingIds.map((id) =>
        fetch(`/api/categories/${id}?depth=0`)
          .then((res) => (res.ok ? res.json() : null))
          .then((doc) => {
            if (doc?.name) {
              categoryNameCache.set(id, doc.name)
              return doc.name as string
            }
            return ''
          })
          .catch(() => ''),
      ),
    ).then((fetched) => {
      if (!isMounted) return
      const all = [...resolvedNames, ...fetched.filter(Boolean)]
      setStockCategoriesText(all.join(', '))
    })

    return () => {
      isMounted = false
    }
  }, [sCats, initialStockText])

  const rowDisplayNumber =
    typeof rowNumber === 'number' ? String(rowNumber + 1).padStart(2, '0') : '01'

  if (!chefDisplayName && !chefId) {
    return <span>{`Chef Assignment ${rowDisplayNumber}`}</span>
  }

  const nameToDisplay = chefDisplayName || `Chef #${chefId.slice(-4)}`
  const assignmentType = data?.assignmentType || 'both'
  const isInactive = data?.status === 'inactive'

  // Format category parts
  let assignmentLabel = ''
  if (assignmentType === 'kitchen') {
    const kText = kitchenCategoriesText ? `(${kitchenCategoriesText})` : '(No categories)'
    assignmentLabel = `Kitchen ${kText}`
  } else if (assignmentType === 'stock') {
    const sText = stockCategoriesText ? `(${stockCategoriesText})` : '(No categories)'
    assignmentLabel = `Stock ${sText}`
  } else {
    // both
    const kText = kitchenCategoriesText ? `Kitchen (${kitchenCategoriesText})` : 'Kitchen (No categories)'
    const sText = stockCategoriesText ? `Stock (${stockCategoriesText})` : 'Stock (No categories)'
    assignmentLabel = `${kText} | ${sText}`
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <strong style={{ color: 'var(--theme-elevation-900, #111)' }}>{nameToDisplay}</strong>
      <span style={{ color: 'var(--theme-elevation-500, #666)' }}>—</span>
      <span style={{ color: 'var(--theme-elevation-700, #333)' }}>{assignmentLabel}</span>
      {isInactive && (
        <span
          style={{
            fontSize: '11px',
            padding: '1px 6px',
            borderRadius: '4px',
            background: 'var(--theme-error-100, #fee2e2)',
            color: 'var(--theme-error-800, #991b1b)',
            fontWeight: 500,
            marginLeft: '4px',
          }}
        >
          Inactive
        </span>
      )}
    </span>
  )
}

export default ChefRowLabel
