'use client'

import React, { useState } from 'react'
import { useFormFields } from '@payloadcms/ui'

interface CollectionCount {
  name: string
  count: number
}

export const ReportDatabaseActions: React.FC = () => {
  const [testing, setTesting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [dbName, setDbName] = useState<string | null>(null)
  const [collections, setCollections] = useState<CollectionCount[] | null>(null)

  let formEnabled = false
  let formSecondDbUri = ''
  let formSelectedReports: string[] = []

  try {
    const formValues = useFormFields(([fields]) => ({
      enabled: Boolean(fields['enabled']?.value),
      secondDbUri: (fields['secondDbUri']?.value as string) || '',
      selectedReports: Array.isArray(fields['selectedReports']?.value)
        ? (fields['selectedReports']?.value as string[])
        : [],
    }))
    formEnabled = formValues.enabled
    formSecondDbUri = formValues.secondDbUri
    formSelectedReports = formValues.selectedReports
  } catch {
    // Graceful fallback if rendered outside FormContext
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setStatusMessage(null)
    setErrorMessage(null)
    setDbName(null)
    setCollections(null)

    try {
      const res = await fetch('/api/test-report-second-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secondDbUri: formSecondDbUri }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setDbName(data.dbName || 'unknown')
        setCollections(Array.isArray(data.collections) ? data.collections : [])
        setStatusMessage(`Connected successfully to "${data.dbName || 'unknown'}" (read-only mode).`)
      } else {
        setErrorMessage(data.error || 'Failed to connect to Second DB.')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network/server error while testing connection.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--theme-elevation-200)',
        backgroundColor: 'var(--theme-elevation-50)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
            Second DB Report Routing (Read-Only)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--theme-elevation-650)' }}>
            Status:{' '}
            <strong>
              {formEnabled ? 'Active' : 'Disabled'}
            </strong>{' '}
            | Selected Reports: <strong>{formSelectedReports.length}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: testing ? '#6b7280' : '#2563eb',
            color: '#ffffff',
            fontWeight: 500,
            fontSize: '13px',
            cursor: testing ? 'not-allowed' : 'pointer',
          }}
        >
          {testing ? 'Testing Connection...' : 'Test Second DB Connection'}
        </button>
      </div>

      {statusMessage && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            borderRadius: '6px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '13px',
          }}
        >
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            borderRadius: '6px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: '13px',
          }}
        >
          {errorMessage}
        </div>
      )}

      {collections && collections.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '6px',
              color: 'var(--theme-elevation-700)',
            }}
          >
            Collections in {dbName}:
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '8px',
            }}
          >
            {collections.map((col) => (
              <div
                key={col.name}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--theme-elevation-200)',
                  backgroundColor: 'var(--theme-elevation-0)',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{col.name}</span>
                <strong>{col.count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
