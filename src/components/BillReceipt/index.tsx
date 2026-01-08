'use client'
import React, { useState } from 'react'
import './index.scss'
import { Product } from '@/payload-types'

// Reusing types
export type BillItem = {
  product?: string | Product | null
  name?: string | null
  quantity: number
  unitPrice: number
  subtotal: number
}

export type BillData = {
  id?: string
  invoiceNumber?: string | null
  createdAt?: string
  items?: BillItem[]
  totalAmount?: number
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
      }
    | string
    | null
  company?:
    | {
        name?: string
      }
    | string
    | null
}

const BillReceipt: React.FC<{ data: BillData }> = ({ data }) => {
  const {
    id,
    invoiceNumber,
    createdAt,
    items = [],
    totalAmount = 0,
    customerDetails,
    paymentMethod,
    branch,
    createdBy,
    company,
  } = data

  const [productReviews, setProductReviews] = useState<{
    [productId: string]: { rating: number; feedback: string; submitted: boolean }
  }>({})

  const [submittingProduct, setSubmittingProduct] = useState<string | null>(null)

  const handleRatingChange = (productId: string, rating: number) => {
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

    setSubmittingProduct(productId)

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

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        alert('Thank you for your review!')
        setProductReviews((prev) => ({
          ...prev,
          [productId]: {
            ...prev[productId],
            submitted: true,
          },
        }))
      } else {
        const errorData = await response.json()
        alert(`Failed to submit review: ${errorData.errors?.[0]?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      alert('An error occurred while submitting your review.')
    } finally {
      setSubmittingProduct(null)
    }
  }

  const branchName = typeof branch === 'object' ? branch?.name : 'Branch'

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
          <h2>
            {typeof company === 'object' && company !== null ? company.name : 'THE BLACK FOREST'}
          </h2>
          {branchName && <p>{branchName}</p>}
        </div>

        <div className="bill-meta">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Bill No: {billNoSuffix}</span>
            <span>Date: {formattedDate}</span>
            <span>Time: {formattedTime}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Assigned By: {creatorName}</span>
            {paymentMethod && <span>Pay Mode: {paymentMethod.toUpperCase()}</span>}
          </div>
          {(customerDetails?.name || customerDetails?.phoneNumber || customerDetails?.address) && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {customerDetails?.name && <span>Customer: {customerDetails.name}</span>}
                {customerDetails?.phoneNumber && <span>Ph: {customerDetails.phoneNumber}</span>}
              </div>
              {customerDetails?.address && (
                <div style={{ marginTop: '2px' }}>
                  <span>Address: {customerDetails.address}</span>
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
            {items.map((item, index) => {
              const productId =
                typeof item.product === 'object' ? item.product?.id : (item.product as string)
              const reviewData = productId ? productReviews[productId] : null
              const rating = reviewData?.rating || 0
              const isSubmitted = reviewData?.submitted

              return (
                <React.Fragment key={index}>
                  <tr>
                    <td>{item.name}</td>
                    <td className="item-qty">
                      {item.quantity} x {item.unitPrice}
                    </td>
                    <td className="item-total">{item.subtotal?.toFixed(2)}</td>
                  </tr>

                  {/* Review Section for specific Product */}
                  {productId && !isSubmitted && (
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
                                  padding: '5px',
                                  fontSize: '12px',
                                  resize: 'none',
                                  color: 'black',
                                }}
                                rows={2}
                              />
                              <button
                                onClick={() => handleSubmitReview(productId)}
                                disabled={submittingProduct === productId}
                                style={{
                                  marginTop: '5px',
                                  backgroundColor: '#000',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                }}
                              >
                                {submittingProduct === productId ? '...' : 'Submit'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {/* Show thank you message if submitted */}
                  {isSubmitted && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          textAlign: 'center',
                          color: 'green',
                          fontSize: '12px',
                          paddingBottom: '5px',
                          borderBottom: '1px dashed #ddd',
                        }}
                      >
                        Thanks for rating!
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        <div className="bill-totals">
          <div>
            <span>Total Items:</span>
            <span>{items.length}</span>
          </div>
          <div className="grand-total">
            <span>Grand Total:</span>
            <span>{totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bill-card bill-receipt" style={{ marginTop: '20px', textAlign: 'center' }}>
        <div className="bill-footer">
          <p>Thank you for visiting!</p>
          <p>Have a sweet day!</p>
        </div>
      </div>
    </>
  )
}

export default BillReceipt
