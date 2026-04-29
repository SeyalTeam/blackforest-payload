import { describe, expect, it } from 'vitest'
import {
  buildIdempotencyRequestHash,
  evaluateIdempotencyRecord,
  IDEMPOTENCY_CONFLICT_REASONS,
  waitForIdempotencyResolution,
} from '@/utilities/idempotency'

describe('Idempotency utility', () => {
  it('returns conflict for same key with different payload hash', () => {
    const requestHashA = buildIdempotencyRequestHash({
      method: 'POST',
      path: '/api/billings',
      search: '',
      envelopeHeader: 'v1',
      bodyText: JSON.stringify({ customer: 'A', items: [{ id: 1 }] }),
    })

    const requestHashB = buildIdempotencyRequestHash({
      method: 'POST',
      path: '/api/billings',
      search: '',
      envelopeHeader: 'v1',
      bodyText: JSON.stringify({ customer: 'B', items: [{ id: 2 }] }),
    })

    const decision = evaluateIdempotencyRecord({
      requestHash: requestHashB,
      record: {
        requestHash: requestHashA,
        status: 'completed',
        responseStatus: 201,
        responsePayload: { id: 'bill_1' },
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    })

    expect(decision.kind).toBe('conflict')
    if (decision.kind === 'conflict') {
      expect(decision.reason).toBe('reused')
      expect(IDEMPOTENCY_CONFLICT_REASONS[decision.reason]).toBe('reused_key')
    }
  })

  it('allows a key to be reused after expiry', () => {
    const decision = evaluateIdempotencyRecord({
      requestHash: 'new_hash',
      now: new Date('2026-04-29T10:00:00.000Z'),
      record: {
        requestHash: 'old_hash',
        status: 'completed',
        responseStatus: 201,
        responsePayload: { id: 'bill_old' },
        expiresAt: '2026-04-29T09:59:59.000Z',
      },
    })

    expect(decision).toEqual({
      kind: 'process',
      reason: 'expired',
    })
  })

  it('replays canonical response for same-hash parallel requests once first request completes', async () => {
    const sharedRecord: {
      requestHash: string
      responsePayload?: unknown
      responseStatus?: number
      status: 'processing' | 'completed'
    } = {
      requestHash: 'same_hash',
      status: 'processing',
    }

    setTimeout(() => {
      sharedRecord.status = 'completed'
      sharedRecord.responseStatus = 201
      sharedRecord.responsePayload = {
        id: 'bill_1',
        invoiceNumber: 'INV-1001',
      }
    }, 35)

    const settled = await waitForIdempotencyResolution({
      requestHash: 'same_hash',
      timeoutMs: 1000,
      intervalMs: 10,
      loadLatest: async () => ({
        requestHash: sharedRecord.requestHash,
        status: sharedRecord.status,
        responseStatus: sharedRecord.responseStatus,
        responsePayload: sharedRecord.responsePayload,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    })

    expect(settled.kind).toBe('replay')
    if (settled.kind === 'replay') {
      expect(settled.status).toBe(201)
      expect(settled.payload).toEqual({
        id: 'bill_1',
        invoiceNumber: 'INV-1001',
      })
    }
  })
})
