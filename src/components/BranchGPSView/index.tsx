'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  MapPin,
  Users,
  Navigation,
  RefreshCw,
  Search,
  Phone,
  Mail,
  Clock,
  Radio,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Eye,
  Crosshair,
  Building2,
} from 'lucide-react'
import './index.scss'

export type PersonPresence = {
  id: string
  userId?: string | null
  employeeId?: string | null
  name: string
  role: string
  phoneNumber?: string
  email?: string
  photoUrl?: string | null
  status: 'active' | 'on_break' | 'closed' | 'assigned'
  isInside: boolean
  punchIn?: string | null
  punchOut?: string | null
  latitude?: number | null
  longitude?: number | null
  distanceMeters: number
  ipAddress?: string
  device?: string
}

export type BranchGPSData = {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  branchPin?: string
  hasGps: boolean
  latitude: number
  longitude: number
  radius: number
  ipAddress?: string
  printerIp?: string
  personsInsideCount: number
  persons: PersonPresence[]
}

export type GPSResponse = {
  branches: BranchGPSData[]
  stats: {
    totalBranches: number
    branchesWithGps: number
    totalPersonsInside: number
    totalActiveClockedIn: number
    today: string
  }
}

const ROLE_EMOJIS: Record<string, string> = {
  chef: '👨‍🍳',
  waiter: '🛎️',
  manager: '👔',
  cashier: '💰',
  supervisor: '📋',
  delivery: '🛵',
  driver: '🚚',
  kitchen: '🍳',
  store_keeper: '📦',
  account: '📊',
  admin: '🛡️',
}

