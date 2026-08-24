import type { PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { resolveReportBranchScope } from '../../endpoints/reportScope'

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

  // Branch filter
  if (branchIds && branchIds.length > 0) {
    pipeline.push({
      $match: {
        $expr: {
          $in: [{ $toString: '$resolvedBranchId' }, branchIds],
        },
      },
    })
  }

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
            { $expr: { $in: [{ $toString: '$resolvedEmployeeId' }, employeeIds] } },
            { $expr: { $in: [{ $toString: '$userObjectId' }, employeeIds] } },
          ],
        },
      })
    }
  }

  pipeline.push({
    $sort: { date: -1, 'activities.punchIn': -1, createdAt: -1 },
  })

  const rawDocs = await AttendanceModel.aggregate(pipeline)

  // Collect all media IDs from capturedImage and employee photo to batch fetch media URLs
  const mediaIdSet = new Set<string>()
  for (const doc of rawDocs) {
    if (doc.employeeDetails?.photo) {
      const pId = toNonEmptyString(doc.employeeDetails.photo)
      if (pId) mediaIdSet.add(pId)
    }
    if (Array.isArray(doc.activities)) {
      for (const act of doc.activities) {
        if (act.capturedImage) {
          const mId = toNonEmptyString(act.capturedImage)
          if (mId) mediaIdSet.add(mId)
        }
      }
    }
  }

  const mediaMap = new Map<string, string>()
  if (mediaIdSet.size > 0 && payload.db.collections['media']) {
    try {
      const MediaModel = payload.db.collections['media']
      const mediaDocs = await MediaModel.find({
        _id: { $in: Array.from(mediaIdSet).map((id) => toNonEmptyString(id)) },
      }).lean()

      for (const m of mediaDocs as any[]) {
        const idStr = String(m._id || m.id)
        const url = m.url || (m.filename ? `/api/media/file/${m.filename}` : '')
        if (url) {
          mediaMap.set(idStr, url)
        }
      }
    } catch (e) {
      console.error('[AttendanceReport] Error resolving media images:', e)
    }
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
    
    const photoMediaId = toNonEmptyString(doc.employeeDetails?.photo || '')
    const employeePhotoUrl = photoMediaId ? mediaMap.get(photoMediaId) : undefined

    const branchId = toNonEmptyString(doc.branchDetails?._id || doc.resolvedBranchId || '')
    const branchName = toNonEmptyString(doc.branchDetails?.name || 'Unassigned')

    const activitiesRaw = Array.isArray(doc.activities) ? doc.activities : []
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
        latitude: toNumber(doc.location?.latitude),
        longitude: toNumber(doc.location?.longitude),
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

        const mId = toNonEmptyString(act.capturedImage)
        const capturedImageUrl = mId ? mediaMap.get(mId) : undefined

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
          latitude: toNumber(act.latitude),
          longitude: toNumber(act.longitude),
        })

        if (actType === 'session') {
          sessionCount++
          recordWorkSeconds += dur
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
      branchId: branchId || undefined,
      branchName,
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
    const branchKey = branchId || 'unknown'
    const existingBranch = branchStatsMap.get(branchKey) || {
      branchName,
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
