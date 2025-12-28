'use client'

import React, { useState, useEffect, useCallback } from 'react'
import './index.scss'

type BranchInventory = {
  id: string
  name: string
  inventory: number
}

type ProductInventory = {
  id: string
  name: string
  totalInventory: number
  branches: BranchInventory[]
}

type ReportData = {
  timestamp: string
  products: ProductInventory[]
}

const InventoryReport: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reports/inventory')
      const json: ReportData = await res.json()
      if (res.ok) {
        setData(json)
      } else {
        throw new Error('Failed to fetch inventory data')
      }
    } catch (error) {
      console.error(error)
      setError('Failed to fetch inventory report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const toggleRow = (id: string) => {
    const newDocs = new Set(expandedRows)
    if (newDocs.has(id)) {
      newDocs.delete(id)
    } else {
      newDocs.add(id)
    }
    setExpandedRows(newDocs)
  }

  return (
    <div className="inventory-report-container">
      <div className="report-header">
        <h1>Inventory Report</h1>
        <button onClick={fetchReport} className="refresh-btn">
          Refresh
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}></th>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>PRODUCT NAME</th>
                <th className="text-right">TOTAL INVENTORY</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((product, index) => (
                <React.Fragment key={product.id}>
                  <tr
                    onClick={() => toggleRow(product.id)}
                    className={expandedRows.has(product.id) ? 'expanded' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ textAlign: 'center' }}>
                      {expandedRows.has(product.id) ? '▼' : '▶'}
                    </td>
                    <td>{index + 1}</td>
                    <td style={{ fontWeight: 'bold' }}>{product.name}</td>
                    <td
                      className="text-right"
                      style={{
                        fontWeight: 'bold',
                        color:
                          product.totalInventory < 0
                            ? 'red'
                            : product.totalInventory === 0
                              ? 'orange'
                              : 'inherit',
                      }}
                    >
                      {product.totalInventory}
                    </td>
                  </tr>

                  {expandedRows.has(product.id) && (
                    <tr className="details-row">
                      <td colSpan={4}>
                        <div className="details-container">
                          <table className="sub-table">
                            <thead>
                              <tr>
                                <th>Branch</th>
                                <th className="text-right">Inventory Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.branches.map((branch) => (
                                <tr key={branch.id}>
                                  <td>{branch.name}</td>
                                  <td
                                    className="text-right"
                                    style={{
                                      color: branch.inventory < 0 ? 'red' : 'inherit',
                                    }}
                                  >
                                    {branch.inventory}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default InventoryReport
