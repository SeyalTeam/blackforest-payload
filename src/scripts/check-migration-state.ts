import 'dotenv/config'
import { MongoClient } from 'mongodb'

async function checkDataState() {
  const uri = process.env.DATABASE_URI || ''
  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('stock-orders')

    // Find orders with the new short format (e.g., matching "XXX-01")
    // Old format is XXX-STC-YYMMDD-XX (much longer)
    const modifiedOrders = await collection
      .find({
        invoiceNumber: { $regex: /^[A-Z]{3}-\d{2}$/ },
      })
      .toArray()

    console.log(`Found ${modifiedOrders.length} orders in new format.`)
    if (modifiedOrders.length > 0) {
      console.log(
        'Sample modified:',
        modifiedOrders.slice(0, 5).map((o) => `${o.invoiceNumber} (${o.createdAt})`),
      )
    }

    // Check old format count
    const oldFormatCount = await collection.countDocuments({
      invoiceNumber: { $regex: /STC/ },
    })
    console.log(`Found ${oldFormatCount} orders in old format.`)
  } catch (err) {
    console.error(err)
  } finally {
    await client.close()
  }
}

checkDataState()
