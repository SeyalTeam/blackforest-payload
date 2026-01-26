import { PayloadHandler, PayloadRequest } from 'payload'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

export const getNetworkStatusHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  try {
    // 1. Fetch branch-geo-settings global
    const geoSettings = await payload.findGlobal({
      slug: 'branch-geo-settings',
      depth: 1, // Ensure branch relationship is populated
    })

    const branches = (geoSettings.locations || [])
      .map((loc: any) => {
        const branchData = loc.branch
        return {
          id: branchData?.id || branchData || '',
          name: branchData?.name || 'Unknown Branch',
          ipAddress: loc.ipAddress || '',
        }
      })
      .filter((b: any) => b.ipAddress)

    // 2. Define a function to ping an IP
    const pingIP = async (rawIp: string) => {
      // Handle IP ranges like "192.168.4.1-192.168.4.250"
      const ip = (rawIp || '').split('-')[0].trim()
      if (!ip) return { status: 'offline', latency: 'N/A' }

      try {
        // -c 1: send 1 packet
        // -W 2: wait 2 seconds for a response
        const { stdout } = await execPromise(`ping -c 1 -W 2 ${ip}`)

        // Extract time=... ms from stdout
        const timeMatch = stdout.match(/time=([\d.]+) ms/)
        const latency = timeMatch ? `${timeMatch[1]}ms` : 'unknown'

        return {
          status: 'online',
          latency,
        }
      } catch (_error) {
        return {
          status: 'offline',
          latency: 'N/A',
        }
      }
    }

    // 3. Ping all branches concurrently
    const results = await Promise.all(
      branches.map(async (branch) => {
        const networkInfo = await pingIP(branch.ipAddress || '')
        return {
          id: branch.id,
          name: branch.name,
          ipAddress: branch.ipAddress,
          ...networkInfo,
          lastChecked: new Date().toISOString(),
        }
      }),
    )

    return Response.json(results)
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
