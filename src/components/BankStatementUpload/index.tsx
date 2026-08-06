'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Eye,
  Download,
  Trash2,
  Upload,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileText,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { StylesConfig } from 'react-select'
import dayjs from 'dayjs'
import './index.scss'

type BranchOption = {
  value: string
  label: string
}

type StatementStatus = 'pending' | 'verified' | 'not-verified'

type BankStatementRow = {
  id: string
  branch: {
    id: string
    name: string
  } | string
  dateType: 'single' | 'double'
  statementDate?: string
  fromDate?: string
  toDate?: string
  filename: string
  url?: string
  filesize?: number
  createdAt: string
  status?: StatementStatus
}

const customSelectStyles: StylesConfig<any, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--theme-elevation-50, #ffffff)',
    borderColor: state.isFocused ? 'var(--theme-info-500, #38bdf8)' : 'var(--theme-elevation-200, #cbd5e1)',
    borderRadius: '8px',
    height: '42px',
    minHeight: '42px',
    minWidth: '200px',
    boxShadow: state.isFocused ? '0 0 0 1px var(--theme-info-500, #38bdf8)' : 'none',
    color: 'var(--theme-text-primary, #0f172a)',
    '&:hover': {
      borderColor: 'var(--theme-info-750, #0284c7)',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--theme-text-primary, #0f172a)',
    fontWeight: 600,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--theme-info-500, #38bdf8)'
      : state.isFocused
        ? 'var(--theme-elevation-100, #f1f5f9)'
        : 'var(--theme-elevation-50, #ffffff)',
    color: state.isSelected ? '#fff' : 'var(--theme-text-primary, #0f172a)',
    cursor: 'pointer',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--theme-elevation-50, #ffffff)',
    border: '1px solid var(--theme-elevation-150, #e2e8f0)',
    zIndex: 9999,
  }),
  input: (base) => ({
    ...base,
    color: 'var(--theme-text-primary, #0f172a)',
  }),
}

const STATUS_CONFIG: Record<StatementStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'status-pending' },
  verified: { label: 'Verified', cls: 'status-verified' },
  'not-verified': { label: 'Not Verified', cls: 'status-not-verified' },
}

