'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Gutter } from '@payloadcms/ui'
import { RefreshCcw, Download, Upload, Zap, Timer, Wifi, WifiOff, Activity } from 'lucide-react'
import Select, { StylesConfig } from 'react-select'
import dayjs from 'dayjs'
import './index.scss'

interface BranchStatus {
  id: string
  name: string
  ipAddress: string
  status: 'online' | 'offline'
  latency: string
  lastChecked: string
}

interface SelectOption extends BranchStatus {
  value: string
  label: string
}

const customStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    borderColor: state.isFocused ? '#06b6d4' : 'rgba(39, 39, 42, 0.5)',
    borderRadius: '12px',
    height: '48px',
    minHeight: '48px',
    boxShadow: 'none',
    color: '#ffffff',
    backdropFilter: 'blur(12px)',
    '&:hover': {
      borderColor: '#06b6d4',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: '#ffffff',
    fontWeight: '500',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#06b6d4'
      : state.isFocused
        ? 'rgba(39, 39, 42, 0.5)'
        : 'transparent',
    color: '#ffffff',
    cursor: 'pointer',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#18181b',
    border: '1px solid rgba(39, 39, 42, 0.5)',
    borderRadius: '12px',
    overflow: 'hidden',
    zIndex: 9999,
  }),
  input: (base) => ({
    ...base,
    color: '#ffffff',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#71717a',
  }),
}

const Gauge: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const percentage = Math.min(value / max, 1)

  return (
    <div className="gauge-container">
      <svg className="gauge-svg" viewBox="0 0 200 150">
        {/* Background track */}
        <path
          d="M 40 140 A 80 80 0 1 1 160 140"
          fill="none"
          stroke="rgba(39, 39, 42, 0.5)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Progress track */}
        <path
          d="M 40 140 A 80 80 0 1 1 160 140"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{
            strokeDashoffset:
              circumference - 0.75 * circumference + 0.75 * circumference * (1 - percentage),
            transition: 'stroke-dashoffset 0.3s ease-out',
          }}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="gauge-value">
        <span className="number">{value.toFixed(2)}</span>
        <span className="unit">Mbps</span>
      </div>
    </div>
  )
}

