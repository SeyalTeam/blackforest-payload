import { describe, expect, it, vi } from 'vitest'
import * as graphQL from 'graphql'
import type { PayloadRequest } from 'payload'
import { readGraphQLQueries } from '@/graphql/readQueries'

type MockPayload = {
  db: {
    collections: {
      billings: {
        aggregate: ReturnType<typeof vi.fn>
      }
    }
  }
  find: ReturnType<typeof vi.fn>
  findGlobal: ReturnType<typeof vi.fn>
}

type ResolverUser = {
  id?: string
  branch?: string
  role?: string
}

type ResolverContext = {
  req: PayloadRequest
}

const buildQueries = () => readGraphQLQueries(graphQL)

const toCursor = (page: number): string => Buffer.from(`page:${page}`).toString('base64')

const buildContext = (
  payload: MockPayload,
  user: ResolverUser = {
    id: 'usr_admin',
    role: 'superadmin',
  },
): ResolverContext => ({
  req: {
    payload,
    user,
  } as unknown as PayloadRequest,
})

describe('Phase 3 GraphQL read queries', () => {
  it('products query applies pagination + branch filter and returns stable shape', async () => {
    const payload: MockPayload = {
      findGlobal: vi.fn(),
      db: {
        collections: {
          billings: {
            aggregate: vi.fn(),
          },
        },
      },
      find: vi.fn(async (args) => {
        if (args.collection === 'products') {
          return {
            docs: [
              {
                id: 'prd_1',
                name: 'Paneer Roll',
                category: 'cat_1',
                isAvailable: true,
                productId: '00001',
                upc: '8901234000012',
                createdAt: '2026-04-30T10:00:00.000Z',
                updatedAt: '2026-04-30T10:05:00.000Z',
              },
            ],
            hasNextPage: false,
            totalDocs: 1,
          }
        }

        throw new Error(`Unexpected collection ${(args as { collection?: string }).collection}`)
      }),
    }

    const context = buildContext(payload)

    const queries = buildQueries()
    const result = await queries.products.resolve(
      null,
      {
        filter: {
          branchId: 'br_1',
          isAvailable: true,
          nameLike: 'paneer',
        },
        first: 20,
        after: toCursor(1),
      },
      context,
    )

    expect(payload.find).toHaveBeenCalledTimes(1)
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'products',
        page: 2,
        limit: 20,
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { name: { like: 'paneer' } },
            { isAvailable: { equals: true } },
            { inactiveBranches: { not_equals: 'br_1' } },
          ]),
        }),
      }),
    )

    expect(result.nodes).toHaveLength(1)
    expect(result.pageInfo).toEqual({
      hasNextPage: false,
      nextCursor: null,
      currentPage: 2,
      pageSize: 20,
      totalDocs: 1,
    })
  })

  it('products query rejects branch-scoped users requesting a different branch', async () => {
    const payload: MockPayload = {
      findGlobal: vi.fn(),
      db: {
        collections: {
          billings: {
            aggregate: vi.fn(),
          },
        },
      },
      find: vi.fn(),
    }

    const queries = buildQueries()

    await expect(
      queries.products.resolve(
        null,
        {
          filter: {
            branchId: 'br_2',
          },
          first: 10,
        },
        buildContext(payload, { id: 'usr_1', role: 'cashier', branch: 'br_1' }),
      ),
    ).rejects.toThrow('Forbidden: branch scope mismatch')

    expect(payload.find).not.toHaveBeenCalled()
  })

  it('categories query applies filters and cursor pagination', async () => {
    const payload: MockPayload = {
      findGlobal: vi.fn(),
      db: {
        collections: {
          billings: {
            aggregate: vi.fn(),
          },
        },
      },
      find: vi.fn(async (args) => {
        if (args.collection === 'categories') {
          return {
            docs: [
              {
                id: 'cat_1',
                name: 'Rolls',
                isBilling: true,
                isCake: false,
                isStock: false,
                isKitchen: true,
                createdAt: '2026-04-30T10:00:00.000Z',
                updatedAt: '2026-04-30T10:05:00.000Z',
              },
            ],
            hasNextPage: true,
            totalDocs: 3,
          }
        }
        throw new Error(`Unexpected collection ${(args as { collection?: string }).collection}`)
      }),
    }

    const context = buildContext(payload)

    const queries = buildQueries()
    const result = await queries.categories.resolve(
      null,
      {
        filter: {
          companyId: 'cmp_1',
          isBilling: true,
          nameLike: 'roll',
        },
        first: 10,
        after: toCursor(0),
      },
      context,
    )

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'categories',
        page: 1,
        limit: 10,
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { company: { in: ['cmp_1'] } },
            { name: { like: 'roll' } },
            { isBilling: { equals: true } },
          ]),
        }),
      }),
    )
    expect(result.pageInfo.hasNextPage).toBe(true)
    expect(typeof result.pageInfo.nextCursor).toBe('string')
  })

  it('widgetSettings returns branch-scoped flags', async () => {
    const payload: MockPayload = {
      find: vi.fn(),
      db: {
        collections: {
          billings: {
            aggregate: vi.fn(),
          },
        },
      },
      findGlobal: vi.fn(async () => ({
        tableOrderCustomerDetailsByBranch: [
          {
            branch: 'br_1',
            showCustomerDetailsForTableOrders: false,
            allowSkipCustomerDetailsForTableOrders: true,
            showCustomerHistoryForTableOrders: false,
            autoSubmitCustomerDetailsForTableOrders: true,
          },
        ],
        billingOrderCustomerDetailsByBranch: [
          {
            branch: 'br_1',
            showCustomerDetailsForBillingOrders: true,
            allowSkipCustomerDetailsForBillingOrders: false,
            showCustomerHistoryForBillingOrders: true,
            autoSubmitCustomerDetailsForBillingOrders: false,
          },
        ],
      })),
    }

    const context = buildContext(payload)

    const queries = buildQueries()
    const result = await queries.widgetSettings.resolve(
      null,
      {
        branchId: 'br_1',
      },
      context,
    )

    expect(payload.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'widget-settings',
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        branchId: 'br_1',
        tableOrderShowCustomerDetails: false,
        billingOrderAllowSkip: false,
        source: 'branch-specific',
      }),
    )
  })

  it('customerLookup applies phone + branch scoping and returns summary + recent bills', async () => {
    const aggregate = vi
      .fn()
      .mockResolvedValueOnce([
        {
          totalBills: 2,
          totalAmount: 540,
          lastBillAt: '2026-04-30T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          _id: 'bill_1',
          invoiceNumber: 'INV-001',
          status: 'completed',
          totalAmount: 220,
          createdAt: '2026-04-30T07:00:00.000Z',
          branch: 'br_1',
        },
      ])

    const payload: MockPayload = {
      findGlobal: vi.fn(),
      db: {
        collections: {
          billings: {
            aggregate,
          },
        },
      },
      find: vi.fn(async (args) => {
        if (args.collection === 'customers') {
          return {
            docs: [
              {
                id: 'cus_1',
                name: 'Ravi',
                phoneNumber: '9876543210',
                rewardPoints: 12,
                rewardProgressAmount: 65,
                isOfferEligible: true,
                totalOffersRedeemed: 3,
              },
            ],
          }
        }
        throw new Error(`Unexpected collection ${(args as { collection?: string }).collection}`)
      }),
    }

    const context = buildContext(payload)

    const queries = buildQueries()
    const result = await queries.customerLookup.resolve(
      null,
      {
        phoneNumber: '9876543210',
        branchId: 'br_1',
        includeCancelled: false,
        first: 5,
      },
      context,
    )

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'customers',
        where: expect.any(Object),
      }),
    )

    expect(aggregate).toHaveBeenCalledTimes(2)
    const firstPipeline = aggregate.mock.calls[0][0] as unknown[]
    const firstMatch = (firstPipeline[0] as { $match?: Record<string, unknown> }).$match || {}
    expect(firstMatch.status).toEqual({ $ne: 'cancelled' })
    expect(firstMatch.$expr).toEqual({ $eq: [{ $toString: '$branch' }, 'br_1'] })

    expect(result).toEqual(
      expect.objectContaining({
        exists: true,
        isNewCustomer: false,
        billingSummary: {
          totalBills: 2,
          totalAmount: 540,
          lastBillAt: '2026-04-30T08:00:00.000Z',
        },
      }),
    )
    expect(result.recentBills).toHaveLength(1)
  })

  it('customerLookup auto-scopes to the logged-in branch for branch-scoped roles', async () => {
    const aggregate = vi
      .fn()
      .mockResolvedValueOnce([
        {
          totalBills: 0,
          totalAmount: 0,
          lastBillAt: null,
        },
      ])
      .mockResolvedValueOnce([])

    const payload: MockPayload = {
      findGlobal: vi.fn(),
      db: {
        collections: {
          billings: {
            aggregate,
          },
        },
      },
      find: vi.fn(async () => ({ docs: [] })),
    }

    const queries = buildQueries()
    const result = await queries.customerLookup.resolve(
      null,
      {
        phoneNumber: '9876543210',
      },
      buildContext(payload, { id: 'usr_1', role: 'waiter', branch: 'br_5' }),
    )

    const firstPipeline = aggregate.mock.calls[0][0] as unknown[]
    const firstMatch = (firstPipeline[0] as { $match?: Record<string, unknown> }).$match || {}
    expect(firstMatch.$expr).toEqual({ $eq: [{ $toString: '$branch' }, 'br_5'] })
    expect(result.exists).toBe(false)
    expect(result.isNewCustomer).toBe(true)
  })

  it('reviews query returns paginated response shape', async () => {
    const payload: MockPayload = {
      findGlobal: vi.fn(),
      db: {
        collections: {
          billings: {
            aggregate: vi.fn(),
          },
        },
      },
      find: vi.fn(async (args) => {
        if (args.collection === 'reviews') {
          return {
            docs: [
              {
                id: 'rev_1',
                customerName: 'Ravi',
                customerPhone: '9876543210',
                branch: 'br_1',
                createdAt: '2026-04-30T06:00:00.000Z',
                updatedAt: '2026-04-30T06:30:00.000Z',
                items: [
                  {
                    rating: 5,
                    feedback: 'Great',
                    status: 'approved',
                    product: 'prd_1',
                  },
                ],
              },
            ],
            hasNextPage: true,
            totalDocs: 2,
          }
        }
        throw new Error(`Unexpected collection ${(args as { collection?: string }).collection}`)
      }),
    }

    const context = buildContext(payload)

    const queries = buildQueries()
    const result = await queries.reviews.resolve(
      null,
      {
        customerPhone: '9876543210',
        first: 1,
        after: toCursor(0),
      },
      context,
    )

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'reviews',
        limit: 1,
        page: 1,
        where: expect.any(Object),
      }),
    )
    expect(result.nodes).toHaveLength(1)
    expect(result.pageInfo.hasNextPage).toBe(true)
    expect(typeof result.pageInfo.nextCursor).toBe('string')
  })

  it('reviews query requires authenticated user context', async () => {
    const payload: MockPayload = {
      findGlobal: vi.fn(),
      db: {
        collections: {
          billings: {
            aggregate: vi.fn(),
          },
        },
      },
      find: vi.fn(),
    }

    const queries = buildQueries()
    await expect(
      queries.reviews.resolve(
        null,
        {
          customerPhone: '9876543210',
        },
        { req: { payload } as unknown as PayloadRequest },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})
