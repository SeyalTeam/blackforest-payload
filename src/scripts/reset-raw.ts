import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

async function resetRaw() {
  const uri = process.env.DATABASE_URI || ''
  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    const db = client.db()
    const collection = db.collection('stock-orders')

    const invoiceNumber = 'ETT-STC-251221-03'
    const order = await collection.findOne({ invoiceNumber })

    if (!order) {
      console.log('Order not found')
      return
    }

    console.log(`Resetting items for ${invoiceNumber}...`)

    const updatedItems = order.items.map((item: any) => ({
      ...item,
      sendingQty: 0,
      sendingAmount: 0,
      sendingDate: null,
      sendingUpdatedBy: null,
      confirmedQty: 0,
      confirmedAmount: 0,
      confirmedDate: null,
      confirmedUpdatedBy: null,
      pickedQty: 0,
      pickedAmount: 0,
      pickedDate: null,
      pickedUpdatedBy: null,
      receivedQty: 0,
      receivedAmount: 0,
      receivedDate: null,
      status: 'ordered',
    }))

    await collection.updateOne(
      { _id: order._id },
      {
        $set: {
          items: updatedItems,
          status: 'ordered',
          updatedAt: new Date(),
        },
      },
    )

    console.log('Successfully reset via RAW MongoDB')
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.close()
  }
}

resetRaw()
