/**
 * Checks if an IP address is within a comma-separated list of IPs or ranges.
 * Range format: 192.168.1.1-192.168.1.10
 */
export function isIPAllowed(ip: string, allowedIPs: string | string[]): boolean {
  if (!allowedIPs) return false

  let allowedItems: string[] = []

  if (Array.isArray(allowedIPs)) {
    allowedItems = allowedIPs.map((item) => item.trim())
  } else {
    if (allowedIPs.trim() === '') return false
    if (allowedIPs.includes('*')) return true
    allowedItems = allowedIPs.split(',').map((item) => item.trim())
  }

  for (const item of allowedItems) {
    if (item === '*') return true
    if (item.includes('-')) {
      const parts = item.split('-').map((ip) => ip.trim())
      if (parts.length === 2 && isIPInRange(ip, parts[0], parts[1])) {
        return true
      }
    } else if (ip === item) {
      return true
    }
  }

  return false
}

function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number)
  return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
}

function isIPInRange(ip: string, start: string, end: string): boolean {
  try {
    const ipLong = ipToLong(ip)
    const startLong = ipToLong(start)
    const endLong = ipToLong(end)
    return ipLong >= startLong && ipLong <= endLong
  } catch (_e) {
    return false
  }
}
