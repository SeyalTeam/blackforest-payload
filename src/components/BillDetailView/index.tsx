'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import './index.scss'

const BillDetailView: React.FC = () => {
  const { id } = useDocumentInfo()

  // We can keep fetching fields if we want to determine if button should be disabled,
  // but for linking to public page, primarily we just need the ID.
  // Converting ID to string safely (it might be number or string depending on DB)
  const billId = id ? String(id) : ''

  if (!billId) {
    return null
  }

  return (
    <div className="bill-detail-container">
      <a
        href={`/billings/${billId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="view-bill-btn"
        style={{
          textDecoration: 'none',
          display: 'inline-block',
          textAlign: 'center',
        }}
      >
        View Bill Receipt
      </a>
    </div>
  )
}

export default BillDetailView
