import type { PayloadRequest } from 'payload'
import { getBranchBillingReportData } from '../services/reports/branchBilling'
import { getCategoryWiseReportData } from '../services/reports/categoryWise'
import { getClosingEntryReportData } from '../services/reports/closingEntry'
import { getExpenseReportData } from '../services/reports/expense'
import { getInventoryReportData } from '../services/reports/inventory'
import { getProductPreparationBillDetailsData } from '../services/reports/productPreparation'
import { getProductWiseReportData } from '../services/reports/productWise'
import { getReturnOrderReportData } from '../services/reports/returnOrder'
import { getWaiterWiseBillingReportData } from '../services/reports/waiterWise'
import { getStockOrderReportData } from '../services/reports/stockOrder'

type BranchBillingFilter = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
}

type BranchBillingQueryArgs = {
  filter?: BranchBillingFilter
}

type ClosingEntryFilter = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
}

type ClosingEntryQueryArgs = {
  filter?: ClosingEntryFilter
}

type InventoryFilter = {
  branch?: null | string
  category?: null | string
  department?: null | string
  product?: null | string
}

type InventoryQueryArgs = {
  filter?: InventoryFilter
}

type CategoryWiseFilter = {
  branch?: null | string
  category?: null | string
  department?: null | string
  endDate?: null | string
  startDate?: null | string
}

type CategoryWiseQueryArgs = {
  filter?: CategoryWiseFilter
}

type ProductWiseFilter = {
  branch?: null | string
  category?: null | string
  chefId?: null | string
  department?: null | string
  endDate?: null | string
  kitchenId?: null | string
  product?: null | string
  startDate?: null | string
}

type ProductWiseQueryArgs = {
  filter?: ProductWiseFilter
}

type ProductPreparationBillDetailsFilter = {
  branch?: null | string
  category?: null | string
  chefId?: null | string
  department?: null | string
  endDate?: null | string
  kitchenId?: null | string
  productId?: null | string
  startDate?: null | string
  status?: null | string
}

type ProductPreparationBillDetailsQueryArgs = {
  filter?: ProductPreparationBillDetailsFilter
}

type WaiterWiseFilter = {
  branch?: null | string
  endDate?: null | string
  hour?: null | number
  startDate?: null | string
  waiter?: null | string
}

type WaiterWiseQueryArgs = {
  filter?: WaiterWiseFilter
}

type ExpenseFilter = {
  branch?: null | string
  category?: null | string
  endDate?: null | string
  startDate?: null | string
}

type ExpenseQueryArgs = {
  filter?: ExpenseFilter
}

type ReturnOrderFilter = {
  branch?: null | string
  endDate?: null | string
  startDate?: null | string
  status?: null | string
}

type ReturnOrderQueryArgs = {
  filter?: ReturnOrderFilter
}

type StockOrderFilter = {
  startDate?: null | string
  endDate?: null | string
  branch?: null | string
  department?: null | string
  category?: null | string
  product?: null | string
  status?: null | string
  orderType?: null | string
  invoice?: null | string
}

type StockOrderQueryArgs = {
  filter?: StockOrderFilter
}

