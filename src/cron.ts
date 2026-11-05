import type { Payload } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export function getExpectedShiftEnd(
  punchInIso: string,
  employee?: { loginTime?: string; logoutTime?: string; workingHours?: number } | null,
): { punchOutDate: Date; durationSeconds: number } {
  const punchInDate = new Date(punchInIso)
  const punchInDayjs = dayjs.utc(punchInIso).tz('Asia/Kolkata')

  // 1. If employee has configured logoutTime (e.g., '02_00' or '18_00')
  if (employee?.logoutTime) {
    const cleanLogout = String(employee.logoutTime).replace('_', ':')
    const [outHRaw, outMRaw] = cleanLogout.split(':').map(Number)
    let outH = isNaN(outHRaw) ? 2 : outHRaw
    let outM = isNaN(outMRaw) ? 0 : outMRaw

    let inH = 0
    let inM = 0
    if (employee.loginTime) {
      const cleanLogin = String(employee.loginTime).replace('_', ':')
      const [h, m] = cleanLogin.split(':').map(Number)
      if (!isNaN(h)) inH = h
      if (!isNaN(m)) inM = m || 0
    }

    // Handle common case where 12:00 AM (midnight) was entered as 12:00 instead of 00:00
    if (inH === 12 && (punchInDayjs.hour() <= 1 || punchInDayjs.hour() >= 23)) {
      inH = 0
    }

    const year = punchInDayjs.year()
    const month = String(punchInDayjs.month() + 1).padStart(2, '0')
    const day = String(punchInDayjs.date()).padStart(2, '0')

    let shiftEndDayjs = dayjs.tz(
      `${year}-${month}-${day} ${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00`,
      'YYYY-MM-DD HH:mm:ss',
      'Asia/Kolkata',
    )

    // If shift crosses midnight (e.g. login 20:00, logout 02:00), shift ends on next calendar day
    if (inH > outH) {
      shiftEndDayjs = shiftEndDayjs.add(1, 'day')
    }

    let shiftEndDate = shiftEndDayjs.toDate()
    if (shiftEndDate.getTime() <= punchInDate.getTime()) {
      const hours = employee.workingHours && employee.workingHours > 0 ? employee.workingHours : 2
      shiftEndDate = new Date(punchInDate.getTime() + hours * 3600 * 1000)
    }

    const durationSeconds = Math.max(0, Math.floor((shiftEndDate.getTime() - punchInDate.getTime()) / 1000))
    return { punchOutDate: shiftEndDate, durationSeconds }
  }

  // 2. If employee has configured workingHours (e.g., 2, 8, 10, 12 hours)
  if (employee?.workingHours && employee.workingHours > 0) {
    const durationSeconds = Math.floor(employee.workingHours * 3600)
    const punchOutDate = new Date(punchInDate.getTime() + durationSeconds * 1000)
    return { punchOutDate, durationSeconds }
  }

  // 3. Night shift rule: if punched in around midnight (23:00 - 01:30 IST), default shift ends at 02:00 AM
  const hourIST = punchInDayjs.hour()
  if (hourIST >= 23 || hourIST <= 1) {
    const year = punchInDayjs.year()
    const month = String(punchInDayjs.month() + 1).padStart(2, '0')
    const day = String(punchInDayjs.date()).padStart(2, '0')
    let twoAmDayjs = dayjs.tz(`${year}-${month}-${day} 02:00:00`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata')
    if (hourIST >= 23) {
      twoAmDayjs = twoAmDayjs.add(1, 'day')
    }
    const shiftEndDate = twoAmDayjs.toDate()
    if (shiftEndDate.getTime() > punchInDate.getTime()) {
      const durationSeconds = Math.max(0, Math.floor((shiftEndDate.getTime() - punchInDate.getTime()) / 1000))
      return { punchOutDate: shiftEndDate, durationSeconds }
    }
  }

  // 4. Default fallback: 12 hours shift
  const defaultDurationSeconds = 12 * 3600
  const punchOutDate = new Date(punchInDate.getTime() + defaultDurationSeconds * 1000)
  return { punchOutDate, durationSeconds: defaultDurationSeconds }
}

async function resolveEmployeeMap(payload: Payload, employeeIds: Set<string>, userIds: Set<string>) {
  const EmployeeModel = payload.db.collections['employees']
  const UserModel = payload.db.collections['users']

  const mongoose = await import('mongoose')
  const toOid = (id: string) => {
    try {
      return new mongoose.Types.ObjectId(id)
    } catch {
      return null
    }
  }

  const [empDocs, userDocs] = await Promise.all([
    EmployeeModel
      ? EmployeeModel.find({
          _id: { $in: Array.from(employeeIds).map(toOid).filter(Boolean) },
        }).lean()
      : [],
    UserModel
      ? UserModel.find({
          _id: { $in: Array.from(userIds).map(toOid).filter(Boolean) },
        }).lean()
      : [],
  ])

  const empMap = new Map<string, any>()
  for (const e of empDocs as any[]) empMap.set(String(e._id), e)

  const userMap = new Map<string, any>()
  const pendingEmpIds = new Set<string>()
  for (const u of userDocs as any[]) {
    userMap.set(String(u._id), u)
    if (u.employee && !empMap.has(String(u.employee))) {
      pendingEmpIds.add(String(u.employee))
    }
  }

  if (pendingEmpIds.size > 0 && EmployeeModel) {
    const extraEmps = await EmployeeModel.find({
      _id: { $in: Array.from(pendingEmpIds).map(toOid).filter(Boolean) },
    }).lean()
    for (const e of extraEmps as any[]) empMap.set(String(e._id), e)
  }

  return { empMap, userMap }
}

export async function runAttendanceAutoPunchOut(payload: Payload) {
  try {
    const now = new Date()
    const AttendanceModel = payload.db.collections['attendance']
    if (!AttendanceModel) return

    // Find all attendance records with an active session
    const activeDocs = await AttendanceModel.find({
      $or: [
        { 'activities.status': 'active' },
        { status: 'active', punchOut: { $exists: false } },
        { status: 'active', punchOut: null },
      ],
    }).lean()

    if (!activeDocs || activeDocs.length === 0) return

    const employeeIds = new Set<string>()
    const userIds = new Set<string>()
    for (const doc of activeDocs as any[]) {
      if (doc.employee) employeeIds.add(String(doc.employee))
      if (doc.user) userIds.add(String(doc.user))
    }

    const { empMap, userMap } = await resolveEmployeeMap(payload, employeeIds, userIds)

    for (const doc of activeDocs as any[]) {
      const user = doc.user ? userMap.get(String(doc.user)) : null
      const empId = String(doc.employee || user?.employee || '')
      const employee = empMap.get(empId)

      let needsUpdate = false
      const activities = Array.isArray(doc.activities) ? [...doc.activities] : []

      const updatedActivities = activities.map((act: any) => {
        if (act.status === 'active' && act.punchIn) {
          const shift = getExpectedShiftEnd(act.punchIn, employee)
          // Grace period: 30 minutes after scheduled shift end
          const autoCloseThreshold = shift.punchOutDate.getTime() + 30 * 60 * 1000

          if (now.getTime() >= autoCloseThreshold) {
            needsUpdate = true
            return {
              ...act,
              status: 'closed',
              punchOut: shift.punchOutDate.toISOString(),
              durationSeconds: shift.durationSeconds,
              punchOutType: 'auto',
            }
          }
        }
        return act
      })

      const updateData: any = {}
      if (needsUpdate) {
        updateData.activities = updatedActivities
        const anyStillActive = updatedActivities.some((a: any) => a.status === 'active')
        if (!anyStillActive) {
          updateData.status = 'closed'
        }
      }

      // Root punchOut if active
      if (doc.status === 'active' && !doc.punchOut && doc.punchIn) {
        const shift = getExpectedShiftEnd(doc.punchIn, employee)
        if (now.getTime() >= shift.punchOutDate.getTime() + 30 * 60 * 1000) {
          needsUpdate = true
          updateData.status = 'closed'
          updateData.punchOut = shift.punchOutDate.toISOString()
          updateData.punchOutType = 'auto'
        }
      }

      if (needsUpdate) {
        await payload.update({
          collection: 'attendance',
          id: String(doc._id || doc.id),
          data: updateData,
        })
        console.log(`[cron] Auto-closed session for doc ${doc._id || doc.id}`)
      }
    }
  } catch (err) {
    console.error('[cron] Error in runAttendanceAutoPunchOut:', err)
  }
}

async function runNightlyJob(payload: Payload) {
  console.log('[cron] Running nightly attendance cleanup...')
  try {
    const d = new Date()
    const utcOffset = d.getTime() + 5.5 * 60 * 60 * 1000
    const localDate = new Date(utcOffset)
    localDate.setUTCHours(0, 0, 0, 0)
    const today = new Date(localDate.getTime() - 5.5 * 60 * 60 * 1000)

    let hasMore = true
    let page = 1

    while (hasMore) {
      const result = await payload.find({
        collection: 'attendance',
        where: {
          date: { less_than: today.toISOString() },
        },
        limit: 100,
        page,
        depth: 0,
      })

      const employeeIds = new Set<string>()
      const userIds = new Set<string>()
      for (const doc of result.docs as any[]) {
        if (doc.employee) employeeIds.add(String(doc.employee))
        if (doc.user) userIds.add(String(doc.user))
      }

      const { empMap, userMap } = await resolveEmployeeMap(payload, employeeIds, userIds)

      for (const doc of result.docs as any[]) {
        const user = doc.user ? userMap.get(String(doc.user)) : null
        const empId = String(doc.employee || user?.employee || '')
        const employee = empMap.get(empId)

        let needsUpdate = false
        const updateData: any = {}

        if (doc.activities && doc.activities.length > 0) {
          const updatedActivities = doc.activities.map((act: any) => {
            if (act.status === 'active') {
              needsUpdate = true
              const shift = getExpectedShiftEnd(act.punchIn || doc.date, employee)

              return {
                ...act,
                status: 'closed',
                punchOut: shift.punchOutDate.toISOString(),
                durationSeconds: shift.durationSeconds,
                punchOutType: 'auto',
              }
            }
            return act
          })
          if (needsUpdate) updateData.activities = updatedActivities
        }

        if (doc.status === 'active' && !doc.punchOut) {
          needsUpdate = true
          const shift = getExpectedShiftEnd(doc.punchIn || doc.date, employee)
          updateData.status = 'closed'
          updateData.punchOut = shift.punchOutDate.toISOString()
          updateData.punchOutType = 'auto'
        }

        if (needsUpdate) {
          await payload.update({
            collection: 'attendance',
            id: doc.id,
            data: updateData,
          })
          console.log(`[cron] Nightly auto-closed session for attendance doc ${doc.id}`)
        }
      }

      hasMore = result.hasNextPage
      page++
    }
    console.log('[cron] Nightly attendance cleanup finished.')
  } catch (err) {
    console.error('[cron] Error in nightly attendance cleanup:', err)
  }
}

function scheduleNextNightlyJob(payload: Payload) {
  const now = new Date()
  const nextMidnight = new Date()
  nextMidnight.setHours(0, 1, 0, 0) // 12:01 AM
  if (now.getTime() >= nextMidnight.getTime()) {
    nextMidnight.setDate(nextMidnight.getDate() + 1)
  }
  const delay = nextMidnight.getTime() - now.getTime()

  setTimeout(async () => {
    await runNightlyJob(payload)
    await runAttendanceAutoPunchOut(payload)
    scheduleNextNightlyJob(payload)
  }, delay)
}

export function startCronJobs(payload: Payload) {
  // 1. Initial cleanup on boot
  runNightlyJob(payload).catch(console.error)
  runAttendanceAutoPunchOut(payload).catch(console.error)

  // 2. Periodic auto-punchout check every 15 minutes (catches 2:00 AM, shift ends, etc.)
  setInterval(() => {
    runAttendanceAutoPunchOut(payload).catch(console.error)
  }, 15 * 60 * 1000)

  // 3. Nightly midnight job
  scheduleNextNightlyJob(payload)
}
