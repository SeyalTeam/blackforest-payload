'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'

const AttendanceWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = async () => {
    setIsOpen(true)
    setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      streamRef.current = stream
    } catch (err) {
      console.error('Error accessing camera:', err)
      setResult({ type: 'error', message: 'Could not access camera. Please allow permissions.' })
    }
  }

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsOpen(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const captureAndVerify = useCallback(async () => {
    if (!videoRef.current) return

    setIsVerifying(true)
    setResult(null)

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsVerifying(false)
        setResult({ type: 'error', message: 'Failed to capture image' })
        return
      }

      const formData = new FormData()
      formData.append('image', blob, 'capture.jpg')

      try {
        const response = await fetch('/api/face-recognize', {
          method: 'POST',
          body: formData,
        })
        const data = await response.json()

        if (data.matched) {
          const name = data.employee?.name || 'Unknown'
          const action = data.action === 'punch_out' ? 'Punch Out' : 'Punch In'
          const confidence = Math.round((data.confidence || 0) * 100)
          
          setResult({
            type: 'success',
            message: `✅ ${name} - ${action} Successful (${confidence}% match)`,
          })
          
          // Auto close after 4 seconds
          setTimeout(() => {
            stopCamera()
            setResult(null)
          }, 4000)
        } else {
          setResult({
            type: 'error',
            message: data.error || 'Face not recognized',
          })
        }
      } catch (error: any) {
        setResult({ type: 'error', message: 'Network error or server timeout. Please try again.' })
      } finally {
        setIsVerifying(false)
      }
    }, 'image/jpeg', 0.8) // High quality JPEG
  }, [stopCamera])

  return (
    <div className="dashboard-widget" style={{ 
      padding: '24px', 
      border: '1px solid var(--theme-elevation-150)', 
      borderRadius: '8px', 
      marginBottom: '24px', 
      backgroundColor: 'var(--theme-elevation-50)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.25rem', fontWeight: 600 }}>📷 Face Recognition Attendance</h2>
      
      {!isOpen ? (
        <button
          onClick={startCamera}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: 'var(--theme-success-400)', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          Take Attendance
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            maxWidth: '500px', 
            backgroundColor: '#000', 
            borderRadius: '8px', 
            overflow: 'hidden',
            aspectRatio: '4/3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {result && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '4px',
              backgroundColor: result.type === 'success' ? '#e6fffa' : '#ffebeb',
              color: result.type === 'success' ? '#2c7a7b' : '#c53030',
              fontWeight: 'bold',
              border: `1px solid ${result.type === 'success' ? '#b2f5ea' : '#feb2b2'}`,
            }}>
              {result.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={captureAndVerify}
              disabled={isVerifying}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: isVerifying ? '#a0aec0' : '#3182ce', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: isVerifying ? 'not-allowed' : 'pointer', 
                fontWeight: 'bold' 
              }}
            >
              {isVerifying ? 'Verifying...' : 'Capture & Verify'}
            </button>
            <button
              onClick={stopCamera}
              disabled={isVerifying}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: 'transparent', 
                color: 'var(--theme-elevation-800)', 
                border: '1px solid var(--theme-elevation-300)', 
                borderRadius: '4px', 
                cursor: isVerifying ? 'not-allowed' : 'pointer', 
                fontWeight: 'bold' 
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AttendanceWidget
