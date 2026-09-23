'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Lock, Unlock, Search, RotateCw, Loader2, X } from 'lucide-react'
import './ClosingEntryWidget.scss'

const ClosingEntryWidget: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch('/api/branches?limit=500&sort=name', {
        credentials: 'include',
      })
      if (res.ok) {
        const json = await res.json()
        setBranches(json.docs || [])
      } else {
        const errJson = await res.json().catch(() => null)
        setErrorMessage(errJson?.message || `Failed to fetch branches (HTTP ${res.status})`)
      }
    } catch (e: any) {
      console.error('Failed to fetch branches for widget', e)
      setErrorMessage(e?.message || 'Network error fetching branches')
    } finally {
      setLoading(false)
    }
  }

  const toggleAccess = async (branchId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus
    setUpdatingId(branchId)
    setErrorMessage(null)

    // Optimistic update
    setBranches((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, isClosingEntryEnabled: nextStatus } : b))
    )

    try {
      // 1. Try dedicated endpoint first
      let res = await fetch('/api/branches/toggle-closing-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ branchId, enabled: nextStatus }),
      })

      // 2. Fallback to PATCH /api/branches/:id if dedicated endpoint returns 404
      if (res.status === 404) {
        res = await fetch(`/api/branches/${branchId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ isClosingEntryEnabled: nextStatus }),
        })
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        const errorText = errJson?.message || `Error ${res.status}: Failed to update branch`
        throw new Error(errorText)
      }

      const updatedData = await res.json().catch(() => null)
      if (updatedData && typeof updatedData.isClosingEntryEnabled === 'boolean') {
        setBranches((prev) =>
          prev.map((b) =>
            b.id === branchId ? { ...b, isClosingEntryEnabled: updatedData.isClosingEntryEnabled } : b
          )
        )
      }
    } catch (e: any) {
      console.error('Error toggling branch access', e)
      setErrorMessage(e?.message || 'Failed to update branch access')
      // Revert optimistic update
      setBranches((prev) =>
        prev.map((b) => (b.id === branchId ? { ...b, isClosingEntryEnabled: currentStatus } : b))
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches
    const q = searchQuery.toLowerCase().trim()
    return branches.filter((b) => b.name?.toLowerCase().includes(q))
  }, [branches, searchQuery])

  if (loading) {
    return (
      <div className="closing-widget-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', padding: 20 }}>
          <Loader2 className="animate-spin" size={20} />
          <span>Loading branch closing entry controls...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="closing-widget-container">
      <div className="closing-widget-header">
        <div className="header-text">
          <h3>Closing Entry Access Control</h3>
          <p>Enable the cashier closing entry form for specific branches. (Auto-locks on submission)</p>
        </div>
        <div className="header-controls">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="refresh-btn"
            onClick={fetchBranches}
            title="Refresh branches"
            disabled={loading || !!updatingId}
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="closing-widget-error">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} title="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {filteredBranches.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `No branches matching "${searchQuery}"` : 'No branches found.'}
        </div>
      ) : (
        <div className="closing-widget-grid">
          {filteredBranches.map((branch) => {
            const isEnabled = branch.isClosingEntryEnabled === true
            const isThisUpdating = updatingId === branch.id
            return (
              <div
                key={branch.id}
                className={`branch-toggle-card ${isEnabled ? 'enabled' : 'disabled'}`}
              >
                <div className="branch-info">
                  <strong>{branch.name}</strong>
                </div>
                <button
                  type="button"
                  className="toggle-button"
                  disabled={isThisUpdating}
                  onClick={() => toggleAccess(branch.id, isEnabled)}
                >
                  {isThisUpdating ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : isEnabled ? (
                    <Unlock size={16} />
                  ) : (
                    <Lock size={16} />
                  )}
                  <span>{isThisUpdating ? 'Updating...' : isEnabled ? 'Enabled' : 'Locked'}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ClosingEntryWidget
