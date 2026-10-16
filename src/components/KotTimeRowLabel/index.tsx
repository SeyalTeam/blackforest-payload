'use client'

import React, { useEffect, useState } from 'react'
import { useRowLabel } from '@payloadcms/ui'

// In-memory cache across row re-renders to prevent redundant network requests
const branchNameCache = new Map<string, string>()

type RowData = {
  branch?: string | { id?: string; _id?: string; name?: string } | null
  branchName?: string | null
}

export const KotTimeRowLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<RowData>()

  const branchObj =
    typeof data?.branch === 'object' && data?.branch !== null ? data.branch : null
  const branchId =
    typeof data?.branch === 'string'
      ? data.branch.trim()
      : (branchObj?.id || (branchObj as any)?._id || '').trim()

  const directName =
    (typeof data?.branchName === 'string' && data.branchName.trim()) ||
    (typeof branchObj?.name === 'string' && branchObj.name.trim()) ||
    (branchId ? branchNameCache.get(branchId) : undefined)

  const [name, setName] = useState<string>(directName || '')

  useEffect(() => {
    if (directName) {
      setName(directName)
      if (branchId) {
        branchNameCache.set(branchId, directName)
      }
      return
    }

    if (!branchId) {
      setName('')
      return
    }

    if (branchNameCache.has(branchId)) {
      setName(branchNameCache.get(branchId) || '')
      return
    }

    let isMounted = true

    fetch(`/api/branches/${branchId}?depth=0`)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (!isMounted) return
        const resolvedName = (doc?.name || '').trim()
        if (resolvedName) {
          branchNameCache.set(branchId, resolvedName)
          setName(resolvedName)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [branchId, directName])

  const rowDisplayNumber =
    typeof rowNumber === 'number'
      ? String(rowNumber + 1).padStart(2, '0')
      : '01'

  if (name && name.trim().length > 0) {
    const trimmed = name.trim()
    const formattedLabel = trimmed.toLowerCase().endsWith('kot time')
      ? trimmed
      : `${trimmed} KOT Time`

    return <span>{formattedLabel}</span>
  }

  return <span>{`Branch KOT Time ${rowDisplayNumber}`}</span>
}

export default KotTimeRowLabel
