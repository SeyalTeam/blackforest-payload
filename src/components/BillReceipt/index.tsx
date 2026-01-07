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
  } = data

  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitReview = async () => {
    if (!feedback.trim()) {
      alert('Please enter your feedback before submitting.')
      return
    }

    if (!id) {
      alert('Bill ID is missing. Cannot submit review.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        bill: id,
        feedback: feedback,
        customerName: customerDetails?.name || undefined,
        customerPhone: customerDetails?.phoneNumber || undefined,
        branch: typeof branch === 'object' ? branch?.id : branch,
        rating: 5, // Defaulting to 5 for now as per static UI
      }

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        alert('Thank you for your feedback!')
        setFeedback('')
      } else {
        const errorData = await response.json()
        alert(`Failed to submit review: ${errorData.errors?.[0]?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      alert('An error occurred while submitting your review.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const branchName = typeof branch === 'object' ? branch?.name : 'Branch'
  // const branchAddress = typeof branch === 'object' ? branch?.address : '' // Removed as unused
  // const branchPhone = typeof branch === 'object' ? branch?.phone : ''     // Removed as unused

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
  const formattedDate = createdAt ? new Date(createdAt).toLocaleString() : 'N/A'

  // Extract Bill No suffix (e.g., "003" from "INV-20251106-003")
  const billNoSuffix = invoiceNumber ? invoiceNumber.split('-').pop() : ''

  return (
    <div className="bill-receipt">
      <div className="bill-header">
        <h2>THE BLACK FOREST</h2>
        {branchName && <p>{branchName}</p>}
        {/* Address and Phone removed as per request */}
      </div>

      <div className="bill-meta">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Bill No: {billNoSuffix}</span>
          <span>Date: {formattedDate}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Assigned By: {creatorName}</span>
          {paymentMethod && <span>Pay Mode: {paymentMethod.toUpperCase()}</span>}
        </div>
        {(customerDetails?.name || customerDetails?.phoneNumber || customerDetails?.address) && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Row 1: Name and Phone */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {customerDetails?.name && <span>Customer: {customerDetails.name}</span>}
              {customerDetails?.phoneNumber && <span>Ph: {customerDetails.phoneNumber}</span>}
            </div>

            {/* Row 2: Address (if present) */}
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
          {items.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td className="item-qty">
                {item.quantity} x {item.unitPrice}
              </td>
              <td className="item-total">{item.subtotal?.toFixed(2)}</td>
            </tr>
          ))}
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

      <div style={{ marginTop: '10px', width: '100%' }}>
        <details open style={{ width: '100%', borderTop: '1px dashed #000', paddingTop: '5px' }}>
          <summary style={{ cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}>
            Review Us
          </summary>
          <div
            style={{
              marginTop: '5px',
              border: '1px solid #000',
              padding: '10px',
              minHeight: '60px',
              fontSize: '12px',
            }}
          >
            <p style={{ margin: '0 0 5px 0' }}>Rate Us: ☆ ☆ ☆ ☆ ☆</p>
            <textarea
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: '#000',
                background: 'transparent',
                fontWeight: 'bold',
              }}
              placeholder="Write your feedback here..."
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
          <div style={{ marginTop: '5px', textAlign: 'center' }}>
            <button
              onClick={handleSubmitReview}
              disabled={isSubmitting}
              style={{
                padding: '4px 8px',
                backgroundColor: isSubmitting ? '#666' : '#000',
                color: '#fff',
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </details>
      </div>

      <div className="bill-footer">
        <p>Thank you for visiting!</p>
        <p>Have a sweet day!</p>
      </div>
    </div>
  )
}

export default BillReceipt
