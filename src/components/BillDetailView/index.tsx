'use client'

import React, { useState } from 'react'
import { useFormFields } from '@payloadcms/ui'
import BillReceipt, { BillData, BillItem } from '../BillReceipt'
import { Product } from '@/payload-types'
import './index.scss'

// Types for populated fields in Admin UI
type BranchData = {
  name?: string
  address?: string
  phone?: string
}

type UserData = {
  name?: string
}

const BillDetailView: React.FC = () => {
  const itemsField = useFormFields(([fields]) => fields.items)
  const invoiceNumberField = useFormFields(([fields]) => fields.invoiceNumber)
  const totalAmountField = useFormFields(([fields]) => fields.totalAmount)
  const createdAtField = useFormFields(([fields]) => fields.createdAt)
  const customerDetailsField = useFormFields(([fields]) => fields.customerDetails)
  const paymentMethodField = useFormFields(([fields]) => fields.paymentMethod)
  const branchField = useFormFields(([fields]) => fields.branch)
  const createdByField = useFormFields(([fields]) => fields.createdBy)

  const [isOpen, setIsOpen] = useState(false)

  const invoiceNumber = invoiceNumberField.value as string

  if (!invoiceNumber) {
    return null
  }

  // Construct data object for BillReceipt
  const billData: BillData = {
    invoiceNumber: invoiceNumber,
    totalAmount: typeof totalAmountField.value === 'number' ? totalAmountField.value : 0,
    items: (itemsField.value as unknown as BillItem[]) || [],
    createdAt: createdAtField.value as string,
    customerDetails: customerDetailsField.value as { name?: string; address?: string } | undefined,
    paymentMethod: paymentMethodField.value as string,
    branch: branchField.value as BranchData | string,
    createdBy: createdByField.value as UserData | string,
  }

  return (
    <div className="bill-detail-container">
      <button type="button" className="view-bill-btn" onClick={() => setIsOpen(true)}>
        View Bill Receipt
      </button>

      {isOpen && (
        <div className="bill-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="bill-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              &times;
            </button>
            <BillReceipt data={billData} />
          </div>
        </div>
      )}
    </div>
  )
}

export default BillDetailView
