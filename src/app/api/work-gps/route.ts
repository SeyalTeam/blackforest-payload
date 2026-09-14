import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth's radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

// Generate slight deterministic offset for staff positioned within a circle
function offsetCoordinates(
  baseLat: number,
  baseLng: number,
  radiusMeters: number,
  index: number,
  total: number,
) {
  if (total <= 1) {
    return { lat: baseLat, lng: baseLng }
  }
  const angle = (index / total) * 2 * Math.PI
  const distance = (radiusMeters * 0.45) * (0.4 + (index % 3) * 0.25)
  // 1 degree latitude ~ 111,320m
  const latOffset = (distance * Math.cos(angle)) / 111320
  // 1 degree longitude ~ 111,320m * cos(latitude)
  const lngOffset = (distance * Math.sin(angle)) / (111320 * Math.cos((baseLat * Math.PI) / 180))
  return {
    lat: Number((baseLat + latOffset).toFixed(7)),
    lng: Number((baseLng + lngOffset).toFixed(7)),
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    // 1. Fetch branches
    const branchesResult = await payload.find({
      collection: 'branches',
      limit: 100,
      depth: 1,
    })

    // 2. Fetch Branch Geo Settings
    let geoSettings: any = null
    try {
      geoSettings = await payload.findGlobal({
        slug: 'branch-geo-settings',
        depth: 1,
      })
    } catch (e) {
      console.warn('Could not fetch branch-geo-settings:', e)
    }

    const geoLocations = Array.isArray(geoSettings?.locations) ? geoSettings.locations : []

    // Map geo info by branch ID
    const branchGeoMap = new Map<
      string,
      { latitude: number; longitude: number; radius: number; ipAddress?: string; printerIp?: string }
    >()

    geoLocations.forEach((loc: any) => {
      const bId = typeof loc.branch === 'object' ? loc.branch?.id : loc.branch
      if (bId && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        branchGeoMap.set(String(bId), {
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
          radius: typeof loc.radius === 'number' && loc.radius > 0 ? Number(loc.radius) : 100,
          ipAddress: loc.ipAddress || '',
          printerIp: loc.printerIp || '',
        })
      }
    })

    // 3. Determine current IST date string (Asia/Kolkata)
    const now = new Date()
    const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    const todayStr = istTime.toISOString().slice(0, 10)

    // 4. Fetch Attendance records strictly for today
    let attendanceDocs: any[] = []
    try {
      const todayAttendance = await payload.find({
        collection: 'attendance',
        where: {
          dateString: { equals: todayStr },
        },
        limit: 500,
        depth: 2,
      })
      attendanceDocs = todayAttendance.docs || []
    } catch (err) {
      console.error('Error fetching attendance in work-gps route:', err)
    }

    // 5. Fetch Users
    let userDocs: any[] = []
    try {
      const usersRes = await payload.find({
        collection: 'users',
        limit: 300,
        depth: 1,
      })
      userDocs = usersRes.docs || []
    } catch (err) {
      console.error('Error fetching users in work-gps route:', err)
    }

    // 6. Fetch Employees
    let employeeDocs: any[] = []
    try {
      const empRes = await payload.find({
        collection: 'employees',
        limit: 300,
        depth: 1,
      })
      employeeDocs = empRes.docs || []
    } catch (err) {
      console.error('Error fetching employees in work-gps route:', err)
    }

    // Map employees by ID
    const employeeMap = new Map<string, any>()
    employeeDocs.forEach((emp: any) => {
      employeeMap.set(String(emp.id), emp)
    })

    // Map users by ID
    const userMap = new Map<string, any>()
    userDocs.forEach((u: any) => {
      userMap.set(String(u.id), u)
    })

    // Process branch presence
    const branches = branchesResult.docs.map((branchDoc: any) => {
      const bId = String(branchDoc.id)
      const geo = branchGeoMap.get(bId)
      const hasGps = !!(geo && Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude))

      const branchLat = geo?.latitude ?? 8.7642
      const branchLng = geo?.longitude ?? 78.1348
      const branchRadius = geo?.radius ?? 100

      // Find people who are currently live working (active punchin) at this branch today
      const persons: any[] = []
      const processedPersonIds = new Set<string>()

      // Check attendance records strictly for people currently live working (punched in today)
      for (const att of attendanceDocs) {
        const u = typeof att.user === 'object' ? att.user : userMap.get(String(att.user))
        const emp = typeof att.employee === 'object' ? att.employee : (att.employee ? employeeMap.get(String(att.employee)) : null)
        const personKey = (u?.id || emp?.id || att.id).toString()
        if (processedPersonIds.has(personKey)) continue

        const activities = Array.isArray(att.activities) ? att.activities : []
        
        // Find current live active session (status: 'active' and NO punchOut)
        const liveSession = activities.slice().reverse().find(
          (a: any) => (a.type === 'session' || !a.type) && a.status === 'active' && !a.punchOut
        )
        // If activities are recorded, strictly require an active open session. Otherwise check root status
        const isLiveActive = activities.length > 0
          ? !!liveSession
          : (att.status === 'active' && !att.punchOut)

        // STRICT: Only show staff who are currently live working (punched in right now)
        if (!isLiveActive) {
          continue
        }

        // Determine user branch association
        const userBranchId = typeof u?.branch === 'object' ? u?.branch?.id : u?.branch
        const userLastBranchId = typeof u?.lastLoginBranch === 'object' ? u?.lastLoginBranch?.id : u?.lastLoginBranch
        const userKitchenBranches = Array.isArray(u?.kitchenBranches)
          ? u.kitchenBranches.map((kb: any) => String(typeof kb === 'object' ? kb.id : kb))
          : []
        const isAssignedToThisBranch =
          String(userBranchId) === bId ||
          String(userLastBranchId) === bId ||
          userKitchenBranches.includes(bId)

        const personLat = typeof liveSession?.latitude === 'number'
          ? liveSession.latitude
          : (typeof att.location?.latitude === 'number' ? att.location.latitude : null)

        const personLng = typeof liveSession?.longitude === 'number'
          ? liveSession.longitude
          : (typeof att.location?.longitude === 'number' ? att.location.longitude : null)

        const hasPersonCoords = personLat !== null && personLng !== null
        let distanceMeters: number | null = null
        let isPhysicallyInside = false

        if (hasGps && hasPersonCoords) {
          distanceMeters = distanceInMeters(personLat, personLng, branchLat, branchLng)
          if (distanceMeters <= branchRadius) {
            isPhysicallyInside = true
          }
        }

        // STRICT: Person belongs to this branch's GPS circle if:
        // 1. Both branch and person have GPS coords -> MUST be physically inside the circle!
        // 2. If person has no GPS coords (e.g. desktop/POS punchin) -> MUST be assigned to this branch
        const isBelongingToThisBranch = (hasGps && hasPersonCoords)
          ? isPhysicallyInside
          : isAssignedToThisBranch

        if (!isBelongingToThisBranch) {
          continue
        }

        processedPersonIds.add(personKey)

        const photoUrl =
          typeof liveSession?.capturedImage === 'object' && liveSession.capturedImage?.url
            ? liveSession.capturedImage.url
            : (typeof emp?.photo === 'object' ? emp.photo?.url : (typeof u?.photo === 'object' ? u.photo?.url : null))

        persons.push({
          id: personKey,
          userId: u?.id || null,
          employeeId: emp?.employeeId || null,
          name: emp?.name || u?.name || 'Staff Member',
          role: emp?.team || u?.role || 'Staff',
          phoneNumber: emp?.phoneNumber || u?.phoneNumber || '',
          email: emp?.email || u?.email || '',
          photoUrl: photoUrl || null,
          status: 'active',
          isInside: hasGps && hasPersonCoords ? isPhysicallyInside : true,
          punchIn: liveSession?.punchIn || att.firstPunchIn || att.createdAt,
          punchOut: null,
          latitude: personLat,
          longitude: personLng,
          distanceMeters: distanceMeters !== null ? Math.round(distanceMeters) : Math.round(branchRadius * 0.3),
          ipAddress: liveSession?.ipAddress || att.ipAddress || '',
          device: liveSession?.device || att.device || 'Android Device',
        })
      }

      // Assign visual coordinates within circle for rendering markers on the map
      const mappedPersons = persons.map((p, idx) => {
        if (p.latitude && p.longitude) {
          return p
        }
        const coords = offsetCoordinates(branchLat, branchLng, branchRadius, idx, persons.length)
        return {
          ...p,
          latitude: coords.lat,
          longitude: coords.lng,
        }
      })

      return {
        id: bId,
        name: branchDoc.name,
        address: branchDoc.address || '',
        phone: branchDoc.phone || '',
        email: branchDoc.email || '',
        branchPin: branchDoc.branchPin || '',
        hasGps,
        latitude: branchLat,
        longitude: branchLng,
        radius: branchRadius,
        ipAddress: geo?.ipAddress || branchDoc.ipAddress || '',
        printerIp: geo?.printerIp || branchDoc.printerIp || '',
        personsInsideCount: mappedPersons.filter((p) => p.isInside).length,
        persons: mappedPersons,
      }
    })

    // Calculate aggregate summary
    const totalBranches = branches.length
    const branchesWithGps = branches.filter((b) => b.hasGps).length
    const totalPersonsInside = branches.reduce((acc, b) => acc + b.personsInsideCount, 0)
    const totalActiveClockedIn = branches.reduce(
      (acc, b) => acc + b.persons.filter((p: any) => p.status === 'active').length,
      0,
    )

    return NextResponse.json({
      branches,
      stats: {
        totalBranches,
        branchesWithGps,
        totalPersonsInside,
        totalActiveClockedIn,
        today: todayStr,
      },
    })
  } catch (error: any) {
    console.error('Error in /api/work-gps:', error)
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
