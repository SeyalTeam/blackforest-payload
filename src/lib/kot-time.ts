import type { Payload } from 'payload'

export type KotTimeUnit = 'minutes' | 'seconds'

export type RoleTimingDetail = {
  unit: KotTimeUnit
  time: number
  timeInMinutes: number
  timeInSeconds: number
}

export type BranchKotTimeConfig = {
  branchId: string
  branchName?: string
  supervisor: RoleTimingDetail
  waiter: RoleTimingDetail
}

const toMinutes = (time: number, unit: KotTimeUnit): number => {
  if (unit === 'seconds') {
    return Number((time / 60).toFixed(2))
  }
  return time
}

const toSeconds = (time: number, unit: KotTimeUnit): number => {
  if (unit === 'minutes') {
    return Math.round(time * 60)
  }
  return time
}

export const DEFAULT_TIMINGS: Omit<BranchKotTimeConfig, 'branchId'> = {
  supervisor: {
    unit: 'minutes',
    time: 2,
    timeInMinutes: 2,
    timeInSeconds: 120,
  },
  waiter: {
    unit: 'minutes',
    time: 5,
    timeInMinutes: 5,
    timeInSeconds: 300,
  },
}

export const getAllKotTimeConfigs = async (
  payload: Payload,
): Promise<Map<string, BranchKotTimeConfig>> => {
  const map = new Map<string, BranchKotTimeConfig>()
  try {
    const kotTimeGlobal = await payload.findGlobal({
      slug: 'kot-time',
      depth: 1,
    })

    const branchList = (kotTimeGlobal as any)?.branches
    if (Array.isArray(branchList)) {
      for (const entry of branchList) {
        const entryBranch = entry.branch
        const id =
          typeof entryBranch === 'object' && entryBranch !== null
            ? entryBranch.id || entryBranch._id
            : entryBranch
        if (!id) continue

        const supervisorUnit: KotTimeUnit =
          entry.supervisorUnit === 'seconds' ? 'seconds' : 'minutes'
        const supervisorTime = Number(entry.supervisorTime) || 0

        const waiterUnit: KotTimeUnit =
          entry.waiterUnit === 'seconds' ? 'seconds' : 'minutes'
        const waiterTime = Number(entry.waiterTime) || 0

        const branchObj = typeof entry.branch === 'object' ? entry.branch : null

        map.set(String(id), {
          branchId: String(id),
          branchName: branchObj?.name || entry.branchName || undefined,
          supervisor: {
            unit: supervisorUnit,
            time: supervisorTime,
            timeInMinutes: toMinutes(supervisorTime, supervisorUnit),
            timeInSeconds: toSeconds(supervisorTime, supervisorUnit),
          },
          waiter: {
            unit: waiterUnit,
            time: waiterTime,
            timeInMinutes: toMinutes(waiterTime, waiterUnit),
            timeInSeconds: toSeconds(waiterTime, waiterUnit),
          },
        })
      }
    }
  } catch (error) {
    payload.logger.error({
      err: error,
      msg: '[getAllKotTimeConfigs] Failed to load KOT time configs',
    })
  }

  return map
}

export const getKotTimeForBranch = async (
  payload: Payload,
  branchId?: string | null,
): Promise<BranchKotTimeConfig | null> => {
  if (!branchId) return null

  try {
    const kotTimeGlobal = await payload.findGlobal({
      slug: 'kot-time',
      depth: 1,
    })

    const branchList = (kotTimeGlobal as any)?.branches
    if (!Array.isArray(branchList) || branchList.length === 0) {
      return {
        branchId,
        ...DEFAULT_TIMINGS,
      }
    }

    const matched = branchList.find((entry: any) => {
      const entryBranch = entry.branch
      const id =
        typeof entryBranch === 'object' && entryBranch !== null
          ? entryBranch.id || entryBranch._id
          : entryBranch
      return String(id) === String(branchId)
    })

    if (!matched) {
      return {
        branchId,
        ...DEFAULT_TIMINGS,
      }
    }

    const supervisorUnit: KotTimeUnit =
      matched.supervisorUnit === 'seconds' ? 'seconds' : 'minutes'
    const supervisorTime = Number(matched.supervisorTime) || 0

    const waiterUnit: KotTimeUnit =
      matched.waiterUnit === 'seconds' ? 'seconds' : 'minutes'
    const waiterTime = Number(matched.waiterTime) || 0

    const branchObj = typeof matched.branch === 'object' ? matched.branch : null

    return {
      branchId,
      branchName: branchObj?.name || undefined,
      supervisor: {
        unit: supervisorUnit,
        time: supervisorTime,
        timeInMinutes: toMinutes(supervisorTime, supervisorUnit),
        timeInSeconds: toSeconds(supervisorTime, supervisorUnit),
      },
      waiter: {
        unit: waiterUnit,
        time: waiterTime,
        timeInMinutes: toMinutes(waiterTime, waiterUnit),
        timeInSeconds: toSeconds(waiterTime, waiterUnit),
      },
    }
  } catch (error) {
    payload.logger.error({
      err: error,
      msg: `[getKotTimeForBranch] Failed to load KOT time for branch: ${branchId}`,
    })
    return {
      branchId,
      ...DEFAULT_TIMINGS,
    }
  }
}
