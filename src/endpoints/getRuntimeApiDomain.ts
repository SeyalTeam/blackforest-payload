import type { PayloadHandler } from 'payload'

type AppAPIDomainRow = {
  domainURL?: string
  enabled?: boolean
  type?: 'primary' | 'secondary'
}

type AppAPIDomainProfile = {
  appKey?: string
  domains?: AppAPIDomainRow[]
}

const normalizeAppKey = (value: string | null): string =>
  (value || '').trim().toLowerCase() || 'billing-app'

const normalizeDomain = (value: unknown): string => {
  const input = typeof value === 'string' ? value.trim() : ''
  if (!input) return ''

  try {
    return new URL(input).toString().replace(/\/+$/, '')
  } catch (_error) {
    try {
      return new URL(`https://${input}`).toString().replace(/\/+$/, '')
    } catch (_nestedError) {
      return ''
    }
  }
}

const getSortedDomains = (rows: AppAPIDomainRow[]): AppAPIDomainRow[] => {
  const domains: AppAPIDomainRow[] = rows
    .map((row) => {
      const type: 'primary' | 'secondary' = row?.type === 'secondary' ? 'secondary' : 'primary'
      return {
        domainURL: normalizeDomain(row?.domainURL),
        enabled: row?.enabled !== false,
        type,
      }
    })
    .filter((row) => row.domainURL.length > 0)

  if (!domains.length) return []

  const primary = domains.filter((d) => d.enabled && d.type === 'primary')
  const secondary = domains.filter((d) => d.enabled && d.type === 'secondary')
  const enabledRemainder = domains.filter(
    (d) => d.enabled && d.type !== 'primary' && d.type !== 'secondary',
  )
  const disabled = domains.filter((d) => !d.enabled)

  return [...primary, ...secondary, ...enabledRemainder, ...disabled]
}

export const getRuntimeApiDomainHandler: PayloadHandler = async (req): Promise<Response> => {
  try {
    const requestURL = new URL(req.url || 'http://localhost')
    const appKey = normalizeAppKey(requestURL.searchParams.get('appKey'))

    const settings = (await req.payload.findGlobal({
      slug: 'widget-settings',
      depth: 0,
      overrideAccess: true,
    })) as {
      appAPIDomains?: AppAPIDomainProfile[]
    }

    const profiles = Array.isArray(settings?.appAPIDomains) ? settings.appAPIDomains : []
    const profile =
      profiles.find((candidate) => normalizeAppKey(candidate?.appKey || null) === appKey) || null

    const rows = Array.isArray(profile?.domains) ? profile.domains : []
    const sortedDomains = getSortedDomains(rows)
    const activeDomain = sortedDomains.find((domain) => domain.enabled) || sortedDomains[0] || null

    if (!activeDomain?.domainURL) {
      return Response.json(
        {
          appKey,
          hasConfig: false,
          message: `No API domains configured for appKey "${appKey}"`,
        },
        { status: 404 },
      )
    }

    const fallbackDomains = sortedDomains
      .filter((domain) => domain.domainURL !== activeDomain.domainURL)
      .map((domain) => domain.domainURL)

    return Response.json(
      {
        appKey,
        hasConfig: true,
        activeDomain: activeDomain.domainURL,
        activeType: activeDomain.type || 'primary',
        domains: sortedDomains.map((domain) => ({
          domainURL: domain.domainURL,
          enabled: domain.enabled,
          type: domain.type || 'primary',
        })),
        fallbackDomains,
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to resolve runtime API domain',
    })
    return Response.json({ message: 'Failed to resolve runtime API domain' }, { status: 500 })
  }
}