const NetworkStatus: React.FC = () => {
  const [statuses, setStatuses] = useState<BranchStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Speed Test State
  const [selectedBranch, setSelectedBranch] = useState<SelectOption | null>(null)
  const [testState, setTestState] = useState<'idle' | 'testing' | 'results'>('idle')
  const [testPhase, setTestPhase] = useState<'ping' | 'download' | 'upload' | 'idle'>('idle')
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [results, setResults] = useState({
    download: 0,
    upload: 0,
    ping: 0,
    jitter: 0,
  })

  const fetchStatuses = useCallback(async (isAuto = false) => {
    if (!isAuto) setLoading(true)
    setRefreshing(true)
    try {
      const res = await fetch('/api/network-status')
      if (res.ok) {
        const data = await res.json()
        setStatuses(data)
        setLastUpdated(new Date().toISOString())
      }
    } catch (error) {
      console.error('Error fetching network statuses:', error)
    } finally {
      if (!isAuto) setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStatuses()
    const interval = setInterval(() => fetchStatuses(true), 30000)
    return () => clearInterval(interval)
  }, [fetchStatuses])

  const runSpeedTest = async () => {
    if (!selectedBranch) return

    setTestState('testing')
    setResults({ download: 0, upload: 0, ping: 0, jitter: 0 })

    try {
      // Phase 1: Ping
      setTestPhase('ping')
      const pings: number[] = []
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        await fetch(`/api/speedtest/ping?t=${Date.now()}`) // Lightweight request for ping
        const end = performance.now()
        pings.push(end - start)
        const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length
        const jitter =
          pings.length > 1 ? Math.abs(pings[pings.length - 1] - pings[pings.length - 2]) : 0
        setResults((prev) => ({ ...prev, ping: avgPing, jitter }))
        await new Promise((r) => setTimeout(r, 100))
      }

      // Phase 2: Download
      setTestPhase('download')
      const dlStart = performance.now()
      const res = await fetch(`/api/speedtest/download?t=${Date.now()}`, {
        headers: { 'Accept-Encoding': 'identity' },
      })
      if (!res.body) throw new Error('No body')

      const reader = res.body.getReader()
      let loaded = 0
      const _total = Number(res.headers.get('Content-Length')) || 10 * 1024 * 1024

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        loaded += value.length
        const ellapsed = (performance.now() - dlStart) / 1000
        const bps = (loaded * 8) / ellapsed
        const mbps = bps / (1024 * 1024)
        setCurrentSpeed(mbps)
      }
      const dlEnd = performance.now()
      const finalDlMbps = (loaded * 8) / ((dlEnd - dlStart) / 1000) / (1024 * 1024)
      setResults((prev) => ({ ...prev, download: finalDlMbps }))

      // Phase 3: Upload
      setTestPhase('upload')
      const ulStart = performance.now()
      const ulData = new Uint8Array(5 * 1024 * 1024).fill(120) // 5MB upload

      const ulRes = await fetch('/api/speedtest/upload', {
        method: 'POST',
        body: ulData,
      })

      if (!ulRes.ok) throw new Error('Upload failed')

      const ulEnd = performance.now()
      const finalUlMbps = (ulData.length * 8) / ((ulEnd - ulStart) / 1000) / (1024 * 1024)
      setResults((prev) => ({ ...prev, upload: finalUlMbps }))
      setCurrentSpeed(finalUlMbps)
    } catch (error) {
      console.error('Speed test error:', error)
    } finally {
      setTestPhase('idle')
      setTestState('results')
      setCurrentSpeed(0)
    }
  }

  return (
    <div className="network-status-page">
      <Gutter>
        <div className="header-row">
          <h1>Live Branch Internet Tracker</h1>
          <div className="last-updated">
            {lastUpdated && <span>Last checked: {dayjs(lastUpdated).format('HH:mm:ss')}</span>}
            <RefreshCcw
              size={18}
              className={`refresh-icon ${!refreshing ? 'stopped' : ''}`}
              onClick={() => fetchStatuses()}
              style={{ cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Speed Test Section */}
        <div className="speed-test-section">
          <div className="speed-test-controls">
            <Select
              options={statuses.map((s) => ({ value: s.id, label: s.name, ...s }))}
              value={selectedBranch}
              onChange={setSelectedBranch}
              placeholder="Select Branch to Test"
              styles={customStyles}
              isSearchable
            />
          </div>

          <div className="speed-test-main">
            {testState === 'idle' ? (
              <div className="go-button-container">
                <div className="pulse-ring"></div>
                <button
                  className={`go-button ${selectedBranch ? 'active' : ''}`}
                  onClick={runSpeedTest}
                  disabled={!selectedBranch}
                >
                  GO
                </button>
              </div>
            ) : (
              <>
                <Gauge
                  value={
                    currentSpeed ||
                    (testPhase === 'download' ? results.download : results.upload) ||
                    0
                  }
                  max={100}
                />

                <div className="results-grid">
                  <div className="result-item">
                    <div className="result-label">
                      <div className="icon-box download">
                        <Download size={16} />
                      </div>
                      Download
                    </div>
                    <div className="result-value">
                      {results.download.toFixed(2)}
                      <span className="unit">Mbps</span>
                    </div>
                    <div className="result-sub">
                      <div className="sub-item">
                        <Zap size={14} /> {results.ping.toFixed(0)} ms
                      </div>
                      <div className="sub-item">
                        <Timer size={14} /> {results.jitter.toFixed(1)} ms
                      </div>
                    </div>
                  </div>

                  <div className="result-item">
                    <div className="result-label">
                      <div className="icon-box upload">
                        <Upload size={16} />
                      </div>
                      Upload
                    </div>
                    <div className="result-value">
                      {results.upload.toFixed(2)}
                      <span className="unit">Mbps</span>
                    </div>
                  </div>
                </div>

                {testState === 'results' && (
                  <button
                    className="export-btn"
                    style={{ marginTop: '20px' }}
                    onClick={() => setTestState('idle')}
                  >
                    Test Again
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <RefreshCcw size={48} className="spinner" />
            <p>Scanning branches...</p>
          </div>
        ) : (
          <div className="status-grid">
            {statuses.length > 0 ? (
              statuses.map((branch) => (
                <div key={branch.id} className={`branch-card ${branch.status}`}>
                  <div className="card-header">
                    <h3>{branch.name}</h3>
                    <div className="status-dot"></div>
                  </div>
                  <div className="card-body">
                    <div className="info-row">
                      <span className="label">Status</span>
                      <span
                        className="value"
                        style={{
                          color: branch.status === 'online' ? '#22c55e' : '#ef4444',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                        }}
                      >
                        {branch.status === 'online' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Wifi size={14} /> Online
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <WifiOff size={14} /> Offline
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">IP Address</span>
                      <span className="value">{branch.ipAddress}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Latency</span>
                      <span className="value">
                        {branch.status === 'online' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Activity size={14} /> {branch.latency}
                          </span>
                        ) : (
                          '---'
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">
                <p>No branches with IP addresses found.</p>
              </div>
            )}
          </div>
        )}
      </Gutter>
    </div>
  )
}

export default NetworkStatus
