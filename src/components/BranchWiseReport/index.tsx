'use client'

import React, { useState, useEffect } from 'react'
import './index.scss'

type ReportStats = {
  branchName: string
  totalBills: number
  totalAmount: number
  cash: number
  upi: number
  card: number
}

type ReportData = {
  date: string
  stats: ReportStats[]
  totals: Omit<ReportStats, 'branchName'>
}

const BranchWiseReport: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchReport = async (selectedDate: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/branch-wise?date=${selectedDate}`)
      if (!res.ok) throw new Error('Failed to fetch report')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      setError('Error loading report data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(date)
  }, [date])

  return (
    <div className="branch-report-container">
      <div className="report-header">
        <h1>Branch Wise Report</h1>
        <div className="date-filter">
          <label>Date: </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="date-input"
          />
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.No</th>
                <th>Branch Name</th>
                <th style={{ textAlign: 'right' }}>Total Bills</th>
                <th style={{ textAlign: 'right' }}>Cash</th>
                <th style={{ textAlign: 'right' }}>UPI</th>
                <th style={{ textAlign: 'right' }}>Card</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((row, index) => (
                <tr key={row.branchName}>
                  <td>{index + 1}</td>{' '}
                  {/* Using index + 1 for S.No as row.sNo is not defined in ReportStats */}
                  <td>{row.branchName}</td>
                  <td style={{ textAlign: 'right' }}>{row.totalBills}</td>
                  <td style={{ textAlign: 'right' }}>
                    {row.cash.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {row.upi.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {row.card.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {row.totalAmount.toLocaleString('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="grand-total">
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.totalBills}</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.cash.toFixed(2)}</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.upi.toFixed(2)}</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.card.toFixed(2)}</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.totalAmount.toFixed(2)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default BranchWiseReport
