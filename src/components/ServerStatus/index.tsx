'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Gutter } from '@payloadcms/ui'
import {
  Cpu,
  Database,
  HardDrive,
  Activity,
  Loader2,
  RefreshCcw,
  Zap,
  Timer,
  Server,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import './index.scss'

interface MetricsPayload {
  cpu: {
    usage: number
    cores: number
    model: string
  }
  memory: {
    totalGB: string
    usedGB: string
    freeGB: string
    percentage: number
  }
  disk: {
    totalGB: string
    usedGB: string
    freeGB: string
    percentage: number
  }
  process: {
    heapUsedMB: number
    heapTotalMB: number
    rssMB: number
  }
  uptime: string
  hostname: string
}

interface HistoricalData {
  time: string
  cpu: number
  memory: number
}

const CircularProgress: React.FC<{
  value: number
  colorClass: string
  icon: React.ReactNode
  label: string
  details: string
}> = ({ value, colorClass, icon, label, details }) => {
  const radius = 55
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="gauge-card">
      <div className="gauge-header">
        <div className={`icon-wrapper ${colorClass}`}>{icon}</div>
        <div className="gauge-meta">
          <h3>{label}</h3>
          <p>{details}</p>
        </div>
      </div>
      <div className="gauge-body">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            className="track"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            className={`progress ${colorClass}`}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="gauge-label">
          <span className="value">{value}%</span>
        </div>
      </div>
    </div>
  )
}

const ServerStatus: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoricalData[]>([])

  const fetchMetrics = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/server-status')
      if (res.ok) {
        const data: MetricsPayload = await res.json()
        setMetrics(data)

        // Update historical tracking data (Max 20 data points)
        setHistory((prev) => {
          const newPoint = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            cpu: data.cpu.usage,
            memory: data.memory.percentage,
          }
          const list = [...prev, newPoint]
          if (list.length > 20) list.shift()
          return list
        })
      } else {
        const errJson = await res.json().catch(() => ({}))
        setError(errJson.message || 'Failed to fetch server metrics')
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching metrics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(() => fetchMetrics(true), 3000) // Poll every 3 seconds
    return () => clearInterval(interval)
  }, [fetchMetrics])

  if (loading && !metrics) {
    return (
      <div className="server-monitor-loading">
        <Loader2 className="animate-spin" size={48} color="#06b6d4" />
        <p>Loading live server metrics...</p>
      </div>
    )
  }

  return (
    <Gutter className="server-monitor-wrapper">
      <div className="monitor-header">
        <div className="title-section">
          <h1>Server Live Monitoring</h1>
          <p>Real-time server performance diagnostics</p>
        </div>
        <div className="header-actions">
          {metrics && (
            <div className="status-badge online">
              <span className="dot animate-pulse"></span>
              Live Tracking
            </div>
          )}
          <button className="btn-refresh" onClick={() => fetchMetrics()} disabled={refreshing}>
            <RefreshCcw className={refreshing ? 'animate-spin' : ''} size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="monitor-error-banner">{error}</div>}

      {metrics && (
        <>
          {/* Quick Stats Grid */}
          <div className="stats-strip">
            <div className="strip-card">
              <div className="icon"><Server size={18} /></div>
              <div className="meta">
                <span>Hostname</span>
                <strong>{metrics.hostname}</strong>
              </div>
            </div>
            <div className="strip-card">
              <div className="icon"><Timer size={18} /></div>
              <div className="meta">
                <span>Uptime</span>
                <strong>{metrics.uptime}</strong>
              </div>
            </div>
            <div className="strip-card">
              <div className="icon"><Zap size={18} /></div>
              <div className="meta">
                <span>CPU Model</span>
                <strong>{metrics.cpu.model.replace(/\(R\)/gi, '').replace(/\(TM\)/gi, '')}</strong>
              </div>
            </div>
          </div>

          {/* Core Gauges */}
          <div className="gauges-grid">
            <CircularProgress
              value={metrics.cpu.usage}
              colorClass="cyan"
              icon={<Cpu size={20} />}
              label="CPU Load"
              details={`${metrics.cpu.cores} Cores Active`}
            />
            <CircularProgress
              value={metrics.memory.percentage}
              colorClass="blue"
              icon={<Activity size={20} />}
              label="System Memory"
              details={`${metrics.memory.usedGB} GB of ${metrics.memory.totalGB} GB`}
            />
            <CircularProgress
              value={metrics.disk.percentage}
              colorClass="orange"
              icon={<HardDrive size={20} />}
              label="SSD Storage"
              details={`${metrics.disk.usedGB} GB of ${metrics.disk.totalGB} GB`}
            />
          </div>

          {/* Historical Utilization Line Chart */}
          <div className="chart-panel">
            <div className="panel-header">
              <h2>Utilization Trends</h2>
              <span>Real-time (polling every 3s)</span>
            </div>
            <div className="chart-container" style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#52525b" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#52525b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: 'rgba(39, 39, 42, 0.8)',
                      borderRadius: '8px',
                      color: '#ffffff',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    name="CPU (%)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCpu)"
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    name="RAM (%)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMemory)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Node Process Metrics */}
          <div className="process-panel">
            <div className="panel-header">
              <h2>Node.js Process Diagnostics</h2>
            </div>
            <div className="process-grid">
              <div className="process-metric-card">
                <Database size={16} color="#06b6d4" />
                <div className="metric-info">
                  <span>Heap Memory Used</span>
                  <strong>{metrics.process.heapUsedMB} MB</strong>
                </div>
              </div>
              <div className="process-metric-card">
                <Database size={16} color="#3b82f6" />
                <div className="metric-info">
                  <span>Heap Total Allocated</span>
                  <strong>{metrics.process.heapTotalMB} MB</strong>
                </div>
              </div>
              <div className="process-metric-card">
                <Database size={16} color="#f97316" />
                <div className="metric-info">
                  <span>Resident Set Size (RSS)</span>
                  <strong>{metrics.process.rssMB} MB</strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Gutter>
  )
}

export default ServerStatus
