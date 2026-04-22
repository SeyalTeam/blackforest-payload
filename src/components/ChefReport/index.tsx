'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

type BranchOption = {
  id: string
  name: string
}

type BranchApiDoc = {
  id: unknown
  name: unknown
}

type ChefSummaryRow = {
  chefName: string
  sendingAmount: number
}

type ChefReportResponse = {
  data?: {
    stockOrderReport?: {
      chefSummary?: ChefSummaryRow[]
    }
  }
  errors?: Array<{ message?: string }>
}

const STOCK_ORDER_CHEF_QUERY = `
  query StockOrderChefSummary($filter: StockOrderReportFilterInput) {
    stockOrderReport(filter: $filter) {
      chefSummary {
        chefName
        sendingAmount
      }
    }
  }
`

const toDateInputValue = (date: Date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const ChefReport: React.FC = () => {
  const today = toDateInputValue(new Date())
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branches, setBranches] = useState<BranchOption[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<ChefSummaryRow[]>([])

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch('/api/reports/branches')
        const json = await res.json()
        if (Array.isArray(json?.docs)) {
          const branchDocs = json.docs as unknown[]

          setBranches(
            branchDocs
              .filter((branch): branch is BranchApiDoc => {
                if (!branch || typeof branch !== 'object') return false
                return 'id' in branch && 'name' in branch
              })
              .map((branch) => ({
                id: String(branch.id),
                name: String(branch.name),
              })),
          )
        } else {
          setBranches([])
        }
      } catch (_err) {
        setBranches([])
      }
    }

    void fetchBranches()
  }, [])

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return
    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      setError('Start date cannot be after end date.')
      setRows([])
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: STOCK_ORDER_CHEF_QUERY,
          variables: {
            filter: {
              startDate,
              endDate,
              branch: selectedBranch || 'all',
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch chef report (HTTP ${response.status})`)
      }

      const json = (await response.json()) as ChefReportResponse
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || 'Failed to fetch chef report')
      }

      const reportRows = json.data?.stockOrderReport?.chefSummary
      setRows(Array.isArray(reportRows) ? reportRows : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading chef report')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [endDate, selectedBranch, startDate])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const totalSendingAmount = useMemo(
    () => rows.reduce((sum, row) => sum + (Number.isFinite(row.sendingAmount) ? row.sendingAmount : 0), 0),
    [rows],
  )

  const handleExportCsv = () => {
    const csvRows: string[] = []
    csvRows.push(['Chef Name', 'Sending Amount'].join(','))
    rows.forEach((row) => {
      csvRows.push([`"${row.chefName.replace(/"/g, '""')}"`, row.sendingAmount.toString()].join(','))
    })
    csvRows.push(['"TOTAL"', totalSendingAmount.toString()].join(','))

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chef_report_${startDate}_to_${endDate}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '16px',
        }}
      >
        <h1 style={{ margin: 0 }}>Chef Report</h1>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label>
            Start:{' '}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '6px 8px' }}
            />
          </label>

          <label>
            End:{' '}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '6px 8px' }}
            />
          </label>

          <label>
            Branch:{' '}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ padding: '6px 8px' }}
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void fetchReport()}
            style={{ padding: '7px 10px', cursor: 'pointer' }}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            style={{ padding: '7px 10px', cursor: 'pointer' }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading && <p>Loading chef report...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ overflowX: 'auto', width: '60%', maxWidth: '100%' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid var(--theme-elevation-200)',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px',
                  borderBottom: '1px solid var(--theme-elevation-200)',
                }}
              >
                Chef Name
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '10px',
                  borderBottom: '1px solid var(--theme-elevation-200)',
                }}
              >
                Sending Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${row.chefName}-${index}`}>
                  <td
                    style={{
                      padding: '10px',
                      borderBottom: '1px solid var(--theme-elevation-150)',
                      fontSize: '1.06rem',
                      fontWeight: 600,
                    }}
                  >
                    {row.chefName}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      borderBottom: '1px solid var(--theme-elevation-150)',
                      textAlign: 'right',
                      fontWeight: 700,
                    }}
                  >
                    ₹ {row.sendingAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={2}
                  style={{
                    textAlign: 'center',
                    padding: '16px',
                    borderBottom: '1px solid var(--theme-elevation-150)',
                  }}
                >
                  No chef report data found.
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '10px', fontWeight: 800, fontSize: '1.18rem' }}>Total</td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, fontSize: '1.18rem' }}>
                ₹ {totalSendingAmount.toLocaleString('en-IN')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ChefReport
