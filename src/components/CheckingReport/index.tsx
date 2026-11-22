'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import './index.scss'

interface LiveStaffItem {
  attendanceId: string
  employeeId: string
  employeeName: string
  userId: string
  role: string
  branchId: string
  branchName: string
  firstPunchIn?: string
  status: string
  auditState: 'check_in' | 'waiting' | 'updated'
  latestAudit?: {
    id: string
    taskTitle: string
    status: string
    photoCount: number
    photos: Array<{
      photo?: any
      photoUrl?: string
      caption?: string
      capturedAt?: string
    }>
    notes?: string
    requestedAt?: string
    submittedAt?: string
  } | null
}

const ROLE_EMOJIS: Record<string, string> = {
  chef: '👨‍🍳',
  kitchen: '🍳',
  waiter: '🛎️',
  cashier: '💰',
  manager: '👔',
  supervisor: '📋',
  delivery: '🛵',
  driver: '🚚',
  store_keeper: '📦',
  account: '📊',
}

export default function CheckingReport() {
  const [staffList, setStaffList] = useState<LiveStaffItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [triggeringStaffId, setTriggeringStaffId] = useState<string | null>(null)
  const [selectedPhotoAudit, setSelectedPhotoAudit] = useState<any | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const fetchLiveStaff = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const res = await fetch('/api/checking/live-staff')
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.staff)) {
          setStaffList(data.staff)
          setLastRefreshedAt(new Date())
        }
      }
    } catch (err) {
      console.error('Failed to fetch live staff for checking:', err)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLiveStaff()
    // Auto-poll every 15 seconds to update "Waiting" -> "Updated" in real time
    const timer = setInterval(() => {
      fetchLiveStaff(true)
    }, 15000)
    return () => clearInterval(timer)
  }, [fetchLiveStaff])

  const handleTriggerAudit = async (staff: LiveStaffItem) => {
    const staffKey = staff.employeeId || staff.userId
    setTriggeringStaffId(staffKey)
    try {
      const res = await fetch('/api/checking/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: staff.employeeId,
          userId: staff.userId,
          branchId: staff.branchId,
          role: staff.role,
        }),
      })

      if (res.ok) {
        // Optimistically update status to 'waiting'
        setStaffList((prev) =>
          prev.map((item) => {
            const itemKey = item.employeeId || item.userId
            if (itemKey === staffKey) {
              return {
                ...item,
                auditState: 'waiting',
                latestAudit: {
                  id: 'pending_temp',
                  taskTitle: staff.role.includes('waiter')
                    ? 'Table Cleaning Audit'
                    : 'Mandatory Kitchen Cleaning Audit',
                  status: 'pending',
                  photoCount: 0,
                  photos: [],
                  notes: '',
                  requestedAt: new Date().toISOString(),
                },
              }
            }
            return item
          }),
        )
      } else {
        alert('Failed to trigger sudden inspection. Please try again.')
      }
    } catch (e) {
      console.error('Error triggering audit:', e)
      alert('Network error while triggering audit.')
    } finally {
      setTriggeringStaffId(null)
    }
  }

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      if (roleFilter !== 'all') {
        const staffRole = staff.role.toLowerCase()
        if (roleFilter === 'chef' && !staffRole.includes('chef') && !staffRole.includes('kitchen')) {
          return false
        }
        if (roleFilter === 'waiter' && !staffRole.includes('waiter') && !staffRole.includes('billing')) {
          return false
        }
        if (roleFilter !== 'chef' && roleFilter !== 'waiter' && staffRole !== roleFilter) {
          return false
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = staff.employeeName.toLowerCase().includes(q)
        const branchMatch = staff.branchName.toLowerCase().includes(q)
        const roleMatch = staff.role.toLowerCase().includes(q)
        if (!nameMatch && !branchMatch && !roleMatch) return false
      }

      return true
    })
  }, [staffList, roleFilter, searchQuery])

  // Count by state
  const stats = useMemo(() => {
    let checkInCount = 0
    let waitingCount = 0
    let updatedCount = 0
    filteredStaff.forEach((s) => {
      if (s.auditState === 'waiting') waitingCount++
      else if (s.auditState === 'updated') updatedCount++
      else checkInCount++
    })
    return { checkInCount, waitingCount, updatedCount, total: filteredStaff.length }
  }, [filteredStaff])

  return (
    <div className="checking-report-container">
      {/* Top Header Card */}
      <div className="checking-header">
        <div className="header-title-block">
          <h2>🔍 Checking (திடீர் ஆய்வு / Sudden Inspection)</h2>
          <p className="subtitle">
            தற்போது நேரலையில் பணியில் உள்ள (Live Attendance) ஊழியர்களின் பட்டியல் மற்றும் திடீர் ஆய்வு மேலாண்மை.
          </p>
        </div>

        <div className="header-actions">
          <div className="live-indicator">
            <span className="pulsing-dot" />
            <span className="live-text">
              LIVE STAFF: <strong>{staffList.length}</strong>
            </span>
          </div>

          <button
            className="refresh-btn"
            onClick={() => fetchLiveStaff()}
            disabled={loading}
            title="Refresh Live Data"
          >
            {loading ? '⏳ Updating...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="checking-kpi-row">
        <div className="kpi-card total">
          <span className="kpi-label">👥 On-Duty Live Staff</span>
          <span className="kpi-value">{stats.total}</span>
        </div>
        <div className="kpi-card ready">
          <span className="kpi-label">🔍 Ready to Check</span>
          <span className="kpi-value">{stats.checkInCount}</span>
        </div>
        <div className="kpi-card waiting">
          <span className="kpi-label">⏳ Waiting for Reply</span>
          <span className="kpi-value">{stats.waitingCount}</span>
        </div>
        <div className="kpi-card updated">
          <span className="kpi-label">✅ Image Updated</span>
          <span className="kpi-value">{stats.updatedCount}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="checking-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search employee, role, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Filter Role:</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">👥 All Active Roles ({staffList.length})</option>
            <option value="chef">👨‍🍳 Chefs Only</option>
            <option value="waiter">🛎️ Waiters Only</option>
            <option value="cashier">💰 Cashiers</option>
            <option value="manager">👔 Managers</option>
          </select>
        </div>

        <div className="last-sync-time">
          Updated: {lastRefreshedAt.toLocaleTimeString()}
        </div>
      </div>

      {/* Table Section */}
      <div className="checking-table-wrapper">
        {loading && staffList.length === 0 ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading live attendance staff...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <h4>No Active Live Staff Found</h4>
            <p>
              தற்போது எவரும் பணியில் இல்லை (No active sessions found today, or all have punched out).
            </p>
          </div>
        ) : (
          <table className="checking-table">
            <thead>
              <tr>
                <th>Employee / ஊழியர்</th>
                <th>Role / பொறுப்பு</th>
                <th>Branch / கிளை</th>
                <th>Punch In Time</th>
                <th>Audit Action & Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((staff) => {
                const staffKey = staff.employeeId || staff.userId
                const isTriggering = triggeringStaffId === staffKey
                const roleLower = staff.role.toLowerCase()
                const emoji =
                  ROLE_EMOJIS[roleLower] ||
                  (roleLower.includes('chef') ? '👨‍🍳' : roleLower.includes('waiter') ? '🛎️' : '👤')

                return (
                  <tr key={staffKey} className={`status-row-${staff.auditState}`}>
                    {/* Employee Name */}
                    <td className="emp-name-col">
                      <div className="emp-avatar">{emoji}</div>
                      <div className="emp-info">
                        <strong className="name-text">{staff.employeeName}</strong>
                        <span className="sub-id">ID: {staff.employeeId || staff.userId || 'N/A'}</span>
                      </div>
                    </td>

                    {/* Role */}
                    <td>
                      <span className={`role-badge role-${roleLower.replace(/[^a-z]/g, '')}`}>
                        {emoji} {staff.role.toUpperCase()}
                      </span>
                    </td>

                    {/* Branch */}
                    <td>
                      <span className="branch-tag">📍 {staff.branchName}</span>
                    </td>

                    {/* Punch In Time */}
                    <td>
                      <span className="time-text">
                        {staff.firstPunchIn
                          ? new Date(staff.firstPunchIn).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Live'}
                      </span>
                    </td>

                    {/* Check In Action Button / Status */}
                    <td className="action-col">
                      {staff.auditState === 'check_in' && (
                        <button
                          className="btn-checkin"
                          onClick={() => handleTriggerAudit(staff)}
                          disabled={isTriggering}
                        >
                          {isTriggering ? (
                            <>⏳ Triggering...</>
                          ) : (
                            <>🔍 Check In</>
                          )}
                        </button>
                      )}

                      {staff.auditState === 'waiting' && (
                        <div className="status-waiting-block">
                          <span className="badge-waiting">
                            <span className="spin-dot" /> ⏳ Waiting for Reply
                          </span>
                          <span className="waiting-subtext">Notification sent to mobile app</span>
                        </div>
                      )}

                      {staff.auditState === 'updated' && (
                        <div className="status-updated-block">
                          <button
                            className="btn-updated-view"
                            onClick={() => setSelectedPhotoAudit(staff.latestAudit)}
                            title="Click to view submitted inspection photos"
                          >
                            ✅ Image Updated ({staff.latestAudit?.photoCount || 1} 📷)
                          </button>
                          {staff.latestAudit?.submittedAt && (
                            <span className="updated-timestamp">
                              {new Date(staff.latestAudit.submittedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal to view submitted photos */}
      {selectedPhotoAudit && (
        <div className="audit-modal-backdrop" onClick={() => setSelectedPhotoAudit(null)}>
          <div className="audit-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📷 Inspection Photo Proof</h3>
              <button className="close-btn" onClick={() => setSelectedPhotoAudit(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-meta">
                <p>
                  <strong>Task:</strong> {selectedPhotoAudit.taskTitle}
                </p>
                {selectedPhotoAudit.submittedAt && (
                  <p>
                    <strong>Submitted At:</strong>{' '}
                    {new Date(selectedPhotoAudit.submittedAt).toLocaleString()}
                  </p>
                )}
                {selectedPhotoAudit.notes && (
                  <p>
                    <strong>Notes:</strong> {selectedPhotoAudit.notes}
                  </p>
                )}
              </div>

              {selectedPhotoAudit.photos && selectedPhotoAudit.photos.length > 0 ? (
                <div className="photos-grid">
                  {selectedPhotoAudit.photos.map((item: any, idx: number) => {
                    const url =
                      item.photoUrl ||
                      (item.photo && typeof item.photo === 'object' ? item.photo.url : '')
                    return (
                      <div key={idx} className="photo-card">
                        <img
                          src={url || '/placeholder.png'}
                          alt={`Audit photo ${idx + 1}`}
                          loading="lazy"
                        />
                        {item.caption && <span className="photo-caption">{item.caption}</span>}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="no-photos">No photos uploaded for this record.</p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-close-modal" onClick={() => setSelectedPhotoAudit(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
