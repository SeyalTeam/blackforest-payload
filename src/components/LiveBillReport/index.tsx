'use client'

import React, { useCallback, useEffect, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { getBill } from '@/app/actions/getBill'
import BillReceipt, { BillData } from '@/components/BillReceipt'
import './index.scss'

type LiveBillStat = {
  billId: string
  invoiceNumber: string
  itemCount: number
  totalAmount: number
  branchName: string
  createdAt: string
}

type LiveBillReportData = {
  startDate: string
  endDate: string
  totalBills: number
  stats: LiveBillStat[]
}

type ReportBranch = {
  id: string
  name: string
}

const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th'
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

const formatBillDate = (isoDate: string): string => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '-'

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const parts = dayFormatter.formatToParts(date)
  const day = Number(parts.find((part) => part.type === 'day')?.value || '0')
  const month = parts.find((part) => part.type === 'month')?.value || ''
  const year = parts.find((part) => part.type === 'year')?.value || ''
  const time = timeFormatter.format(date)

  if (!day || !month || !year) return time
  return `${month} ${day}${getOrdinalSuffix(day)} ${year}, ${time}`
}

const formatAmount = (value: number): string => {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

const formatItemLabel = (count: number): string => {
  return `${count} ${count === 1 ? 'Item' : 'Items'}`
}

const BillModal: React.FC<{
  billData: BillData | null
  loading: boolean
  onClose: () => void
}> = ({ billData, loading, onClose }) => {
  if (!billData && !loading) return null

  return (
    <div className="bill-modal-overlay" onClick={onClose}>
      <div className="bill-modal-content" onClick={(event) => event.stopPropagation()}>
        {loading ? (
          <div className="bill-modal-loading">Loading Bill...</div>
        ) : (
          billData && <BillReceipt data={billData} />
        )}
      </div>
    </div>
  )
}

const LiveBillReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()])
  const [startDate, endDate] = dateRange
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [branches, setBranches] = useState<ReportBranch[]>([])

  const [data, setData] = useState<LiveBillReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('')

  const [selectedBill, setSelectedBill] = useState<BillData | null>(null)
  const [loadingBill, setLoadingBill] = useState(false)

  const toLocalDateStr = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchReport = useCallback(
    async (silent = false) => {
      if (!startDate || !endDate) return

      if (!silent) setLoading(true)
      if (!silent) setError('')

      try {
        const startStr = toLocalDateStr(startDate)
        const endStr = toLocalDateStr(endDate)
        let url = `/api/reports/live-bill?startDate=${startStr}&endDate=${endStr}`
        if (selectedBranch !== 'all') {
          url += `&branch=${selectedBranch}`
        }

        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to fetch report')

        const reportJson: LiveBillReportData = await response.json()
        setData(reportJson)
        setLastUpdatedAt(
          new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
        )
      } catch (fetchError) {
        console.error(fetchError)
        setError('Error loading live bill report')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [startDate, endDate, selectedBranch],
  )

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchResponse = await fetch('/api/reports/branches')
        if (!branchResponse.ok) return
        const branchJson = (await branchResponse.json()) as {
          docs?: ReportBranch[]
        }
        setBranches(branchJson.docs || [])
      } catch (branchError) {
        console.error(branchError)
      }
    }

    fetchBranches()
  }, [])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchReport(true)
    }, 15000)

    return () => clearInterval(timer)
  }, [fetchReport])

  const handleBillClick = async (billId: string) => {
    setLoadingBill(true)
    setSelectedBill(null)

    try {
      const billData = await getBill(billId)
      setSelectedBill(billData)
    } catch (billError) {
      console.error('Failed to fetch bill data', billError)
      alert('Failed to load bill details')
    } finally {
      setLoadingBill(false)
    }
  }

  const CustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({ value, onClick }, ref) => {
      const [start = '', end = ''] = value ? value.split(' - ') : ['', '']

      return (
        <button className="custom-date-input" onClick={onClick} ref={ref}>
          <span className="date-text">{start}</span>
          <span className="separator">→</span>
          <span className="date-text">{end || start}</span>
          <span className="icon" aria-hidden>
            <svg
              width="16"
              height="16"
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
    <div className="live-bill-report-container">
      <div className="report-header">
        <h1>Live Bill Report</h1>
        <div className="report-controls">
          <DatePicker
            selectsRange={true}
            startDate={startDate}
            endDate={endDate}
            onChange={(update) => setDateRange(update)}
            monthsShown={1}
            dateFormat="yyyy-MM-dd"
            customInput={<CustomInput />}
            calendarClassName="custom-calendar"
            popperPlacement="bottom-start"
          />

          <select
            value={selectedBranch}
            onChange={(event) => setSelectedBranch(event.target.value)}
            className="branch-select"
          >
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          <button
            className="refresh-btn"
            onClick={() => {
              void fetchReport()
            }}
          >
            Refresh
          </button>

          <button
            className="reset-btn"
            onClick={() => {
              setDateRange([new Date(), new Date()])
              setSelectedBranch('all')
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="report-meta">
        <span>Total Bills: {data?.totalBills ?? 0}</span>
        <span>Auto Refresh: 15s</span>
        <span>Last Updated: {lastUpdatedAt || '--'}</span>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="table-wrap">
          <table className="live-bill-table">
            <thead>
              <tr>
                <th>INVOICE NO</th>
                <th>ITEMS</th>
                <th>AMOUNT</th>
                <th>BRANCH</th>
                <th>BILL TIME</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No bills found for this range
                  </td>
                </tr>
              ) : (
                data.stats.map((row) => (
                  <tr key={`${row.billId}-${row.createdAt}`}>
                    <td className="invoice-cell">
                      <button onClick={() => void handleBillClick(row.billId)}>{row.invoiceNumber}</button>
                    </td>
                    <td>{formatItemLabel(row.itemCount)}</td>
                    <td>{formatAmount(row.totalAmount)}</td>
                    <td>{row.branchName}</td>
                    <td>{formatBillDate(row.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

export default LiveBillReport
