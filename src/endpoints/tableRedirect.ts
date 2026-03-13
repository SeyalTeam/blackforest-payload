import type { PayloadHandler } from 'payload'

export const tableRedirectHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.url) {
    return new Response('Request URL is required', { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const section = searchParams.get('section')
  const table = searchParams.get('table')

  if (!branchId || !section || !table) {
    return new Response('Missing required parameters: branchId, section, table', { status: 400 })
  }

  try {
    const settings = await req.payload.findGlobal({
      slug: 'widget-settings',
      depth: 0,
    })

    const domains =
      (settings.tableQRDomains as {
        domainURL: string
        enabled?: boolean
        type?: 'primary' | 'secondary'
      }[]) || []

    // 1. Success path: Pick the enabled Primary domain
    // 2. Failover path: Pick the first enabled Secondary domain
    // 3. Fallback path: Pick any enabled domain
    // 4. Absolute fallback: Pick the very first domain
    const activeDomain =
      domains.find((d) => d.enabled !== false && d.type === 'primary') ||
      domains.find((d) => d.enabled !== false && d.type === 'secondary') ||
      domains.find((d) => d.enabled !== false) ||
      domains[0]

    if (!activeDomain || !activeDomain.domainURL) {
      return new Response('No domains configured in Widget Settings', { status: 404 })
    }

    const targetBase = activeDomain.domainURL.trim()
    const targetURL = new URL(targetBase)
    targetURL.searchParams.set('branchId', branchId)
    targetURL.searchParams.set('section', section)
    targetURL.searchParams.set('table', table)

    return Response.redirect(targetURL.toString(), 302)
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to redirect table QR',
    })
    return new Response('Internal Server Error', { status: 500 })
  }
}
