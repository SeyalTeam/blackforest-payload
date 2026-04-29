import type { PayloadRequest, Where } from 'payload'

type ProductFilter = {
  branchId?: null | string
  categoryId?: null | string
  companyId?: null | string
  isAvailable?: boolean | null
  nameLike?: null | string
  upc?: null | string
}

type ProductsArgs = {
  after?: null | string
  filter?: ProductFilter
  first?: null | number
}

type CategoryFilter = {
  companyId?: null | string
  isBilling?: boolean | null
  nameLike?: null | string
}

type CategoriesArgs = {
  after?: null | string
  filter?: CategoryFilter
  first?: null | number
}

type WidgetSettingsArgs = {
  branchId: string
}

type CustomerLookupArgs = {
  branchId?: null | string
  first?: null | number
  includeCancelled?: null | boolean
  phoneNumber: string
}

type ReviewsArgs = {
  after?: null | string
  customerPhone: string
  first?: null | number
}

type BillingsCollectionModel = {
  aggregate: (pipeline: unknown[]) => Promise<unknown[]>
}

const DEFAULT_PRODUCTS_PAGE_SIZE = 50
const DEFAULT_CATEGORIES_PAGE_SIZE = 40
const DEFAULT_CUSTOMER_LOOKUP_BILL_LIMIT = 15
const DEFAULT_REVIEWS_PAGE_SIZE = 50

const MAX_PRODUCTS_PAGE_SIZE = 100
const MAX_CATEGORIES_PAGE_SIZE = 50
const MAX_CUSTOMER_LOOKUP_BILL_LIMIT = 50
const MAX_REVIEWS_PAGE_SIZE = 100

const BRANCH_SCOPED_ROLES = new Set([
  'branch',
  'kitchen',
  'waiter',
  'cashier',
  'supervisor',
  'delivery',
  'driver',
  'chef',
])

type RequestUser = {
  id?: unknown
  role?: unknown
  branch?: unknown
}

const toText = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const toInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Math.trunc(toNumber(value, fallback))
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, parsed)
}

const toId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value && typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown }
    if (record.id != null) return toId(record.id)
    if (record._id != null) return toId(record._id)
  }
  return null
}

const encodePageCursor = (page: number): string => Buffer.from(`page:${page}`).toString('base64')

const decodePageCursor = (cursor: unknown): number => {
  if (typeof cursor !== 'string' || cursor.trim().length === 0) return 0
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8')
    if (!decoded.startsWith('page:')) return 0
    const page = Number.parseInt(decoded.slice(5), 10)
    return Number.isFinite(page) && page >= 0 ? page : 0
  } catch (_error) {
    return 0
  }
}

const toPhoneDigits = (value: string): string => value.replace(/\D/g, '')

const buildPhoneCandidates = (phoneNumber: string): string[] => {
  const normalized = phoneNumber.trim()
  const digits = toPhoneDigits(normalized)
  const values = new Set<string>()

  if (normalized.length > 0) values.add(normalized)
  if (digits.length > 0) values.add(digits)

  if (digits.length === 10) {
    values.add(`91${digits}`)
  } else if (digits.length > 10) {
    const lastTen = digits.slice(-10)
    values.add(lastTen)
    values.add(`91${lastTen}`)
  }

  return Array.from(values)
}

const buildWhereOrEquals = (fieldPath: string, candidates: string[]): Where => {
  if (candidates.length <= 1) {
    return {
      [fieldPath]: {
        equals: candidates[0],
      },
    }
  }

  return {
    or: candidates.map((candidate) => ({
      [fieldPath]: {
        equals: candidate,
      },
    })),
  }
}

const clampNullableBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value
  return null
}

const getRelationshipId = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    return getRelationshipId((value as { id?: unknown }).id)
  }
  if (value && typeof value === 'object' && '_id' in value) {
    return getRelationshipId((value as { _id?: unknown })._id)
  }
  return null
}

