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

  // ✅ Add your new collection here
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

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
    // 👇 NEW OPTIONS
    connectOptions: {
      // Keep a healthy pool for server‑less bursts
      maxPoolSize: 100, // ↑ increase from 50 → 100
      minPoolSize: 10, // keep a few warm connections
      maxIdleTimeMS: 20000, // close idle connections after 20 s
      waitQueueTimeoutMS: 8000, // give requests a bit more time (8 s)
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
          prefix: '', // Empty to allow per-file dynamic prefixes from hooks
        },
      },
      token: process.env.blackforest_READ_WRITE_TOKEN || '',
    }),
  ],
})
