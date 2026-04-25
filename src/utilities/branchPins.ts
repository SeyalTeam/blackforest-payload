import { createHash } from 'crypto'
import type { PayloadRequest } from 'payload'

const BRANCH_PIN_REGEX = /^\d{4}$/
const BRANCH_PIN_TIMEZONE = 'Asia/Kolkata'
const BRANCH_PIN_SECRET =
  process.env.BRANCH_PIN_DAILY_SECRET?.trim() || 'blackforest-branch-pin-secret'
const MAX_DAILY_BRANCH_PINS = 10000

export const BRANCH_PIN_HEADER = 'x-branch-pin'
export const BRANCH_PIN_REQUIRED_ROLES = new Set(['branch', 'waiter', 'cashier'])

let lastDailyBranchPinSyncDate: string | null = null
let dailyBranchPinSyncPromise: Promise<void> | null = null

type BranchPinDoc = {
  id: string
  branchPin?: string | null
}

export const normalizeBranchPin = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export const isValidBranchPin = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  return BRANCH_PIN_REGEX.test(value)
}

export const getISTDateKey = (date: Date = new Date()): string =>
  date.toLocaleDateString('en-CA', { timeZone: BRANCH_PIN_TIMEZONE })

const toPinString = (value: number): string => value.toString().padStart(4, '0')

const hashSeedToNumber = (seed: string): number => {
  const digest = createHash('sha256').update(seed).digest()
  return digest.readUInt32BE(0)
}

const buildDailyPinMap = (branchIDs: string[], dateKey: string): Map<string, string> => {
  const sortedBranchIDs = [...branchIDs].sort((a, b) => a.localeCompare(b))
  const usedPins = new Set<string>()
  const pinByBranchID = new Map<string, string>()

  for (const branchID of sortedBranchIDs) {
    const baseNumber = hashSeedToNumber(`${BRANCH_PIN_SECRET}:${dateKey}:${branchID}`) % 10000
    let resolvedPin: string | null = null

    for (let offset = 0; offset < 10000; offset += 1) {
      const candidatePin = toPinString((baseNumber + offset) % 10000)
      if (!usedPins.has(candidatePin)) {
        usedPins.add(candidatePin)
        resolvedPin = candidatePin
        break
      }
    }

    if (!resolvedPin) {
      throw new Error('Unable to assign a unique daily 4-digit PIN for all branches.')
    }

    pinByBranchID.set(branchID, resolvedPin)
  }

  return pinByBranchID
}

export const ensureDailyBranchPins = async (req: PayloadRequest): Promise<void> => {
  const dateKey = getISTDateKey()

  if (lastDailyBranchPinSyncDate === dateKey) {
    return
  }

  if (dailyBranchPinSyncPromise) {
    await dailyBranchPinSyncPromise
    return
  }

  dailyBranchPinSyncPromise = (async () => {
    const branchResult = await req.payload.find({
      collection: 'branches',
      depth: 0,
      pagination: false,
      limit: MAX_DAILY_BRANCH_PINS,
      overrideAccess: true,
    })

    const branches = (branchResult.docs || []) as BranchPinDoc[]
    if (branches.length === 0) {
      lastDailyBranchPinSyncDate = dateKey
      return
    }

    if (branches.length > MAX_DAILY_BRANCH_PINS) {
      throw new Error('Daily PIN rotation supports at most 10,000 branches.')
    }

    const pinByBranchID = buildDailyPinMap(
      branches.map((branch) => String(branch.id)),
      dateKey,
    )

    const branchesToUpdate = branches.filter((branch) => {
      const branchID = String(branch.id)
      const nextPin = pinByBranchID.get(branchID)
      const currentPin =
        typeof branch.branchPin === 'string' ? branch.branchPin.trim() : ''
      return Boolean(nextPin && currentPin !== nextPin)
    })

    if (branchesToUpdate.length > 0) {
      console.log(`[Branch PIN] Rotating PINs for ${branchesToUpdate.length} branches for date ${dateKey}`)
    }

    for (const branch of branchesToUpdate) {
      const branchID = String(branch.id)
      const nextPin = pinByBranchID.get(branchID)
      if (!nextPin) continue

      await req.payload.update({
        collection: 'branches',
        id: branchID,
        data: {
          branchPin: nextPin,
        } as any,
        depth: 0,
        overrideAccess: true,
        context: {
          skipBranchPinUniquenessCheck: true,
          branchPinRotationDate: dateKey,
        } as any,
      })
    }

    lastDailyBranchPinSyncDate = dateKey
  })().finally(() => {
    dailyBranchPinSyncPromise = null
  })

  await dailyBranchPinSyncPromise
}