const getAuthenticatedUser = (req: PayloadRequest): RequestUser => {
  const user = req.user as RequestUser | undefined
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

const resolveEffectiveBranchScope = (
  user: RequestUser,
  requestedBranchId: string | null,
): string | null => {
  const role = toText(user.role) || ''
  const normalizedRequested = requestedBranchId && requestedBranchId !== 'all' ? requestedBranchId : null

  if (!BRANCH_SCOPED_ROLES.has(role)) {
    return normalizedRequested
  }

  const userBranchId = getRelationshipId(user.branch)
  if (!userBranchId) {
    throw new Error('Forbidden: branch scope missing')
  }

  if (normalizedRequested && normalizedRequested !== userBranchId) {
    throw new Error('Forbidden: branch scope mismatch')
  }

  return userBranchId
}

const getWidgetSettingForBranch = (
  branchId: string,
  rows: unknown,
  shape: {
    autoSubmitField: string
    allowSkipField: string
    showDetailsField: string
    showHistoryField: string
  },
) => {
  const list = Array.isArray(rows) ? rows : []
  const matched = list.find((entry) => {
    if (!entry || typeof entry !== 'object') return false
    return getRelationshipId((entry as { branch?: unknown }).branch) === branchId
  }) as Record<string, unknown> | undefined

  return {
    autoSubmit:
      typeof matched?.[shape.autoSubmitField] === 'boolean'
        ? (matched[shape.autoSubmitField] as boolean)
        : true,
    allowSkip:
      typeof matched?.[shape.allowSkipField] === 'boolean'
        ? (matched[shape.allowSkipField] as boolean)
        : true,
    showDetails:
      typeof matched?.[shape.showDetailsField] === 'boolean'
        ? (matched[shape.showDetailsField] as boolean)
        : true,
    showHistory:
      typeof matched?.[shape.showHistoryField] === 'boolean'
        ? (matched[shape.showHistoryField] as boolean)
        : true,
    source: matched ? 'branch-specific' : 'default',
  }
}

const parseCustomerLookupBillSummary = (row: unknown) => {
  const record = (row && typeof row === 'object' ? row : {}) as {
    lastBillAt?: unknown
    totalAmount?: unknown
    totalBills?: unknown
  }

  return {
    lastBillAt: toText(record.lastBillAt) || null,
    totalAmount: Math.round(Math.max(0, toNumber(record.totalAmount, 0)) * 100) / 100,
    totalBills: Math.max(0, Math.trunc(toNumber(record.totalBills, 0))),
  }
}

export const readGraphQLQueries = (graphQL: typeof import('graphql')) => {
  const ProductFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'ReadProductFilterInput',
    fields: {
      companyId: { type: graphQL.GraphQLID },
      categoryId: { type: graphQL.GraphQLID },
      nameLike: { type: graphQL.GraphQLString },
      upc: { type: graphQL.GraphQLString },
      isAvailable: { type: graphQL.GraphQLBoolean },
      branchId: { type: graphQL.GraphQLID },
    },
  })

  const CategoryFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'ReadCategoryFilterInput',
    fields: {
      companyId: { type: graphQL.GraphQLID },
      nameLike: { type: graphQL.GraphQLString },
      isBilling: { type: graphQL.GraphQLBoolean },
    },
  })

  const ReadProductType = new graphQL.GraphQLObjectType({
    name: 'ReadProduct',
    fields: {
      id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLID) },
      name: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      productId: { type: graphQL.GraphQLString },
      upc: { type: graphQL.GraphQLString },
      categoryId: { type: graphQL.GraphQLID },
      isAvailable: { type: graphQL.GraphQLBoolean },
      createdAt: { type: graphQL.GraphQLString },
      updatedAt: { type: graphQL.GraphQLString },
    },
  })

  const ReadCategoryType = new graphQL.GraphQLObjectType({
    name: 'ReadCategory',
    fields: {
      id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLID) },
      name: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      isBilling: { type: graphQL.GraphQLBoolean },
      isCake: { type: graphQL.GraphQLBoolean },
      isStock: { type: graphQL.GraphQLBoolean },
      isKitchen: { type: graphQL.GraphQLBoolean },
      createdAt: { type: graphQL.GraphQLString },
      updatedAt: { type: graphQL.GraphQLString },
    },
  })

  const PageInfoType = new graphQL.GraphQLObjectType({
    name: 'ReadPageInfo',
    fields: {
      hasNextPage: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      nextCursor: { type: graphQL.GraphQLString },
      currentPage: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      pageSize: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalDocs: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const ProductConnectionType = new graphQL.GraphQLObjectType({
    name: 'ReadProductConnection',
    fields: {
      nodes: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ReadProductType)),
        ),
      },
      pageInfo: { type: new graphQL.GraphQLNonNull(PageInfoType) },
    },
  })

  const CategoryConnectionType = new graphQL.GraphQLObjectType({
    name: 'ReadCategoryConnection',
    fields: {
      nodes: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ReadCategoryType)),
        ),
      },
      pageInfo: { type: new graphQL.GraphQLNonNull(PageInfoType) },
    },
  })

  const WidgetSettingsType = new graphQL.GraphQLObjectType({
    name: 'ReadWidgetSettings',
    fields: {
      branchId: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLID) },
      tableOrderShowCustomerDetails: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      tableOrderAllowSkip: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      tableOrderShowHistory: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      tableOrderAutoSubmit: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      billingOrderShowCustomerDetails: {
        type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean),
      },
      billingOrderAllowSkip: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      billingOrderShowHistory: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      billingOrderAutoSubmit: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      source: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
    },
  })

  const CustomerLookupBillType = new graphQL.GraphQLObjectType({
    name: 'ReadCustomerLookupBill',
    fields: {
      id: { type: graphQL.GraphQLID },
      invoiceNumber: { type: graphQL.GraphQLString },
      status: { type: graphQL.GraphQLString },
      totalAmount: { type: graphQL.GraphQLFloat },
      createdAt: { type: graphQL.GraphQLString },
      branchId: { type: graphQL.GraphQLID },
    },
  })

  const CustomerLookupCustomerType = new graphQL.GraphQLObjectType({
    name: 'ReadCustomerLookupCustomer',
    fields: {
      id: { type: graphQL.GraphQLID },
      name: { type: graphQL.GraphQLString },
      phoneNumber: { type: graphQL.GraphQLString },
      rewardPoints: { type: graphQL.GraphQLFloat },
      rewardProgressAmount: { type: graphQL.GraphQLFloat },
      isOfferEligible: { type: graphQL.GraphQLBoolean },
      totalOffersRedeemed: { type: graphQL.GraphQLInt },
    },
  })

  const CustomerLookupSummaryType = new graphQL.GraphQLObjectType({
    name: 'ReadCustomerLookupSummary',
    fields: {
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      lastBillAt: { type: graphQL.GraphQLString },
    },
  })

  const CustomerLookupType = new graphQL.GraphQLObjectType({
    name: 'ReadCustomerLookup',
    fields: {
      exists: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      isNewCustomer: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      customer: { type: CustomerLookupCustomerType },
      billingSummary: { type: new graphQL.GraphQLNonNull(CustomerLookupSummaryType) },
      recentBills: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(CustomerLookupBillType)),
        ),
      },
    },
  })

  const ReviewItemType = new graphQL.GraphQLObjectType({
    name: 'ReadReviewItem',
    fields: {
      rating: { type: graphQL.GraphQLFloat },
      feedback: { type: graphQL.GraphQLString },
      status: { type: graphQL.GraphQLString },
      chefReply: { type: graphQL.GraphQLString },
      repliedBy: { type: graphQL.GraphQLString },
      repliedAt: { type: graphQL.GraphQLString },
      productId: { type: graphQL.GraphQLID },
    },
  })

  const ReviewType = new graphQL.GraphQLObjectType({
    name: 'ReadReview',
    fields: {
      id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLID) },
      customerName: { type: graphQL.GraphQLString },
      customerPhone: { type: graphQL.GraphQLString },
      branchId: { type: graphQL.GraphQLID },
      createdAt: { type: graphQL.GraphQLString },
      updatedAt: { type: graphQL.GraphQLString },
      items: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ReviewItemType)),
        ),
      },
    },
  })

  const ReviewConnectionType = new graphQL.GraphQLObjectType({
    name: 'ReadReviewConnection',
    fields: {
      nodes: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ReviewType)),
        ),
      },
      pageInfo: { type: new graphQL.GraphQLNonNull(PageInfoType) },
    },
  })

  return {
    products: {
      type: new graphQL.GraphQLNonNull(ProductConnectionType),
      args: {
        filter: {
          type: new graphQL.GraphQLNonNull(ProductFilterInputType),
        },
        first: {
          type: graphQL.GraphQLInt,
        },
        after: {
          type: graphQL.GraphQLString,
        },
      },
      resolve: async (
        _source: unknown,
        args: ProductsArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        const req = context.req
        const user = getAuthenticatedUser(req)
        const filter = args.filter || {}
        const limit = toInt(args.first, DEFAULT_PRODUCTS_PAGE_SIZE, MAX_PRODUCTS_PAGE_SIZE)
        const page = decodePageCursor(args.after) + 1
        const whereClauses: unknown[] = []

        const categoryID = toText(filter.categoryId)
        if (categoryID) {
          whereClauses.push({
            category: {
              equals: categoryID,
            },
          })
        }

        const branchID = resolveEffectiveBranchScope(user, toText(filter.branchId))
        if (branchID) {
          whereClauses.push({
            inactiveBranches: {
              not_equals: branchID,
            },
          })
        }

        const upc = toText(filter.upc)
        if (upc) {
          whereClauses.push({
            upc: {
              equals: upc,
            },
          })
        }

        const nameLike = toText(filter.nameLike)
        if (nameLike) {
          whereClauses.push({
            name: {
              like: nameLike,
            },
          })
        }

        const isAvailable = clampNullableBoolean(filter.isAvailable)
        if (isAvailable !== null) {
          whereClauses.push({
            isAvailable: {
              equals: isAvailable,
            },
          })
        }

        const companyID = toText(filter.companyId)
        if (companyID) {
          const categoryResult = await req.payload.find({
            collection: 'categories',
            depth: 0,
            limit: 500,
            pagination: false,
          where: {
            company: {
              in: [companyID],
            },
          } as Where,
            overrideAccess: true,
          })

          const categoryIDs = categoryResult.docs
            .map((doc) => toId((doc as { id?: unknown }).id))
            .filter((id): id is string => Boolean(id))

          if (categoryIDs.length === 0) {
            return {
              nodes: [],
              pageInfo: {
                hasNextPage: false,
                nextCursor: null,
                currentPage: page,
                pageSize: limit,
                totalDocs: 0,
              },
            }
          }

          whereClauses.push({
            category: {
              in: categoryIDs,
            },
          })
        }

        const result = await req.payload.find({
          collection: 'products',
          depth: 0,
          limit,
          page,
          sort: 'name',
          where: whereClauses.length > 0 ? ({ and: whereClauses } as unknown as Where) : undefined,
          overrideAccess: true,
        })

        return {
          nodes: result.docs.map((doc) => {
            const product = doc as unknown as Record<string, unknown>
            return {
              id: toId(product.id) || '',
              name: toText(product.name) || '',
              productId: toText(product.productId),
              upc: toText(product.upc),
              categoryId: getRelationshipId(product.category),
              isAvailable: typeof product.isAvailable === 'boolean' ? product.isAvailable : null,
              createdAt: toText(product.createdAt),
              updatedAt: toText(product.updatedAt),
            }
          }),
          pageInfo: {
            hasNextPage: Boolean(result.hasNextPage),
            nextCursor: result.hasNextPage ? encodePageCursor(page) : null,
            currentPage: page,
            pageSize: limit,
            totalDocs: toInt(result.totalDocs, 0, Number.MAX_SAFE_INTEGER),
          },
        }
      },
    },
    categories: {
      type: new graphQL.GraphQLNonNull(CategoryConnectionType),
      args: {
        filter: {
          type: CategoryFilterInputType,
        },
        first: {
          type: graphQL.GraphQLInt,
        },
        after: {
          type: graphQL.GraphQLString,
        },
      },
      resolve: async (
        _source: unknown,
        args: CategoriesArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        const req = context.req
        getAuthenticatedUser(req)
        const filter = args.filter || {}
        const limit = toInt(args.first, DEFAULT_CATEGORIES_PAGE_SIZE, MAX_CATEGORIES_PAGE_SIZE)
        const page = decodePageCursor(args.after) + 1
        const whereClauses: unknown[] = []

        const companyID = toText(filter.companyId)
        if (companyID) {
          whereClauses.push({
            company: {
              in: [companyID],
            },
          })
        }

        const nameLike = toText(filter.nameLike)
        if (nameLike) {
          whereClauses.push({
            name: {
              like: nameLike,
            },
          })
        }

        const isBilling = clampNullableBoolean(filter.isBilling)
        if (isBilling !== null) {
          whereClauses.push({
            isBilling: {
              equals: isBilling,
            },
          })
        }

        const result = await req.payload.find({
          collection: 'categories',
          depth: 0,
          limit,
          page,
          sort: 'name',
          where: whereClauses.length > 0 ? ({ and: whereClauses } as unknown as Where) : undefined,
          overrideAccess: true,
        })

        return {
          nodes: result.docs.map((doc) => {
            const category = doc as unknown as Record<string, unknown>
            return {
              id: toId(category.id) || '',
              name: toText(category.name) || '',
              isBilling: typeof category.isBilling === 'boolean' ? category.isBilling : null,
              isCake: typeof category.isCake === 'boolean' ? category.isCake : null,
              isStock: typeof category.isStock === 'boolean' ? category.isStock : null,
              isKitchen: typeof category.isKitchen === 'boolean' ? category.isKitchen : null,
              createdAt: toText(category.createdAt),
              updatedAt: toText(category.updatedAt),
            }
          }),
          pageInfo: {
            hasNextPage: Boolean(result.hasNextPage),
            nextCursor: result.hasNextPage ? encodePageCursor(page) : null,
            currentPage: page,
            pageSize: limit,
            totalDocs: toInt(result.totalDocs, 0, Number.MAX_SAFE_INTEGER),
          },
        }
      },
    },
    widgetSettings: {
      type: new graphQL.GraphQLNonNull(WidgetSettingsType),
      args: {
        branchId: {
          type: new graphQL.GraphQLNonNull(graphQL.GraphQLID),
        },
      },
      resolve: async (
        _source: unknown,
        args: WidgetSettingsArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        const user = getAuthenticatedUser(context.req)
        const branchID = resolveEffectiveBranchScope(user, toText(args.branchId))
        if (!branchID) {
          throw new Error('branchId is required')
        }

        const settings = (await context.req.payload.findGlobal({
          slug: 'widget-settings',
          depth: 0,
          overrideAccess: true,
        })) as {
          billingOrderCustomerDetailsByBranch?: unknown
          tableOrderCustomerDetailsByBranch?: unknown
        }

        const tableOrder = getWidgetSettingForBranch(
          branchID,
          settings.tableOrderCustomerDetailsByBranch,
          {
            showDetailsField: 'showCustomerDetailsForTableOrders',
            allowSkipField: 'allowSkipCustomerDetailsForTableOrders',
            showHistoryField: 'showCustomerHistoryForTableOrders',
            autoSubmitField: 'autoSubmitCustomerDetailsForTableOrders',
          },
        )

        const billingOrder = getWidgetSettingForBranch(
          branchID,
          settings.billingOrderCustomerDetailsByBranch,
          {
            showDetailsField: 'showCustomerDetailsForBillingOrders',
            allowSkipField: 'allowSkipCustomerDetailsForBillingOrders',
            showHistoryField: 'showCustomerHistoryForBillingOrders',
            autoSubmitField: 'autoSubmitCustomerDetailsForBillingOrders',
          },
        )

        return {
          branchId: branchID,
          tableOrderShowCustomerDetails: tableOrder.showDetails,
          tableOrderAllowSkip: tableOrder.allowSkip,
          tableOrderShowHistory: tableOrder.showHistory,
          tableOrderAutoSubmit: tableOrder.autoSubmit,
          billingOrderShowCustomerDetails: billingOrder.showDetails,
          billingOrderAllowSkip: billingOrder.allowSkip,
          billingOrderShowHistory: billingOrder.showHistory,
          billingOrderAutoSubmit: billingOrder.autoSubmit,
          source:
            tableOrder.source === 'branch-specific' || billingOrder.source === 'branch-specific'
              ? 'branch-specific'
              : 'default',
        }
      },
    },
    customerLookup: {
      type: new graphQL.GraphQLNonNull(CustomerLookupType),
      args: {
        phoneNumber: {
          type: new graphQL.GraphQLNonNull(graphQL.GraphQLString),
        },
        branchId: {
          type: graphQL.GraphQLID,
        },
        includeCancelled: {
          type: graphQL.GraphQLBoolean,
        },
        first: {
          type: graphQL.GraphQLInt,
        },
      },
      resolve: async (
        _source: unknown,
        args: CustomerLookupArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        const req = context.req
        const user = getAuthenticatedUser(req)
        const phoneNumber = toText(args.phoneNumber)
        if (!phoneNumber) {
          throw new Error('phoneNumber is required')
        }

        const billLimit = toInt(
          args.first,
          DEFAULT_CUSTOMER_LOOKUP_BILL_LIMIT,
          MAX_CUSTOMER_LOOKUP_BILL_LIMIT,
        )
        const includeCancelled = Boolean(args.includeCancelled)
        const branchId = resolveEffectiveBranchScope(user, toText(args.branchId))
        const phoneCandidates = buildPhoneCandidates(phoneNumber)

        const customerResult = await req.payload.find({
          collection: 'customers',
          depth: 0,
          limit: 1,
          sort: '-updatedAt',
          where: buildWhereOrEquals('phoneNumber', phoneCandidates),
          overrideAccess: true,
        })

        const customerDoc = customerResult.docs[0] as unknown as Record<string, unknown> | undefined

        const BillingModel = req.payload.db.collections['billings'] as unknown as
          | BillingsCollectionModel
          | undefined
        if (!BillingModel) {
          throw new Error('Billings collection not found')
        }

        const billingMatch: Record<string, unknown> = {
          ['customerDetails.phoneNumber']: {
            $in: phoneCandidates,
          },
        }

        if (!includeCancelled) {
          billingMatch.status = { $ne: 'cancelled' }
        }

        if (branchId && branchId !== 'all') {
          billingMatch.$expr = {
            $eq: [{ $toString: '$branch' }, branchId],
          }
        }

        const [summaryRows, recentBillRows] = (await Promise.all([
          BillingModel.aggregate([
            { $match: billingMatch },
            {
              $group: {
                _id: null,
                totalBills: { $sum: 1 },
                totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
                lastBillAt: { $max: '$createdAt' },
              },
            },
          ]),
          BillingModel.aggregate([
            { $match: billingMatch },
            { $sort: { createdAt: -1 } },
            { $limit: billLimit },
            {
              $project: {
                _id: 1,
                invoiceNumber: 1,
                status: 1,
                totalAmount: { $ifNull: ['$totalAmount', 0] },
                createdAt: 1,
                branch: 1,
              },
            },
          ]),
        ])) as [unknown[], unknown[]]

        const summary = parseCustomerLookupBillSummary(summaryRows[0])

        return {
          exists: Boolean(customerDoc),
          isNewCustomer: !customerDoc,
          customer: customerDoc
            ? {
                id: toId(customerDoc.id),
                name: toText(customerDoc.name),
                phoneNumber: toText(customerDoc.phoneNumber) || phoneNumber,
                rewardPoints: toNumber(customerDoc.rewardPoints, 0),
                rewardProgressAmount: toNumber(customerDoc.rewardProgressAmount, 0),
                isOfferEligible: Boolean(customerDoc.isOfferEligible),
                totalOffersRedeemed: toInt(customerDoc.totalOffersRedeemed, 0, 1000000),
              }
            : null,
          billingSummary: summary,
          recentBills: recentBillRows.map((row) => {
            const bill = row as Record<string, unknown>
            return {
              id: toId(bill._id),
              invoiceNumber: toText(bill.invoiceNumber),
              status: toText(bill.status),
              totalAmount: toNumber(bill.totalAmount, 0),
              createdAt: toText(bill.createdAt),
              branchId: toId(bill.branch),
            }
          }),
        }
      },
    },
    reviews: {
      type: new graphQL.GraphQLNonNull(ReviewConnectionType),
      args: {
        customerPhone: {
          type: new graphQL.GraphQLNonNull(graphQL.GraphQLString),
        },
        first: {
          type: graphQL.GraphQLInt,
        },
        after: {
          type: graphQL.GraphQLString,
        },
      },
      resolve: async (
        _source: unknown,
        args: ReviewsArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        const req = context.req
        getAuthenticatedUser(req)
        const customerPhone = toText(args.customerPhone)
        if (!customerPhone) {
          throw new Error('customerPhone is required')
        }

        const limit = toInt(args.first, DEFAULT_REVIEWS_PAGE_SIZE, MAX_REVIEWS_PAGE_SIZE)
        const page = decodePageCursor(args.after) + 1
        const phoneCandidates = buildPhoneCandidates(customerPhone)

        const result = await req.payload.find({
          collection: 'reviews',
          depth: 0,
          limit,
          page,
          sort: '-createdAt',
          where: buildWhereOrEquals('customerPhone', phoneCandidates),
          overrideAccess: true,
        })

        return {
          nodes: result.docs.map((doc) => {
            const review = doc as unknown as Record<string, unknown>
            const items = Array.isArray(review.items) ? review.items : []
            return {
              id: toId(review.id) || '',
              customerName: toText(review.customerName),
              customerPhone: toText(review.customerPhone),
              branchId: toId(review.branch),
              createdAt: toText(review.createdAt),
              updatedAt: toText(review.updatedAt),
              items: items.map((item) => {
                const row = item as Record<string, unknown>
                return {
                  rating: toNumber(row.rating, 0),
                  feedback: toText(row.feedback),
                  status: toText(row.status),
                  chefReply: toText(row.chefReply),
                  repliedBy: toText(row.repliedBy),
                  repliedAt: toText(row.repliedAt),
                  productId: toId(row.product),
                }
              }),
            }
          }),
          pageInfo: {
            hasNextPage: Boolean(result.hasNextPage),
            nextCursor: result.hasNextPage ? encodePageCursor(page) : null,
            currentPage: page,
            pageSize: limit,
            totalDocs: toInt(result.totalDocs, 0, Number.MAX_SAFE_INTEGER),
          },
        }
      },
    },
  }
}
