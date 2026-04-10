'use client'
import React, { useState } from 'react'
import './index.scss'
import { Product } from '@/payload-types'

// Reusing types
export type BillItem = {
  product?: string | Product | null
  status?: 'ordered' | 'prepared' | 'delivered' | 'cancelled' | null
  name?: string | null
  notes?: string | null
  quantity: number
  unitPrice: number
  effectiveUnitPrice?: number | null
  isPriceOfferApplied?: boolean | null
  priceOfferDiscountPerUnit?: number | null
  subtotal: number
  gstRate?: number | null
  taxableAmount?: number | null
  gstAmount?: number | null
  finalLineTotal?: number | null
}

export type BillData = {
  id?: string
  invoiceNumber?: string | null
  createdAt?: string
  items?: BillItem[]
  grossAmount?: number | null
  totalAmount?: number
  totalAmountBeforeRoundOff?: number | null
  roundOffAmount?: number | null
  customerOfferDiscount?: number | null
  customerEntryPercentageOfferDiscount?: number | null
  totalPercentageOfferDiscount?: number | null
  totalTaxableAmount?: number | null
  totalGSTAmount?: number | null
  existingReviews?: {
    items?: Array<{
      product: string | Product
      rating: number
      feedback?: string
    }>
  } | null
  customerDetails?: {
    name?: string | null
    phoneNumber?: string | null
    address?: string | null
  } | null
  paymentMethod?: string | null
  createdBy?:
    | {
        name?: string | null
      }
    | string
    | null
  branch?:
    | {
        id?: string
        name?: string
        address?: string
        phone?: string
        gst?: string
      }
    | string
    | null
  company?:
    | {
        name?: string
        gst?: string | null
      }
    | string
    | null
  tableDetails?: {
    section?: string | null
    tableNumber?: string | null
  } | null
}

import { updateCustomer } from '@/app/actions/updateCustomer'

const roundMoney = (value: number): number => Number(value.toFixed(2))

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

const toPaiseValue = (value: number): number => Math.max(0, Math.round(toFiniteNumber(value) * 100))

const fromPaiseValue = (paise: number): number => roundMoney(Math.max(0, paise) / 100)

const splitGSTFromInclusiveLine = (
  lineTotalInclusiveInPaise: number,
  gstRate: number,
): {
  taxableInPaise: number
  gstInPaise: number
  cgstInPaise: number
  sgstInPaise: number
} => {
  const normalizedLineTotalInPaise = Math.max(0, lineTotalInclusiveInPaise)
  const normalizedRate = Math.max(0, toFiniteNumber(gstRate))
  const taxableInPaise =
    normalizedRate > 0
      ? Math.min(
          normalizedLineTotalInPaise,
          Math.max(0, Math.round((normalizedLineTotalInPaise * 100) / (100 + normalizedRate))),
        )
      : normalizedLineTotalInPaise
  const gstInPaise = normalizedLineTotalInPaise - taxableInPaise
  const cgstInPaise = Math.floor(gstInPaise / 2)
  const sgstInPaise = gstInPaise - cgstInPaise

  return {
    taxableInPaise,
    gstInPaise: cgstInPaise + sgstInPaise,
    cgstInPaise,
    sgstInPaise,
  }
}

const getRelationshipId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim().length > 0 ? id : null
  }

  return null
}

const getDisplayUnitPrice = (item: BillItem): number => {
  if (item.isPriceOfferApplied && typeof item.effectiveUnitPrice === 'number') {
    return item.effectiveUnitPrice
  }

  return item.unitPrice
}

const getGSTDetails = (
  item: BillItem,
  branchId: string | null,
): { hsnCode: string | null; rate: number } => {
  const product = item.product
  if (!product || typeof product !== 'object') {
    return { hsnCode: null, rate: 0 }
  }

  const hsnCode = typeof product.hsnCode === 'string' ? product.hsnCode : null
  let gstRate = toFiniteNumber(product.defaultPriceDetails?.gst)

  if (branchId && Array.isArray(product.branchOverrides)) {
    const override = product.branchOverrides.find((branchOverride) => {
      const overrideBranchId = getRelationshipId(branchOverride?.branch)
      return overrideBranchId === branchId
    })

    if (override?.gst) {
      gstRate = toFiniteNumber(override.gst)
    }
  }

  return {
    hsnCode,
    rate: gstRate,
  }
}

