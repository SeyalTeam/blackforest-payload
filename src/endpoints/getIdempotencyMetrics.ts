import type { PayloadHandler } from 'payload'
import { getIdempotencyMetricsSnapshot } from '@/utilities/idempotencyMetrics'

const ALLOWED_ROLES = new Set(['superadmin', 'admin'])

export const getIdempotencyMetricsHandler: PayloadHandler = async (req): Promise<Response> => {
  const role = req.user?.role || ''
  if (!ALLOWED_ROLES.has(role)) {
    return Response.json({ message: 'Forbidden' }, { status: 403 })
  }

  const snapshot = getIdempotencyMetricsSnapshot()
  return Response.json({
    data: snapshot,
    meta: {
      requestId:
        typeof req.headers?.get === 'function' ? req.headers.get('x-request-id') || null : null,
    },
    error: null,
  })
}
