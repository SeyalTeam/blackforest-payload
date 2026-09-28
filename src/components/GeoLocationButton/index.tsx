'use client'

import { useFormFields } from '@payloadcms/ui'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  getGeofencePolygonCorners,
  getGeofenceFrontEdgeCenter,
  type GeofenceConfig,
} from '../../utilities/geo'

export const GeoLocationButton: React.FC<{ path: string }> = ({ path }) => {
  const pathParts = path.split('.')
  const basePath = pathParts.slice(0, -1).join('.')

  const latitudeFieldPath = `${basePath}.latitude`
  const longitudeFieldPath = `${basePath}.longitude`
  const radiusFieldPath = `${basePath}.radius`
  const shapeFieldPath = `${basePath}.shape`
  const buildingTypeFieldPath = `${basePath}.buildingType`
  const squareSizeFieldPath = `${basePath}.squareSize`
  const rectWidthFieldPath = `${basePath}.rectWidth`
  const rectLengthFieldPath = `${basePath}.rectLength`
  const rotationFieldPath = `${basePath}.rotation`

  const {
    dispatch,
    latitude,
    longitude,
    radius,
    shape,
    buildingType,
    squareSize,
    rectWidth,
    rectLength,
    rotation,
  } = useFormFields(([fields, dispatch]) => ({
    dispatch,
    latitude: fields[latitudeFieldPath]?.value as number,
    longitude: fields[longitudeFieldPath]?.value as number,
    radius: (fields[radiusFieldPath]?.value as number) ?? 100,
    shape: ((fields[shapeFieldPath]?.value as string) || 'circle') as
      | 'circle'
      | 'square'
      | 'rectangle',
    buildingType: (fields[buildingTypeFieldPath]?.value as string) || 'standalone',
    squareSize: (fields[squareSizeFieldPath]?.value as number) ?? 50,
    rectWidth: (fields[rectWidthFieldPath]?.value as number) ?? 40,
    rectLength: (fields[rectLengthFieldPath]?.value as number) ?? 60,
    rotation: (fields[rotationFieldPath]?.value as number) ?? 0,
  }))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layerGroupRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const polygonRef = useRef<any>(null)
  const headingLineRef = useRef<any>(null)
  const [leafletLib, setLeafletLib] = useState<any>(null)

  const updateField = useCallback(
    (fieldPath: string, value: any) => {
      dispatch({ type: 'UPDATE', path: fieldPath, value })
    },
    [dispatch],
  )

  const updateLocation = useCallback(
    (lat: number, lng: number) => {
      dispatch({ type: 'UPDATE', path: latitudeFieldPath, value: Number(lat.toFixed(7)) })
      dispatch({ type: 'UPDATE', path: longitudeFieldPath, value: Number(lng.toFixed(7)) })
    },
    [dispatch, latitudeFieldPath, longitudeFieldPath],
  )

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

  // Initialize Map
  useEffect(() => {
    if (!leafletLib || !mapContainerRef.current || mapInstanceRef.current) return

    const L = leafletLib
    const initLat = latitude || 8.7642
    const initLng = longitude || 78.1348

    const map = L.map(mapContainerRef.current, {
      center: [initLat, initLng],
      zoom: 17,
      zoomControl: false,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 21,
      maxNativeZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)
    layerGroupRef.current = layerGroup
    mapInstanceRef.current = map

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      updateLocation(lat, lng)
    })

    return () => {
      map.remove()
      mapInstanceRef.current = null
      layerGroupRef.current = null
      markerRef.current = null
      circleRef.current = null
      polygonRef.current = null
      headingLineRef.current = null
    }
  }, [leafletLib, updateLocation]) // run once on lib load

  // Draw or update shapes (Circle, Square, Rectangle) whenever params change
  useEffect(() => {
    if (!leafletLib || !mapInstanceRef.current || !layerGroupRef.current) return

    const L = leafletLib
    const map = mapInstanceRef.current
    const layerGroup = layerGroupRef.current

    if (typeof latitude !== 'number' || typeof longitude !== 'number') return

    // 1. Center Marker
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: 'branch-marker-icon-custom',
        html: `<div style="width:24px;height:24px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">📍</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
      const marker = L.marker([latitude, longitude], { icon, draggable: true }).addTo(layerGroup)
      marker.on('dragend', () => {
        const latlng = marker.getLatLng()
        updateLocation(latlng.lat, latlng.lng)
      })
      markerRef.current = marker
      map.setView([latitude, longitude], map.getZoom() || 17)
    } else {
      markerRef.current.setLatLng([latitude, longitude])
    }

    const currentShape = (shape || 'circle').toLowerCase()
    const geofenceConfig: GeofenceConfig = {
      latitude,
      longitude,
      shape: currentShape,
      radius: radius || 100,
      squareSize: squareSize || 50,
      rectWidth: rectWidth || 40,
      rectLength: rectLength || 60,
      rotation: rotation || 0,
    }

    // 2. Circle Boundary
    if (currentShape === 'circle') {
      // Remove polygon & heading line if present
      if (polygonRef.current) {
        layerGroup.removeLayer(polygonRef.current)
        polygonRef.current = null
      }
      if (headingLineRef.current) {
        layerGroup.removeLayer(headingLineRef.current)
        headingLineRef.current = null
      }

      const circleRadius = radius || 100
      if (!circleRef.current) {
        const circle = L.circle([latitude, longitude], {
          radius: circleRadius,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.18,
          weight: 2,
          dashArray: '6, 6',
        }).addTo(layerGroup)
        circleRef.current = circle
      } else {
        circleRef.current.setLatLng([latitude, longitude])
        circleRef.current.setRadius(circleRadius)
      }
    } else {
      // Square or Rectangle Polygon
      if (circleRef.current) {
        layerGroup.removeLayer(circleRef.current)
        circleRef.current = null
      }

      const corners = getGeofencePolygonCorners(geofenceConfig)
      const frontCenter = getGeofenceFrontEdgeCenter(geofenceConfig)

      if (!polygonRef.current) {
        const polygon = L.polygon(corners, {
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.22,
          weight: 2.5,
          dashArray: '6, 6',
        }).addTo(layerGroup)
        polygonRef.current = polygon
      } else {
        polygonRef.current.setLatLngs(corners)
      }

      // Draw Heading Direction Line (pointing towards front of building)
      const headingCoords = [
        [latitude, longitude],
        frontCenter,
      ]
      if (!headingLineRef.current) {
        const headingLine = L.polyline(headingCoords, {
          color: '#ef4444',
          weight: 3,
          opacity: 0.85,
          dashArray: '3, 4',
        }).addTo(layerGroup)
        headingLineRef.current = headingLine
      } else {
        headingLineRef.current.setLatLngs(headingCoords)
      }
    }
  }, [
    leafletLib,
    latitude,
    longitude,
    shape,
    radius,
    squareSize,
    rectWidth,
    rectLength,
    rotation,
    updateLocation,
  ])

  const getLocation = (e: React.MouseEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      setLoading(false)
      return
    }

    if (!window.isSecureContext) {
      setError('Geolocation requires a secure context (HTTPS).')
      setLoading(false)
      return
    }

    const successCallback = (position: GeolocationPosition) => {
      updateLocation(position.coords.latitude, position.coords.longitude)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([position.coords.latitude, position.coords.longitude], 18)
      }
      setLoading(false)
    }

    const errorCallback = (err: GeolocationPositionError, method: string) => {
      if (method === 'High accuracy') return

      let errorMessage = `Error (${err.code}): ${err.message}`
      if (err.code === err.TIMEOUT) {
        errorMessage = 'Location request timed out.'
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errorMessage = 'Position unavailable.'
      } else if (err.code === err.PERMISSION_DENIED) {
        errorMessage = 'Location permission denied.'
      }

      setError(errorMessage)
      setLoading(false)
    }

    navigator.geolocation.getCurrentPosition(
      successCallback,
      () => {
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (lowAccuracyError) => errorCallback(lowAccuracyError, 'Low accuracy'),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 },
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const currentShape = (shape || 'circle').toLowerCase()
  const currentRotation = Number(rotation) || 0

  const handleRotationChange = (newDeg: number) => {
    // Normalize to 0-360 range
    let normalized = Math.round(newDeg) % 360
    if (normalized < 0) normalized += 360
    updateField(rotationFieldPath, normalized)
  }

  // Calculate approximate covered area
  let areaText = ''
  if (currentShape === 'circle') {
    const r = radius || 100
    const area = Math.round(Math.PI * r * r)
    areaText = `Radius: ${r}m • Area: ~${area.toLocaleString()} m²`
  } else if (currentShape === 'square') {
    const s = squareSize || 50
    const area = Math.round(s * s)
    areaText = `Square: ${s}m × ${s}m • Area: ~${area.toLocaleString()} m² • Rotation: ${currentRotation}°`
  } else {
    const w = rectWidth || 40
    const l = rectLength || 60
    const area = Math.round(w * l)
    areaText = `Rectangle: ${w}m (Width) × ${l}m (Length) • Area: ~${area.toLocaleString()} m² • Rotation: ${currentRotation}°`
  }

  return (
    <div
      style={{
        marginBottom: '24px',
        width: '100%',
        fontFamily: 'inherit',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 14px',
          background: 'var(--theme-elevation-50, #1e293b)',
          border: '1px solid var(--theme-elevation-150, #334155)',
          borderRadius: '8px 8px 0 0',
        }}
      >
        {/* Left: Geolocation & Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={getLocation}
            disabled={loading}
            type="button"
            style={{
              padding: '7px 14px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? 'Locating...' : '📍 Get Current Location'}
          </button>

          {/* Building Type Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              Building Type:
            </span>
            <select
              value={buildingType || 'standalone'}
              onChange={(e) => updateField(buildingTypeFieldPath, e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #475569',
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="standalone">🏢 Standalone Building / Outlet</option>
              <option value="mall">🏬 Shopping Mall / Complex</option>
              <option value="commercial">🏪 Commercial Shop / Street Outlet</option>
              <option value="kitchen">🍳 Central Kitchen / Bakery</option>
              <option value="warehouse">📦 Warehouse / Stock Center</option>
              <option value="kiosk">🎪 Kiosk / Outdoor Stall</option>
              <option value="custom">🏷️ Custom / Other</option>
            </select>
          </div>
        </div>

        {/* Right: Shape Switcher Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Shape:</span>
          <div
            style={{
              display: 'inline-flex',
              background: '#0f172a',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #334155',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => updateField(shapeFieldPath, 'circle')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: currentShape === 'circle' ? '#2563eb' : 'transparent',
                color: currentShape === 'circle' ? '#ffffff' : '#94a3b8',
                fontWeight: currentShape === 'circle' ? 600 : 400,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              ⭕ Circle
            </button>
            <button
              type="button"
              onClick={() => updateField(shapeFieldPath, 'square')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: currentShape === 'square' ? '#2563eb' : 'transparent',
                color: currentShape === 'square' ? '#ffffff' : '#94a3b8',
                fontWeight: currentShape === 'square' ? 600 : 400,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              ⬛ Square
            </button>
            <button
              type="button"
              onClick={() => updateField(shapeFieldPath, 'rectangle')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: currentShape === 'rectangle' ? '#2563eb' : 'transparent',
                color: currentShape === 'rectangle' ? '#ffffff' : '#94a3b8',
                fontWeight: currentShape === 'rectangle' ? 600 : 400,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              ▰ Rectangle
            </button>
          </div>
        </div>
      </div>

      {/* 2. Shape Parameters & Rotation Control Bar */}
      <div
        style={{
          background: 'var(--theme-elevation-100, #1e293b)',
          borderLeft: '1px solid var(--theme-elevation-150, #334155)',
          borderRight: '1px solid var(--theme-elevation-150, #334155)',
          borderBottom: '1px solid var(--theme-elevation-150, #334155)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Dynamic Dimensions Control */}
        {currentShape === 'circle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                Radius (meters):
              </label>
              <input
                type="number"
                min={10}
                max={1000}
                value={radius ?? 100}
                onChange={(e) => updateField(radiusFieldPath, Number(e.target.value))}
                style={{
                  width: '90px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '13px',
                }}
              />
            </div>
            <input
              type="range"
              min={15}
              max={400}
              step={5}
              value={radius ?? 100}
              onChange={(e) => updateField(radiusFieldPath, Number(e.target.value))}
              style={{ flex: 1, minWidth: '150px', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              {[50, 100, 150, 200].map((rVal) => (
                <button
                  key={rVal}
                  type="button"
                  onClick={() => updateField(radiusFieldPath, rVal)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: (radius ?? 100) === rVal ? '#3b82f6' : '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {rVal}m
                </button>
              ))}
            </div>
          </div>
        )}

        {currentShape === 'square' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Square Side Size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                  Square Side (meters):
                </label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={squareSize ?? 50}
                  onChange={(e) => updateField(squareSizeFieldPath, Number(e.target.value))}
                  style={{
                    width: '85px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                />
              </div>
              <input
                type="range"
                min={10}
                max={250}
                step={5}
                value={squareSize ?? 50}
                onChange={(e) => updateField(squareSizeFieldPath, Number(e.target.value))}
                style={{ flex: 1, minWidth: '150px', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {[30, 50, 75, 100].map((sVal) => (
                  <button
                    key={sVal}
                    type="button"
                    onClick={() => updateField(squareSizeFieldPath, sVal)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid #475569',
                      background: (squareSize ?? 50) === sVal ? '#3b82f6' : '#0f172a',
                      color: '#ffffff',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {sVal}m
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation Control for Square */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                paddingTop: '8px',
                borderTop: '1px dashed #334155',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>
                  🔄 Rotate Square:
                </span>
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={currentRotation}
                  onChange={(e) => handleRotationChange(Number(e.target.value))}
                  style={{
                    width: '75px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#38bdf8',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>degrees</span>
              </div>

              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={currentRotation}
                onChange={(e) => handleRotationChange(Number(e.target.value))}
                style={{ flex: 1, minWidth: '150px', cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleRotationChange(currentRotation - 15)}
                  title="Rotate -15 degrees"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  -15°
                </button>
                <button
                  type="button"
                  onClick={() => handleRotationChange(currentRotation + 15)}
                  title="Rotate +15 degrees"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  +15°
                </button>
                <button
                  type="button"
                  onClick={() => handleRotationChange(0)}
                  title="Reset rotation to North (0 degrees)"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: currentRotation === 0 ? '#3b82f6' : '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  0° (N)
                </button>
                <button
                  type="button"
                  onClick={() => handleRotationChange(90)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: currentRotation === 90 ? '#3b82f6' : '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  90° (E)
                </button>
                <button
                  type="button"
                  onClick={() => handleRotationChange(180)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: currentRotation === 180 ? '#3b82f6' : '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  180° (S)
                </button>
              </div>
            </div>
          </div>
        )}

        {currentShape === 'rectangle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Width and Length Sliders */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Width */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', minWidth: '95px' }}>
                  Width (m):
                </label>
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={rectWidth ?? 40}
                  onChange={(e) => updateField(rectWidthFieldPath, Number(e.target.value))}
                  style={{
                    width: '75px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                />
                <input
                  type="range"
                  min={10}
                  max={250}
                  step={5}
                  value={rectWidth ?? 40}
                  onChange={(e) => updateField(rectWidthFieldPath, Number(e.target.value))}
                  style={{ flex: 1, cursor: 'pointer' }}
                />
              </div>

              {/* Length */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', minWidth: '95px' }}>
                  Length (m):
                </label>
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={rectLength ?? 60}
                  onChange={(e) => updateField(rectLengthFieldPath, Number(e.target.value))}
                  style={{
                    width: '75px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                />
                <input
                  type="range"
                  min={10}
                  max={250}
                  step={5}
                  value={rectLength ?? 60}
                  onChange={(e) => updateField(rectLengthFieldPath, Number(e.target.value))}
                  style={{ flex: 1, cursor: 'pointer' }}
                />

                {/* Swap Dimensions Button */}
                <button
                  type="button"
                  title="Swap Width & Length"
                  onClick={() => {
                    const temp = rectWidth ?? 40
                    updateField(rectWidthFieldPath, rectLength ?? 60)
                    updateField(rectLengthFieldPath, temp)
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#94a3b8',
                    fontSize: '11px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⇄ Swap
                </button>
              </div>
            </div>

            {/* Rotation Control for Rectangle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                paddingTop: '8px',
                borderTop: '1px dashed #334155',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>
                  🔄 Rotate Rectangle:
                </span>
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={currentRotation}
                  onChange={(e) => handleRotationChange(Number(e.target.value))}
                  style={{
                    width: '75px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#38bdf8',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>degrees</span>
              </div>

              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={currentRotation}
                onChange={(e) => handleRotationChange(Number(e.target.value))}
                style={{ flex: 1, minWidth: '150px', cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleRotationChange(currentRotation - 15)}
                  title="Rotate -15 degrees"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  -15°
                </button>
                <button
                  type="button"
                  onClick={() => handleRotationChange(currentRotation + 15)}
                  title="Rotate +15 degrees"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  +15°
                </button>
                <button
                  type="button"
                  onClick={() => handleRotationChange(0)}
                  title="Reset rotation to North (0 degrees)"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: currentRotation === 0 ? '#3b82f6' : '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  0° (N)
                </button>
                <button
                  type="button"
                  onClick={() => handleRotationChange(90)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: currentRotation === 90 ? '#3b82f6' : '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  90° (E)
                </button>
                <button
                  type="button"
                  onClick={() => handleRotationChange(180)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    background: currentRotation === 180 ? '#3b82f6' : '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  180° (S)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#ef4444', margin: '8px 0', fontSize: '12px', fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}

      {/* 3. Leaflet Map Canvas */}
      <div
        style={{
          borderLeft: '1px solid #334155',
          borderRight: '1px solid #334155',
          borderBottom: '1px solid #334155',
          position: 'relative',
        }}
      >
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '420px',
            backgroundColor: '#0f172a',
            zIndex: 1,
          }}
        />

        {/* Live Footprint Summary Badge overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 400,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>📐 {areaText}</span>
          {latitude && longitude && (
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>
              • Center: {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </span>
          )}
        </div>
      </div>

      {/* 4. Instructional Tips */}
      <div
        style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#94a3b8',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}
      >
        <div>
          💡 <strong>Tip:</strong> Drag the red center pin or click anywhere on the map to position
          your building.
        </div>
        {currentShape !== 'circle' && (
          <div>
            🔄 <strong>Alignment:</strong> Use the <strong>Rotate</strong> slider (0°–360°) to align
            the {currentShape} boundary with your building footprint and the street angle. The red
            dashed line points towards the front entrance.
          </div>
        )}
      </div>
    </div>
  )
}
export default GeoLocationButton
