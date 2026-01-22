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

    // Check for Secure Context (HTTPS or localhost)
    if (!window.isSecureContext) {
      setError(
        'Geolocation requires a secure context (HTTPS). Please check your connection security.',
      )
      setLoading(false)
      return
    }

    const successCallback = (position: GeolocationPosition) => {
      console.log('Geolocation success:', position.coords)
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

    const errorCallback = (err: GeolocationPositionError, method: string) => {
      console.error(`${method} geolocation error:`, err)

      // Don't set error yet if it's the first attempt (high accuracy)
      if (method === 'High accuracy') return

      let errorMessage = `Error (${err.code}): ${err.message}`

      if (err.code === err.TIMEOUT) {
        errorMessage =
          'Location request timed out. Please check if your device has a clear GPS signal.'
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errorMessage =
          'Position unavailable. Please ensure Location Services are enabled in your OS/Browser settings.'
      } else if (err.code === err.PERMISSION_DENIED) {
        errorMessage = 'Location permission denied. Please allow location access for this site.'
      }

      setError(errorMessage)
      setLoading(false)
    }

    console.log('Requesting high accuracy location...')
    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      successCallback,
      (highAccuracyError) => {
        errorCallback(highAccuracyError, 'High accuracy')

        console.log('Falling back to low accuracy location...')
        // Fallback to low accuracy
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (lowAccuracyError) => errorCallback(lowAccuracyError, 'Low accuracy'),
          {
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 0,
          },
        )
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
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
