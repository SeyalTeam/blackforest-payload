'use client'

import React, { useState, useEffect } from 'react'
import './index.scss'

type ReportStats = {
  sNo: number
  categoryName: string
  totalQuantity: number
  totalAmount: number
  branchSales: Record<string, number>
}

type ReportData = {
  date: string
  branchHeaders: string[]
  stats: ReportStats[]
  totals: {
    totalQuantity: number
    totalAmount: number
  }
}

const CategoryWiseReport: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState('all')

  // Fetch available branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch('/api/branches?limit=100&pagination=false')
        if (res.ok) {
          const json = await res.json()
          setBranches(json.docs)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchBranches()
  }, [])

  const fetchReport = async (selectedDate: string, branchId: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/category-wise?date=${selectedDate}&branch=${branchId}`)
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
    fetchReport(date, selectedBranch)
  }, [date, selectedBranch])

  return (
    <div className="category-report-container">
      <div className="report-header">
        <h1>Category Wise Report</h1>
        <div className="date-filter">
          <div className="filter-group">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="date-input"
            />
          </div>

          <div className="filter-group">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="date-input"
              style={{ minWidth: '180px' }}
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
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
                <th style={{ width: '50px' }}>S.No</th>
                <th>Category</th>
                {/* Dynamically render branch headers */}
                {data.branchHeaders.map((header) => (
                  <th key={header} style={{ textAlign: 'left' }}>
                    {header}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Total Quantity</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((row) => (
                <tr key={row.sNo}>
                  <td>{row.sNo}</td>
                  <td>{row.categoryName}</td>
                  {/* Dynamically render branch sales cells */}
                  {data.branchHeaders.map((header) => (
                    <td key={header} style={{ textAlign: 'left' }}>
                      {(row.branchSales[header] || 0).toFixed(2)}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right' }}>{row.totalQuantity}</td>
                  <td style={{ textAlign: 'right' }}>{row.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="grand-total">
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                {/* Empty cells for branch columns in footer (or calculate vertical totals if needed later) */}
                {data.branchHeaders.map((header) => (
                  <td key={header}></td>
                ))}
                <td style={{ textAlign: 'right' }}>
                  <strong>{data.totals.totalQuantity}</strong>
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

export default CategoryWiseReport
