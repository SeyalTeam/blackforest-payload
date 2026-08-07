import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()

async function backfill() {
  const uri = process.env.DATABASE_URI || 'mongodb://127.0.0.1/payload'
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db()
    console.log('Connected to DB')
    
    const collection = db.collection('billings')
    
    // Find all completed/settled bills without a settledAt field
    const cursor = collection.find({
      status: { $in: ['completed', 'settled'] },
      settledAt: { $exists: false }
    })
    
    let count = 0
    let bulk = collection.initializeUnorderedBulkOp()
    
    for await (const doc of cursor) {
      bulk.find({ _id: doc._id }).updateOne({ $set: { settledAt: doc.updatedAt } })
      count++
      if (count % 1000 === 0) {
        await bulk.execute()
        console.log(`Updated ${count} bills...`)
        bulk = collection.initializeUnorderedBulkOp()
      }
    }
    
    if (count % 1000 !== 0 && count > 0) {
      await bulk.execute()
    }
    
    console.log(`Done! Updated ${count} bills.`)
  } catch (error) {
    console.error(error)
  } finally {
    await client.close()
  }
}

backfill()
