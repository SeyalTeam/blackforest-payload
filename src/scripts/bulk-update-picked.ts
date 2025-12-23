import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

async function bulkPick() {
  const uri = process.env.DATABASE_URI || ''
  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    const db = client.db()
    const collection = db.collection('stock-orders')

    const invoiceNumber = 'CHI-STC-251222-01'
    const order = await collection.findOne({ invoiceNumber })

    if (!order) {
      console.log(`Order ${invoiceNumber} not found`)
      return
    }

    console.log(`Updating Picked Qty for ${invoiceNumber}...`)

    // 8:30 PM IST is 3:00 PM UTC (15:00)
    const pickedDate = new Date('2025-12-22T15:00:00.000Z')
    const userId = new ObjectId('693f95089d9f6d17f5076818')

    const updatedItems = (order.items || []).map(
      (item: { confirmedQty?: number; confirmedAmount?: number }) => ({
        ...item,
        pickedQty: item.confirmedQty || 0,
        pickedAmount: item.confirmedAmount || 0,
        pickedDate: pickedDate,
        pickedUpdatedBy: userId,
        status: 'picked',
      }),
    )

    await collection.updateOne(
      { _id: order._id },
      {
        $set: {
          items: updatedItems,
          status: 'picked',
          updatedAt: new Date(),
        },
      },
    )

    console.log(`Successfully bulk picked ${invoiceNumber}.`)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.close()
  }
}

bulkPick()
