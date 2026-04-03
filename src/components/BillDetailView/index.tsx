'use client'

import React, { useEffect, useState } from 'react'
import { useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import { createPortal } from 'react-dom'
import './index.scss'

type Feedback = {
  type: 'success' | 'error'
  text: string
}

const BillDetailView: React.FC = () => {
  const { id } = useDocumentInfo()
  const { value: statusValue } = useField<string | null>({ path: 'status' })
  const { value: paymentMethodValue } = useField<string | null>({ path: 'paymentMethod' })
  const { dispatch } = useFormFields(([_fields, dispatch]) => ({ dispatch }))
  const [isSettling, setIsSettling] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const billId = id ? String(id) : ''
  const status = typeof statusValue === 'string' ? statusValue : ''
  const paymentMethod = typeof paymentMethodValue === 'string' ? paymentMethodValue : ''
  const isCompleted = status === 'completed'
  const isSettled = status === 'settled'
  const canSettle = Boolean(billId && isCompleted && paymentMethod && !isSettling)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isReceiptOpen) {
      return undefined
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsReceiptOpen(false)
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isReceiptOpen])

  const settleBill = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    if (!billId) {
      setFeedback({ type: 'error', text: 'Bill ID is missing.' })
      return
    }

    if (!isCompleted) {
      setFeedback({ type: 'error', text: 'Only completed bills can be settled.' })
      return
    }

    if (!paymentMethod) {
      setFeedback({ type: 'error', text: 'Select payment method before settling the bill.' })
      return
    }

    setIsSettling(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/billings/${billId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 'settled',
          paymentMethod,
        }),
      })

      if (!response.ok) {
        let message = `Failed to settle bill (${response.status}).`
        try {
          const payload = (await response.json()) as {
            errors?: Array<{ message?: string }>
            message?: string
          }
          if (payload?.errors?.[0]?.message) {
            message = payload.errors[0].message
          } else if (payload?.message) {
            message = payload.message
          }
        } catch {
          // Ignore JSON parse issues and show generic message.
        }
        throw new Error(message)
      }

      dispatch({
        type: 'UPDATE',
        path: 'status',
        value: 'settled',
      })
      dispatch({
        type: 'UPDATE',
        path: 'paymentMethod',
        value: paymentMethod,
      })

      setFeedback({ type: 'success', text: 'Bill settled successfully.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to settle bill.'
      setFeedback({ type: 'error', text: message })
    } finally {
      setIsSettling(false)
    }
  }

  if (!billId) {
    return null
  }

  return (
    <div className="bill-detail-container">
      <div className="bill-actions-row">
        <button type="button" className="view-bill-btn" onClick={() => setIsReceiptOpen(true)}>
          View Bill Receipt
        </button>
        <button
          type="button"
          className="settle-bill-btn"
          onClick={settleBill}
          disabled={!canSettle}
          title={
            isSettled
              ? 'Bill is already settled.'
              : !isCompleted
                ? 'Bill must be completed before settlement.'
                : !paymentMethod
                  ? 'Select payment method before settlement.'
                  : 'Confirm bill settlement'
          }
        >
          {isSettled ? 'Bill Settled' : isSettling ? 'Settling...' : 'Confirm & Settle Bill'}
        </button>
      </div>

      {!isSettled && isCompleted && !paymentMethod && (
        <p className="bill-hint">Select payment method, then click Confirm &amp; Settle Bill.</p>
      )}

      {!isSettled && !isCompleted && (
        <p className="bill-hint">Settlement button is enabled only after the bill is completed.</p>
      )}

      {feedback && <p className={`bill-feedback ${feedback.type}`}>{feedback.text}</p>}
      {isMounted &&
        isReceiptOpen &&
        createPortal(
          <div className="bill-detail-modal-overlay" onClick={() => setIsReceiptOpen(false)} role="presentation">
            <div
              className="bill-detail-modal-content"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Bill receipt"
            >
              <button
                type="button"
                className="bill-detail-modal-close"
                onClick={() => setIsReceiptOpen(false)}
                aria-label="Close bill receipt"
              >
                x
              </button>
              <iframe
                src={`/billings/${billId}`}
                title="Bill receipt preview"
                className="bill-detail-receipt-frame"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default BillDetailView
