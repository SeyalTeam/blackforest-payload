import { buildConfig } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

// ✅ Match imports from payload.config.ts
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
import Reviews from './collections/Reviews'
import Customers from './collections/Customers'
import BillingCustomers from './collections/BillingCustomers'
import InstockEntries from './collections/InstockEntries'
import Tables from './collections/Tables'
import Kitchens from './collections/Kitchens'
import Attendance from './collections/Attendance'
import APKFiles from './collections/APKFiles'
import { StockAlerts } from './collections/StockAlerts'
import IdempotencyKeys from './collections/IdempotencyKeys'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const mongoConnectionString =
  process.env.MONGODB_URI?.trim() ||
  process.env.MONGO_URI?.trim() ||
  process.env.DATABASE_URI?.trim() ||
  ''

if (!mongoConnectionString) {
  throw new Error(
    '[payload.mongo.config] Missing MongoDB connection string. Set MONGODB_URI (or DATABASE_URI fallback).',
  )
}

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [
    Users,
    Branches,
    Companies,
    Categories,
    Products,
    Media,
    Employees,
    Billings,
    Customers,
    BillingCustomers,
    Kitchens,
    Tables,
    Attendance,
    StockOrders,
    Expenses,
    ReturnOrder,
    Dealers,
    APKFiles,
    Reviews,
    Messages,
    MessageThreads,
    MessageReceipts,
    MessageAttachments,
    ClosingEntries,
    Departments,
    InstockEntries,
    StockAlerts,
    IdempotencyKeys,
  ],
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || 'TEMP_SECRET',
  db: mongooseAdapter({
    url: mongoConnectionString,
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
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
