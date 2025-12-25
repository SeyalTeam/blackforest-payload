// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
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
import { BranchWiseReportGlobal } from './globals/BranchWiseReport'
import { CategoryWiseReportGlobal } from './globals/CategoryWiseReport'
import { getBranchWiseReportHandler } from './endpoints/getBranchWiseReport'
import { getCategoryWiseReportHandler } from './endpoints/getCategoryWiseReport'

// Path helpers
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
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
    'https://admin.theblackforestcakes.com', // your domain
    'https://superadmin.theblackforestcakes.com',
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
    'https://admin.theblackforestcakes.com',
    'https://superadmin.theblackforestcakes.com',
  ],

  endpoints: [
    {
      path: '/reports/branch-wise',
      method: 'get',
      handler: getBranchWiseReportHandler,
    },
    {
      path: '/reports/category-wise',
      method: 'get',
      handler: getCategoryWiseReportHandler,
    },
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
  ],
  globals: [IPSettings, BranchWiseReportGlobal, CategoryWiseReportGlobal],

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
