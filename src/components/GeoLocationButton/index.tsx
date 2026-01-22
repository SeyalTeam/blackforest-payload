'use client'

import { useFormFields } from '@payloadcms/ui'

import React, { useState } from 'react'

export const GeoLocationButton: React.FC<{ path: string }> = ({ path }) => {
  // path will be something like "locations.0.latitude"
  // We need to find the base path for the row index to update both lat and long
  // e.g. "locations.0."

  // Extract the row path prefix (e.g., "locations.0.")
  const pathParts = path.split('.')
  const basePath = pathParts.slice(0, -1).join('.')

  const latitudeFieldPath = `${basePath}.latitude`
  const longitudeFieldPath = `${basePath}.longitude`

  const { dispatch } = useFormFields(([_fields, dispatch]) => ({ dispatch }))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getLocation = (e: React.MouseEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      setLoading(false)
      return
    }

    const successCallback = (position: GeolocationPosition) => {
      dispatch({
        type: 'UPDATE',
        path: latitudeFieldPath,
        value: position.coords.latitude,
      })
      dispatch({
        type: 'UPDATE',
        path: longitudeFieldPath,
        value: position.coords.longitude,
      })
      setLoading(false)
    }

    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      successCallback,
      (highAccuracyError) => {
        console.warn('High accuracy geolocation failed:', highAccuracyError)

        // Fallback to low accuracy
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (lowAccuracyError) => {
            console.error('Low accuracy geolocation failed:', lowAccuracyError)
            let errorMessage = `Error: ${lowAccuracyError.message}`

            if (lowAccuracyError.code === lowAccuracyError.TIMEOUT) {
              errorMessage = 'Location request timed out. Please check your network.'
            } else if (lowAccuracyError.code === lowAccuracyError.POSITION_UNAVAILABLE) {
              errorMessage = 'Position unavailable. Check if location services are enabled.'
            } else if (lowAccuracyError.code === lowAccuracyError.PERMISSION_DENIED) {
              errorMessage = 'Location permission denied.'
            }

            setError(errorMessage)
            setLoading(false)
          },
          {
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 0,
          },
        )
      },
      {
        enableHighAccuracy: true,
        timeout: 10000, // Short timeout for high accuracy
        maximumAge: 0,
      },
    )
  }

  return (
    <div style={{ marginBottom: '10px' }}>
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
      {error && <div style={{ color: 'red', marginTop: '5px', fontSize: '12px' }}>{error}</div>}
    </div>
  )
}
