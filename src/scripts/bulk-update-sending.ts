import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

async function bulkUpdate() {
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

    console.log(`Updating Sending Qty for ${invoiceNumber}...`)

    // 7:35 PM IST is 2:05 PM UTC (14:05)
    const sendingDate = new Date('2025-12-22T14:05:00.000Z')
    const chefId = new ObjectId('693f916c536497dce5d7eb26')

    const updatedItems = order.items.map((item: any) => ({
      ...item,
      sendingQty: item.requiredQty || 0,
      sendingAmount: item.requiredAmount || 0,
      sendingDate: sendingDate,
      sendingUpdatedBy: chefId,
      status: 'sending',
    }))

    await collection.updateOne(
      { _id: order._id },
      {
        $set: {
          items: updatedItems,
          status: 'sending',
          updatedAt: new Date(),
        },
      },
    )

    console.log(`Successfully bulk updated ${invoiceNumber} sending metrics.`)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.close()
  }
}

bulkUpdate()