export default function BranchGPSView() {
  const [data, setData] = useState<GPSResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(true)

  // Floating hover details card state
  const [hoveredPerson, setHoveredPerson] = useState<{
    person: PersonPresence
    branchName: string
    radius: number
  } | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layerGroupRef = useRef<any>(null)
  const [leafletLib, setLeafletLib] = useState<any>(null)

  // 1. Fetch GPS presence data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/work-gps')
      if (res.ok) {
        const json: GPSResponse = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to load GPS branch presence:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 2. Dynamically import Leaflet on client side
  useEffect(() => {
    let mounted = true
    Promise.all([
      import('leaflet'),
      // @ts-expect-error leaflet css import
      import('leaflet/dist/leaflet.css').catch(() => null),
    ]).then(([L]) => {
      if (mounted) {
        setLeafletLib(L.default || L)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  // 3. Initialize Leaflet map
  useEffect(() => {
    if (!leafletLib || !mapContainerRef.current || mapInstanceRef.current) return

    const L = leafletLib
    // Initialize map centered around standard coordinates (Tamil Nadu / Tuticorin default)
    const map = L.map(mapContainerRef.current, {
      center: [8.7642, 78.1348],
      zoom: 13,
      zoomControl: false,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)
    layerGroupRef.current = layerGroup
    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      layerGroupRef.current = null
    }
  }, [leafletLib])

  // Filtered branches
  const filteredBranches = useMemo(() => {
    if (!data?.branches) return []
    return data.branches.filter((b) => {
      if (selectedBranchId !== 'all' && b.id !== selectedBranchId) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesBranch = b.name.toLowerCase().includes(q)
        const matchesStaff = b.persons.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.role.toLowerCase().includes(q) ||
            (p.employeeId && p.employeeId.toLowerCase().includes(q)),
        )
        if (!matchesBranch && !matchesStaff) return false
      }
      return true
    })
  }, [data, selectedBranchId, searchQuery])

  // 4. Update Map Circles & Markers when data or filters change
  useEffect(() => {
    if (!leafletLib || !mapInstanceRef.current || !layerGroupRef.current || !data) return

    const L = leafletLib
    const map = mapInstanceRef.current
    const layerGroup = layerGroupRef.current
    layerGroup.clearLayers()

    const bounds: [number, number][] = []

    filteredBranches.forEach((branch) => {
      if (!branch.hasGps && !branch.latitude) return

      const branchPos: [number, number] = [branch.latitude, branch.longitude]
      bounds.push(branchPos)

      // 4A. Draw Branch GPS Circle (Geofence)
      const circle = L.circle(branchPos, {
        radius: branch.radius || 100,
        color: branch.personsInsideCount > 0 ? '#10b981' : '#3b82f6',
        fillColor: branch.personsInsideCount > 0 ? '#10b981' : '#3b82f6',
        fillOpacity: 0.18,
        weight: 2,
        dashArray: '5, 5',
      })
      circle.addTo(layerGroup)

      // 4B. Branch Center Marker
      const branchHtml = `
        <div class="branch-pin-bubble">
          <div class="branch-badge">
            <span class="branch-name-label">${branch.name}</span>
            <span class="staff-count-tag ${branch.personsInsideCount === 0 ? 'zero' : ''}">
              ${branch.personsInsideCount} Inside
            </span>
          </div>
          <div class="branch-pin-head">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
        </div>
      `

      const branchIcon = L.divIcon({
        className: 'branch-marker-icon',
        html: branchHtml,
        iconSize: [120, 50],
        iconAnchor: [60, 50],
      })

      const branchMarker = L.marker(branchPos, { icon: branchIcon }).addTo(layerGroup)
      branchMarker.on('click', () => {
        map.flyTo(branchPos, 17, { duration: 1.2 })
      })

      // 4C. Person Markers Inside Branch Circle
      branch.persons.forEach((person) => {
        if (!person.latitude || !person.longitude) return

        const personPos: [number, number] = [person.latitude, person.longitude]
        bounds.push(personPos)

        const initials = person.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()

        const statusClass =
          person.status === 'on_break'
            ? 'break'
            : person.status === 'assigned'
            ? 'assigned'
            : person.status === 'active'
            ? 'active'
            : 'closed'

        const avatarInner = person.photoUrl
          ? `<img src="${person.photoUrl}" alt="${person.name}" />`
          : `<span class="initials">${initials || 'ST'}</span>`

        const personHtml = `
          <div class="person-avatar-pin" data-person-id="${person.id}">
            ${avatarInner}
            <span class="status-indicator ${statusClass}"></span>
            ${person.status === 'active' ? '<div class="radar-ring"></div>' : ''}
          </div>
        `

        const personIcon = L.divIcon({
          className: 'person-marker-icon',
          html: personHtml,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const personMarker = L.marker(personPos, { icon: personIcon }).addTo(layerGroup)

        // Mouse hover on map marker -> display rich person detail card
        personMarker.on('mouseover', (e: any) => {
          const domEvent = e.originalEvent
          setHoveredPerson({
            person,
            branchName: branch.name,
            radius: branch.radius,
          })
          setHoverPos({
            x: domEvent.clientX + 16,
            y: domEvent.clientY - 40,
          })
        })

        personMarker.on('mousemove', (e: any) => {
          const domEvent = e.originalEvent
          setHoverPos({
            x: domEvent.clientX + 16,
            y: domEvent.clientY - 40,
          })
        })

        personMarker.on('mouseout', () => {
          setHoveredPerson(null)
          setHoverPos(null)
        })
      })
    })

    // Fit map bounds if markers exist
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 16)
      } else {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 })
      }
    }
  }, [leafletLib, filteredBranches, data])

  // Center map onto a specific branch
  const handleZoomToBranch = (branch: BranchGPSData) => {
    if (!mapInstanceRef.current || !branch.latitude || !branch.longitude) return
    mapInstanceRef.current.flyTo([branch.latitude, branch.longitude], 17, { duration: 1.2 })
  }

  // Format date / punch times
  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Not clocked in today'
    try {
      const d = new Date(dateStr)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="branch-gps-container">
      {/* 1. Header Toolbar */}
      <div className="gps-header">
        <div className="gps-title-area">
          <div className="gps-icon-badge">
            <Radio size={20} />
          </div>
          <div>
            <h1>Branch GPS & Staff Presence</h1>
            <p>Live geofence circles and staff count inside each branch</p>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="gps-stats-strip">
          <div className="stat-pill">
            <Building2 size={14} />
            <span>Branches:</span>
            <span className="stat-val">{data?.stats.totalBranches || 0}</span>
          </div>
          <div className="stat-pill active-pill">
            <Users size={14} />
            <span>Persons Inside Geofence:</span>
            <span className="stat-val">{data?.stats.totalPersonsInside || 0}</span>
          </div>
          <div className="stat-pill">
            <ShieldCheck size={14} />
            <span>Active Clocked In:</span>
            <span className="stat-val">{data?.stats.totalActiveClockedIn || 0}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="gps-actions">
          <select
            className="gps-select"
            value={selectedBranchId}
            onChange={(e) => {
              const val = e.target.value
              setSelectedBranchId(val)
              if (val !== 'all') {
                const b = data?.branches.find((br) => br.id === val)
                if (b) handleZoomToBranch(b)
              }
            }}
          >
            <option value="all">🌐 All Branches</option>
            {data?.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.personsInsideCount} inside)
              </option>
            ))}
          </select>

          <button
            className={`gps-refresh-btn ${loading ? 'loading' : ''}`}
            onClick={() => fetchData()}
            title="Refresh Live GPS Data"
          >
            <RefreshCw size={14} />
            <span>Sync</span>
          </button>

          <button
            className="drawer-toggle-btn"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            title={isPanelOpen ? 'Collapse side panel' : 'Expand side panel'}
          >
            <Eye size={14} />
            <span>{isPanelOpen ? 'Hide Panel' : 'Show Panel'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="gps-content-area">
        {/* Leaflet Map Wrapper */}
        <div className="gps-map-wrapper">
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* 3. Floating Hover Detail Card for Person */}
        {hoveredPerson && hoverPos && (
          <div
            className="person-hover-card"
            style={{
              left: `${Math.min(hoverPos.x, window.innerWidth - 340)}px`,
              top: `${Math.max(10, Math.min(hoverPos.y, window.innerHeight - 340))}px`,
            }}
          >
            {/* Hover Card Header */}
            <div className="hover-card-header">
              <div className="hover-avatar-box">
                {hoveredPerson.person.photoUrl ? (
                  <img
                    src={hoveredPerson.person.photoUrl}
                    alt={hoveredPerson.person.name}
                  />
                ) : (
                  <div className="hover-fallback-avatar">
                    {hoveredPerson.person.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="hover-title-info">
                <h3 className="hover-person-name">{hoveredPerson.person.name}</h3>
                <div>
                  <span className="hover-role-badge">
                    {ROLE_EMOJIS[hoveredPerson.person.role.toLowerCase()] || '👤'}{' '}
                    {hoveredPerson.person.role}
                  </span>
                  {hoveredPerson.person.employeeId && (
                    <span className="hover-empid">#{hoveredPerson.person.employeeId}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Hover Card Body */}
            <div className="hover-card-body">
              {/* Geofence Status Badge */}
              <div className="hover-geofence-alert">
                <span className="inside-dot"></span>
                <span>
                  Inside {hoveredPerson.branchName} GPS Circle (
                  {hoveredPerson.person.distanceMeters}m from center)
                </span>
              </div>

              <div className="hover-detail-row">
                <span className="detail-label">
                  <MapPin size={13} />
                  <span>Branch:</span>
                </span>
                <span className="detail-value highlight">{hoveredPerson.branchName}</span>
              </div>

              <div className="hover-detail-row">
                <span className="detail-label">
                  <Crosshair size={13} />
                  <span>Geofence Radius:</span>
                </span>
                <span className="detail-value">{hoveredPerson.radius} meters</span>
              </div>

              <div className="hover-detail-row">
                <span className="detail-label">
                  <Clock size={13} />
                  <span>Punch In:</span>
                </span>
                <span className="detail-value">
                  {formatTime(hoveredPerson.person.punchIn)}
                </span>
              </div>

              {hoveredPerson.person.phoneNumber && (
                <div className="hover-detail-row">
                  <span className="detail-label">
                    <Phone size={13} />
                    <span>Phone:</span>
                  </span>
                  <span className="detail-value">{hoveredPerson.person.phoneNumber}</span>
                </div>
              )}

              {hoveredPerson.person.email && (
                <div className="hover-detail-row">
                  <span className="detail-label">
                    <Mail size={13} />
                    <span>Email:</span>
                  </span>
                  <span className="detail-value">{hoveredPerson.person.email}</span>
                </div>
              )}

              {hoveredPerson.person.device && (
                <div className="hover-detail-row">
                  <span className="detail-label">
                    <Smartphone size={13} />
                    <span>Device:</span>
                  </span>
                  <span className="detail-value">{hoveredPerson.person.device}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Side Panel: Branch List with Staff */}
        <div className={`gps-side-panel ${!isPanelOpen ? 'collapsed' : ''}`}>
          {/* Panel Search */}
          <div className="panel-search-box">
            <div className="search-input-wrap">
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search staff or branch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Branch Cards */}
          <div className="panel-branch-list">
            {filteredBranches.map((branch) => {
              const isSelected = selectedBranchId === branch.id

              return (
                <div
                  key={branch.id}
                  className={`branch-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleZoomToBranch(branch)}
                >
                  <div className="branch-card-top">
                    <h4 className="branch-name">{branch.name}</h4>
                    <span
                      className={`inside-badge ${
                        branch.personsInsideCount === 0 ? 'zero' : ''
                      }`}
                    >
                      <Users size={12} />
                      <span>{branch.personsInsideCount} Inside</span>
                    </span>
                  </div>

                  <div className="branch-meta-line">
                    <span>
                      <Crosshair size={12} />
                      Radius: {branch.radius}m
                    </span>
                    {branch.address && (
                      <span>
                        <MapPin size={12} />
                        {branch.address}
                      </span>
                    )}
                  </div>

                  {/* Staff Avatars Tray */}
                  {branch.persons.length > 0 && (
                    <div className="branch-staff-tray">
                      <div className="staff-tray-title">Staff in Circle</div>
                      <div className="staff-avatars-row">
                        {branch.persons.map((person) => (
                          <div
                            key={person.id}
                            className="mini-staff-chip"
                            onMouseEnter={(e) => {
                              setHoveredPerson({
                                person,
                                branchName: branch.name,
                                radius: branch.radius,
                              })
                              setHoverPos({
                                x: e.clientX - 330,
                                y: e.clientY - 50,
                              })
                            }}
                            onMouseMove={(e) => {
                              setHoverPos({
                                x: e.clientX - 330,
                                y: e.clientY - 50,
                              })
                            }}
                            onMouseLeave={() => {
                              setHoveredPerson(null)
                              setHoverPos(null)
                            }}
                          >
                            {person.photoUrl ? (
                              <img
                                src={person.photoUrl}
                                alt={person.name}
                                className="chip-avatar"
                              />
                            ) : (
                              <div className="chip-avatar">
                                {person.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="chip-name">{person.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {filteredBranches.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px 15px',
                  color: '#94a3b8',
                  fontSize: '0.9rem',
                }}
              >
                No branches match your search criteria.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