export const reportGraphQLQueries = (graphQL: typeof import('graphql')) => {
  const BranchBillingFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'BranchBillingReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
      trendPeriod: { type: graphQL.GraphQLString },
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
      completedCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      completedAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      settledCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      settledAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cancelledCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      cancelledAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      tableOrderCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      tableOrderAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      nonTableOrderCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      nonTableOrderAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalExpenses: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalReturns: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalClosingSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
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
      completedCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      completedAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      settledCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      settledAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cancelledCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      cancelledAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const BranchBillingTrendPointType = new graphQL.GraphQLObjectType({
    name: 'BranchBillingTrendPoint',
    fields: {
      label: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      fullLabel: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalExpense: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalReturn: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const BranchBillingHeatmapPointType = new graphQL.GraphQLObjectType({
    name: 'BranchBillingHeatmapPoint',
    fields: {
      day: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      hour: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      amount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      count: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const BranchBillingSummaryType = new graphQL.GraphQLObjectType({
    name: 'BranchBillingSummary',
    fields: {
      averageTrendAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      trendPercentage: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      medianAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
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
      trendData: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(BranchBillingTrendPointType)),
        ),
      },
      summary: { type: new graphQL.GraphQLNonNull(BranchBillingSummaryType) },
      heatmapData: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(BranchBillingHeatmapPointType)),
        ),
      },
    },
  })

  const ClosingEntryReportFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'ClosingEntryReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
    },
  })

  const ClosingEntryReportExpenseDetailType = new graphQL.GraphQLObjectType({
    name: 'ClosingEntryReportExpenseDetail',
    fields: {
      category: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      reason: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      amount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      imageUrl: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      date: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
    },
  })

  const ClosingEntryReportDenominationsType = new graphQL.GraphQLObjectType({
    name: 'ClosingEntryReportDenominations',
    fields: {
      count2000: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count500: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count200: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count100: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count50: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count10: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count5: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const ClosingEntryReportEntryType = new graphQL.GraphQLObjectType({
    name: 'ClosingEntryReportEntry',
    fields: {
      closingNumber: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      createdAt: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      systemSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      manualSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      onlineSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      expenses: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cash: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      upi: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      card: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      denominations: { type: new graphQL.GraphQLNonNull(ClosingEntryReportDenominationsType) },
      expenseDetails: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ClosingEntryReportExpenseDetailType)),
        ),
      },
    },
  })

  const ClosingEntryReportStatType = new graphQL.GraphQLObjectType({
    name: 'ClosingEntryReportStat',
    fields: {
      _id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      branchName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      totalEntries: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      closingNumbers: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(graphQL.GraphQLString)),
        ),
      },
      lastUpdated: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      entries: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ClosingEntryReportEntryType)),
        ),
      },
      sNo: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      expenseDetails: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ClosingEntryReportExpenseDetailType)),
        ),
      },
      systemSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      manualSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      onlineSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      expenses: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      returnTotal: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      stockOrders: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      net: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cash: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      upi: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      card: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      count2000: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count500: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count200: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count100: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count50: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count10: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      count5: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const ClosingEntryReportTotalsType = new graphQL.GraphQLObjectType({
    name: 'ClosingEntryReportTotals',
    fields: {
      totalEntries: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      systemSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      manualSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      onlineSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalSales: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      expenses: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      returnTotal: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      stockOrders: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      net: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cash: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      upi: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      card: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const ClosingEntryReportResultType = new graphQL.GraphQLObjectType({
    name: 'ClosingEntryReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      stats: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ClosingEntryReportStatType)),
        ),
      },
      totals: { type: new graphQL.GraphQLNonNull(ClosingEntryReportTotalsType) },
    },
  })

  const InventoryReportFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'InventoryReportFilterInput',
    fields: {
      department: { type: graphQL.GraphQLString },
      category: { type: graphQL.GraphQLString },
      product: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
    },
  })

  const InventoryReportBranchType = new graphQL.GraphQLObjectType({
    name: 'InventoryReportBranch',
    fields: {
      id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      name: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      inventory: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      value: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      sold: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      returned: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      received: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      instock: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      initial: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const InventoryReportProductType = new graphQL.GraphQLObjectType({
    name: 'InventoryReportProduct',
    fields: {
      id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      name: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      totalInventory: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalValue: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalSold: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalReturned: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalReceived: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalInstock: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      branches: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(InventoryReportBranchType)),
        ),
      },
    },
  })

  const InventoryReportResultType = new graphQL.GraphQLObjectType({
    name: 'InventoryReportResult',
    fields: {
      timestamp: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      products: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(InventoryReportProductType)),
        ),
      },
    },
  })

  const CategoryWiseFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'CategoryWiseReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
      category: { type: graphQL.GraphQLString },
      department: { type: graphQL.GraphQLString },
    },
  })

  const CategoryWiseBranchSaleType = new graphQL.GraphQLObjectType({
    name: 'CategoryWiseBranchSale',
    fields: {
      branchCode: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      amount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      quantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const CategoryWiseBranchTotalType = new graphQL.GraphQLObjectType({
    name: 'CategoryWiseBranchTotal',
    fields: {
      branchCode: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      amount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const CategoryWiseReportStatType = new graphQL.GraphQLObjectType({
    name: 'CategoryWiseReportStat',
    fields: {
      sNo: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      categoryName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      totalQuantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      branchSales: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(CategoryWiseBranchSaleType)),
        ),
      },
    },
  })

  const CategoryWiseReportTotalsType = new graphQL.GraphQLObjectType({
    name: 'CategoryWiseReportTotals',
    fields: {
      totalQuantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      branchTotals: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(CategoryWiseBranchTotalType)),
        ),
      },
    },
  })

  const CategoryWiseReportResultType = new graphQL.GraphQLObjectType({
    name: 'CategoryWiseReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      branchHeaders: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(graphQL.GraphQLString)),
        ),
      },
      stats: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(CategoryWiseReportStatType)),
        ),
      },
      totals: { type: new graphQL.GraphQLNonNull(CategoryWiseReportTotalsType) },
    },
  })

  const ProductWiseFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'ProductWiseReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
      category: { type: graphQL.GraphQLString },
      department: { type: graphQL.GraphQLString },
      product: { type: graphQL.GraphQLString },
      chefId: { type: graphQL.GraphQLString },
      kitchenId: { type: graphQL.GraphQLString },
    },
  })

  const ProductWiseBranchSaleType = new graphQL.GraphQLObjectType({
    name: 'ProductWiseBranchSale',
    fields: {
      branchCode: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      amount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      quantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const ProductWiseBranchTotalType = new graphQL.GraphQLObjectType({
    name: 'ProductWiseBranchTotal',
    fields: {
      branchCode: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      amount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const ProductWiseReportStatType = new graphQL.GraphQLObjectType({
    name: 'ProductWiseReportStat',
    fields: {
      sNo: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      productId: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      productName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      price: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      unit: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      preparationTime: { type: graphQL.GraphQLFloat },
      averagePreparationTime: { type: graphQL.GraphQLFloat },
      averagePreparationSampleSize: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalQuantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      branchSales: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ProductWiseBranchSaleType)),
        ),
      },
    },
  })

  const ProductWiseReportTotalsType = new graphQL.GraphQLObjectType({
    name: 'ProductWiseReportTotals',
    fields: {
      totalQuantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      branchTotals: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ProductWiseBranchTotalType)),
        ),
      },
    },
  })

  const ProductWiseReportResultType = new graphQL.GraphQLObjectType({
    name: 'ProductWiseReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      branchHeaders: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(graphQL.GraphQLString)),
        ),
      },
      stats: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ProductWiseReportStatType)),
        ),
      },
      totals: { type: new graphQL.GraphQLNonNull(ProductWiseReportTotalsType) },
    },
  })

  const ProductPreparationBillDetailsReportFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'ProductPreparationBillDetailsReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
      category: { type: graphQL.GraphQLString },
      department: { type: graphQL.GraphQLString },
      productId: { type: graphQL.GraphQLString },
      chefId: { type: graphQL.GraphQLString },
      kitchenId: { type: graphQL.GraphQLString },
      status: { type: graphQL.GraphQLString },
    },
  })

  const ProductPreparationBillDetailsAvailableChefType = new graphQL.GraphQLObjectType({
    name: 'ProductPreparationBillDetailsAvailableChef',
    fields: {
      id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      name: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
    },
  })

  const ProductPreparationBillDetailsItemType = new graphQL.GraphQLObjectType({
    name: 'ProductPreparationBillDetailsItem',
    fields: {
      billingId: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      billNumber: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      amount: { type: graphQL.GraphQLFloat },
      productId: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      productName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      orderedAt: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      preparedAt: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      preparationTime: { type: graphQL.GraphQLFloat },
      chefPreparationTime: { type: graphQL.GraphQLFloat },
      productStandardPreparationTime: { type: graphQL.GraphQLFloat },
      chefName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      quantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      status: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
    },
  })

  const ProductPreparationBillDetailsReportResultType = new graphQL.GraphQLObjectType({
    name: 'ProductPreparationBillDetailsReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      productId: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      availableChefs: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ProductPreparationBillDetailsAvailableChefType)),
        ),
      },
      details: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ProductPreparationBillDetailsItemType)),
        ),
      },
    },
  })

  const WaiterWiseFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'WaiterWiseReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
      waiter: { type: graphQL.GraphQLString },
      hour: { type: graphQL.GraphQLInt },
    },
  })

  const WaiterWiseReportStatType = new graphQL.GraphQLObjectType({
    name: 'WaiterWiseReportStat',
    fields: {
      waiterId: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      waiterName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      employeeId: { type: graphQL.GraphQLString },
      branchNames: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(graphQL.GraphQLString)),
        ),
      },
      branchIds: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(graphQL.GraphQLString)),
        ),
      },
      lastBillTime: { type: graphQL.GraphQLString },
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cashAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      upiAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cardAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      customerCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const WaiterWiseReportTotalsType = new graphQL.GraphQLObjectType({
    name: 'WaiterWiseReportTotals',
    fields: {
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cashAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      upiAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      cardAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const WaiterWiseReportActiveBranchType = new graphQL.GraphQLObjectType({
    name: 'WaiterWiseReportActiveBranch',
    fields: {
      id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      name: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
    },
  })

  const WaiterWiseReportTimelineType = new graphQL.GraphQLObjectType({
    name: 'WaiterWiseReportTimeline',
    fields: {
      minHour: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      maxHour: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const WaiterWiseReportBranchBenchmarkType = new graphQL.GraphQLObjectType({
    name: 'WaiterWiseReportBranchBenchmark',
    fields: {
      _id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalBills: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalWaiters: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const WaiterWiseReportResultType = new graphQL.GraphQLObjectType({
    name: 'WaiterWiseReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      stats: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(WaiterWiseReportStatType)),
        ),
      },
      totals: { type: new graphQL.GraphQLNonNull(WaiterWiseReportTotalsType) },
      activeBranches: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(WaiterWiseReportActiveBranchType)),
        ),
      },
      timeline: { type: new graphQL.GraphQLNonNull(WaiterWiseReportTimelineType) },
      branchBenchmarks: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(WaiterWiseReportBranchBenchmarkType)),
        ),
      },
    },
  })

  const ExpenseReportFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'ExpenseReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
      category: { type: graphQL.GraphQLString },
    },
  })

  const ExpenseReportItemType = new graphQL.GraphQLObjectType({
    name: 'ExpenseReportItem',
    fields: {
      category: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      reason: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      amount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      time: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      imageUrl: { type: graphQL.GraphQLString },
    },
  })

  const ExpenseReportGroupType = new graphQL.GraphQLObjectType({
    name: 'ExpenseReportGroup',
    fields: {
      _id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      branchName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      total: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      count: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      items: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ExpenseReportItemType)),
        ),
      },
    },
  })

  const ExpenseReportCategoryStatType = new graphQL.GraphQLObjectType({
    name: 'ExpenseReportCategoryStat',
    fields: {
      category: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      total: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      count: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      percentage: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const ExpenseReportMetaType = new graphQL.GraphQLObjectType({
    name: 'ExpenseReportMeta',
    fields: {
      grandTotal: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      categories: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(graphQL.GraphQLString)),
        ),
      },
      categoryStats: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ExpenseReportCategoryStatType)),
        ),
      },
    },
  })

  const ExpenseReportResultType = new graphQL.GraphQLObjectType({
    name: 'ExpenseReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      groups: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ExpenseReportGroupType)),
        ),
      },
      meta: { type: new graphQL.GraphQLNonNull(ExpenseReportMetaType) },
    },
  })

  const ReturnOrderReportFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'ReturnOrderReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
      status: { type: graphQL.GraphQLString },
    },
  })

  const ReturnOrderReportItemType = new graphQL.GraphQLObjectType({
    name: 'ReturnOrderReportItem',
    fields: {
      returnNumber: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      status: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      product: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      quantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      unitPrice: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      subtotal: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      notes: { type: graphQL.GraphQLString },
      time: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      imageUrl: { type: graphQL.GraphQLString },
    },
  })

  const ReturnOrderReportGroupType = new graphQL.GraphQLObjectType({
    name: 'ReturnOrderReportGroup',
    fields: {
      _id: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      branchName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      totalAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalQuantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      count: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      orderCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      items: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ReturnOrderReportItemType)),
        ),
      },
    },
  })

  const ReturnOrderReportStatusStatType = new graphQL.GraphQLObjectType({
    name: 'ReturnOrderReportStatusStat',
    fields: {
      status: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      total: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      count: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      percentage: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const ReturnOrderReportMetaType = new graphQL.GraphQLObjectType({
    name: 'ReturnOrderReportMeta',
    fields: {
      grandTotal: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      totalCount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalQuantity: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      statuses: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(graphQL.GraphQLString)),
        ),
      },
      statusStats: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ReturnOrderReportStatusStatType)),
        ),
      },
    },
  })

  const ReturnOrderReportResultType = new graphQL.GraphQLObjectType({
    name: 'ReturnOrderReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      groups: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(ReturnOrderReportGroupType)),
        ),
      },
      meta: { type: new graphQL.GraphQLNonNull(ReturnOrderReportMetaType) },
    },
  })

  const StockOrderReportFilterInputType = new graphQL.GraphQLInputObjectType({
    name: 'StockOrderReportFilterInput',
    fields: {
      startDate: { type: graphQL.GraphQLString },
      endDate: { type: graphQL.GraphQLString },
      branch: { type: graphQL.GraphQLString },
      kitchen: { type: graphQL.GraphQLString },
      department: { type: graphQL.GraphQLString },
      category: { type: graphQL.GraphQLString },
      product: { type: graphQL.GraphQLString },
      chef: { type: graphQL.GraphQLString },
      status: { type: graphQL.GraphQLString },
      orderType: { type: graphQL.GraphQLString },
      invoice: { type: graphQL.GraphQLString },
    },
  })

  const StockOrderReportStatType = new graphQL.GraphQLObjectType({
    name: 'StockOrderReportStat',
    fields: {
      branchName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      stockOrders: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      liveOrders: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalOrders: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const StockOrderReportInvoiceType = new graphQL.GraphQLObjectType({
    name: 'StockOrderReportInvoice',
    fields: {
      invoice: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      isLive: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLBoolean) },
      createdAt: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      deliveryDate: { type: graphQL.GraphQLString },
    },
  })

  const StockOrderReportDetailType = new graphQL.GraphQLObjectType({
    name: 'StockOrderReportDetail',
    fields: {
      productName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      categoryName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      departmentName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      price: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      invoiceNumber: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      ordQty: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      ordTime: { type: graphQL.GraphQLString },
      sntQty: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      sntTime: { type: graphQL.GraphQLString },
      conQty: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      conTime: { type: graphQL.GraphQLString },
      picQty: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      picTime: { type: graphQL.GraphQLString },
      recQty: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      recTime: { type: graphQL.GraphQLString },
      difQty: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
      ordUpdatedByName: { type: graphQL.GraphQLString },
      sntUpdatedByName: { type: graphQL.GraphQLString },
      conUpdatedByName: { type: graphQL.GraphQLString },
      picUpdatedByName: { type: graphQL.GraphQLString },
      recUpdatedByName: { type: graphQL.GraphQLString },
      branchName: { type: graphQL.GraphQLString },
      branchDisplay: { type: graphQL.GraphQLString },
    },
  })

  const StockOrderReportChefSummaryType = new graphQL.GraphQLObjectType({
    name: 'StockOrderReportChefSummary',
    fields: {
      chefName: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      sendingAmount: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLFloat) },
    },
  })

  const StockOrderReportTotalsType = new graphQL.GraphQLObjectType({
    name: 'StockOrderReportTotals',
    fields: {
      stockOrders: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      liveOrders: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
      totalOrders: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLInt) },
    },
  })

  const StockOrderReportResultType = new graphQL.GraphQLObjectType({
    name: 'StockOrderReportResult',
    fields: {
      startDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      endDate: { type: new graphQL.GraphQLNonNull(graphQL.GraphQLString) },
      stats: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(StockOrderReportStatType)),
        ),
      },
      totals: { type: new graphQL.GraphQLNonNull(StockOrderReportTotalsType) },
      details: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(StockOrderReportDetailType)),
        ),
      },
      invoiceNumbers: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(StockOrderReportInvoiceType)),
        ),
      },
      chefSummary: {
        type: new graphQL.GraphQLNonNull(
          new graphQL.GraphQLList(new graphQL.GraphQLNonNull(StockOrderReportChefSummaryType)),
        ),
      },
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
    closingEntryReport: {
      type: new graphQL.GraphQLNonNull(ClosingEntryReportResultType),
      args: {
        filter: {
          type: ClosingEntryReportFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: ClosingEntryQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        return getClosingEntryReportData(context.req, args.filter || {})
      },
    },
    inventoryReport: {
      type: new graphQL.GraphQLNonNull(InventoryReportResultType),
      args: {
        filter: {
          type: InventoryReportFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: InventoryQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        return getInventoryReportData(context.req, args.filter || {})
      },
    },
    categoryWiseReport: {
      type: new graphQL.GraphQLNonNull(CategoryWiseReportResultType),
      args: {
        filter: {
          type: CategoryWiseFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: CategoryWiseQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        const report = await getCategoryWiseReportData(context.req, args.filter || {})

        return {
          ...report,
          stats: report.stats.map((stat) => ({
            ...stat,
            branchSales: Object.entries(stat.branchSales).map(([branchCode, value]) => ({
              branchCode,
              amount: value.amount,
              quantity: value.quantity,
            })),
          })),
          totals: {
            ...report.totals,
            branchTotals: Object.entries(report.totals.branchTotals).map(([branchCode, amount]) => ({
              branchCode,
              amount,
            })),
          },
        }
      },
    },
    productWiseReport: {
      type: new graphQL.GraphQLNonNull(ProductWiseReportResultType),
      args: {
        filter: {
          type: ProductWiseFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: ProductWiseQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        const report = await getProductWiseReportData(context.req, args.filter || {})

        return {
          ...report,
          stats: report.stats.map((stat) => ({
            ...stat,
            branchSales: Object.entries(stat.branchSales).map(([branchCode, value]) => ({
              branchCode,
              amount: value.amount,
              quantity: value.quantity,
            })),
          })),
          totals: {
            ...report.totals,
            branchTotals: Object.entries(report.totals.branchTotals).map(([branchCode, amount]) => ({
              branchCode,
              amount,
            })),
          },
        }
      },
    },
    productPreparationBillDetailsReport: {
      type: new graphQL.GraphQLNonNull(ProductPreparationBillDetailsReportResultType),
      args: {
        filter: {
          type: ProductPreparationBillDetailsReportFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: ProductPreparationBillDetailsQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        return getProductPreparationBillDetailsData(context.req, args.filter || {})
      },
    },
    waiterWiseReport: {
      type: new graphQL.GraphQLNonNull(WaiterWiseReportResultType),
      args: {
        filter: {
          type: WaiterWiseFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: WaiterWiseQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        return getWaiterWiseBillingReportData(context.req, args.filter || {})
      },
    },
    expenseReport: {
      type: new graphQL.GraphQLNonNull(ExpenseReportResultType),
      args: {
        filter: {
          type: ExpenseReportFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: ExpenseQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        return getExpenseReportData(context.req, args.filter || {})
      },
    },
    returnOrderReport: {
      type: new graphQL.GraphQLNonNull(ReturnOrderReportResultType),
      args: {
        filter: {
          type: ReturnOrderReportFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: ReturnOrderQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        return getReturnOrderReportData(context.req, args.filter || {})
      },
    },
    stockOrderReport: {
      type: new graphQL.GraphQLNonNull(StockOrderReportResultType),
      args: {
        filter: {
          type: StockOrderReportFilterInputType,
        },
      },
      resolve: async (
        _source: unknown,
        args: StockOrderQueryArgs,
        context: {
          req?: PayloadRequest
        },
      ) => {
        if (!context.req) {
          throw new Error('Request context is missing')
        }

        return getStockOrderReportData(context.req, args.filter || {})
      },
    },
  }
}
