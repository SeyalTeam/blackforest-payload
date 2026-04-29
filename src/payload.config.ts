import { s3Storage } from '@payloadcms/storage-s3'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
// Force rebuild
import { buildConfig, type CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

// ✅ Import all your collections
import { Users } from './collections/Users'
import { Branches } from './collections/Branches'
import { Companies } from './collections/Companies'
import Departments from './collections/Departments'
import Categories from './collections/Categories'
import Products from './collections/Products'
import { Media } from './collections/Media'
import Dealers from './collections/Dealers'
import Employees from './collections/Employees'
import Billings from './collections/Billings'
import { MessageThreads } from './collections/MessageThreads'
import { Messages } from './collections/Messages'
import { MessageReceipts } from './collections/MessageReceipts'
import { MessageAttachments } from './collections/MessageAttachments'
import ReturnOrder from './collections/ReturnOrder'
import ClosingEntries from './collections/ClosingEntries'
import Expenses from './collections/Expenses'
import StockOrders from './collections/StockOrders'
import { IPSettings } from './globals/IPSettings'
import { DashboardGlobal } from './globals/Dashboard'
import { BranchBillingReportGlobal } from './globals/BranchBillingReport'
import { CategoryWiseReportGlobal } from './globals/CategoryWiseReport'
import { ProductWiseReportGlobal } from './globals/ProductWiseReport'
import { ProductTimeReportGlobal } from './globals/ProductTimeReport'
import { getBranchBillingReportHandler } from './endpoints/getBranchBillingReport'
import { getCategoryWiseReportHandler } from './endpoints/getCategoryWiseReport'
import { getCategoryWiseReportPDFHandler } from './endpoints/getCategoryWiseReportPDF'
import { getProductWiseReportHandler } from './endpoints/getProductWiseReport'
import { getProductPreparationBillDetailsHandler } from './endpoints/getProductPreparationBillDetails'
import { getClosingEntryReportHandler } from './endpoints/getClosingEntryReport'
import { getWaiterWiseBillingReportHandler } from './endpoints/getWaiterWiseBillingReport'
import { ClosingEntryReportGlobal } from './globals/ClosingEntryReport'
import { WaiterWiseBillingReportGlobal } from './globals/WaiterWiseBillingReport'
import { InventoryReportGlobal } from './globals/InventoryReport'
import { getInventoryReportHandler } from './endpoints/getInventoryReport'
import { StockOrderReportGlobal } from './globals/StockOrderReport'
import { getStockOrderReportHandler } from './endpoints/getStockOrderReport'
import { getAfterstockCustomerReportHandler } from './endpoints/getAfterstockCustomerReport'
import { AfterstockCustomerReportGlobal } from './globals/AfterstockCustomerReport'
import { getReviewReportHandler } from './endpoints/getReviewReport'
import { ReviewReportGlobal } from './globals/ReviewReport'
import { getLiveBillReportHandler } from './endpoints/getLiveBillReport'
import { LiveBillReportGlobal } from './globals/LiveBillReport'
import { resetInventoryHandler } from './endpoints/resetInventory'
import Reviews from './collections/Reviews'
import Customers from './collections/Customers'
import InstockEntries from './collections/InstockEntries'
import { getInstockEntryReportHandler } from './endpoints/getInstockEntryReport'
import { updateInstockStatusHandler } from './endpoints/updateInstockStatus'
import { InstockEntryReportGlobal } from './globals/InstockEntryReport'
import { getDashboardStatsHandler } from './endpoints/getDashboardStats'
import { getExpenseReportHandler } from './endpoints/getExpenseReport'
import { ExpenseReportGlobal } from './globals/ExpenseReport'
import { getReturnOrderReportHandler } from './endpoints/getReturnOrderReport'
import { ReturnOrderReportGlobal } from './globals/ReturnOrderReport'
import { BranchGeoSettings } from './globals/BranchGeoSettings'
import { NetworkStatus } from './globals/NetworkStatus'
import { getNetworkStatusHandler } from './endpoints/getNetworkStatus'
import { downloadHandler, uploadHandler, pingHandler } from './endpoints/speedtest'
import Tables from './collections/Tables'
import Kitchens from './collections/Kitchens'
import Attendance from './collections/Attendance'
import { WidgetSettingsGlobal } from './globals/Widgets'
import { createWidgetOrderHandler } from './endpoints/createWidgetOrder'
import { getTableCustomerDetailsVisibilityHandler } from './endpoints/getTableCustomerDetailsVisibility'
import { getLiveTableStatusHandler } from './endpoints/getLiveTableStatus'
import { getLiveLoggedInUsersHandler } from './endpoints/getLiveLoggedInUsers'
import { getReportBranchesHandler } from './endpoints/getReportBranches'
import { getWidgetProductOptionsHandler } from './endpoints/getWidgetProductOptions'
import { getBillingCustomerLookupHandler } from './endpoints/getBillingCustomerLookup'
import { CustomerOfferSettings } from './globals/CustomerOfferSettings'
import APKFiles from './collections/APKFiles'
import { AppDownloadSettings } from './globals/AppDownloadSettings'
import { getLatestAppDownloadHandler } from './endpoints/getLatestAppDownload'
import { generateTableQRHandler } from './endpoints/generateTableQR'
import { tableRedirectHandler } from './endpoints/tableRedirect'
import { callWaiterHandler } from './endpoints/callWaiter'
import { ackWaiterCallHandler } from './endpoints/ackWaiterCall'
import { StockAlerts } from './collections/StockAlerts'
import { reportGraphQLQueries } from './graphql/reportQueries'
import IdempotencyKeys from './collections/IdempotencyKeys'
import { getIdempotencyMetricsHandler } from './endpoints/getIdempotencyMetrics'
import { setupIdempotencyRetention } from './utilities/idempotencyRetention'
import { readGraphQLQueries } from './graphql/readQueries'

// Path helpers
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const withoutCollectionSidebarLinks = <T extends CollectionConfig>(collection: T): T => ({
  ...collection,
  admin: {
    ...(collection.admin || {}),
    group: undefined,
  },
})

const normalizeAbsoluteURL = (value?: string | null): string => {
  const input = value?.trim() || ''
  if (!input) return ''

  try {
    return new URL(input).toString().replace(/\/+$/, '')
  } catch (_error) {
    try {
      return new URL(`https://${input}`).toString().replace(/\/+$/, '')
    } catch (_nestedError) {
      return ''
    }
  }
}

const publicServerURL = normalizeAbsoluteURL(process.env.PAYLOAD_PUBLIC_SERVER_URL)
const vercelURL = process.env.VERCEL_URL?.trim()

const rawR2Env = {
  S3_BUCKET: process.env.S3_BUCKET?.trim(),
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID?.trim(),
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY?.trim(),
  S3_ENDPOINT: process.env.S3_ENDPOINT?.trim(),
  S3_REGION: process.env.S3_REGION?.trim(),
}

const r2Env = {
  ...rawR2Env,
  S3_ENDPOINT: normalizeAbsoluteURL(rawR2Env.S3_ENDPOINT),
  S3_REGION: process.env.S3_REGION?.trim() || 'auto',
}

const missingR2Env = Object.entries(rawR2Env)
  .filter(([key, value]) => key !== 'S3_REGION' && !value)
  .map(([key]) => key)

if (missingR2Env.length > 0) {
  throw new Error(
    `[R2 config] Missing required environment variable(s): ${missingR2Env.join(', ')}`,
  )
}

if (rawR2Env.S3_ENDPOINT && !r2Env.S3_ENDPOINT) {
  throw new Error('[R2 config] Invalid S3_ENDPOINT. Use a full URL or hostname.')
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      /* views: {
        dashboard: {
          Component: '/components/AdminCollectionsDashboard/index.tsx#default',
        },
      },
      beforeNavLinks: [
        '/components/AdminCollapsedNavBehavior/index.tsx#default',
        '/components/AdminCollectionsNavLink/index.tsx#default',
      ], */
    },
  },

  // ✅ ADD CORS + CSRF HERE
  cors: [
    'http://localhost:3000',
    'http://localhost:4200',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:5000',
    'http://localhost:64781', // flutter web port
    'http://127.0.0.1',
    'http://127.0.0.1:5500',
    'https://blackforest.vseyal.com', // your domain
    'https://blackforest1.vseyal.com',
    'https://superadmin.theblackforestcakes.com',
    'http://192.168.29.173:3000', // Local Network IP
  ].filter(Boolean) as string[],

  csrf: [
    'http://localhost:3000',
    'http://localhost:4200',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:5000',
    'http://localhost:64781', // flutter web
    'http://127.0.0.1',
    'http://127.0.0.1:5500',
    'https://blackforest.vseyal.com',
    'https://blackforest1.vseyal.com',
    'https://superadmin.theblackforestcakes.com',
    'http://192.168.29.173:3000', // Local Network IP
  ].filter(Boolean) as string[],

  graphQL: {
    queries: (graphQL) => ({
      ...reportGraphQLQueries(graphQL),
      ...readGraphQLQueries(graphQL),
    }),
  },

  bodyParser: {
    limits: {
      fileSize: 250 * 1024 * 1024, // 250MB max upload size
    },
  },

  endpoints: [
    {
      path: '/reports/branch-billing',
      method: 'get',
      handler: getBranchBillingReportHandler,
    },
    {
      path: '/reports/category-wise',
      method: 'get',
      handler: getCategoryWiseReportHandler,
    },
    {
      path: '/reports/category-wise/export-pdf',
      method: 'get',
      handler: getCategoryWiseReportPDFHandler,
    },
    {
      path: '/reports/product-wise',
      method: 'get',
      handler: getProductWiseReportHandler,
    },
    {
      path: '/reports/product-preparation-bill-details',
      method: 'get',
      handler: getProductPreparationBillDetailsHandler,
    },
    {
      path: '/reports/closing-entry',
      method: 'get',
      handler: getClosingEntryReportHandler,
    },
    {
      path: '/reports/waiter-wise',
      method: 'get',
      handler: getWaiterWiseBillingReportHandler,
    },
    {
      path: '/reports/inventory',
      method: 'get',
      handler: getInventoryReportHandler,
    },
    {
      path: '/reports/stock-order',
      method: 'get',
      handler: getStockOrderReportHandler,
    },
    {
      path: '/reports/afterstock-customer',
      method: 'get',
      handler: getAfterstockCustomerReportHandler,
    },
    {
      path: '/reports/instock-entry',
      method: 'get',
      handler: getInstockEntryReportHandler,
    },
    {
      path: '/instock-params/update-status', // Choosing a path
      method: 'post',
      handler: updateInstockStatusHandler,
    },
    {
      path: '/reports/review',
      method: 'get',
      handler: getReviewReportHandler,
    },
    {
      path: '/reports/live-bill',
      method: 'get',
      handler: getLiveBillReportHandler,
    },
    {
      path: '/inventory/reset',
      method: 'post',
      handler: resetInventoryHandler,
    },
    {
      path: '/dashboard-stats',
      method: 'get',
      handler: getDashboardStatsHandler,
    },
    {
      path: '/reports/expense',
      method: 'get',
      handler: getExpenseReportHandler,
    },
    {
      path: '/reports/return-order',
      method: 'get',
      handler: getReturnOrderReportHandler,
    },
    {
      path: '/reports/branches',
      method: 'get',
      handler: getReportBranchesHandler,
    },
    {
      path: '/network-status',
      method: 'get',
      handler: getNetworkStatusHandler,
    },
    {
      path: '/speedtest/download',
      method: 'get',
      handler: downloadHandler,
    },
    {
      path: '/speedtest/upload',
      method: 'post',
      handler: uploadHandler,
    },
    {
      path: '/speedtest/ping',
      method: 'get',
      handler: pingHandler,
    },
    {
      path: '/widgets/create-order',
      method: 'post',
      handler: createWidgetOrderHandler,
    },
    {
      path: '/widgets/table-customer-details-visibility',
      method: 'get',
      handler: getTableCustomerDetailsVisibilityHandler,
    },
    {
      path: '/widgets/live-table-status',
      method: 'get',
      handler: getLiveTableStatusHandler,
    },
    {
      path: '/widgets/live-logins',
      method: 'get',
      handler: getLiveLoggedInUsersHandler,
    },
    {
      path: '/widgets/product-options',
      method: 'get',
      handler: getWidgetProductOptionsHandler,
    },
    {
      path: '/widgets/table-qr-preview',
      method: 'post',
      handler: generateTableQRHandler,
    },
    {
      path: '/table-redirect',
      method: 'get',
      handler: tableRedirectHandler,
    },
    {
      path: '/call-waiter',
      method: 'post',
      handler: callWaiterHandler,
    },
    {
      path: '/call-waiter/ack',
      method: 'post',
      handler: ackWaiterCallHandler,
    },
    {
      path: '/billing/customer-lookup',
      method: 'get',
      handler: getBillingCustomerLookupHandler,
    },
    {
      path: '/app-download/latest.apk',
      method: 'get',
      handler: getLatestAppDownloadHandler,
    },
    {
      path: '/app-download/:appKey.apk',
      method: 'get',
      handler: getLatestAppDownloadHandler,
    },
    {
      path: '/ops/idempotency-metrics',
      method: 'get',
      handler: getIdempotencyMetricsHandler,
    },
  ],

  globals: [
    IPSettings,
    DashboardGlobal,
    BranchBillingReportGlobal,
    CategoryWiseReportGlobal,
    ProductWiseReportGlobal,
    ProductTimeReportGlobal,
    ClosingEntryReportGlobal,
    WaiterWiseBillingReportGlobal,
    InventoryReportGlobal,
    StockOrderReportGlobal,
    AfterstockCustomerReportGlobal,
    ReviewReportGlobal,
    LiveBillReportGlobal,
    InstockEntryReportGlobal,
    ExpenseReportGlobal,
    ReturnOrderReportGlobal,
    BranchGeoSettings,
    NetworkStatus,
    WidgetSettingsGlobal,
    CustomerOfferSettings,
    AppDownloadSettings,
  ],

  // Collections
  collections: [
    Users,
    Companies,
    Branches,
    Departments,
    Categories,
    Products,
    Media,
    Dealers,
    Employees,
    MessageThreads,
    MessageAttachments,
    Messages,
    MessageReceipts,
    Billings,
    ReturnOrder,
    ClosingEntries,
    Expenses,
    StockOrders,
    Reviews,
    Customers,
    InstockEntries,
    Tables,
    Kitchens,
    Attendance,
    APKFiles,
    StockAlerts,
    IdempotencyKeys,
  ],

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',

    connectOptions: {
      maxPoolSize: 100,
      minPoolSize: 10,
      maxIdleTimeMS: 20000,
      waitQueueTimeoutMS: 8000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
    },
  }),

  sharp,
  serverURL: publicServerURL || (vercelURL ? `https://${vercelURL}` : 'http://localhost:3000'),
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'blackforest/uploads',
        },
        'message-attachments': {
          prefix: 'blackforest/uploads/messages',
        },
        'apk-files': {
          prefix: 'blackforest/uploads/apk',
        },
      },
      bucket: r2Env.S3_BUCKET || '',
      config: {
        credentials: {
          accessKeyId: r2Env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: r2Env.S3_SECRET_ACCESS_KEY || '',
        },
        region: r2Env.S3_REGION,
        endpoint: r2Env.S3_ENDPOINT || '',
        forcePathStyle: true,
      },
    }),
  ],
  onInit: async (payload) => {
    await setupIdempotencyRetention(payload)
    console.log('[Payload] Initialization successful')
  },
})
