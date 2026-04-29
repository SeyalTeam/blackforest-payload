import { describe, expect, it } from 'vitest'
import {
  getIdempotencyMetricsSnapshot,
  incrementIdempotencyMetric,
  resetIdempotencyMetrics,
} from '@/utilities/idempotencyMetrics'

describe('Idempotency metrics utility', () => {
  it('tracks and resets counters', () => {
    resetIdempotencyMetrics()
    incrementIdempotencyMetric('idempotency_replay', { scope: 'POST:/api/billings' })
    incrementIdempotencyMetric('idempotency_conflict', { scope: 'PATCH:/api/billings/1' })

    const snapshot = getIdempotencyMetricsSnapshot()
    expect(snapshot.counters.idempotency_replay).toBe(1)
    expect(snapshot.counters.idempotency_conflict).toBe(1)
    expect(snapshot.events.length).toBe(2)

    resetIdempotencyMetrics()
    const afterReset = getIdempotencyMetricsSnapshot()
    expect(afterReset.counters.idempotency_replay).toBe(0)
    expect(afterReset.counters.idempotency_conflict).toBe(0)
    expect(afterReset.events.length).toBe(0)
  })
})
