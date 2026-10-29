import fs from 'fs'
import path from 'path'
import type { Payload } from 'payload'

export interface AppKeyGatekeeperData {
  updatedAt: string
  disabledBranchIds: string[]
  disabledBranchPins: string[]
  disabledBranchCodes: string[]
}

const GATEKEEPER_FILE = path.resolve(process.cwd(), 'app-key-gatekeeper.json')

let inMemoryGatekeeperData: AppKeyGatekeeperData = {
  updatedAt: new Date().toISOString(),
  disabledBranchIds: [],
  disabledBranchPins: [],
  disabledBranchCodes: [],
}

export const getAppKeyGatekeeperData = (): AppKeyGatekeeperData => {
  if (inMemoryGatekeeperData.disabledBranchIds.length === 0) {
    try {
      if (fs.existsSync(GATEKEEPER_FILE)) {
        const raw = fs.readFileSync(GATEKEEPER_FILE, 'utf-8')
        inMemoryGatekeeperData = JSON.parse(raw)
      }
    } catch (_) {}
  }
  return inMemoryGatekeeperData
}

export const syncAppKeyGatekeeperFromDoc = async (
  doc: any,
  payload?: Payload,
): Promise<AppKeyGatekeeperData> => {
  const rows = Array.isArray(doc?.appKeyValidationByBranch)
    ? doc.appKeyValidationByBranch
    : []

  const disabledBranchIds: string[] = []
  const disabledBranchPins: string[] = []
  const disabledBranchCodes: string[] = []

  for (const row of rows) {
    if (row.requireAppKey === false) {
      const branchVal = row.branch
      const branchId =
        typeof branchVal === 'object' && branchVal !== null
          ? String(branchVal.id || branchVal._id || '')
          : String(branchVal || '')

      if (branchId) {
        disabledBranchIds.push(branchId)

        if (typeof branchVal === 'object' && branchVal !== null) {
          if (branchVal.branchPin) disabledBranchPins.push(String(branchVal.branchPin).trim())
          if (branchVal.code) disabledBranchCodes.push(String(branchVal.code).trim().toLowerCase())
          if (branchVal.name) disabledBranchCodes.push(String(branchVal.name).trim().toLowerCase())
        }
      }
    }
  }

  // If payload instance is available, resolve any missing branchPins or codes for disabled branches
  if (payload && disabledBranchIds.length > 0) {
    try {
      const branches = await payload.find({
        collection: 'branches',
        where: {
          id: { in: disabledBranchIds },
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })

      for (const b of branches.docs as any[]) {
        if (b.branchPin) {
          const pin = String(b.branchPin).trim()
          if (!disabledBranchPins.includes(pin)) disabledBranchPins.push(pin)
        }
        if (b.code) {
          const code = String(b.code).trim().toLowerCase()
          if (!disabledBranchCodes.includes(code)) disabledBranchCodes.push(code)
        }
        if (b.name) {
          const name = String(b.name).trim().toLowerCase()
          if (!disabledBranchCodes.includes(name)) disabledBranchCodes.push(name)
        }
      }
    } catch (e) {
      console.error('[syncAppKeyGatekeeper] Error enriching branch details:', e)
    }
  }

  const data: AppKeyGatekeeperData = {
    updatedAt: new Date().toISOString(),
    disabledBranchIds: Array.from(new Set(disabledBranchIds)),
    disabledBranchPins: Array.from(new Set(disabledBranchPins)),
    disabledBranchCodes: Array.from(new Set(disabledBranchCodes)),
  }

  inMemoryGatekeeperData = data

  try {
    fs.writeFileSync(GATEKEEPER_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('[syncAppKeyGatekeeper] Failed to write app-key-gatekeeper.json:', err)
  }

  return data
}
