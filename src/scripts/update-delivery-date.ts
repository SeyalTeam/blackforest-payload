import 'dotenv/config'
import { MongoClient } from 'mongodb'

async function updateDeliveryDate() {
  const uri = process.env.DATABASE_URI || ''
  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    const db = client.db()
    const collection = db.collection('stock-orders')

    const invoiceNumber = 'ETT-STC-251222-10'

    // Tomorrow is Dec 24, 2025
    // Setting it to 9:00 AM IST (3:30 AM UTC)
    const tomorrowDelivery = new Date('2025-12-24T03:30:00.000Z')

    console.log(
      `Updating delivery date for ${invoiceNumber} to ${tomorrowDelivery.toISOString()}...`,
    )

    const result = await collection.updateOne(
      { invoiceNumber },
      {
        $set: {
          deliveryDate: tomorrowDelivery,
          updatedAt: new Date(),
        },
      },
    )

    if (result.matchedCount > 0) {
      console.log(`Successfully updated delivery date for ${invoiceNumber}`)
    } else {
      console.log(`Order ${invoiceNumber} not found`)
    }
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.close()
  }
}

updateDeliveryDate()
