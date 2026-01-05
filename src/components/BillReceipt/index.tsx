import React from 'react'
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
  invoiceNumber?: string | null
  createdAt?: string
  items?: BillItem[]
  totalAmount?: number
  customerDetails?: {
    name?: string | null
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
        name?: string
        address?: string
        phone?: string
      }
    | string
    | null
}

const BillReceipt: React.FC<{ data: BillData }> = ({ data }) => {
  const {
    invoiceNumber,
    createdAt,
    items = [],
    totalAmount = 0,
    customerDetails,
    paymentMethod,
    branch,
    createdBy,
  } = data

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
        <div>
          <span>Assigned By:</span>
          <span>{creatorName}</span>
        </div>
        {customerDetails?.name && (
          <div>
            <span>Customer:</span>
            <span>{customerDetails.name}</span>
          </div>
        )}
        {paymentMethod && (
          <div>
            <span>Pay Mode:</span>
            <span>{paymentMethod.toUpperCase()}</span>
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

      <div className="bill-footer">
        <p>Thank you for visiting!</p>
        <p>Have a sweet day!</p>
      </div>
    </div>
  )
}

export default BillReceipt
