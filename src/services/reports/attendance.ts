import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope, toIndexedIdList } from '../../endpoints/reportScope'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export type AttendanceReportActivity = {
  id?: string
  type: 'session' | 'break'
  punchIn: string
  punchOut?: string
  status: 'active' | 'closed'
  durationSeconds: number
  durationFormatted: string
  ipAddress?: string
  device?: string
  capturedImageUrl?: string
  latitude?: number
  longitude?: number
  branchId?: string
  branchName?: string
}

export type AttendanceReportItem = {
  id: string
  date: string
  dateString: string
  userId: string
  userName: string
  userEmail: string
  userRole: string
  employeeId?: string
  employeeName: string
  employeeTeam?: string
  employeePhone?: string
  employeePhotoUrl?: string
  branchId?: string
  branchName: string
  loginBranchId?: string
  loginBranchName?: string
  firstPunchIn?: string
  lastPunchOut?: string
  totalWorkSeconds: number
  totalWorkFormatted: string
  totalBreakSeconds: number
  totalBreakFormatted: string
  sessionCount: number
  breakCount: number
  status: 'active' | 'on_break' | 'closed'
  activities: AttendanceReportActivity[]
}

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

export type AttendanceReportRoleStat = {
  role: string
  count: number
  totalHours: number
}

export type AttendanceReportBranchStat = {
  branchId: string
  branchName: string
  presentCount: number
  activeCount: number
  totalHours: number
}

export type AttendanceReportTotals = {
  totalRecords: number
  uniqueEmployees: number
  currentlyActive: number
  totalWorkSeconds: number
  totalWorkFormatted: string
  totalBreakSeconds: number
  totalBreakFormatted: string
  avgWorkSecondsPerDay: number
  avgWorkFormatted: string
}

export type AttendanceReportResult = {
  startDate: string
  endDate: string
  items: AttendanceReportItem[]
  totals: AttendanceReportTotals
  roleStats: AttendanceReportRoleStat[]
  branchStats: AttendanceReportBranchStat[]
}

export type AttendanceReportArgs = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
  role?: null | string
  employee?: null | string
  status?: null | string
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toNonEmptyString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  if (value && typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown; toString?: () => string }
    if (record.id) return toNonEmptyString(record.id, fallback)
    if (record._id) return toNonEmptyString(record._id, fallback)
    if (typeof record.toString === 'function') {
      const str = record.toString()
      if (str && str !== '[object Object]') return str
    }
  }

  return fallback
}

export const formatSecondsToReadable = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSecs = safeSeconds % 60

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSecs}s`
  }
  return `${remainingSecs}s`
}

const toDayBoundary = (dateParam: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = dateParam.split('-')
  const year = parseInt(yearRaw, 10)
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  const parsedDate = dayjs.tz(`${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata')
  return (mode === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day')).toDate()
}

const getMediaUrl = (mediaDoc: any): string => {
  if (!mediaDoc) return ''
  if (typeof mediaDoc === 'string') {
    const trimmed = mediaDoc.trim()
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/api/') ||
      trimmed.startsWith('data:')
    ) {
      return trimmed
    }
  }

  if (typeof mediaDoc === 'object' && mediaDoc !== null) {
    if (mediaDoc.url && typeof mediaDoc.url === 'string') return mediaDoc.url
    if (mediaDoc.thumbnailURL && typeof mediaDoc.thumbnailURL === 'string') return mediaDoc.thumbnailURL
    if (mediaDoc.filename && typeof mediaDoc.filename === 'string') {
      const publicURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL
      if (publicURL) {
        const cleanURL = publicURL.endsWith('/') ? publicURL.slice(0, -1) : publicURL
        const prefix = mediaDoc.prefix ? String(mediaDoc.prefix).replace(/^\/+|\/+$/g, '') : ''
        return prefix
          ? `${cleanURL}/blackforest/uploads/${prefix}/${mediaDoc.filename}`
          : `${cleanURL}/blackforest/uploads/${mediaDoc.filename}`
      }
      return `/api/media/file/${mediaDoc.filename}`
    }
  }

  return ''
}

