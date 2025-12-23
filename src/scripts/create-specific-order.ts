import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

async function createSpecificOrder() {
  const uri = process.env.DATABASE_URI || ''
  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    const db = client.db()
    const collection = db.collection('stock-orders')

    // 1. Fetch original to get all data
    const original = await collection.findOne({ invoiceNumber: 'ETT-STC-251222-10' })

    if (!original) {
      console.log('Original order not found')
      return
    }

    console.log('Creating ETT-STC-251222-11...')

    // Ordered date: Dec 22, 2025 at 10:40 PM IST (slightly after -10)
    // 10:40 PM IST is 17:10 UTC
    const yesterdayDate = new Date('2025-12-22T17:10:00.000Z')
    // Tomorrow delivery relative to today (Dec 23) is Dec 24
    const tomorrowDelivery = new Date('2025-12-24T09:00:00.000Z')

    // 2. Prepare new document
    const {
      _id: _id,
      invoiceNumber: _invoiceNumber,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...baseData
    } = original

    // Update items with new requiredDate and reset other fields
    const newItems = (original.items || []).map(
      (item: {
        product: string | object
        name: string
        inStock?: number
        inStockAmount?: number
        requiredQty?: number
        requiredAmount?: number
      }) => ({
        product: item.product,
        name: item.name,
        inStock: item.inStock || 0,
        inStockAmount: item.inStockAmount || 0,
        requiredQty: item.requiredQty || 0,
        requiredAmount: item.requiredAmount || 0,
        requiredDate: yesterdayDate,
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
        differenceQty: item.requiredQty || 0,
        differenceAmount: item.requiredAmount || 0,
        status: 'ordered',
        id: new ObjectId().toString(),
      }),
    )

    const newDoc = {
      ...baseData,
      invoiceNumber: 'ETT-STC-251222-11',
      deliveryDate: tomorrowDelivery,
      items: newItems,
      createdAt: yesterdayDate,
      updatedAt: new Date(),
      status: 'ordered',
    }

    const result = await collection.insertOne(newDoc)
    console.log(`Successfully created order ETT-STC-251222-11 with ID: ${result.insertedId}`)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.close()
  }
}

createSpecificOrder()
