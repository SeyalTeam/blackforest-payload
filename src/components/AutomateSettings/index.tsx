'use client'

import React, { useState, useEffect } from 'react'
import { Package, X, Calendar, MapPin, MessageSquare, ListFilter, Loader2 } from 'lucide-react'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './index.scss'

const AutomateSettings: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

  // Form State
  const [selectedBranch, setSelectedBranch] = useState<{ value: string; label: string } | null>(
    null,
  )
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date(Date.now() + 86400000)) // Tomorrow
  const [orderType, setOrderType] = useState<{ value: string; label: string }>({
    value: 'stock',
    label: 'Stock Order',
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchBranches = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/branches?limit=1000&sort=name')
        const json = await res.json()
        setBranches(json.docs || [])
      } catch (err) {
        console.error('Error fetching branches:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBranches()
  }, [])

  const handleSubmit = async () => {
    if (!selectedBranch || !deliveryDate || !message) {
      alert('Please fill in all fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/automate/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranch.value,
          deliveryDate: deliveryDate.toISOString(),
          orderType: orderType.value,
          message: message,
        }),
      })

      const json = await res.json()
      if (res.ok) {
        alert(`Order created successfully! Invoice: ${json.invoiceNumber}`)
        setIsModalOpen(false)
        setMessage('')
      } else {
        alert(`Error: ${json.message}`)
      }
    } catch (err) {
      console.error('Submission error:', err)
      alert('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const customSelectStyles = {
    control: (base: any) => ({
      ...base,
      backgroundColor: '#18181b',
      borderColor: '#27272a',
      color: '#fff',
      '&:hover': { borderColor: '#3b82f6' },
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: '#18181b',
      border: '1px solid #27272a',
      zIndex: 1001,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? '#27272a' : 'transparent',
      color: '#fff',
      '&:active': { backgroundColor: '#3b82f6' },
    }),
    singleValue: (base: any) => ({ ...base, color: '#fff' }),
    input: (base: any) => ({ ...base, color: '#fff' }),
  }

  return (
    <div className="automate-settings">
      <div className="header">
        <h1>Automate</h1>
        <p>Quickly execute automated tasks and workflows.</p>
      </div>

      <div className="tiles-grid">
        <div className="tile" onClick={() => setIsModalOpen(true)}>
          <Package className="tile-icon" size={48} />
          <span className="tile-label">Stock Order</span>
        </div>
        {/* Placeholder for future automated tasks */}
      </div>

      {isModalOpen && (
        <div className="automate-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="automate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Automate Stock Order</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>
                  <MapPin size={14} style={{ marginRight: 4 }} /> Branch
                </label>
                <Select
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  styles={customSelectStyles}
                  placeholder="Select Branch..."
                  isLoading={loading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <Calendar size={14} style={{ marginRight: 4 }} /> Delivery Date
                  </label>
                  <DatePicker
                    selected={deliveryDate}
                    onChange={(date: Date | null) => setDeliveryDate(date || new Date())}
                    className="custom-date-picker"
                    dateFormat="yyyy-MM-dd"
                    customInput={React.createElement(
                      React.forwardRef<HTMLInputElement, any>(({ value, onClick }, ref) => (
                        <div className="input-wrapper" onClick={onClick}>
                          <input
                            ref={ref}
                            type="text"
                            value={value}
                            readOnly
                            style={{
                              width: '100%',
                              background: '#18181b',
                              border: '1px solid #27272a',
                              borderRadius: '0.5rem',
                              padding: '0.75rem',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          />
                        </div>
                      )),
                    )}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <ListFilter size={14} style={{ marginRight: 4 }} /> Order Type
                  </label>
                  <Select
                    options={[
                      { value: 'stock', label: 'Stock Order' },
                      { value: 'live', label: 'Live Order' },
                    ]}
                    value={orderType}
                    onChange={(opt: any) => setOrderType(opt)}
                    styles={customSelectStyles}
                    isSearchable={false}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <MessageSquare size={14} style={{ marginRight: 4 }} /> Order Details (Product Qty)
                </label>
                <textarea
                  placeholder="Example:&#10;Veg puff 30&#10;Egg puff 20"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 className="animate-spin" size={16} /> Creating...
                  </span>
                ) : (
                  'Create Order'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AutomateSettings
