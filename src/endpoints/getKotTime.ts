import type { PayloadHandler } from 'payload'
import { getKotTimeForBranch } from '../lib/kot-time'

export const getKotTimeHandler: PayloadHandler = async (req): Promise<Response> => {
  const { payload } = req
  const url = new URL(req.url || 'http://localhost')
  const branchId = url.searchParams.get('branch')

  try {
    if (branchId) {
      const config = await getKotTimeForBranch(payload, branchId)
      return Response.json(
        {
          success: true,
          data: config,
        },
        { status: 200 },
      )
    }

    const kotTimeGlobal = await payload.findGlobal({
      slug: 'kot-time',
      depth: 1,
    })

    const rawBranches = (kotTimeGlobal as any)?.branches || []
    const branches = rawBranches.map((entry: any) => {
      const branchObj = typeof entry.branch === 'object' && entry.branch !== null ? entry.branch : null
      const branchIdStr = branchObj ? branchObj.id || branchObj._id : String(entry.branch || '')
      const supervisorUnit = entry.supervisorUnit === 'seconds' ? 'seconds' : 'minutes'
      const supervisorTime = Number(entry.supervisorTime) || 0
      const waiterUnit = entry.waiterUnit === 'seconds' ? 'seconds' : 'minutes'
      const waiterTime = Number(entry.waiterTime) || 0

      return {
        branchId: String(branchIdStr),
        branchName: branchObj?.name || undefined,
        supervisor: {
          unit: supervisorUnit,
          time: supervisorTime,
          timeInMinutes: supervisorUnit === 'seconds' ? Number((supervisorTime / 60).toFixed(2)) : supervisorTime,
          timeInSeconds: supervisorUnit === 'minutes' ? supervisorTime * 60 : supervisorTime,
        },
        waiter: {
          unit: waiterUnit,
          time: waiterTime,
          timeInMinutes: waiterUnit === 'seconds' ? Number((waiterTime / 60).toFixed(2)) : waiterTime,
          timeInSeconds: waiterUnit === 'minutes' ? waiterTime * 60 : waiterTime,
        },
      }
    })

    return Response.json(
      {
        success: true,
        data: branches,
      },
      { status: 200 },
    )
  } catch (error: any) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to retrieve KOT Time settings',
    })
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve KOT Time settings',
      },
      { status: 500 },
    )
  }
}
