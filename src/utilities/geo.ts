export type GeofenceShape = 'circle' | 'square' | 'rectangle'

export interface GeofenceConfig {
  latitude: number
  longitude: number
  shape?: GeofenceShape | string | null
  buildingType?: string | null
  radius?: number | null // circle radius in meters (default 100)
  squareSize?: number | null // square side length in meters (default 50)
  rectWidth?: number | null // rectangle width in meters (default 40)
  rectLength?: number | null // rectangle length in meters (default 60)
  rotation?: number | null // rotation angle in degrees (0 - 360 clockwise from North)
}

const EARTH_RADIUS_METERS = 6371000

export function deg2rad(deg: number): number {
  return deg * (Math.PI / 180)
}

export function rad2deg(rad: number): number {
  return rad * (180 / Math.PI)
}

/**
 * Calculates great circle distance between two points in meters (Haversine formula).
 */
export function getDistanceFromLatLonInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS_METERS * c)
}

/**
 * Returns effective/bounding radius in meters for any geofence shape.
 * Useful for fast bounding-box filters or backwards-compatible fallbacks.
 */
export function getEffectiveRadius(geofence: GeofenceConfig): number {
  const shape = (geofence.shape || 'circle').toLowerCase()
  if (shape === 'square') {
    const side = Number(geofence.squareSize) || 50
    // Half diagonal: sqrt(2) * (side / 2)
    return Math.round((Math.SQRT2 * side) / 2)
  }
  if (shape === 'rectangle') {
    const width = Number(geofence.rectWidth) || 40
    const length = Number(geofence.rectLength) || 60
    return Math.round(Math.sqrt(width * width + length * length) / 2)
  }
  return Number(geofence.radius) || 100
}

/**
 * Calculates the 4 rotated corner coordinates [lat, lng] for square or rectangular geofences.
 * Corners returned in clockwise order starting from top-right (relative to building heading).
 */
export function getGeofencePolygonCorners(geofence: GeofenceConfig): [number, number][] {
  const shape = (geofence.shape || 'circle').toLowerCase()
  const centerLat = Number(geofence.latitude)
  const centerLng = Number(geofence.longitude)

  let width = 40
  let length = 60

  if (shape === 'square') {
    const side = Number(geofence.squareSize) || 50
    width = side
    length = side
  } else if (shape === 'rectangle') {
    width = Number(geofence.rectWidth) || 40
    length = Number(geofence.rectLength) || 60
  } else {
    // Circle approximation (24-sided polygon) if polygon vertices requested
    const r = Number(geofence.radius) || 100
    const points: [number, number][] = []
    const segments = 24
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI
      const dy = r * Math.cos(angle)
      const dx = r * Math.sin(angle)
      const lat = centerLat + rad2deg(dy / EARTH_RADIUS_METERS)
      const lng = centerLng + rad2deg(dx / (EARTH_RADIUS_METERS * Math.cos(deg2rad(centerLat))))
      points.push([Number(lat.toFixed(7)), Number(lng.toFixed(7))])
    }
    return points
  }

  const rotationDeg = Number(geofence.rotation) || 0
  const theta = deg2rad(rotationDeg)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)

  const halfW = width / 2
  const halfL = length / 2

  // 4 corners relative to building center:
  // Top-Right, Bottom-Right, Bottom-Left, Top-Left
  const localCorners: [number, number][] = [
    [halfW, halfL],
    [halfW, -halfL],
    [-halfW, -halfL],
    [-halfW, halfL],
  ]

  const cosCenterLat = Math.cos(deg2rad(centerLat))

  return localCorners.map(([u, v]) => {
    const dx = u * cosT + v * sinT
    const dy = -u * sinT + v * cosT
    const lat = centerLat + rad2deg(dy / EARTH_RADIUS_METERS)
    const lng = centerLng + rad2deg(dx / (EARTH_RADIUS_METERS * cosCenterLat))
    return [Number(lat.toFixed(7)), Number(lng.toFixed(7))]
  })
}

/**
 * Returns the front edge center coordinate [lat, lng] indicating the building facing direction.
 */
export function getGeofenceFrontEdgeCenter(geofence: GeofenceConfig): [number, number] {
  const shape = (geofence.shape || 'circle').toLowerCase()
  const centerLat = Number(geofence.latitude)
  const centerLng = Number(geofence.longitude)

  const length =
    shape === 'square'
      ? Number(geofence.squareSize) || 50
      : Number(geofence.rectLength) || 60

  const rotationDeg = Number(geofence.rotation) || 0
  const theta = deg2rad(rotationDeg)

  const halfL = length / 2
  const dx = halfL * Math.sin(theta)
  const dy = halfL * Math.cos(theta)

  const lat = centerLat + rad2deg(dy / EARTH_RADIUS_METERS)
  const lng = centerLng + rad2deg(dx / (EARTH_RADIUS_METERS * Math.cos(deg2rad(centerLat))))

  return [Number(lat.toFixed(7)), Number(lng.toFixed(7))]
}

/**
 * Determines whether a target point (lat, lng) is inside the geofence.
 * Supports Circle, Square, and Rotated Rectangle with optional tolerance (e.g. 60m indoor drift).
 */
