import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { getReturnOrderReportData } from '@/services/reports/returnOrder'

describe('getReturnOrderReportData media resolution', () => {
  it('resolves image URLs from mediaInfo and fallback queries correctly', async () => {
    process.env.NEXT_PUBLIC_S3_PUBLIC_URL = 'https://pub-ebbea0aed91b471c928aeb4a33cd83d7.r2.dev'

    const mockAggregate = vi.fn().mockResolvedValue([
      {
        _id: 'branch1',
        branchName: 'Branch One',
        totalAmount: 1000,
        totalQuantity: 5,
        count: 4,
        orders: ['RET-001'],
        items: [
          {
            id: 'ord1',
            itemId: 'item1',
            returnNumber: 'RET-001',
            status: 'pending',
            product: 'Cake',
            quantity: 1,
            unitPrice: 200,
            subtotal: 200,
            notes: '',
            time: '2026-05-13T05:00:00.000Z',
            imageUrl: 'https://pub-ebbea0aed91b471c928aeb4a33cd83d7.r2.dev/blackforest/uploads/returnorder/direct.jpg',
            filename: 'direct.jpg',
            prefix: 'blackforest/uploads/returnorder/',
            proofPhoto: '6a04014ee72be2918df2479b',
          },
          {
            id: 'ord2',
            itemId: 'item2',
            returnNumber: 'RET-002',
            status: 'accepted',
            product: 'Pastry',
            quantity: 1,
            unitPrice: 150,
            subtotal: 150,
            notes: '',
            time: '2026-05-13T05:01:00.000Z',
            imageUrl: '',
            filename: 'return_item2.jpg',
            prefix: 'returnorder',
            proofPhoto: '6a04014ee72be2918df2479c',
          },
          {
            id: 'ord3',
            itemId: 'item3',
            returnNumber: 'RET-003',
            status: 'returned',
            product: 'Bread',
            quantity: 1,
            unitPrice: 50,
            subtotal: 50,
            notes: '',
            time: '2026-05-13T05:02:00.000Z',
            imageUrl: '',
            filename: '',
            prefix: '',
            proofPhoto: '6a04014ee72be2918df2479d', // Unmatched in lookup, to be resolved via payload.find
          },
          {
            id: 'ord4',
            itemId: 'item4',
            returnNumber: 'RET-004',
            status: 'cancelled',
            product: 'Cookies',
            quantity: 2,
            unitPrice: 50,
            subtotal: 100,
            notes: '',
            time: '2026-05-13T05:03:00.000Z',
            imageUrl: '',
            filename: '',
            prefix: '',
            proofPhoto: 'https://images.unsplash.com/photo-cookies.jpg', // Direct external URL
          },
        ],
      },
    ])

    const mockPayloadFind = vi.fn().mockResolvedValue({
      docs: [
        {
          id: '6a04014ee72be2918df2479d',
          filename: 'fallback_proof.jpg',
          prefix: 'blackforest/uploads/returnorder/',
        },
      ],
    })

    const mockReq = {
      payload: {
        find: mockPayloadFind,
        db: {
          collections: {
            'return-orders': {
              aggregate: mockAggregate,
            },
            media: {
              find: vi.fn(),
            },
          },
        },
        logger: {
          warn: vi.fn(),
          info: vi.fn(),
          error: vi.fn(),
        },
      },
      user: {
        role: 'superadmin',
      },
    } as unknown as PayloadRequest

    const result = await getReturnOrderReportData(mockReq, {
      startDate: '2026-05-13',
      endDate: '2026-05-13',
    })

    expect(result.groups).toHaveLength(1)
    const items = result.groups[0].items

    // item 1: direct imageUrl from media
    const item1 = items.find((i) => i.itemId === 'item1')
    expect(item1?.imageUrl).toBe(
      'https://pub-ebbea0aed91b471c928aeb4a33cd83d7.r2.dev/blackforest/uploads/returnorder/direct.jpg',
    )

    // item 2: constructed from filename & prefix
    const item2 = items.find((i) => i.itemId === 'item2')
    expect(item2?.imageUrl).toBe(
      'https://pub-ebbea0aed91b471c928aeb4a33cd83d7.r2.dev/blackforest/uploads/returnorder/return_item2.jpg',
    )

    // item 3: resolved from fallback payload.find
    const item3 = items.find((i) => i.itemId === 'item3')
    expect(item3?.imageUrl).toBe(
      'https://pub-ebbea0aed91b471c928aeb4a33cd83d7.r2.dev/blackforest/uploads/returnorder/fallback_proof.jpg',
    )

    // item 4: direct external URL
    const item4 = items.find((i) => i.itemId === 'item4')
    expect(item4?.imageUrl).toBe('https://images.unsplash.com/photo-cookies.jpg')
  })

  it('handles item with no photo gracefully', async () => {
    const mockAggregate = vi.fn().mockResolvedValue([
      {
        _id: 'branch1',
        branchName: 'Branch One',
        totalAmount: 100,
        totalQuantity: 1,
        count: 1,
        orders: ['RET-005'],
        items: [
          {
            id: 'ord5',
            itemId: 'item5',
            returnNumber: 'RET-005',
            status: 'pending',
            product: 'Water',
            quantity: 1,
            unitPrice: 100,
            subtotal: 100,
            notes: '',
            time: '2026-05-13T05:00:00.000Z',
            imageUrl: '',
            filename: '',
            prefix: '',
            proofPhoto: null,
          },
        ],
      },
    ])

    const mockReq = {
      payload: {
        find: vi.fn(),
        db: {
          collections: {
            'return-orders': {
              aggregate: mockAggregate,
            },
            media: {
              find: vi.fn(),
            },
          },
        },
        logger: {
          warn: vi.fn(),
          info: vi.fn(),
          error: vi.fn(),
        },
      },
      user: {
        role: 'superadmin',
      },
    } as unknown as PayloadRequest

    const result = await getReturnOrderReportData(mockReq, {
      startDate: '2026-05-13',
      endDate: '2026-05-13',
    })

    expect(result.groups[0].items[0].imageUrl).toBeUndefined()
  })
})
