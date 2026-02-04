// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
// Force rebuild
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'

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
import ReturnOrder from './collections/ReturnOrder'
import ClosingEntries from './collections/ClosingEntries'
import Expenses from './collections/Expenses'
import StockOrders from './collections/StockOrders'
import { IPSettings } from './globals/IPSettings'
import { DashboardGlobal } from './globals/Dashboard'
import { BranchBillingReportGlobal } from './globals/BranchBillingReport'
import { CategoryWiseReportGlobal } from './globals/CategoryWiseReport'
import { ProductWiseReportGlobal } from './globals/ProductWiseReport'
import { getBranchBillingReportHandler } from './endpoints/getBranchBillingReport'
import { getCategoryWiseReportHandler } from './endpoints/getCategoryWiseReport'
import { getCategoryWiseReportPDFHandler } from './endpoints/getCategoryWiseReportPDF'
import { getProductWiseReportHandler } from './endpoints/getProductWiseReport'
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
import { BranchGeoSettings } from './globals/BranchGeoSettings'
import { NetworkStatus } from './globals/NetworkStatus'
import { getNetworkStatusHandler } from './endpoints/getNetworkStatus'
import { downloadHandler, uploadHandler, pingHandler } from './endpoints/speedtest'
import Tables from './collections/Tables'
import { AutomateGlobal } from './globals/Automate'
import { createAutomatedOrderHandler } from './endpoints/createAutomatedOrder'

// Path helpers
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      // views: {
      //   Dashboard: {
      //     Component: '/components/Dashboard/index.tsx#default',
      //   },
      // },
      // beforeNavLinks: [],
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
    'https://superadmin.theblackforestcakes.com',
    'http://192.168.29.173:3000', // Local Network IP
  ],

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
    'https://superadmin.theblackforestcakes.com',
    'http://192.168.29.173:3000', // Local Network IP
  ],

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
      path: '/automate/create-order',
      method: 'post',
      handler: createAutomatedOrderHandler,
    },
  ],

  globals: [
    IPSettings,
    DashboardGlobal,
    BranchBillingReportGlobal,
    CategoryWiseReportGlobal,
    ProductWiseReportGlobal,
    ClosingEntryReportGlobal,
    WaiterWiseBillingReportGlobal,
    InventoryReportGlobal,
    StockOrderReportGlobal,
    AfterstockCustomerReportGlobal,
    ReviewReportGlobal,
    InstockEntryReportGlobal,
    ExpenseReportGlobal,
    BranchGeoSettings,
    NetworkStatus,
    AutomateGlobal,
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
    Billings,
    ReturnOrder,
    ClosingEntries,
    Expenses,
    StockOrders,
    Reviews,
    Customers,
    InstockEntries,
    Tables,
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

  plugins: [
    vercelBlobStorage({
      enabled: true,
      collections: {
        [Media.slug]: {
          prefix: '',
        },
      },
      token: process.env.blackforest_READ_WRITE_TOKEN || '',
    }),
  ],
})
