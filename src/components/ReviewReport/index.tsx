'use client'

import React, { useState, useEffect } from 'react'
import './index.scss'

import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

import { approveReview } from '@/app/actions/approveReview'
import { getBill } from '@/app/actions/getBill'
import BillReceipt, { BillData } from '@/components/BillReceipt'

type ReviewStat = {
  sNo: number
  customerName: string
  phoneNumber: string
  billNumber: string
  billId: string
  productName: string
  reviewMessage: string
  chefReply: string
  reviewId: string
  itemId: string
  status: string
}

type ReportData = {
  startDate: string
  endDate: string
  stats: ReviewStat[]
}

const DetailModal: React.FC<{
  data: ReviewStat | null
  onClose: () => void
}> = ({ data, onClose }) => {
  if (!data) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '24px',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '600px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          color: '#333',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          By {data.customerName} ({data.phoneNumber})
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
          <tbody>
            <tr>
              <td
                style={{
                  padding: '8px',
                  fontWeight: 'bold',
                  width: '120px',
                  verticalAlign: 'top',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                Customer Review:
              </td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
                {data.reviewMessage}
              </td>
            </tr>
            <tr>
              <td
                style={{ padding: '8px', fontWeight: 'bold', width: '120px', verticalAlign: 'top' }}
              >
                Chef Reply:
              </td>
              <td style={{ padding: '8px' }}>
                {data.chefReply || (
                  <span style={{ color: '#999', fontStyle: 'italic' }}>No reply yet</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const BillModal: React.FC<{
  billData: BillData | null
  loading: boolean
  onClose: () => void
}> = ({ billData, loading, onClose }) => {
  if (!billData && !loading) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001, // Higher than detail modal if needed, though they shouldn't overlap usually
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff', // Bill receipt usually white
          padding: '0',
          borderRadius: '0',
          width: '90%',
          maxWidth: '400px', // Receipt width
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 25px rgba(0,0,0,0.5)',
          color: '#000',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading Bill...</div>
        ) : (
          billData && <BillReceipt data={billData} />
        )}
      </div>
    </div>
  )
}

const ReviewReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedReview, setSelectedReview] = useState<ReviewStat | null>(null)

  // Bill Modal State
  const [selectedBill, setSelectedBill] = useState<BillData | null>(null)
  const [loadingBill, setLoadingBill] = useState(false)

  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    const fetchReport = async (start: Date, end: Date) => {
      setLoading(true)
      setError('')
      try {
        const startStr = toLocalDateStr(start)
        const endStr = toLocalDateStr(end)
        const res = await fetch(`/api/reports/review?startDate=${startStr}&endDate=${endStr}`)
        if (!res.ok) throw new Error('Failed to fetch report')
        const json: ReportData = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
        setError('Error loading report data')
      } finally {
        setLoading(false)
      }
    }

    if (startDate && endDate) {
      fetchReport(startDate, endDate)
    }
  }, [startDate, endDate])

  const handleApprove = async (e: React.MouseEvent, stat: ReviewStat) => {
    e.stopPropagation()
    if (stat.status !== 'replied') return

    // Optimistic Update
    if (data) {
      const updatedStats = data.stats.map((s) => {
        if (s.sNo === stat.sNo) {
          return { ...s, status: 'approved' }
        }
        return s
      })
      setData({ ...data, stats: updatedStats })
    }

    try {
      const result = await approveReview(stat.reviewId, stat.itemId)
      if (!result.success) {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (error: any) {
      console.error('Failed to approve review', error)
      alert(`Failed to approve: ${error.message}`)

      // Revert Optimistic Update
      if (data) {
        const revertedStats = data.stats.map((s) => {
          if (s.sNo === stat.sNo) {
            return { ...s, status: stat.status } // Revert to original
          }
          return s
        })
        setData({ ...data, stats: revertedStats })
      }
    }
  }

  const handleBillClick = async (e: React.MouseEvent, billId: string) => {
    e.stopPropagation() // Prevent opening the review detail modal
    setLoadingBill(true)
    setSelectedBill(null) // Clear previous bill data

    try {
      const bill = await getBill(billId)
      setSelectedBill(bill)
    } catch (error) {
      console.error('Failed to fetch bill', error)
      alert('Failed to load bill details')
    } finally {
      setLoadingBill(false)
    }
  }

  const handleExportExcel = () => {
    if (!data) return
    const csvRows = []
    csvRows.push(
      [
        'S.NO',
        'CUSTOMER NAME',
        'PHONE NUMBER',
        'BILL NUMBER',
        'PRODUCT NAME',
        'REVIEW MESSAGE',
        'CHEF REPLY',
        'STATUS',
      ].join(','),
    )
    data.stats.forEach((row) => {
      csvRows.push(
        [
          row.sNo,
          `"${row.customerName}"`,
          `"${row.phoneNumber}"`,
          `"${row.billNumber}"`,
          `"${row.productName}"`,
          `"${row.reviewMessage.replace(/"/g, '""')}"`, // Escape quotes
          `"${(row.chefReply || '').replace(/"/g, '""')}"`,
          `"${row.status}"`,
        ].join(','),
      )
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `review_report_${startDate ? toLocalDateStr(startDate) : ''}_to_${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv`
    a.click()
    setShowExportMenu(false)
  }

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      const [start, end] = value ? value.split(' - ') : ['', '']
      return (
        <button className="custom-date-input" onClick={onClick} ref={ref}>
          <span className="date-text">{start}</span>
          <span className="separator">→</span>
          <span className="date-text">{end || start}</span>
          <span className="icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </span>
        </button>
      )
    },
  )
  CustomInput.displayName = 'CustomInput'

  return (
    <div className="review-report-container">
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Review Report</h1>
        </div>
        <div className="date-filter">
          <div className="filter-group">
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => {
                setDateRange(update)
              }}
              monthsShown={1}
              dateFormat="yyyy-MM-dd"
              className="date-input"
              customInput={<CustomInput />}
              calendarClassName="custom-calendar"
              popperPlacement="bottom-start"
            />
          </div>

          <div className="filter-group">
            <div className="export-container">
              <button
                className="export-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Report"
              >
                <span>Export</span>
                <span className="icon">↓</span>
              </button>
              {showExportMenu && (
                <div className="export-menu">
                  <button onClick={handleExportExcel}>Excel</button>
                </div>
              )}
            </div>
            {showExportMenu && (
              <div
                className="export-backdrop"
                onClick={() => setShowExportMenu(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 9998,
                  cursor: 'default',
                }}
              />
            )}
          </div>
          <div className="filter-group">
            <button
              onClick={() => {
                setDateRange([new Date(), new Date()])
              }}
              title="Reset Filters"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 0 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--theme-text-primary)',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>CUSTOMER NAME</th>
                <th>PHONE NUMBER</th>
                <th>BILL NUMBER</th>
                <th>PRODUCT NAME</th>
                <th style={{ width: '20%' }}>REVIEW MESSAGE</th>
                <th style={{ width: '20%' }}>CHEF REPLY</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((row) => (
                <tr
                  key={row.sNo}
                  onClick={() => setSelectedReview(row)}
                  style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                  className="review-row"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td>{row.sNo}</td>
                  <td>{row.customerName}</td>
                  <td>{row.phoneNumber}</td>
                  <td
                    onClick={(e) => {
                      if (row.billId) {
                        handleBillClick(e, row.billId)
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                    }}
                    title="Click to view bill receipt"
                  >
                    {row.billNumber}
                  </td>
                  <td>{row.productName}</td>
                  <td
                    style={{
                      maxWidth: '150px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.reviewMessage}
                  </td>
                  <td
                    style={{
                      maxWidth: '150px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.chefReply || '-'}
                  </td>
                  <td>
                    <span
                      onClick={(e) => handleApprove(e, row)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor:
                          row.status === 'approved'
                            ? '#e6f4ea'
                            : row.status === 'replied'
                              ? '#e8f0fe'
                              : '#fce8e6',
                        color:
                          row.status === 'approved'
                            ? '#1e8e3e'
                            : row.status === 'replied'
                              ? '#1967d2'
                              : '#d93025',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textTransform: 'capitalize',
                        cursor: row.status === 'replied' ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                      title={row.status === 'replied' ? 'Click to Approve' : undefined}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedReview && (
        <DetailModal data={selectedReview} onClose={() => setSelectedReview(null)} />
      )}

      {(selectedBill || loadingBill) && (
        <BillModal
          billData={selectedBill}
          loading={loadingBill}
          onClose={() => {
            setSelectedBill(null)
            setLoadingBill(false)
          }}
        />
      )}
    </div>
  )
}

export default ReviewReport
