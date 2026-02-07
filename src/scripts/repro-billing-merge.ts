import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(process.cwd(), '.env')
console.log('Loading .env from:', envPath)
dotenv.config({ path: envPath })

console.log('PAYLOAD_SECRET present:', !!process.env.PAYLOAD_SECRET)
console.log('DATABASE_URI present:', !!process.env.DATABASE_URI)

async function run() {
  const { getPayload } = await import('payload')
  const { default: configPromise } = await import('../payload.config')

  const payload = await getPayload({ config: configPromise })

  console.log('Fetching dependencies...')
  const branches = await payload.find({ collection: 'branches', limit: 1 })
  if (branches.docs.length === 0) throw new Error('No branches found')
  const branch = branches.docs[0]

  const products = await payload.find({ collection: 'products', limit: 1 })
  if (products.docs.length === 0) throw new Error('No products found')
  const product = products.docs[0]

  // Find a user valid for creation (e.g. superadmin or branch role)
  // Assuming the script runs as superadmin context if internal, but payload.create requires user in context usually for hooks?
  // Actually local API runs as system unless user is passed. But hooks might rely on `req.user`.
  // create-stock-order-part2.ts passes a user object.
  const users = await payload.find({ collection: 'users', limit: 1 })
  // Ideally find a superadmin or stick with what we have.
  const user = users.docs[0]

  console.log(`Branch: ${branch.name}, Product: ${product.name}`)

  console.log('--- Test 1: Merging Logic (Expected: Should Merge) ---')
  try {
    const bill = await payload.create({
      collection: 'billings',
      data: {
        branch: branch.id,
        items: [
          {
            product: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: 100,
            status: 'ordered',
            notes: 'Test Note',
          },
          {
            product: product.id,
            name: product.name,
            quantity: 2,
            unitPrice: 100,
            status: 'ordered',
            notes: 'Test Note',
          },
        ],
        customerDetails: { name: 'Test Customer', phoneNumber: '9999999999' },
        paymentMethod: 'cash',
        totalAmount: 300, // Placeholder
        status: 'ordered',
      } as any,
      user: user as any, // Mock user context
    })

    console.log('Bill 1 created. ID:', bill.id)
    console.log('Items:', JSON.stringify(bill.items, null, 2))

    if (bill.items && bill.items.length === 1 && bill.items[0].quantity === 3) {
      console.log('SUCCESS: Items merged correctly.')
    } else {
      console.log('FAILURE: Items NOT merged.')
    }
  } catch (error) {
    console.error('Error creating bill 1:', error)
  }

  console.log('\n--- Test 2: Different Status (Expected: Should NOT Merge) ---')
  try {
    const bill2 = await payload.create({
      collection: 'billings',
      data: {
        branch: branch.id,
        items: [
          {
            product: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: 100,
            status: 'prepared',
            notes: 'Test Note',
          },
          {
            product: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: 100,
            status: 'ordered',
            notes: 'Test Note',
          },
        ],
        customerDetails: { name: 'Test Customer 2', phoneNumber: '8888888888' },
        paymentMethod: 'cash',
        status: 'ordered',
      } as any,
      user: user as any,
    })

    console.log('Bill 2 created. ID:', bill2.id)
    console.log('Items:', JSON.stringify(bill2.items, null, 2))

    if (bill2.items && bill2.items.length === 2) {
      console.log('SUCCESS: Items NOT merged (as expected due to status diff).')
    } else {
      console.log('FAILURE: Items wrongly merged or other error.')
    }
  } catch (error) {
    console.error('Error creating bill 2:', error)
  }

  process.exit(0)
}

run()