export const getAttendanceReportData = async (
  req: PayloadRequest,
  args: AttendanceReportArgs = {},
): Promise<AttendanceReportResult> => {
  const { payload } = req

  const todayStr = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD')
  const startDateParam =
    typeof args.startDate === 'string' && args.startDate.trim().length > 0
      ? args.startDate.trim()
      : todayStr
  const endDateParam =
    typeof args.endDate === 'string' && args.endDate.trim().length > 0
      ? args.endDate.trim()
      : todayStr

  const startOfDay = toDayBoundary(startDateParam, 'start')
  const endOfDay = toDayBoundary(endDateParam, 'end')

  const branchParam = typeof args.branch === 'string' ? args.branch.trim() : ''
  const roleParam = typeof args.role === 'string' ? args.role.trim() : ''
  const employeeParam = typeof args.employee === 'string' ? args.employee.trim() : ''
  const statusParam = typeof args.status === 'string' ? args.status.trim() : ''

  const { branchIds } = await resolveReportBranchScope(req, branchParam)

  // Fetch branch geo settings and branches to resolve physical geofence for GPS punches
  let geoLocations: any[] = []
  try {
    const geoSettings = await payload.findGlobal({
      slug: 'branch-geo-settings',
      depth: 1,
    })
    geoLocations = Array.isArray(geoSettings?.locations) ? geoSettings.locations : []
  } catch (e) {
    req.payload.logger.warn({ msg: 'Failed to fetch branch-geo-settings', error: e })
  }

  let allBranches: any[] = []
  try {
    const branchesResult = await payload.find({
      collection: 'branches',
      limit: 300,
      depth: 0,
    })
    allBranches = branchesResult.docs || []
  } catch (e) {
    req.payload.logger.warn({ msg: 'Failed to fetch branches', error: e })
  }

  const branchMap = new Map<string, { id: string; name: string; latitude?: number; longitude?: number }>()
  for (const b of allBranches) {
    branchMap.set(String(b.id), {
      id: String(b.id),
      name: b.name || 'Unknown Branch',
      latitude: typeof b.latitude === 'number' ? b.latitude : undefined,
      longitude: typeof b.longitude === 'number' ? b.longitude : undefined,
    })
  }

  type GeofenceTarget = {
    branchId: string
    branchName: string
    latitude: number
    longitude: number
    radius: number
  }
  const geofences: GeofenceTarget[] = []

  for (const loc of geoLocations) {
    const bId = String(typeof loc.branch === 'object' ? loc.branch?.id : loc.branch || '')
    const bName = (typeof loc.branch === 'object' && loc.branch?.name) || branchMap.get(bId)?.name || 'Branch'
    const lat = typeof loc.latitude === 'number' ? loc.latitude : Number(loc.latitude)
    const lng = typeof loc.longitude === 'number' ? loc.longitude : Number(loc.longitude)
    const radius = typeof loc.radius === 'number' && loc.radius > 0 ? Number(loc.radius) : 100

    if (bId && Number.isFinite(lat) && Number.isFinite(lng)) {
      geofences.push({
        branchId: bId,
        branchName: bName,
        latitude: lat,
        longitude: lng,
        radius,
      })
    }
  }

  for (const b of allBranches) {
    const bId = String(b.id)
    if (!geofences.some((g) => g.branchId === bId)) {
      const lat = typeof b.latitude === 'number' ? b.latitude : Number(b.latitude)
      const lng = typeof b.longitude === 'number' ? b.longitude : Number(b.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        geofences.push({
          branchId: bId,
          branchName: b.name || 'Branch',
          latitude: lat,
          longitude: lng,
          radius: 100,
        })
      }
    }
  }

  const resolveBranchFromCoords = (
    lat?: number | null,
    lng?: number | null,
  ): { branchId: string; branchName: string; distance: number } | null => {
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      (lat === 0 && lng === 0)
    ) {
      return null
    }

    let bestMatch: { branchId: string; branchName: string; distance: number } | null = null
    let minDistance = Infinity

    for (const g of geofences) {
      const dist = distanceInMeters(lat, lng, g.latitude, g.longitude)
      const effectiveRadius = g.radius + 30
      if (dist <= effectiveRadius) {
        if (dist < minDistance) {
          minDistance = dist
          bestMatch = {
            branchId: g.branchId,
            branchName: g.branchName,
            distance: dist,
          }
        }
      }
    }

    if (!bestMatch) {
      for (const g of geofences) {
        const dist = distanceInMeters(lat, lng, g.latitude, g.longitude)
        if (dist <= 300 && dist < minDistance) {
          minDistance = dist
          bestMatch = {
            branchId: g.branchId,
            branchName: g.branchName,
            distance: dist,
          }
        }
      }
    }

    return bestMatch
  }

  const AttendanceModel = payload.db.collections['attendance']
  if (!AttendanceModel) {
    throw new Error('Attendance collection not found')
  }

  // Base match query on date or dateString
  const matchQuery: Record<string, any> = {
    $or: [
      {
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      },
      {
        dateString: {
          $gte: startDateParam,
          $lte: endDateParam,
        },
      },
    ],
  }

  const pipeline: any[] = [
    { $match: matchQuery },
    // Convert user and employee relationship fields to ObjectId for lookup
    {
      $addFields: {
        userObjectId: {
          $convert: {
            input: '$user',
            to: 'objectId',
            onError: null,
            onNull: null,
          },
        },
        employeeObjectId: {
          $convert: {
            input: '$employee',
            to: 'objectId',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userObjectId',
        foreignField: '_id',
        as: 'userDetails',
      },
    },
    {
      $unwind: {
        path: '$userDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        // If employee not directly on attendance doc, try user's employee
        resolvedEmployeeId: {
          $ifNull: [
            '$employeeObjectId',
            {
              $convert: {
                input: '$userDetails.employee',
                to: 'objectId',
                onError: null,
                onNull: null,
              },
            },
          ],
        },
        resolvedBranchId: {
          $convert: {
            input: {
              $ifNull: [
                '$userDetails.branch',
                {
                  $ifNull: [
                    '$userDetails.lastLoginBranch',
                    { $arrayElemAt: ['$userDetails.kitchenBranches', 0] },
                  ],
                },
              ],
            },
            to: 'objectId',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'resolvedEmployeeId',
        foreignField: '_id',
        as: 'employeeDetails',
      },
    },
    {
      $unwind: {
        path: '$employeeDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'branches',
        localField: 'resolvedBranchId',
        foreignField: '_id',
        as: 'branchDetails',
      },
    },
    {
      $unwind: {
        path: '$branchDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
  ]

  // Branch filter will be applied in document processing after physical and login branches are resolved

  // Role / Team filter
  if (roleParam && roleParam !== 'all') {
    const roles = roleParam
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter((r) => r.length > 0 && r !== 'all')

    if (roles.length > 0) {
      pipeline.push({
        $match: {
          $or: [
            { 'employeeDetails.team': { $in: roles } },
            { 'userDetails.role': { $in: roles } },
          ],
        },
      })
    }
  }

  // Employee filter
  if (employeeParam && employeeParam !== 'all') {
    const employeeIds = employeeParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && id !== 'all')

    if (employeeIds.length > 0) {
      pipeline.push({
        $match: {
          $or: [
            { resolvedEmployeeId: { $in: toIndexedIdList(employeeIds) } },
            { userObjectId: { $in: toIndexedIdList(employeeIds) } },
          ],
        },
      })
    }
  }

  pipeline.push({
    $sort: { date: -1, 'activities.punchIn': -1, createdAt: -1 },
  })

  const rawDocs = await AttendanceModel.aggregate(pipeline)

  // Collect all media IDs from capturedImage, photo, employee photo to batch fetch media URLs
  const mediaIdSet = new Set<string>()

  const extractMediaId = (val: unknown) => {
    if (!val) return
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (
        !trimmed.startsWith('http://') &&
        !trimmed.startsWith('https://') &&
        !trimmed.startsWith('/api/') &&
        !trimmed.startsWith('data:')
      ) {
        mediaIdSet.add(trimmed)
      }
    } else if (typeof val === 'object' && val !== null) {
      const rec = val as { id?: unknown; _id?: unknown; url?: unknown; filename?: unknown }
      if (!rec.url && !rec.filename) {
        const idStr = toNonEmptyString(rec.id || rec._id)
        if (idStr) mediaIdSet.add(idStr)
      }
    }
  }

  for (const doc of rawDocs) {
    extractMediaId(doc.employeeDetails?.photo)
    extractMediaId(doc.photo)
    extractMediaId(doc.capturedImage)

    const activitiesList = Array.isArray(doc.activities) ? doc.activities : []
    for (const act of activitiesList) {
      extractMediaId(act.capturedImage)
      extractMediaId(act.photo)
      extractMediaId(act.image)
      extractMediaId(act.photoUrl)
      extractMediaId(act.imageUrl)
    }

    const recordsList = Array.isArray(doc.records) ? doc.records : []
    for (const rec of recordsList) {
      extractMediaId(rec.photo)
      extractMediaId(rec.capturedImage)
      extractMediaId(rec.image)
    }
  }

  const mediaMap = new Map<string, string>()

  if (mediaIdSet.size > 0) {
    const idArray = Array.from(mediaIdSet)
    try {
      const mediaRes = await payload.find({
        collection: 'media',
        where: {
          id: {
            in: idArray,
          },
        },
        depth: 0,
        pagination: false,
        limit: 1000,
        overrideAccess: true,
      })

      for (const m of mediaRes.docs as any[]) {
        const idStr = String(m.id || m._id)
        const url = getMediaUrl(m)
        if (url) {
          mediaMap.set(idStr, url)
        }
      }
    } catch (e) {
      console.error('[AttendanceReport] Error resolving media images with payload.find:', e)
    }

    // Fallback: Check if any IDs are still missing from mediaMap and query DB directly
    const missingIds = idArray.filter((id) => !mediaMap.has(id))
    if (missingIds.length > 0 && payload.db.collections['media']) {
      try {
        const MediaModel = payload.db.collections['media']
        const mongoose = await import('mongoose')
        const objectIds = missingIds
          .map((id) => {
            try {
              return new mongoose.Types.ObjectId(id)
            } catch {
              return null
            }
          })
          .filter(Boolean)

        const mediaDocs = await MediaModel.find({
          $or: [{ _id: { $in: objectIds } }, { _id: { $in: missingIds } }],
        }).lean()

        for (const m of mediaDocs as any[]) {
          const idStr = String(m._id || m.id)
          const url = getMediaUrl(m)
          if (url) {
            mediaMap.set(idStr, url)
          }
        }
      } catch (dbErr) {
        console.error('[AttendanceReport] Fallback DB media query error:', dbErr)
      }
    }
  }

  const resolveImage = (rawVal: unknown): string | undefined => {
    if (!rawVal) return undefined
    const directUrl = getMediaUrl(rawVal)
    if (directUrl) return directUrl

    const idStr = toNonEmptyString(rawVal)
    if (idStr) {
      if (mediaMap.has(idStr)) return mediaMap.get(idStr)
      if (
        idStr.startsWith('http://') ||
        idStr.startsWith('https://') ||
        idStr.startsWith('/api/') ||
        idStr.startsWith('data:')
      ) {
        return idStr
      }
      if (idStr.includes('.')) {
        const publicURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL
        if (publicURL) {
          const cleanURL = publicURL.endsWith('/') ? publicURL.slice(0, -1) : publicURL
          return `${cleanURL}/blackforest/uploads/${idStr}`
        }
        return `/api/media/file/${idStr}`
      }
    }
    return undefined
  }

  const now = new Date()
  const items: AttendanceReportItem[] = []

  const uniqueEmployeeSet = new Set<string>()
  let totalActiveCount = 0
  let totalWorkSecondsAll = 0
  let totalBreakSecondsAll = 0

  const roleStatsMap = new Map<string, { count: number; totalSeconds: number }>()
  const branchStatsMap = new Map<string, { branchName: string; presentCount: number; activeCount: number; totalSeconds: number }>()

  for (const doc of rawDocs) {
    const id = toNonEmptyString(doc._id || doc.id)
    const dateStr = doc.dateString || (doc.date ? dayjs.utc(doc.date).format('YYYY-MM-DD') : startDateParam)
    const dateIso = doc.date ? new Date(doc.date).toISOString() : new Date(dateStr).toISOString()

    const userId = toNonEmptyString(doc.userDetails?._id || doc.user)
    const userName = toNonEmptyString(doc.employeeDetails?.name || doc.userDetails?.name || doc.userDetails?.email || 'Unknown')
    const userEmail = toNonEmptyString(doc.userDetails?.email || '')
    const userRole = toNonEmptyString(doc.userDetails?.role || 'staff')

    const employeeId = toNonEmptyString(doc.employeeDetails?.employeeId || '')
    const employeeName = toNonEmptyString(doc.employeeDetails?.name || userName)
    const employeeTeam = toNonEmptyString(doc.employeeDetails?.team || userRole)
    const employeePhone = toNonEmptyString(doc.employeeDetails?.phoneNumber || '')
    
    const employeePhotoUrl = resolveImage(doc.employeeDetails?.photo)

    const branchId = toNonEmptyString(doc.branchDetails?._id || doc.resolvedBranchId || '')
    const branchName = toNonEmptyString(doc.branchDetails?.name || 'Unassigned')

    const activitiesRaw = Array.isArray(doc.activities) && doc.activities.length > 0
      ? doc.activities
      : Array.isArray(doc.records) && doc.records.length > 0
        ? doc.records.map((r: any, idx: number) => ({
            id: r.id || r._id || `rec-${idx}`,
            type: 'session',
            punchIn: r.punchIn,
            punchOut: r.punchOut,
            capturedImage: r.photo || r.capturedImage,
            status: !r.punchOut ? 'active' : 'closed',
            ipAddress: r.ipAddress || doc.ipAddress,
            device: r.device || doc.device,
            latitude: r.latitude || doc.location?.latitude,
            longitude: r.longitude || doc.location?.longitude,
          }))
        : []

    const activities: AttendanceReportActivity[] = []

    let recordWorkSeconds = 0
    let recordBreakSeconds = 0
    let sessionCount = 0
    let breakCount = 0
    let firstPunchIn: string | undefined = undefined
    let lastPunchOut: string | undefined = undefined
    let hasActiveSession = false
    let hasActiveBreak = false

    // If no activities array but legacy punchIn exists:
    if (activitiesRaw.length === 0 && doc.punchIn) {
      const pIn = new Date(doc.punchIn).toISOString()
      const pOut = doc.punchOut ? new Date(doc.punchOut).toISOString() : undefined
      const isAct = !pOut || doc.status === 'active'
      const dur = pOut
        ? Math.max(0, Math.floor((new Date(pOut).getTime() - new Date(pIn).getTime()) / 1000))
        : Math.max(0, Math.floor((now.getTime() - new Date(pIn).getTime()) / 1000))

      const capturedImageUrl = resolveImage(doc.capturedImage || doc.photo || doc.image)

      const actLat = toNumber(doc.location?.latitude)
      const actLng = toNumber(doc.location?.longitude)
      const matchedActBranch = resolveBranchFromCoords(actLat, actLng)

      activities.push({
        id: 'legacy-1',
        type: 'session',
        punchIn: pIn,
        punchOut: pOut,
        status: isAct ? 'active' : 'closed',
        durationSeconds: dur,
        durationFormatted: formatSecondsToReadable(dur),
        ipAddress: toNonEmptyString(doc.ipAddress),
        device: toNonEmptyString(doc.device),
        capturedImageUrl,
        latitude: actLat || undefined,
        longitude: actLng || undefined,
        branchId: matchedActBranch?.branchId,
        branchName: matchedActBranch?.branchName,
      })
      sessionCount = 1
      recordWorkSeconds = dur
      firstPunchIn = pIn
      lastPunchOut = pOut
      if (isAct) hasActiveSession = true
    } else {
      for (const act of activitiesRaw) {
        const actType = act.type === 'break' ? 'break' : 'session'
        const pIn = act.punchIn ? new Date(act.punchIn).toISOString() : dateIso
        const pOut = act.punchOut ? new Date(act.punchOut).toISOString() : undefined
        const isAct = act.status === 'active' || (!act.punchOut && actType === 'session')

        let dur = toNumber(act.durationSeconds)
        if (dur <= 0) {
          if (pOut) {
            dur = Math.max(0, Math.floor((new Date(pOut).getTime() - new Date(pIn).getTime()) / 1000))
          } else if (isAct) {
            dur = Math.max(0, Math.floor((now.getTime() - new Date(pIn).getTime()) / 1000))
          }
        }

        const capturedImageUrl = resolveImage(
          act.capturedImage || act.photo || act.image || act.photoUrl || act.imageUrl,
        )

        const breakSecs = toNumber((act as any).breakDurationSeconds)
        
        const actLat = typeof act.latitude === 'number' ? act.latitude : (act.latitude ? Number(act.latitude) : undefined)
        const actLng = typeof act.longitude === 'number' ? act.longitude : (act.longitude ? Number(act.longitude) : undefined)
        const matchedActBranch = resolveBranchFromCoords(actLat, actLng)

        activities.push({
          id: toNonEmptyString(act.id || act._id),
          type: actType,
          punchIn: pIn,
          punchOut: pOut,
          status: isAct ? 'active' : 'closed',
          durationSeconds: dur,
          durationFormatted: formatSecondsToReadable(dur),
          ipAddress: toNonEmptyString(act.ipAddress),
          device: toNonEmptyString(act.device),
          capturedImageUrl,
          latitude: actLat,
          longitude: actLng,
          branchId: matchedActBranch?.branchId,
          branchName: matchedActBranch?.branchName,
        })

        if (actType === 'session') {
          sessionCount++
          recordWorkSeconds += dur
          
          if (breakSecs > 0) {
            breakCount++
            recordBreakSeconds += breakSecs
            
            // Optionally, insert a break activity for the UI to display if needed
            const breakStart = new Date(new Date(pIn).getTime() - (breakSecs * 1000)).toISOString()
            activities.push({
              type: 'break',
              punchIn: breakStart,
              punchOut: pIn,
              status: 'closed',
              durationSeconds: breakSecs,
              durationFormatted: formatSecondsToReadable(breakSecs),
            })
          }
          
          if (isAct) hasActiveSession = true
          if (!firstPunchIn || new Date(pIn).getTime() < new Date(firstPunchIn).getTime()) {
            firstPunchIn = pIn
          }
          if (pOut) {
            if (!lastPunchOut || new Date(pOut).getTime() > new Date(lastPunchOut).getTime()) {
              lastPunchOut = pOut
            }
          }
        } else {
          breakCount++
          recordBreakSeconds += dur
          if (isAct) hasActiveBreak = true
        }
      }
    }

    let status: 'active' | 'on_break' | 'closed' = 'closed'
    if (hasActiveBreak) {
      status = 'on_break'
    } else if (hasActiveSession) {
      status = 'active'
    }

    // Status filter check
    if (statusParam && statusParam !== 'all') {
      if (statusParam === 'active' && status !== 'active') continue
      if (statusParam === 'closed' && status !== 'closed') continue
      if (statusParam === 'on_break' && status !== 'on_break') continue
    }

    // Determine current branch where user is:
    // 1. Check if there's an active session with a matched physical branch
    // 2. Otherwise check the latest session with a matched physical branch (e.g. Session #2 at second branch)
    // 3. Otherwise fall back to login branch
    const sessionActs = activities.filter((a) => a.type === 'session')
    const activeSessionWithBranch = sessionActs.slice().reverse().find((a) => a.status === 'active' && a.branchName)
    const latestSessionWithBranch = sessionActs.slice().reverse().find((a) => a.branchName)

    const loginBranchId = toNonEmptyString(doc.branchDetails?._id || doc.resolvedBranchId || '')
    const loginBranchName = toNonEmptyString(doc.branchDetails?.name || branchMap.get(loginBranchId)?.name || 'Unassigned')

    const currentBranchName = activeSessionWithBranch?.branchName || latestSessionWithBranch?.branchName || loginBranchName
    const currentBranchId = activeSessionWithBranch?.branchId || latestSessionWithBranch?.branchId || loginBranchId

    // Branch filter check
    if (branchIds && branchIds.length > 0) {
      const associatedBranchIds = new Set<string>()
      if (currentBranchId) associatedBranchIds.add(String(currentBranchId))
      if (loginBranchId) associatedBranchIds.add(String(loginBranchId))
      for (const a of activities) {
        if (a.branchId) associatedBranchIds.add(String(a.branchId))
      }
      const matchesBranch = branchIds.some((bId) => associatedBranchIds.has(String(bId)))
      if (!matchesBranch) continue
    }

    const item: AttendanceReportItem = {
      id,
      date: dateIso,
      dateString: dateStr,
      userId,
      userName,
      userEmail,
      userRole,
      employeeId: employeeId || undefined,
      employeeName,
      employeeTeam: employeeTeam || undefined,
      employeePhone: employeePhone || undefined,
      employeePhotoUrl,
      branchId: currentBranchId || undefined,
      branchName: currentBranchName,
      loginBranchId: loginBranchId || undefined,
      loginBranchName: loginBranchName !== 'Unassigned' ? loginBranchName : undefined,
      firstPunchIn,
      lastPunchOut: hasActiveSession ? undefined : lastPunchOut,
      totalWorkSeconds: recordWorkSeconds,
      totalWorkFormatted: formatSecondsToReadable(recordWorkSeconds),
      totalBreakSeconds: recordBreakSeconds,
      totalBreakFormatted: formatSecondsToReadable(recordBreakSeconds),
      sessionCount,
      breakCount,
      status,
      activities,
    }

    items.push(item)

    // Aggregate statistics
    const employeeKey = employeeId || userId || userName
    uniqueEmployeeSet.add(employeeKey)
    if (status === 'active' || status === 'on_break') {
      totalActiveCount++
    }
    totalWorkSecondsAll += recordWorkSeconds
    totalBreakSecondsAll += recordBreakSeconds

    // Role stats
    const roleKey = (employeeTeam || 'other').toUpperCase()
    const existingRole = roleStatsMap.get(roleKey) || { count: 0, totalSeconds: 0 }
    existingRole.count++
    existingRole.totalSeconds += recordWorkSeconds
    roleStatsMap.set(roleKey, existingRole)

    // Branch stats
    const branchKey = item.branchId || 'unknown'
    const existingBranch = branchStatsMap.get(branchKey) || {
      branchName: item.branchName,
      presentCount: 0,
      activeCount: 0,
      totalSeconds: 0,
    }
    existingBranch.presentCount++
    if (status === 'active' || status === 'on_break') {
      existingBranch.activeCount++
    }
    existingBranch.totalSeconds += recordWorkSeconds
    branchStatsMap.set(branchKey, existingBranch)
  }

  const totalRecords = items.length
  const uniqueEmployees = uniqueEmployeeSet.size
  const avgWorkSecondsPerDay = totalRecords > 0 ? Math.round(totalWorkSecondsAll / totalRecords) : 0

  const roleStats: AttendanceReportRoleStat[] = Array.from(roleStatsMap.entries())
    .map(([role, data]) => ({
      role,
      count: data.count,
      totalHours: Number((data.totalSeconds / 3600).toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count)

  const branchStats: AttendanceReportBranchStat[] = Array.from(branchStatsMap.entries())
    .map(([branchId, data]) => ({
      branchId,
      branchName: data.branchName,
      presentCount: data.presentCount,
      activeCount: data.activeCount,
      totalHours: Number((data.totalSeconds / 3600).toFixed(2)),
    }))
    .sort((a, b) => b.presentCount - a.presentCount)

  return {
    startDate: startDateParam,
    endDate: endDateParam,
    items,
    totals: {
      totalRecords,
      uniqueEmployees,
      currentlyActive: totalActiveCount,
      totalWorkSeconds: totalWorkSecondsAll,
      totalWorkFormatted: formatSecondsToReadable(totalWorkSecondsAll),
      totalBreakSeconds: totalBreakSecondsAll,
      totalBreakFormatted: formatSecondsToReadable(totalBreakSecondsAll),
      avgWorkSecondsPerDay,
      avgWorkFormatted: formatSecondsToReadable(avgWorkSecondsPerDay),
    },
    roleStats,
    branchStats,
  }
}
