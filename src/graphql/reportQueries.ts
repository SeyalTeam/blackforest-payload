import type { PayloadRequest } from 'payload'
import { getBranchBillingReportData } from '../services/reports/branchBilling'

type BranchBillingFilter = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
}

type BranchBillingQueryArgs = {
  filter?: BranchBillingFilter
}

export const reportGraphQLQueries = (graphQL: typeof import('graphql')) => {
  const BranchBillingFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'BranchBillingReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
    },
  })

  const BranchBillingTotalsType = new graphQL.GraphQLObjectType({
    name: 'BranchBillingReportTotals',
    fields: {
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cash: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      upi: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      card: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const BranchBillingStatType = new graphQL.GraphQLObjectType({
    name: 'BranchBillingReportStat',
    fields: {
      sNo: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      branchName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cash: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      upi: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      card: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const BranchBillingReportResultType = new graphQL.GraphQLObjectType({
    name: 'BranchBillingReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      stats: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(BranchBillingStatType)),
        ),
      },
      totals: { type: new graphQL.GraphQLNonNull(BranchBillingTotalsType) },
    },
  })

  return {
    branchBillingReport: {
      type: new graphQL.GraphQLNonNull(BranchBillingReportResultType),
      args: {
        filter: {
          type: BranchBillingFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: BranchBillingQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        return getBranchBillingReportData(context.req, args.filter || {})
      },
    },
  }
}
