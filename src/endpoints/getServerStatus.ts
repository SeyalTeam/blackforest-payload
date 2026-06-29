import { PayloadHandler } from 'payload'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getBufferedLogs } from '../utilities/logBuffer'

const execPromise = promisify(exec)

const getCpuAverage = () => {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  cpus.forEach((core) => {
    for (const type in core.times) {
      total += (core.times as any)[type]
    }
    idle += core.times.idle
  })
  return { idle: idle / cpus.length, total: total / cpus.length }
}

const measureCpuLoad = async (): Promise<number> => {
  const start = getCpuAverage()
  await new Promise((resolve) => setTimeout(resolve, 150))
  const end = getCpuAverage()
  const idleDifference = end.idle - start.idle
  const totalDifference = end.total - start.total
  if (totalDifference === 0) return 0
  return 100 - Math.round((100 * idleDifference) / totalDifference)
}

const getDiskUsage = async () => {
  try {
    const { stdout } = await execPromise('df -k /')
    const lines = stdout.trim().split('\n')
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/)
      const totalKB = parseInt(parts[1], 10)
      const usedKB = parseInt(parts[2], 10)
      const freeKB = parseInt(parts[3], 10)
      return {
        totalGB: (totalKB / (1024 * 1024)).toFixed(1),
        usedGB: (usedKB / (1024 * 1024)).toFixed(1),
        freeGB: (freeKB / (1024 * 1024)).toFixed(1),
        percentage: Math.round((usedKB / totalKB) * 100),
      }
    }
  } catch (_err) {
    // Fail-safe
  }
  return { totalGB: 'N/A', usedGB: 'N/A', freeGB: 'N/A', percentage: 0 }
}

const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

export const getServerStatusHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user || !['superadmin', 'admin'].includes(req.user.role || '')) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cpuLoad = await measureCpuLoad()
    const disk = await getDiskUsage()

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    const memory = {
      totalGB: (totalMem / (1024 * 1024 * 1024)).toFixed(1),
      usedGB: (usedMem / (1024 * 1024 * 1024)).toFixed(1),
      freeGB: (freeMem / (1024 * 1024 * 1024)).toFixed(1),
      percentage: Math.round((usedMem / totalMem) * 100),
    }

    const processMem = process.memoryUsage()

    return Response.json({
      cpu: {
        usage: cpuLoad,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
      },
      memory,
      disk,
      process: {
        heapUsedMB: Math.round(processMem.heapUsed / (1024 * 1024)),
        heapTotalMB: Math.round(processMem.heapTotal / (1024 * 1024)),
        rssMB: Math.round(processMem.rss / (1024 * 1024)),
      },
      uptime: formatUptime(os.uptime()),
      hostname: os.hostname(),
      logs: getBufferedLogs(),
    })
  } catch (error: any) {
    return Response.json({ error: error.message || 'Failed to resolve server metrics' }, { status: 500 })
  }
}
