'use client'
import React, { useState } from 'react'
import './index.scss'
import { Product } from '@/payload-types'

// Reusing types
export type BillItem = {
  product?: string | Product | null
  name?: string | null
  notes?: string | null
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
      }
    | string
    | null
  company?:
    | {
        name?: string
      }
    | string
    | null
  tableDetails?: {
    section?: string | null
    tableNumber?: string | null
  } | null
}

import { updateCustomer } from '@/app/actions/updateCustomer'

// ... existing imports

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
    existingReviews,
    tableDetails,
  } = data

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
            {items.map((item, index) => {
              // Update types (Add this near the top or update existing BillItem definition)
              // Wait, I should not redefine it if it's already there, but I need to make sure the prop passed has the data.
              // The data is passed as `any` in page.tsx line 56, so safely accessing it inside the component is key.

              // In the map function:
              const product = typeof item.product === 'object' ? (item.product as any) : null
              const productId = product?.id || (item.product as string)

              const department = product?.category?.department
              const departmentName = typeof department === 'object' ? department?.name : null

              // Restriction Logic: Hide if no department OR department is 'Others'
              const canReview = departmentName && departmentName !== 'Others'

              const reviewData = productId ? productReviews[productId] : null
              const rating = reviewData?.rating || 0
              const isSubmitted = reviewData?.submitted

              return (
                <React.Fragment key={index}>
                  <tr>
                    <td>
                      {item.name}
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
                      {item.quantity} x {item.unitPrice}
                    </td>
                    <td className="item-total">{item.subtotal?.toFixed(2)}</td>
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