export function isPointInsideGeofence(
  pointLat: number,
  pointLng: number,
  geofence: GeofenceConfig,
  toleranceMeters: number = 0,
): boolean {
  if (
    typeof pointLat !== 'number' ||
    typeof pointLng !== 'number' ||
    !Number.isFinite(pointLat) ||
    !Number.isFinite(pointLng) ||
    !Number.isFinite(geofence.latitude) ||
    !Number.isFinite(geofence.longitude)
  ) {
    return false
  }

  const shape = (geofence.shape || 'circle').toLowerCase()

  if (shape === 'circle') {
    const radius = Number(geofence.radius) || 100
    const dist = getDistanceFromLatLonInMeters(
      pointLat,
      pointLng,
      geofence.latitude,
      geofence.longitude,
    )
    return dist <= radius + toleranceMeters
  }

  // Square or Rectangle
  const centerLat = Number(geofence.latitude)
  const centerLng = Number(geofence.longitude)
  const rotationDeg = Number(geofence.rotation) || 0

  let width = 40
  let length = 60

  if (shape === 'square') {
    const side = Number(geofence.squareSize) || 50
    width = side
    length = side
  } else {
    width = Number(geofence.rectWidth) || 40
    length = Number(geofence.rectLength) || 60
  }

  const theta = deg2rad(rotationDeg)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)

  // Tangent plane displacement in meters
  const dy = deg2rad(pointLat - centerLat) * EARTH_RADIUS_METERS
  const dx = deg2rad(pointLng - centerLng) * EARTH_RADIUS_METERS * Math.cos(deg2rad(centerLat))

  // Project into building local coordinate system (u = along width, v = along length)
  const u = dx * cosT - dy * sinT
  const v = dx * sinT + dy * cosT

  const maxU = width / 2 + toleranceMeters
  const maxV = length / 2 + toleranceMeters

  return Math.abs(u) <= maxU && Math.abs(v) <= maxV
}

/**
 * Returns shortest distance in meters from point to the geofence boundary (0 if inside).
 */
export function getDistanceToGeofence(
  pointLat: number,
  pointLng: number,
  geofence: GeofenceConfig,
): number {
  if (
    typeof pointLat !== 'number' ||
    typeof pointLng !== 'number' ||
    !Number.isFinite(pointLat) ||
    !Number.isFinite(pointLng) ||
    !Number.isFinite(geofence.latitude) ||
    !Number.isFinite(geofence.longitude)
  ) {
    return Infinity
  }

  const shape = (geofence.shape || 'circle').toLowerCase()

  if (shape === 'circle') {
    const radius = Number(geofence.radius) || 100
    const dist = getDistanceFromLatLonInMeters(
      pointLat,
      pointLng,
      geofence.latitude,
      geofence.longitude,
    )
    return Math.max(0, dist - radius)
  }

  const centerLat = Number(geofence.latitude)
  const centerLng = Number(geofence.longitude)
  const rotationDeg = Number(geofence.rotation) || 0

  let width = 40
  let length = 60

  if (shape === 'square') {
    const side = Number(geofence.squareSize) || 50
    width = side
    length = side
  } else {
    width = Number(geofence.rectWidth) || 40
    length = Number(geofence.rectLength) || 60
  }

  const theta = deg2rad(rotationDeg)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)

  const dy = deg2rad(pointLat - centerLat) * EARTH_RADIUS_METERS
  const dx = deg2rad(pointLng - centerLng) * EARTH_RADIUS_METERS * Math.cos(deg2rad(centerLat))

  const u = dx * cosT - dy * sinT
  const v = dx * sinT + dy * cosT

  const du = Math.max(0, Math.abs(u) - width / 2)
  const dv = Math.max(0, Math.abs(v) - length / 2)

  return Math.round(Math.sqrt(du * du + dv * dv))
}

/**
 * Generates dispersed coordinates for multiple people inside the geofence shape so markers do not overlap.
 */
export function computeDispersedGeofencePositions(
  geofence: GeofenceConfig,
  count: number,
): [number, number][] {
  const centerLat = Number(geofence.latitude)
  const centerLng = Number(geofence.longitude)

  if (count <= 1) {
    return [[centerLat, centerLng]]
  }

  const shape = (geofence.shape || 'circle').toLowerCase()

  if (shape === 'circle') {
    const radius = Number(geofence.radius) || 100
    const positions: [number, number][] = []
    const maxR = Math.min(radius * 0.45, 45)

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI
      const dist = maxR * (0.35 + ((i % 3) * 0.22))
      const dy = dist * Math.cos(angle)
      const dx = dist * Math.sin(angle)
      const lat = centerLat + rad2deg(dy / EARTH_RADIUS_METERS)
      const lng = centerLng + rad2deg(dx / (EARTH_RADIUS_METERS * Math.cos(deg2rad(centerLat))))
      positions.push([Number(lat.toFixed(7)), Number(lng.toFixed(7))])
    }
    return positions
  }

  // Square or Rectangle: arrange inside the rotated box
  let width = 40
  let length = 60
  if (shape === 'square') {
    const side = Number(geofence.squareSize) || 50
    width = side
    length = side
  } else {
    width = Number(geofence.rectWidth) || 40
    length = Number(geofence.rectLength) || 60
  }

  const rotationDeg = Number(geofence.rotation) || 0
  const theta = deg2rad(rotationDeg)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const cosCenterLat = Math.cos(deg2rad(centerLat))

  const positions: [number, number][] = []
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const u = cols > 1 ? (col / (cols - 1) - 0.5) * width * 0.7 : 0
    const v = rows > 1 ? (row / (rows - 1) - 0.5) * length * 0.7 : 0

    const dx = u * cosT + v * sinT
    const dy = -u * sinT + v * cosT
    const lat = centerLat + rad2deg(dy / EARTH_RADIUS_METERS)
    const lng = centerLng + rad2deg(dx / (EARTH_RADIUS_METERS * cosCenterLat))
    positions.push([Number(lat.toFixed(7)), Number(lng.toFixed(7))])
  }

  return positions
}
