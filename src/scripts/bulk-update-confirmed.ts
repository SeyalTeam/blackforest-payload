import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

async function bulkConfirm() {
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

    console.log(`Updating Confirmed Qty for ${invoiceNumber}...`)

    // 8:15 PM IST is 2:45 PM UTC (14:45)
    const confirmedDate = new Date('2025-12-22T14:45:00.000Z')
    const userId = new ObjectId('6924470658b8fcd1660f926e')

    const updatedItems = (order.items || []).map(
      (item: { sendingQty?: number; sendingAmount?: number }) => ({
        ...item,
        confirmedQty: item.sendingQty || 0,
        confirmedAmount: item.sendingAmount || 0,
        confirmedDate: confirmedDate,
        confirmedUpdatedBy: userId,
        status: 'confirmed',
      }),
    )

    await collection.updateOne(
      { _id: order._id },
      {
        $set: {
          items: updatedItems,
          status: 'confirmed',
          updatedAt: new Date(),
        },
      },
    )

    console.log(`Successfully bulk confirmed ${invoiceNumber}.`)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.close()
  }
}

bulkConfirm()
