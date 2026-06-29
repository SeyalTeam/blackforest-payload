'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
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
  Terminal,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
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
  currentTime?: string
  logs?: {
    timestamp: string
    text: string
    stream: 'stdout' | 'stderr'
  }[]
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

  const consoleEndRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [streamFilter, setStreamFilter] = useState<'all' | 'stdout' | 'stderr'>('all')
  const [timeFilter, setTimeFilter] = useState<'30m' | '1h' | '12h' | '1d' | '3d' | '1w' | '2w'>('30m')
  const [liveMode, setLiveMode] = useState(true)
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null)

  const getRequestType = (text: string): string => {
    const match = text.match(/(GET|POST|PUT|DELETE|PATCH|OPTIONS)\s+(\/[^\s?]*)/i)
    if (match) {
      return `${match[1].toUpperCase()} ${match[2]}`
    }
    if (text.toLowerCase().includes('mongo')) return 'MONGO'
    if (text.toLowerCase().includes('payload')) return 'PAYLOAD'
    return 'SYSTEM'
  }

  const getHttpStatusCode = (text: string, stream: 'stdout' | 'stderr'): string => {
    try {
      if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        const parsed = JSON.parse(text)
        if (parsed.status) return String(parsed.status)
        if (parsed.res?.statusCode) return String(parsed.res.statusCode)
      }
    } catch (_e) {}

    const match = text.match(/(?:GET|POST|PUT|DELETE|PATCH|OPTIONS)\s+\/[^\s?]*.*\s+([1-5]\d{2})(?:\s+|$|\b)/i)
    if (match) {
      return match[1]
    }
    return stream === 'stderr' ? 'ERR' : 'INF'
  }

  const getFilteredLogsByTime = () => {
    const now = metrics?.currentTime ? new Date(metrics.currentTime).getTime() : new Date().getTime()
    let rangeMs = 30 * 60 * 1000 // default 30m
    if (timeFilter === '1h') rangeMs = 60 * 60 * 1000
    else if (timeFilter === '12h') rangeMs = 12 * 60 * 60 * 1000
    else if (timeFilter === '1d') rangeMs = 24 * 60 * 60 * 1000
    else if (timeFilter === '3d') rangeMs = 3 * 24 * 60 * 60 * 1000
    else if (timeFilter === '1w') rangeMs = 7 * 24 * 60 * 60 * 1000
    else if (timeFilter === '2w') rangeMs = 14 * 24 * 60 * 60 * 1000

    return (metrics?.logs || []).filter((log) => {
      const logTime = new Date(log.timestamp).getTime()
      const matchesTime = now - logTime <= rangeMs
      const matchesSearch = log.text.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStream = streamFilter === 'all' || log.stream === streamFilter
      return matchesTime && matchesSearch && matchesStream
    })
  }

  const filteredLogs = getFilteredLogsByTime()

  const downloadLogs = () => {
    const textContent = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.stream.toUpperCase()}] ${l.text}`)
      .join('\n')
    const blob = new Blob([textContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `server_logs_${new Date().toISOString().replace(/:/g, '-')}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    // Auto-scroll disabled per user instruction
  }, [metrics?.logs])

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
    let interval: any
    if (liveMode) {
      interval = setInterval(() => fetchMetrics(true), 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [fetchMetrics, liveMode])

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

          {/* Live Terminal Console Logs */}
          <div className="terminal-panel vercel-theme">
            <div className="panel-header">
              <div className="title-area">
                <Terminal size={16} color="#00ff00" />
                <h2>Real-Time Console Logs</h2>
              </div>
              <div className="terminal-actions">
                <button
                  className={`btn-action live-toggle ${liveMode ? 'active' : ''}`}
                  onClick={() => setLiveMode(!liveMode)}
                >
                  <span className={`live-dot ${liveMode ? 'heartbeat' : ''}`} />
                  {liveMode ? 'Live (On)' : 'Live (Paused)'}
                </button>
                <div className="time-select-container">
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as any)}
                    className="time-dropdown"
                  >
                    <option value="30m">Last 30 minutes</option>
                    <option value="1h">Last hour</option>
                    <option value="12h">Last 12 hours</option>
                    <option value="1d">Last day</option>
                    <option value="3d">Last 3 days</option>
                    <option value="1w">Last week</option>
                    <option value="2w">Last 2 weeks</option>
                  </select>
                </div>
                <button className="btn-action download" onClick={downloadLogs} title="Download Logs">
                  <Download size={14} />
                  Export
                </button>
              </div>
            </div>

            {/* Vercel Style Toolbar */}
            <div className="terminal-toolbar">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="filter-pills">
                <button
                  className={`pill ${streamFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStreamFilter('all')}
                >
                  All Logs
                </button>
                <button
                  className={`pill ${streamFilter === 'stdout' ? 'active' : ''}`}
                  onClick={() => setStreamFilter('stdout')}
                >
                  System Info
                </button>
                <button
                  className={`pill ${streamFilter === 'stderr' ? 'active' : ''}`}
                  onClick={() => setStreamFilter('stderr')}
                >
                  Errors
                </button>
              </div>
            </div>

            {/* Vercel Logs Grid Table */}
            <div className="terminal-body scroll-manual">
              <div className="terminal-table-header">
                <span className="col-time">Time</span>
                <span className="col-status">Status</span>
                <span className="col-host">Host</span>
                <span className="col-request">Request</span>
                <span className="col-message">Messages</span>
              </div>
              <div className="terminal-scroll">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log, index) => {
                    const isExpanded = expandedLogIndex === index
                    const statusCode = getHttpStatusCode(log.text, log.stream)
                    let statusClass = 'status-inf'
                    if (statusCode === 'ERR') statusClass = 'status-err'
                    else if (statusCode.startsWith('2')) statusClass = 'status-2xx'
                    else if (statusCode.startsWith('3')) statusClass = 'status-3xx'
                    else if (statusCode.startsWith('4')) statusClass = 'status-4xx'
                    else if (statusCode.startsWith('5')) statusClass = 'status-5xx'

                    return (
                      <div key={index} className="log-row-container">
                        <div
                          className={`log-row ${log.stream} ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => setExpandedLogIndex(isExpanded ? null : index)}
                        >
                          <span className="col-time">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="col-status">
                            <span className={`status-badge ${statusClass}`}>
                              {statusCode}
                            </span>
                          </span>
                          <span className="col-host">{metrics.hostname}</span>
                          <span className="col-request">{getRequestType(log.text)}</span>
                          <span className="col-message">{log.text}</span>
                        </div>
                        {isExpanded && (
                          <div className="log-details">
                            <div className="detail-field">
                              <strong>Timestamp:</strong> <span>{log.timestamp} ({new Date(log.timestamp).toLocaleString()})</span>
                            </div>
                            <div className="detail-field">
                              <strong>Stream:</strong> <span>{log.stream === 'stderr' ? 'stderr (Error)' : 'stdout (Info)'}</span>
                            </div>
                            <div className="detail-field">
                              <strong>Host:</strong> <span>{metrics.hostname}</span>
                            </div>
                            <div className="detail-field">
                              <strong>Request Type:</strong> <span>{getRequestType(log.text)}</span>
                            </div>
                            <div className="detail-field raw-text">
                              <strong>Full Message:</strong>
                              <pre>{log.text}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="empty-logs">No matching logs found.</div>
                )}
                <div ref={consoleEndRef} style={{ height: 1 }} />
              </div>
            </div>
          </div>
        </>
      )}
    </Gutter>
  )
}

export default ServerStatus