const BillReceipt: React.FC<{ data: BillData }> = ({ data }) => {
  const {
    id,
    invoiceNumber,
    createdAt,
    items = [],
    grossAmount = 0,
    totalAmount = 0,
    totalAmountBeforeRoundOff: storedTotalAmountBeforeRoundOff,
    roundOffAmount: storedRoundOffAmount,
    customerOfferDiscount = 0,
    customerEntryPercentageOfferDiscount = 0,
    totalPercentageOfferDiscount = 0,
    totalTaxableAmount: storedTotalTaxableAmount,
    totalGSTAmount: storedTotalGSTAmount,
    customerDetails,
    paymentMethod,
    branch,
    createdBy,
    company,
    existingReviews,
    tableDetails,
  } = data

  const branchId = getRelationshipId(branch)
  const billedItems = items.filter((item) => item.status !== 'cancelled')
  const cancelledItems = items.filter((item) => item.status === 'cancelled')
  const billedLineCount = billedItems.length
  const billedQuantity = billedItems.reduce((sum, item) => sum + toFiniteNumber(item.quantity), 0)
  const billedLineTotalsInPaise = billedItems.map((item) =>
    toPaiseValue(toFiniteNumber(item.subtotal ?? toFiniteNumber(item.quantity) * getDisplayUnitPrice(item))),
  )
  const billedGrossAmountInPaise = billedLineTotalsInPaise.reduce((sum, lineTotal) => sum + lineTotal, 0)
  const billedGrossAmount = fromPaiseValue(billedGrossAmountInPaise)
  const storedGrossAmountInPaise = toPaiseValue(toFiniteNumber(grossAmount) || billedGrossAmount)
  const storedDiscountAmountInPaise = toPaiseValue(
    toFiniteNumber(customerOfferDiscount) +
      toFiniteNumber(customerEntryPercentageOfferDiscount) +
      toFiniteNumber(totalPercentageOfferDiscount),
  )
  const hasCancelledTotalMismatch =
    cancelledItems.length > 0 &&
    Math.abs(storedGrossAmountInPaise - billedGrossAmountInPaise) > 1
  const displayDiscountAmountInPaise = hasCancelledTotalMismatch
    ? storedGrossAmountInPaise > 0
      ? Math.min(
          billedGrossAmountInPaise,
          Math.round((storedDiscountAmountInPaise * billedGrossAmountInPaise) / storedGrossAmountInPaise),
        )
      : 0
    : Math.min(billedGrossAmountInPaise, storedDiscountAmountInPaise)
  const displayDiscountAmount = fromPaiseValue(displayDiscountAmountInPaise)

  const distributeDiscountAcrossLines = (
    lineTotalsInPaise: number[],
    discountInPaise: number,
  ): number[] => {
    const discounts = lineTotalsInPaise.map(() => 0)
    if (discountInPaise <= 0) return discounts

    const grossInPaise = lineTotalsInPaise.reduce((sum, lineTotal) => sum + lineTotal, 0)
    if (grossInPaise <= 0) return discounts

    type Share = { index: number; remainder: number }
    const shares: Share[] = []
    let assignedDiscountInPaise = 0

    lineTotalsInPaise.forEach((lineTotalInPaise, index) => {
      if (lineTotalInPaise <= 0) return

      const rawShare = (discountInPaise * lineTotalInPaise) / grossInPaise
      const baseShare = Math.floor(rawShare)
      discounts[index] = baseShare
      assignedDiscountInPaise += baseShare
      shares.push({ index, remainder: rawShare - baseShare })
    })

    const remainingInPaise = discountInPaise - assignedDiscountInPaise
    if (remainingInPaise <= 0 || shares.length === 0) return discounts

    shares.sort((left, right) => right.remainder - left.remainder)

    for (let offset = 0; offset < remainingInPaise; offset += 1) {
      const share = shares[offset % shares.length]
      if (!share) continue

      const index = share.index
      if (discounts[index] < lineTotalsInPaise[index]) {
        discounts[index] += 1
      }
    }

    return discounts
  }

  const billedLineDiscountsInPaise = distributeDiscountAcrossLines(
    billedLineTotalsInPaise,
    displayDiscountAmountInPaise,
  )
  const fallbackLineTotalsInclusiveInPaise = billedLineTotalsInPaise.map((lineTotalInPaise, index) =>
    Math.max(0, lineTotalInPaise - (billedLineDiscountsInPaise[index] || 0)),
  )
  const sellerGSTIN =
    typeof branch === 'object' && branch !== null
      ? branch.gst || (typeof company === 'object' && company !== null ? company.gst || '' : '')
      : typeof company === 'object' && company !== null
        ? company.gst || ''
        : ''

  const itemTaxBreakdowns = billedItems.map((item, index) => {
    const fallbackGSTDetails = getGSTDetails(item, branchId)
    const fallbackLineTotalInPaise = fallbackLineTotalsInclusiveInPaise[index] || 0
    const fallbackSplit = splitGSTFromInclusiveLine(fallbackLineTotalInPaise, fallbackGSTDetails.rate)

    const hasStoredBreakdown =
      item.finalLineTotal != null || item.taxableAmount != null || item.gstAmount != null

    const storedRate = toFiniteNumber(item.gstRate)
    const storedTaxableInPaise = toPaiseValue(toFiniteNumber(item.taxableAmount))
    const storedGSTInPaise = toPaiseValue(toFiniteNumber(item.gstAmount))
    const storedLineTotalInPaise =
      item.finalLineTotal != null
        ? toPaiseValue(toFiniteNumber(item.finalLineTotal))
        : Math.max(0, storedTaxableInPaise + storedGSTInPaise)

    const rate = hasStoredBreakdown ? storedRate : fallbackGSTDetails.rate
    const lineTotalInPaise = hasStoredBreakdown ? storedLineTotalInPaise : fallbackLineTotalInPaise
    const inferredTaxableInPaise = splitGSTFromInclusiveLine(lineTotalInPaise, rate).taxableInPaise
    const taxableInPaise = hasStoredBreakdown
      ? item.taxableAmount != null
        ? Math.min(lineTotalInPaise, Math.max(0, storedTaxableInPaise))
        : item.gstAmount != null
          ? Math.min(lineTotalInPaise, Math.max(0, lineTotalInPaise - storedGSTInPaise))
          : inferredTaxableInPaise
      : fallbackSplit.taxableInPaise
    const gstInPaise = lineTotalInPaise - taxableInPaise
    const cgstInPaise = Math.floor(gstInPaise / 2)
    const sgstInPaise = gstInPaise - cgstInPaise

    return {
      lineTotal: fromPaiseValue(lineTotalInPaise),
      lineTotalInPaise,
      rate,
      taxableValue: fromPaiseValue(taxableInPaise),
      taxableInPaise,
      gstAmount: fromPaiseValue(gstInPaise),
      gstInPaise,
      cgstInPaise,
      sgstInPaise,
    }
  })

  const gstSummaryMap = new Map<number, { taxableInPaise: number; gstInPaise: number; totalInPaise: number }>()

  itemTaxBreakdowns.forEach((itemBreakdown) => {
    const { rate, taxableInPaise, gstInPaise, lineTotalInPaise } = itemBreakdown
    const existing = gstSummaryMap.get(rate) || { taxableInPaise: 0, gstInPaise: 0, totalInPaise: 0 }

    gstSummaryMap.set(rate, {
      taxableInPaise: existing.taxableInPaise + taxableInPaise,
      gstInPaise: existing.gstInPaise + gstInPaise,
      totalInPaise: existing.totalInPaise + lineTotalInPaise,
    })
  })

  const gstSummaryRows = Array.from(gstSummaryMap.entries())
    .map(([rate, values]) => ({
      rate,
      taxableValue: fromPaiseValue(values.taxableInPaise),
      gstAmount: fromPaiseValue(values.gstInPaise),
      total: fromPaiseValue(values.totalInPaise),
    }))
    .sort((left, right) => left.rate - right.rate)

  const calculatedTotalTaxableInPaise = itemTaxBreakdowns.reduce(
    (sum, row) => sum + row.taxableInPaise,
    0,
  )
  const calculatedTotalGSTInPaise = itemTaxBreakdowns.reduce((sum, row) => sum + row.gstInPaise, 0)
  const calculatedCGSTInPaise = itemTaxBreakdowns.reduce((sum, row) => sum + row.cgstInPaise, 0)
  const calculatedSGSTInPaise = itemTaxBreakdowns.reduce((sum, row) => sum + row.sgstInPaise, 0)
  const calculatedTotalTaxableValue = fromPaiseValue(calculatedTotalTaxableInPaise)
  const calculatedTotalGSTAmount = fromPaiseValue(calculatedTotalGSTInPaise)
  const totalTaxableValue =
    storedTotalTaxableAmount == null
      ? calculatedTotalTaxableValue
      : roundMoney(toFiniteNumber(storedTotalTaxableAmount))
  const totalGSTAmount =
    storedTotalGSTAmount == null ? calculatedTotalGSTAmount : roundMoney(toFiniteNumber(storedTotalGSTAmount))
  const cgstAmount = fromPaiseValue(calculatedCGSTInPaise)
  const sgstAmount = fromPaiseValue(calculatedSGSTInPaise)
  const calculatedGrandTotal = fromPaiseValue(
    itemTaxBreakdowns.reduce((sum, row) => sum + row.lineTotalInPaise, 0),
  )
  const calculatedRoundedTotal = Math.round(calculatedGrandTotal)
  const hasStoredRoundOffValues =
    storedTotalAmountBeforeRoundOff != null || storedRoundOffAmount != null
  const displayTotalAmount = hasCancelledTotalMismatch
    ? calculatedRoundedTotal
    : hasStoredRoundOffValues
      ? roundMoney(totalAmount)
      : calculatedRoundedTotal
  const displayTotalBeforeRoundOff =
    storedTotalAmountBeforeRoundOff == null
      ? calculatedGrandTotal
      : roundMoney(toFiniteNumber(storedTotalAmountBeforeRoundOff))
  const displayRoundOffAmount =
    storedRoundOffAmount == null
      ? roundMoney(displayTotalAmount - displayTotalBeforeRoundOff)
      : roundMoney(toFiniteNumber(storedRoundOffAmount))

  // Local state for customer details (initially from props)
  const [localCustomerDetails, setLocalCustomerDetails] = useState(
    customerDetails || { name: '', phoneNumber: '', address: '' },
  )

  // Modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [modalName, setModalName] = useState('')
  const [modalPhone, setModalPhone] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Pending action state (to resume after details collected)
  const [pendingRating, setPendingRating] = useState<{ productId: string; rating: number } | null>(
    null,
  )

  const [productReviews, setProductReviews] = useState<{
    [productId: string]: { rating: number; feedback: string; submitted: boolean }
  }>(() => {
    const initialState: {
      [key: string]: { rating: number; feedback: string; submitted: boolean }
    } = {}
    if (existingReviews?.items) {
      existingReviews.items.forEach((reviewItem) => {
        const prodId =
          typeof reviewItem.product === 'object' ? reviewItem.product.id : reviewItem.product
        initialState[prodId] = {
          rating: reviewItem.rating,
          feedback: reviewItem.feedback || '',
          submitted: true,
        }
      })
    }
    return initialState
  })

  const handleRatingChange = (productId: string, rating: number) => {
    // Check if we have customer details
    if (!localCustomerDetails?.name || !localCustomerDetails?.phoneNumber) {
      // Missing details: Open modal and save intent
      setModalPhone(localCustomerDetails?.phoneNumber || '')
      setModalName(localCustomerDetails?.name || '')
      setPendingRating({ productId, rating })
      setShowCustomerModal(true)
      return
    }

    // Normal behavior
    setProductReviews((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        rating,
        feedback: prev[productId]?.feedback || '',
        submitted: prev[productId]?.submitted || false,
      },
    }))
  }

  // ... (rest of the file until modal JSX)

  const handleSaveDetails = async () => {
    if (!id || !modalName || !modalPhone) return

    // 1. Optimistic Update: Immediately changes UI state
    setLocalCustomerDetails({ ...localCustomerDetails, name: modalName, phoneNumber: modalPhone })
    setShowCustomerModal(false)

    // 2. Apply pending rating immediately
    if (pendingRating) {
      setProductReviews((prev) => ({
        ...prev,
        [pendingRating.productId]: {
          ...prev[pendingRating.productId],
          rating: pendingRating.rating,
          feedback: prev[pendingRating.productId]?.feedback || '',
          submitted: prev[pendingRating.productId]?.submitted || false,
        },
      }))
      setPendingRating(null)
    }

    // 3. Background Sync (Fire and Forget)
    try {
      await updateCustomer(id, modalName, modalPhone)
    } catch (error) {
      console.error('Failed to sync customer details in background', error)
      // Optionally handle error (e.g., toast), but don't blocking UI
    }
  }

  const handleFeedbackChange = (productId: string, feedback: string) => {
    setProductReviews((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        feedback,
      },
    }))
  }

  const handleSubmitReview = async (productId: string) => {
    const reviewData = productReviews[productId]
    if (!reviewData || !reviewData.rating) return

    // Optimistic update: Show as submitted immediately
    setProductReviews((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        submitted: true,
      },
    }))

    try {
      const payload = {
        bill: id,
        product: productId,
        rating: reviewData.rating,
        feedback: reviewData.feedback,
        customerName: customerDetails?.name || undefined,
        customerPhone: customerDetails?.phoneNumber || undefined,
        branch: typeof branch === 'object' ? branch?.id : branch,
      }

      await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error('Error submitting review:', error)
    }
  }

  const branchName = typeof branch === 'object' ? branch?.name : 'Branch'
  const branchAddress = typeof branch === 'object' ? branch?.address : ''
  const branchPhone = typeof branch === 'object' ? branch?.phone : ''

  let creatorName = 'Staff'
  if (typeof createdBy === 'object' && createdBy !== null) {
    if (createdBy.name) {
      creatorName = createdBy.name
    } else if (
      typeof (createdBy as any).employee === 'object' &&
      (createdBy as any).employee?.name
    ) {
      creatorName = (createdBy as any).employee.name
    } else if ((createdBy as any).email) {
      creatorName = (createdBy as any).email.split('@')[0]
    }
  } else if (typeof createdBy === 'string') {
    creatorName = 'Staff' // ID only, can't resolve name without more data
  }

  // Date formatting
  const dateObj = createdAt ? new Date(createdAt) : null

  // Format Date: DD/MM/YY
  const formattedDate = dateObj
    ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : 'N/A'

  // Format Time: HH:MM
  const formattedTime = dateObj
    ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : ''

  // Extract Bill No suffix (e.g., "003" from "INV-20251106-003")
  const billNoSuffix = invoiceNumber ? invoiceNumber.split('-').pop() : ''

  return (
    <>
      {/* Card 1: Bill Details */}
      <div className="bill-card bill-receipt">
        <div className="bill-header">
          <p className="bill-document-type">Tax Invoice</p>
          <h2>
            {typeof company === 'object' && company !== null ? company.name : 'THE BLACK FOREST'}
          </h2>
          {branchName && <p>{branchName}</p>}
          {branchAddress && <p>{branchAddress}</p>}
          {(branchPhone || sellerGSTIN) && (
            <div className="seller-meta">
              {branchPhone && <span>Ph: {branchPhone}</span>}
              {sellerGSTIN && <span>GSTIN: {sellerGSTIN}</span>}
            </div>
          )}
        </div>

        <div className="bill-meta">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Invoice No: {invoiceNumber || billNoSuffix}</span>
            <span>Date: {formattedDate}</span>
            <span>Time: {formattedTime}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Assigned By: {creatorName}</span>
            {tableDetails && (
              <span>
                Table: {tableDetails.section && `${tableDetails.section} - `}
                {tableDetails.tableNumber}
              </span>
            )}
            {paymentMethod && <span>Pay Mode: {paymentMethod.toUpperCase()}</span>}
          </div>

          {(localCustomerDetails?.name ||
            localCustomerDetails?.phoneNumber ||
            localCustomerDetails?.address) && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {localCustomerDetails?.name && <span>Customer: {localCustomerDetails.name}</span>}
                {localCustomerDetails?.phoneNumber && (
                  <span>Ph: {localCustomerDetails.phoneNumber}</span>
                )}
              </div>
              {localCustomerDetails?.address && (
                <div style={{ marginTop: '2px' }}>
                  <span>Address: {localCustomerDetails.address}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <table className="bill-items">
          <thead>
            <tr>
              <th>Item</th>
              <th className="item-qty">Qty</th>
              <th className="item-total">Amt</th>
            </tr>
          </thead>
          <tbody>
            {billedItems.map((item, index) => {
              const product = typeof item.product === 'object' ? (item.product as any) : null
              const productId = product?.id || (item.product as string)
              const gstDetails = getGSTDetails(item, branchId)
              const itemTax = itemTaxBreakdowns[index] || {
                rate: 0,
                taxableValue: 0,
                gstAmount: 0,
                lineTotal: 0,
              }

              const department = product?.category?.department
              const departmentName = typeof department === 'object' ? department?.name : null

              // Restriction Logic: Hide if no department OR department is 'Others'
              const canReview = departmentName && departmentName !== 'Others'

              const reviewData = productId ? productReviews[productId] : null
              const rating = reviewData?.rating || 0
              const isSubmitted = reviewData?.submitted
              const displayUnitPrice =
                item.isPriceOfferApplied && typeof item.effectiveUnitPrice === 'number'
                  ? item.effectiveUnitPrice
                  : item.unitPrice

              return (
                <React.Fragment key={index}>
                  <tr>
                    <td>
                      {item.name}
                      {(gstDetails.hsnCode || itemTax.rate > 0) && (
                        <div className="item-meta-line">
                          {gstDetails.hsnCode ? `HSN: ${gstDetails.hsnCode}` : 'HSN: -'}
                          {itemTax.rate > 0 ? ` | GST: ${itemTax.rate}%` : ''}
                        </div>
                      )}
                      <div className="item-meta-line">
                        Taxable: {itemTax.taxableValue.toFixed(2)} | GST Amt: {itemTax.gstAmount.toFixed(2)} |
                        Total: {itemTax.lineTotal.toFixed(2)}
                      </div>
                      {item.notes && (
                        <div
                          style={{
                            fontSize: '11px',
                            fontStyle: 'italic',
                            color: '#666',
                            marginTop: '2px',
                          }}
                        >
                          Note: {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="item-qty">
                      {item.quantity} x {displayUnitPrice}
                    </td>
                    <td className="item-total">
                      {itemTax.lineTotal.toFixed(2)}
                    </td>
                  </tr>

                  {/* Review Section for specific Product - Only if allowed */}
                  {productId && !isSubmitted && canReview && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ borderBottom: '1px dashed #ddd', paddingBottom: '10px' }}
                      >
                        <div style={{ marginTop: '5px' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}
                          >
                            <span style={{ fontSize: '12px', marginRight: '5px' }}>
                              Rate this item:
                            </span>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                onClick={() => handleRatingChange(productId, star)}
                                style={{
                                  cursor: 'pointer',
                                  color: star <= rating ? '#FFD700' : '#ccc',
                                  fontSize: '18px',
                                  marginRight: '2px',
                                }}
                              >
                                ★
                              </span>
                            ))}
                          </div>

                          {rating > 0 && (
                            <div style={{ marginTop: '5px' }}>
                              <textarea
                                placeholder="How was it?"
                                value={reviewData?.feedback || ''}
                                onChange={(e) => handleFeedbackChange(productId, e.target.value)}
                                style={{
                                  width: '100%',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  padding: '8px',
                                  fontSize: '13px',
                                  resize: 'none',
                                  color: 'black',
                                }}
                                rows={2}
                              />
                              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                <button
                                  onClick={() => handleSubmitReview(productId)}
                                  style={{
                                    backgroundColor: '#000',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '8px 24px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                  }}
                                  className="submit-review-btn"
                                >
                                  Submit Review
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {/* Show rating and feedback if submitted */}
                  {isSubmitted && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          paddingBottom: '10px',
                          borderBottom: '1px dashed #ddd',
                        }}
                      >
                        <div style={{ marginTop: '2px' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}
                          >
                            <span style={{ fontSize: '12px', marginRight: '5px' }}>
                              Thanks For Your Rating:
                            </span>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                style={{
                                  color: star <= rating ? '#FFD700' : '#ccc',
                                  fontSize: '18px',
                                  marginRight: '2px',
                                }}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          {reviewData?.feedback && (
                            <div
                              style={{
                                fontSize: '11px',
                                lineHeight: '1.2',
                                color: '#555',
                                backgroundColor: '#f9f9f9',
                                padding: '3px 5px',
                                borderRadius: '3px',
                                border: '1px solid #eee',
                              }}
                            >
                              {reviewData.feedback}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {cancelledItems.length > 0 && (
          <div className="bill-note">
            {cancelledItems.length} cancelled item{cancelledItems.length > 1 ? 's were' : ' was'}{' '}
            excluded from this GST invoice summary.
          </div>
        )}

        <div className="bill-totals">
          <div>
            <span>Billed Lines:</span>
            <span>{billedLineCount}</span>
          </div>
          <div>
            <span>Total Qty:</span>
            <span>{billedQuantity}</span>
          </div>
          <div>
            <span>Subtotal:</span>
            <span>{billedGrossAmount.toFixed(2)}</span>
          </div>
          {displayDiscountAmount > 0 && (
            <div>
              <span>Discount:</span>
              <span>-{displayDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          <div>
            <span>Taxable Value:</span>
            <span>{totalTaxableValue.toFixed(2)}</span>
          </div>
          {gstSummaryRows.map((row) => (
            <div key={row.rate}>
              <span>{row.rate}% GST:</span>
              <span>{row.gstAmount.toFixed(2)}</span>
            </div>
          ))}
          <div>
            <span>All Products GST Total:</span>
            <span>{totalGSTAmount.toFixed(2)}</span>
          </div>
          <div>
            <span>CGST:</span>
            <span>{cgstAmount.toFixed(2)}</span>
          </div>
          <div>
            <span>SGST:</span>
            <span>{sgstAmount.toFixed(2)}</span>
          </div>
          <div>
            <span>Total Before Round Off:</span>
            <span>{displayTotalBeforeRoundOff.toFixed(2)}</span>
          </div>
          {Math.abs(displayRoundOffAmount) > 0 && (
            <div>
              <span>Round Off:</span>
              <span>
                {displayRoundOffAmount > 0 ? '+' : ''}
                {displayRoundOffAmount.toFixed(2)}
              </span>
            </div>
          )}
          {hasCancelledTotalMismatch && (
            <div className="bill-note-row">
              <span>Adjusted for cancellations</span>
              <span>Saved total was {roundMoney(totalAmount).toFixed(2)}</span>
            </div>
          )}
          <div>
            <span>Prices:</span>
            <span>GST Inclusive (MRP)</span>
          </div>
          <div className="grand-total">
            <span>All Products Total:</span>
            <span>{displayTotalAmount.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <div className="bill-card bill-receipt" style={{ marginTop: '20px', textAlign: 'center' }}>
        <div className="bill-footer">
          <p>Thank you for visiting!</p>
          <p>Have a sweet day!</p>
        </div>
      </div>
      {/* Customer Details Modal */}
      {showCustomerModal && (
        <div className="customer-modal-overlay">
          <div className="customer-modal">
            <h3>Customer Details</h3>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                placeholder="Enter phone number"
                value={modalPhone}
                onChange={(e) => setModalPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Customer Name</label>
              <input
                type="text"
                placeholder="Enter customer name"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowCustomerModal(false)
                  setPendingRating(null)
                }}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleSaveDetails}
                disabled={!modalName || !modalPhone || isSaving}
              >
                {isSaving ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BillReceipt
