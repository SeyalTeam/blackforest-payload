'use client'

import { useFormFields } from '@payloadcms/ui'
import React, { useState, useEffect, useRef, useCallback } from 'react'

export const GeoLocationButton: React.FC<{ path: string }> = ({ path }) => {
  const pathParts = path.split('.')
  const basePath = pathParts.slice(0, -1).join('.')

  const latitudeFieldPath = `${basePath}.latitude`
  const longitudeFieldPath = `${basePath}.longitude`
  const radiusFieldPath = `${basePath}.radius`

  const { dispatch, latitude, longitude, radius } = useFormFields(([fields, dispatch]) => ({
    dispatch,
    latitude: fields[latitudeFieldPath]?.value as number,
    longitude: fields[longitudeFieldPath]?.value as number,
    radius: (fields[radiusFieldPath]?.value as number) || 100,
  }))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layerGroupRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const [leafletLib, setLeafletLib] = useState<any>(null)

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

  useEffect(() => {
    if (!leafletLib || !mapContainerRef.current || mapInstanceRef.current) return

    const L = leafletLib
    // Initialize map centered around default coords (or current if available)
    const initLat = latitude || 8.7642
    const initLng = longitude || 78.1348
    
    const map = L.map(mapContainerRef.current, {
      center: [initLat, initLng],
      zoom: 16,
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

    // Map click to set location
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      updateLocation(lat, lng)
    })

    return () => {
      map.remove()
      mapInstanceRef.current = null
      layerGroupRef.current = null
    }
  }, [leafletLib]) // init once

  const updateLocation = useCallback((lat: number, lng: number) => {
    dispatch({ type: 'UPDATE', path: latitudeFieldPath, value: lat })
    dispatch({ type: 'UPDATE', path: longitudeFieldPath, value: lng })
  }, [dispatch, latitudeFieldPath, longitudeFieldPath])

  useEffect(() => {
    if (!leafletLib || !mapInstanceRef.current || !layerGroupRef.current) return

    const L = leafletLib
    const map = mapInstanceRef.current
    const layerGroup = layerGroupRef.current

    if (latitude && longitude) {
      if (!markerRef.current) {
        // Create marker
        const icon = L.divIcon({
          className: 'branch-marker-icon-custom',
          html: `<div style="width:24px;height:24px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        const marker = L.marker([latitude, longitude], { icon, draggable: true }).addTo(layerGroup)
        marker.on('dragend', (e: any) => {
          const latlng = marker.getLatLng()
          updateLocation(latlng.lat, latlng.lng)
        })
        markerRef.current = marker

        // Create circle
        const circle = L.circle([latitude, longitude], {
          radius: radius || 100,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.18,
          weight: 2,
          dashArray: '5, 5',
        }).addTo(layerGroup)
        circleRef.current = circle
        
        map.setView([latitude, longitude], map.getZoom())
      } else {
        // Update existing marker/circle
        markerRef.current.setLatLng([latitude, longitude])
        circleRef.current.setLatLng([latitude, longitude])
        circleRef.current.setRadius(radius || 100)
      }
    }
  }, [leafletLib, latitude, longitude, radius, updateLocation])

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
      (highAccuracyError) => {
        errorCallback(highAccuracyError, 'High accuracy')
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (lowAccuracyError) => errorCallback(lowAccuracyError, 'Low accuracy'),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  return (
    <div style={{ marginBottom: '20px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <button
          onClick={getLocation}
          disabled={loading}
          type="button"
          style={{
            padding: '8px 12px',
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
          }}
        >
          {loading ? 'Getting Location...' : 'Get Current Location'}
        </button>
        {radius && <div style={{ fontSize: '13px', color: '#666' }}>Current Radius: {radius}m</div>}
      </div>
      {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '12px' }}>{error}</div>}
      
      <div style={{ border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '400px', backgroundColor: '#f0f0f0', zIndex: 1 }} />
      </div>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
        Tip: Drag the red marker or click anywhere on the map to change the location. Update the &quot;Radius&quot; field below to visually resize the geofence circle.
      </div>
    </div>
  )
}
