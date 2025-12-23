import 'dotenv/config'
import { MongoClient } from 'mongodb'

async function renameInvoice() {
  const uri = process.env.DATABASE_URI || ''
  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    const db = client.db()
    const collection = db.collection('stock-orders')

    const oldInvoice = 'ETT-STC-251222-11'
    const newInvoice = 'ETT-STC-251222-10'

    console.log(`Renaming ${oldInvoice} to ${newInvoice}...`)

    const result = await collection.updateOne(
      { invoiceNumber: oldInvoice },
      {
        $set: {
          invoiceNumber: newInvoice,
          updatedAt: new Date(),
        },
      },
    )

    if (result.matchedCount > 0) {
      console.log(`Successfully renamed ${oldInvoice} to ${newInvoice}`)
    } else {
      console.log(`Order ${oldInvoice} not found`)
    }
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.close()
  }
}

renameInvoice()
