import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

async function resetOrders() {
  const payload = await getPayload({ config })

  const invoiceNumbers = ['ETT-STC-251222-10']

  for (const invoiceNumber of invoiceNumbers) {
    console.log(`\nProcessing Order: ${invoiceNumber}`)

    const order = await payload.find({
      collection: 'stock-orders',
      where: {
        invoiceNumber: {
          equals: invoiceNumber,
        },
      },
    })

    if (order.docs.length === 0) {
      console.log(`  Order ${invoiceNumber} not found`)
      continue
    }

    const doc = order.docs[0]
    console.log(`  Found Order ID: ${doc.id}`)

    const updatedItems = doc.items?.map((item: Record<string, unknown>) => ({
      ...item,
      // Reset Sending
      sendingQty: 0,
      sendingAmount: 0,
      sendingDate: null,
      sendingUpdatedBy: null,

      // Reset Confirmed
      confirmedQty: 0,
      confirmedAmount: 0,
      confirmedDate: null,
      confirmedUpdatedBy: null,

      // Reset Picked
      pickedQty: 0,
      pickedAmount: 0,
      pickedDate: null,
      pickedUpdatedBy: null,

      // Reset Received
      receivedQty: 0,
      receivedAmount: 0,
      receivedDate: null,

      // Reset status
      status: 'ordered',
    }))

    console.log(`  Updating ${doc.items?.length} items via direct DB update...`)
    const collection = payload.db.collections['stock-orders']
    await collection.updateOne(
      { _id: doc.id },
      {
        $set: {
          items: updatedItems,
          status: 'ordered',
        },
      },
    )
    console.log(`  Successfully reset all quantities and status for ${invoiceNumber}`)
  }

  process.exit(0)
}

resetOrders()
