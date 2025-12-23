import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

async function getCreatedAt() {
  const payload = await getPayload({ config })

  const order = await payload.find({
    collection: 'stock-orders',
    where: {
      invoiceNumber: {
        equals: 'ETT-STC-251222-10',
      },
    },
  })

  if (order.docs.length > 0) {
    const doc = order.docs[0]
    console.log(`Order: ${doc.invoiceNumber}`)
    console.log(`Created At: ${doc.createdAt}`)
    console.log(`Delivery Date: ${doc.deliveryDate}`)
  } else {
    console.log('Order not found')
  }
  process.exit(0)
}

getCreatedAt()
