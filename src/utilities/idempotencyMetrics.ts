export const IDEMPOTENCY_METRIC_NAMES = [
  'idempotency_replay',
  'idempotency_conflict',
  'idempotency_wait',
  'idempotency_expired_reclaim',
] as const

export type IdempotencyMetricName = (typeof IDEMPOTENCY_METRIC_NAMES)[number]

type MetricCounterState = {
  [key in IdempotencyMetricName]: number
}

type MetricEvent = {
  at: string
  metric: IdempotencyMetricName
  scope?: string
}

const MAX_EVENT_HISTORY = 200

const initialCounters = (): MetricCounterState => ({
  idempotency_replay: 0,
  idempotency_conflict: 0,
  idempotency_wait: 0,
  idempotency_expired_reclaim: 0,
})

const state: {
  counters: MetricCounterState
  events: MetricEvent[]
  updatedAt: string
} = {
  counters: initialCounters(),
  events: [],
  updatedAt: new Date().toISOString(),
}

export const incrementIdempotencyMetric = (
  metric: IdempotencyMetricName,
  options?: { scope?: string },
): void => {
  state.counters[metric] += 1
  state.updatedAt = new Date().toISOString()
  state.events.push({
    metric,
    at: state.updatedAt,
    scope: options?.scope,
  })
  if (state.events.length > MAX_EVENT_HISTORY) {
    state.events.splice(0, state.events.length - MAX_EVENT_HISTORY)
  }
}

export const getIdempotencyMetricsSnapshot = (): {
  counters: MetricCounterState
  events: MetricEvent[]
  generatedAt: string
} => ({
  generatedAt: new Date().toISOString(),
  counters: { ...state.counters },
  events: [...state.events],
})

export const resetIdempotencyMetrics = (): void => {
  state.counters = initialCounters()
  state.events = []
  state.updatedAt = new Date().toISOString()
}