const StatusBadge: React.FC<{
  stmtId: string
  current: StatementStatus
  onUpdate: (newStatus: StatementStatus) => void
}> = ({ stmtId, current, onUpdate }) => {
  const [updating, setUpdating] = useState(false)
  const cfg = STATUS_CONFIG[current] || STATUS_CONFIG['pending']

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value as StatementStatus
    setUpdating(true)
    try {
      await fetch(`/api/bank-statements/${stmtId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      onUpdate(nextStatus)
    } catch (_) {
      // silently fail
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className={`status-select-wrap ${cfg.cls}${updating ? ' status-updating' : ''}`}>
      <select
        className="status-select"
        value={current}
        onChange={handleChange}
        disabled={updating}
      >
        <option value="pending">Pending</option>
        <option value="verified">Verified</option>
        <option value="not-verified">Not Verified</option>
      </select>
    </div>
  )
}

const BankStatementUpload: React.FC = () => {
  // State for lists
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [statements, setStatements] = useState<BankStatementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingStatements, setFetchingStatements] = useState(false)

  // Form State
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [dateType, setDateType] = useState<'single' | 'double'>('single')
  const [statementDate, setStatementDate] = useState<Date | null>(null)
  const [fromDate, setFromDate] = useState<Date | null>(null)
  const [toDate, setToDate] = useState<Date | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Filter list by branch and status
  const [filterBranch, setFilterBranch] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Feedback State
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch branches
  const loadBranches = async () => {
    try {
      const res = await fetch('/api/reports/branches')
      if (!res.ok) throw new Error('Failed to load branches')
      const data = await res.json()
      const options = (data.docs || []).map((b: any) => ({
        value: b.id,
        label: b.name,
      }))
      setBranches(options)
    } catch (err: any) {
      console.error(err)
      setError('Failed to fetch branches. Please check your network or try again.')
    }
  }

  // Fetch uploaded statements
  const loadStatements = async () => {
    setFetchingStatements(true)
    try {
      const res = await fetch('/api/bank-statements?depth=1&limit=1000&sort=-createdAt')
      if (!res.ok) throw new Error('Failed to load statements')
      const data = await res.json()
      setStatements(data.docs || [])
    } catch (err: any) {
      console.error(err)
      setError('Failed to load statements history.')
    } finally {
      setFetchingStatements(false)
    }
  }

  useEffect(() => {
    setIsMounted(true)
    loadBranches()
    loadStatements()
  }, [])

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedBranch) {
      setError('Please select a branch.')
      return
    }

    if (dateType === 'single' && !statementDate) {
      setError('Please select the statement date.')
      return
    }

    if (dateType === 'double') {
      if (!fromDate || !toDate) {
        setError('Please select both starting and ending dates.')
        return
      }
      if (dayjs(fromDate).isAfter(dayjs(toDate))) {
        setError('Start date cannot be after the end date.')
        return
      }
    }

    if (!selectedFile) {
      setError('Please choose a bank statement file to upload.')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('branch', selectedBranch)
      formData.append('dateType', dateType)

      const payloadData: any = {
        branch: selectedBranch,
        dateType: dateType,
      }

      if (dateType === 'single') {
        const isoDate = statementDate!.toISOString()
        formData.append('statementDate', isoDate)
        payloadData.statementDate = isoDate
      } else {
        const isoFrom = fromDate!.toISOString()
        const isoTo = toDate!.toISOString()
        formData.append('fromDate', isoFrom)
        formData.append('toDate', isoTo)
        payloadData.fromDate = isoFrom
        payloadData.toDate = isoTo
      }

      formData.append('_payload', JSON.stringify(payloadData))

      const res = await fetch('/api/bank-statements', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.errors?.[0]?.message || 'Failed to upload statement')
      }

      setSuccess('Bank statement uploaded successfully!')
      // Reset form
      setSelectedFile(null)
      setStatementDate(null)
      setFromDate(null)
      setToDate(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Refresh list
      await loadStatements()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Error occurred during statement upload.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this bank statement?')) return

    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/bank-statements/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete statement')

      setSuccess('Bank statement deleted successfully.')
      loadStatements()
    } catch (err: any) {
      console.error(err)
      setError('Failed to delete statement.')
    }
  }



  const handleDownloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('Direct download failed, falling back to window.open', err)
      window.open(url, '_blank')
    }
  }

  const filteredStatements = statements.filter((stmt) => {
    if (filterBranch !== 'all') {
      const stmtBranchId = typeof stmt.branch === 'object' ? stmt.branch?.id : stmt.branch
      if (stmtBranchId !== filterBranch) return false
    }
    if (filterStatus !== 'all') {
      const stmtStatus = stmt.status || 'pending'
      if (stmtStatus !== filterStatus) return false
    }
    return true
  })

  if (!isMounted) return null

  const currentBranchOption = branches.find((b) => b.value === selectedBranch) || null
  const currentFilterBranchOption = branches.find((b) => b.value === filterBranch) || {
    value: 'all',
    label: 'All Branches',
  }

  return (
    <div className="branch-report-container bank-statements-container">
      <div className="report-topbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <p className="crumbs">ACCOUNT / BANK STATEMENT UPLOAD</p>
          <h1 style={{ margin: 0 }}>Bank Statement Upload</h1>
          <p className="subtitle">Upload bank statements for single or double dates per branch.</p>
        </div>
        <div className="actions">
          <button
            className="icon-btn"
            onClick={() => {
              loadBranches()
              loadStatements()
            }}
            disabled={loading || fetchingStatements}
            title="Refresh lists"
          >
            <RefreshCw className={fetchingStatements || loading ? 'animate-spin' : ''} size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="report-alert alert--error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="report-alert alert--success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Upload Form Card */}
        <div className="report-card form-card">
          <div className="card-header">
            <h3>Upload New Statement</h3>
          </div>
          <form onSubmit={handleUpload} className="upload-form">
            <div className="form-group">
              <label className="filter-label">Branch</label>
              <Select
                options={branches}
                value={currentBranchOption}
                onChange={(opt) => opt && setSelectedBranch(opt.value)}
                styles={customSelectStyles}
                placeholder="Select Branch"
                isSearchable
              />
            </div>

            <div className="form-group">
              <label className="filter-label">Statement Date Type</label>
              <div className="type-toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${dateType === 'single' ? 'active' : ''}`}
                  onClick={() => setDateType('single')}
                >
                  Single Date
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${dateType === 'double' ? 'active' : ''}`}
                  onClick={() => setDateType('double')}
                >
                  Double Date (Range)
                </button>
              </div>
            </div>

            {dateType === 'single' ? (
              <div className="form-group">
                <label className="filter-label">Choose Statement Date</label>
                <div className="custom-datepicker-wrap">
                  <Calendar size={16} className="date-icon" />
                  <DatePicker
                    selected={statementDate}
                    onChange={(date: Date | null) => setStatementDate(date)}
                    placeholderText="Select Date"
                    className="datepicker-input"
                    dateFormat="yyyy-MM-dd"
                  />
                </div>
              </div>
            ) : (
              <div className="form-group double-date-group">
                <div className="date-field">
                  <label className="filter-label">From Date</label>
                  <div className="custom-datepicker-wrap">
                    <Calendar size={16} className="date-icon" />
                    <DatePicker
                      selected={fromDate}
                      onChange={(date: Date | null) => setFromDate(date)}
                      placeholderText="Select Start Date"
                      className="datepicker-input"
                      dateFormat="yyyy-MM-dd"
                    />
                  </div>
                </div>
                <div className="date-field">
                  <label className="filter-label">To Date</label>
                  <div className="custom-datepicker-wrap">
                    <Calendar size={16} className="date-icon" />
                    <DatePicker
                      selected={toDate}
                      onChange={(date: Date | null) => setToDate(date)}
                      placeholderText="Select End Date"
                      className="datepicker-input"
                      dateFormat="yyyy-MM-dd"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="filter-label">Bank Statement File</label>
              <div
                className={`dropzone-area ${selectedFile ? 'has-file' : ''}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
              >
                <Upload size={28} className="upload-icon" />
                {selectedFile ? (
                  <div className="file-info">
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <div className="dropzone-text">
                    <p className="main-text">Drag & drop your statement here, or <span>browse</span></p>
                    <p className="sub-text">Supports PDF, CSV, Excel, Images</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} style={{ marginRight: '8px' }} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} style={{ marginRight: '8px' }} />
                  Upload Statement
                </>
              )}
            </button>
          </form>
        </div>

        {/* History / Table Card */}
        <div className="report-card table-card list-card">
          <div className="card-header list-header">
            <h3>Uploaded Statements</h3>
            <div className="list-filters">
              <Select
                options={[
                  { value: 'all', label: 'All Branches' },
                  ...branches,
                ]}
                value={currentFilterBranchOption}
                onChange={(opt) => opt && setFilterBranch(opt.value)}
                styles={customSelectStyles}
                placeholder="Filter by Branch"
              />
              <Select
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: '🟡 Pending' },
                  { value: 'verified', label: '🟢 Verified' },
                  { value: 'not-verified', label: '🔴 Not Verified' },
                ]}
                value={(
                  [
                    { value: 'all', label: 'All Statuses' },
                    { value: 'pending', label: '🟡 Pending' },
                    { value: 'verified', label: '🟢 Verified' },
                    { value: 'not-verified', label: '🔴 Not Verified' },
                  ].find((o) => o.value === filterStatus) || { value: 'all', label: 'All Statuses' }
                )}
                onChange={(opt) => opt && setFilterStatus(opt.value)}
                styles={customSelectStyles}
                placeholder="Filter by Status"
              />
            </div>
          </div>

          <div className="table-wrapper">
            {fetchingStatements ? (
              <div className="list-loading">
                <RefreshCw className="animate-spin" size={24} />
                <span>Loading uploaded statements...</span>
              </div>
            ) : filteredStatements.length === 0 ? (
              <div className="list-empty">
                <FileText size={48} className="empty-icon" />
                <p>No statements uploaded yet for the selected criteria.</p>
              </div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="sno-col">S.No</th>
                    <th className="branch-col">Branch</th>
                    <th className="date-col">Statement Date</th>
                    <th className="filename-col">File Name</th>
                    <th className="uploaded-col">Uploaded At</th>
                    <th className="status-col">Status</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                   {filteredStatements.map((stmt, index) => {
                    const branchName =
                      typeof stmt.branch === 'object' ? stmt.branch?.name : stmt.branch

                    // Format dates
                    let statementDateText = ''
                    if (stmt.dateType === 'single') {
                      statementDateText = stmt.statementDate
                        ? dayjs(stmt.statementDate).format('YYYY-MM-DD')
                        : 'N/A'
                    } else {
                      const fromText = stmt.fromDate
                        ? dayjs(stmt.fromDate).format('YYYY-MM-DD')
                        : 'N/A'
                      const toText = stmt.toDate
                        ? dayjs(stmt.toDate).format('YYYY-MM-DD')
                        : 'N/A'
                      statementDateText = `${fromText} to ${toText}`
                    }

                    return (
                      <tr key={stmt.id}>
                        <td className="sno-cell">{index + 1}</td>
                        <td className="branch-cell">{branchName}</td>
                        <td className="date-cell">{statementDateText}</td>
                        <td className="filename-cell">
                          <span className="filename-text" title={stmt.filename}>{stmt.filename}</span>
                        </td>
                        <td className="uploaded-cell">
                          {dayjs(stmt.createdAt).format('YYYY-MM-DD HH:mm')}
                        </td>
                        <td className="status-cell">
                          <StatusBadge
                            stmtId={stmt.id}
                            current={(stmt.status as StatementStatus) || 'pending'}
                            onUpdate={(newStatus) => {
                              setStatements((prev) =>
                                prev.map((s) => s.id === stmt.id ? { ...s, status: newStatus } : s)
                              )
                            }}
                          />
                        </td>
                        <td className="actions-cell">
                          <div className="actions-wrap">
                            {stmt.url ? (
                              <>
                                <button
                                  className="action-icon-btn view-btn"
                                  onClick={() => window.open(stmt.url, '_blank')}
                                  title="View Statement"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  className="action-icon-btn download-btn"
                                  onClick={() => handleDownloadFile(stmt.url!, stmt.filename)}
                                  title="Download Statement"
                                >
                                  <Download size={16} />
                                </button>
                              </>
                            ) : (
                              <span className="no-url-label">No File Link</span>
                            )}
                            <button
                              className="action-icon-btn delete-btn"
                              onClick={() => handleDelete(stmt.id)}
                              title="Delete Statement"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BankStatementUpload
