'use client'

import React, { useState } from 'react'
import { useFormFields } from '@payloadcms/ui'

export const DatabaseSyncActions: React.FC = () => {
  const [syncing, setSyncing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<any>(null)
  const [counts, setCounts] = useState<any>(null)
  const [dbNames, setDbNames] = useState<{ src?: string; tgt?: string } | null>(null)

  let formSourceDbUri: string | undefined
  let formTargetDbUri: string | undefined
  let formCollections: string[] | undefined

  try {
    const formValues = useFormFields(([fields]) => ({
      sourceDbUri: fields['sourceDbUri']?.value as string,
      targetDbUri: fields['targetDbUri']?.value as string,
      collections: fields['collections']?.value as string[],
    }))
    formSourceDbUri = formValues.sourceDbUri
    formTargetDbUri = formValues.targetDbUri
    formCollections = formValues.collections
  } catch {
    // If rendered outside FormContext, fall back gracefully
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    setMessage(null)
    setError(null)
    setDetails(null)

    try {
      const payloadBody: any = {}
      if (formSourceDbUri) payloadBody.sourceDbUri = formSourceDbUri
      if (formTargetDbUri) payloadBody.targetDbUri = formTargetDbUri
      if (formCollections && formCollections.length > 0) payloadBody.collections = formCollections

      const res = await fetch('/api/trigger-database-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setMessage('✅ ' + data.message)
        setDetails(data.details)
      } else {
        setError('❌ Sync Error: ' + (data.message || data.error || 'Failed to sync'))
        if (data.details) setDetails(data.details)
      }
    } catch (err: any) {
      setError('❌ Network/Server Error: ' + (err.message || String(err)))
    } finally {
      setSyncing(false)
    }
  }

  const handleCheckCounts = async () => {
    setChecking(true)
    setMessage(null)
    setError(null)
    setCounts(null)
    setDbNames(null)

    try {
      const payloadBody: any = {}
      if (formSourceDbUri) payloadBody.sourceDbUri = formSourceDbUri
      if (formTargetDbUri) payloadBody.targetDbUri = formTargetDbUri
      if (formCollections && formCollections.length > 0) payloadBody.collections = formCollections

      const res = await fetch('/api/check-database-sync-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setCounts(data.counts)
        if (data.sourceDbName || data.targetDbName) {
          setDbNames({ src: data.sourceDbName, tgt: data.targetDbName })
        }
      } else {
        setError('❌ Connection / Count Error: ' + (data.error || 'Failed to fetch counts'))
      }
    } catch (err: any) {
      setError('❌ Network/Server Error: ' + (err.message || String(err)))
    } finally {
      setChecking(false)
    }
  }

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        margin: '16px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
            ⚡ Database Sync Actions
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Verify connection counts or run synchronization immediately.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleCheckCounts}
            disabled={checking || syncing}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#334155',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: checking || syncing ? 'not-allowed' : 'pointer',
              opacity: checking || syncing ? 0.6 : 1,
            }}
          >
            {checking ? 'Checking Counts...' : '📊 Check DB Counts'}
          </button>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing || checking}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '6px',
              cursor: syncing || checking ? 'not-allowed' : 'pointer',
              opacity: syncing || checking ? 0.6 : 1,
            }}
          >
            {syncing ? 'Syncing...' : '🚀 Sync Now (DB 2 ➔ DB 1)'}
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {dbNames && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b' }}>
          Connected Databases: <strong>DB2 Source:</strong> {dbNames.src || 'default'} |{' '}
          <strong>DB1 Target:</strong> {dbNames.tgt || 'default'}
        </div>
      )}

      {counts && (
        <div style={{ marginTop: '14px', overflowX: 'auto' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            Live Collection Document Counts:
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>Collection</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>DB 2 (Source)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>DB 1 (Target)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(counts).map(([col, c]: [string, any]) => (
                <tr key={col} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                    {col}
                    {c.matchedCollection && (
                      <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                        (matched table: {c.matchedCollection})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#0284c7', fontWeight: 600 }}>{c.db2Count}</td>
                  <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 600 }}>{c.db1Count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {details && Object.keys(details).length > 0 && (
        <div style={{ marginTop: '14px', overflowX: 'auto' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            Sync Details by Collection:
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>Collection</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>DB 2 Total</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>DB 1 Before</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>Newly Added</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>Skipped (Existing)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>DB 1 Total Now</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(details).map(([col, d]: [string, any]) => (
                <tr key={col} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                    {col}
                    {d.matchedCollection && (
                      <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                        ({d.matchedCollection})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{d.sourceCount}</td>
                  <td style={{ padding: '8px 12px' }}>{d.targetCountBefore}</td>
                  <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 600 }}>+{d.inserted}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{d.skipped}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d.targetCountAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
