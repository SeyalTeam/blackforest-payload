import fs from 'fs'
import path from 'path'

export interface SyncFrontendEnvResult {
  success: boolean
  activeDomain: string
  updatedFiles: string[]
  message: string
}

/**
 * Locate the standalone frontend repository directory (blackforest-frontend)
 */
export const findFrontendDir = (): string | null => {
  const candidates = [
    process.env.FRONTEND_DIR,
    path.resolve(process.cwd(), '../blackforest-frontend'),
    path.resolve(process.cwd(), 'blackforest-frontend'),
    path.resolve(__dirname, '../../../../blackforest-frontend'),
    path.resolve(__dirname, '../../../blackforest-frontend'),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate
      }
    } catch {
      // continue checking
    }
  }

  return null
}

/**
 * Safely update or insert NEXT_PUBLIC_API_URL in a target .env file
 */
export const updateEnvFile = (filePath: string, activeDomain: string): boolean => {
  try {
    let content = ''
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8')
    }

    const key = 'NEXT_PUBLIC_API_URL'
    const newLine = `${key}=${activeDomain}`
    const regex = new RegExp(`^${key}=.*$`, 'm')

    let updatedContent = ''
    if (regex.test(content)) {
      updatedContent = content.replace(regex, newLine)
    } else {
      updatedContent =
        content.trim().length > 0 ? `${content.trim()}\n${newLine}\n` : `${newLine}\n`
    }

    fs.writeFileSync(filePath, updatedContent, 'utf-8')
    return true
  } catch (error) {
    console.error(`[syncFrontendEnv] Failed to update file at ${filePath}:`, error)
    return false
  }
}

/**
 * Synchronize the active domain to the frontend .env.local and .env files
 */
export const syncFrontendEnv = (activeDomain: string): SyncFrontendEnvResult => {
  if (!activeDomain) {
    return {
      success: false,
      activeDomain: '',
      updatedFiles: [],
      message: 'No active domain provided to sync',
    }
  }

  const normalizedDomain = activeDomain.trim().replace(/\/+$/, '')
  const frontendDir = findFrontendDir()

  if (!frontendDir) {
    return {
      success: false,
      activeDomain: normalizedDomain,
      updatedFiles: [],
      message: 'Frontend directory (blackforest-frontend) not found on server filesystem',
    }
  }

  const filesToUpdate = ['.env.local', '.env']
  const updatedFiles: string[] = []

  for (const fileName of filesToUpdate) {
    const filePath = path.join(frontendDir, fileName)
    // Always update or create .env.local; update .env only if it exists
    if (fileName === '.env.local' || fs.existsSync(filePath)) {
      const ok = updateEnvFile(filePath, normalizedDomain)
      if (ok) {
        updatedFiles.push(fileName)
      }
    }
  }

  return {
    success: updatedFiles.length > 0,
    activeDomain: normalizedDomain,
    updatedFiles,
    message:
      updatedFiles.length > 0
        ? `Successfully synced NEXT_PUBLIC_API_URL=${normalizedDomain} to frontend (${updatedFiles.join(', ')})`
        : 'Failed to write to frontend .env files',
  }
}

/**
 * Helper to extract active frontend API domain from widget-settings global doc
 */
export const resolveActiveFrontendDomainFromDoc = (doc: any): string | null => {
  if (!doc) return null

  // 1. Check dedicated frontendAPIDomains array
  const frontendRows = Array.isArray(doc.frontendAPIDomains) ? doc.frontendAPIDomains : []
  if (frontendRows.length > 0) {
    const active =
      frontendRows.find((r: any) => r.enabled !== false && r.type === 'primary') ||
      frontendRows.find((r: any) => r.enabled !== false) ||
      frontendRows[0]

    if (active?.domainURL?.trim()) {
      return active.domainURL.trim().replace(/\/+$/, '')
    }
  }

  // 2. Check appAPIDomains for 'frontend-web'
  const appProfiles = Array.isArray(doc.appAPIDomains) ? doc.appAPIDomains : []
  const frontendProfile = appProfiles.find(
    (p: any) => (p?.appKey || '').trim().toLowerCase() === 'frontend-web',
  )
  const profileDomains = Array.isArray(frontendProfile?.domains) ? frontendProfile.domains : []

  if (profileDomains.length > 0) {
    const active =
      profileDomains.find((r: any) => r.enabled !== false && r.type === 'primary') ||
      profileDomains.find((r: any) => r.enabled !== false) ||
      profileDomains[0]

    if (active?.domainURL?.trim()) {
      return active.domainURL.trim().replace(/\/+$/, '')
    }
  }

  return null
}

/**
 * Sync frontend .env from widget settings document
 */
export const syncFrontendEnvFromDoc = (doc: any): SyncFrontendEnvResult => {
  const activeDomain = resolveActiveFrontendDomainFromDoc(doc)
  if (!activeDomain) {
    return {
      success: false,
      activeDomain: '',
      updatedFiles: [],
      message: 'No active frontend API domain configured in widget-settings',
    }
  }
  return syncFrontendEnv(activeDomain)
}
