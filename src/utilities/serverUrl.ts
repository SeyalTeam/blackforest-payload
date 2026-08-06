const isLocalHostname = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true
  if (hostname.startsWith('192.168.')) return true
  if (hostname.startsWith('10.')) return true
  if (hostname.startsWith('172.')) {
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      const secondPart = parseInt(parts[1], 10)
      if (!isNaN(secondPart) && secondPart >= 16 && secondPart <= 31) {
        return true
      }
    }
  }
  return false
}

const normalizeAbsoluteURL = (value?: string | null): string => {
  const input = value?.trim() || ''
  if (!input) return ''

  try {
    const url = new URL(input)
    if (url.protocol === 'http:' && !isLocalHostname(url.hostname)) {
      url.protocol = 'https:'
    }
    return url.toString().replace(/\/+$/, '')
  } catch (_error) {
    try {
      const url = new URL(`https://${input}`)
      return url.toString().replace(/\/+$/, '')
    } catch (_nestedError) {
      return ''
    }
  }
}

export const getPublicServerURL = (): string => {
  if (process.env.PAYLOAD_PUBLIC_SERVER_URL) {
    return normalizeAbsoluteURL(process.env.PAYLOAD_PUBLIC_SERVER_URL)
  }

  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return normalizeAbsoluteURL(process.env.NEXT_PUBLIC_SERVER_URL)
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return 'http://localhost:3000'
}
