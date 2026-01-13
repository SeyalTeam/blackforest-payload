import { Payload } from 'payload'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const run = async () => {
  if (!process.env.DATABASE_URI) {
    console.error('DATABASE_URI not found')
    process.exit(1)
  }

  const client = new MongoClient(process.env.DATABASE_URI)

  try {
    await client.connect()
    const db = client.db() // Use db from connection string

    const collections = await db.listCollections().toArray()
    console.log(
      'Collections:',
      collections.map((c) => c.name).filter((n) => n.includes('stock')),
    )

    console.log('Searching for invoice ETT-152 again...')
    const order = await db.collection('stock-orders').findOne({ invoiceNumber: 'ETT-152' })

    if (order) {
      console.log('Found Order:', JSON.stringify(order, null, 2))
    } else {
      console.log('Order ETT-152 not found directly.')
      // List recent orders to see what formats exist
      const recent = await db
        .collection('stock-orders')
        .find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray()

      console.log(
        'Recent 10 orders:',
        recent.map((r) => ({
          id: r._id,
          inv: r.invoiceNumber,
          created: r.createdAt,
        })),
      )
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.close()
  }
}

run()
