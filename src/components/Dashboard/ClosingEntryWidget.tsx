'use client'

import React, { useEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import './ClosingEntryWidget.scss'

const DASHBOARD_API_BASE_URL = 'https://blackforest.vseyal.com'

const ClosingEntryWidget: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${DASHBOARD_API_BASE_URL}/api/branches?limit=100&sort=name`)
      if (res.ok) {
        const json = await res.json()
        setBranches(json.docs || [])
      }
    } catch (e) {
      console.error('Failed to fetch branches for widget', e)
    } finally {
      setLoading(false)
    }
  }

  const toggleAccess = async (branchId: string, currentStatus: boolean) => {
    try {
      // Optimistic update
      setBranches((prev) =>
        prev.map((b) => (b.id === branchId ? { ...b, isClosingEntryEnabled: !currentStatus } : b))
      )

      const res = await fetch(`${DASHBOARD_API_BASE_URL}/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isClosingEntryEnabled: !currentStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to update')
      }
    } catch (e) {
      console.error('Error toggling branch access', e)
      // Revert on error
      fetchBranches()
    }
  }

  if (loading) {
    return <div className="closing-widget-container"><p>Loading branch controls...</p></div>
  }

  if (branches.length === 0) {
    return null
  }

  return (
    <div className="closing-widget-container">
      <div className="closing-widget-header">
        <h3>Closing Entry Access Control</h3>
        <p>Enable the cashier closing entry form for specific branches. (Auto-locks on submission)</p>
      </div>
      <div className="closing-widget-grid">
        {branches.map((branch) => {
          const isEnabled = branch.isClosingEntryEnabled === true
          return (
            <div key={branch.id} className={`branch-toggle-card ${isEnabled ? 'enabled' : 'disabled'}`}>
              <div className="branch-info">
                <strong>{branch.name}</strong>
              </div>
              <button
                className="toggle-button"
                onClick={() => toggleAccess(branch.id, isEnabled)}
              >
                {isEnabled ? <Unlock size={16} /> : <Lock size={16} />}
                <span>{isEnabled ? 'Enabled' : 'Locked'}</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ClosingEntryWidget
