'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'

type Props = {
  path: string
}

const toNonNegativeNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value)
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed)
    }
  }

  return 0
}

const toFixed2 = (value: number): number => {
  return parseFloat(value.toFixed(2))
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

const ProductPriceOfferPreviewField: React.FC<Props> = ({ path }) => {
  const pathParts = path.split('.')
  const rowBasePath = pathParts.slice(0, -1).join('.')

  const productPath = `${rowBasePath}.product`
  const discountPath = `${rowBasePath}.discountAmount`
  const finalPricePath = `${rowBasePath}.finalPricePreview`

  const { value: currentPriceValue } = useField<number | null>({ path })
  const { value: finalPriceValue } = useField<number | null>({ path: finalPricePath })
  const { value: selectedProduct } = useField({ path: productPath })
  const { value: discountValue } = useField<number | string | null>({ path: discountPath })

  const { dispatch } = useFormFields(([_fields, dispatch]) => ({ dispatch }))
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)

  const productID = useMemo(() => getRelationshipID(selectedProduct), [selectedProduct])

  const updateField = useCallback(
    (targetPath: string, value: number) => {
      dispatch({
        type: 'UPDATE',
        path: targetPath,
        value: toFixed2(Math.max(0, value)),
      })
    },
    [dispatch],
  )

  useEffect(() => {
    const discount = toNonNegativeNumber(discountValue)

    if (!productID) {
      updateField(path, 0)
      updateField(finalPricePath, 0)
      return
    }

    let cancelled = false

    const loadProductPrice = async () => {
      setIsLoadingPrice(true)
      try {
        const response = await fetch(`/api/products/${productID}?depth=0`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`Failed to load product ${productID}`)
        }

        const product = (await response.json()) as {
          defaultPriceDetails?: {
            price?: number
          }
        }

        if (cancelled) return

        const productPrice = toNonNegativeNumber(product?.defaultPriceDetails?.price)
        updateField(path, productPrice)
        updateField(finalPricePath, Math.max(0, productPrice - discount))
      } catch (error) {
        if (cancelled) return
        console.error('Failed to fetch product price preview:', error)
        updateField(path, 0)
        updateField(finalPricePath, 0)
      } finally {
        if (!cancelled) {
          setIsLoadingPrice(false)
        }
      }
    }

    loadProductPrice()

    return () => {
      cancelled = true
    }
  }, [discountValue, finalPricePath, path, productID, updateField])

  useEffect(() => {
    const currentPrice = toNonNegativeNumber(currentPriceValue)
    const discount = toNonNegativeNumber(discountValue)
    const expectedFinalPrice = toFixed2(Math.max(0, currentPrice - discount))
    const currentFinalPrice = toFixed2(toNonNegativeNumber(finalPriceValue))

    if (currentFinalPrice !== expectedFinalPrice) {
      updateField(finalPricePath, expectedFinalPrice)
    }
  }, [currentPriceValue, discountValue, finalPricePath, finalPriceValue, updateField])

  const displayValue = toFixed2(toNonNegativeNumber(currentPriceValue))

  return (
    <div className="field-type number">
      <label className="field-label" htmlFor={path}>
        Current Price (Rs)
      </label>
      <input
        id={path}
        type="number"
        readOnly
        value={displayValue}
        step="0.01"
        style={{ width: '100%' }}
      />
      <p className="field-description">
        {isLoadingPrice ? 'Loading product price...' : 'Auto-filled from selected product price.'}
      </p>
    </div>
  )
}

export default ProductPriceOfferPreviewField
