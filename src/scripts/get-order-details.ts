import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

async function getOrderDetails() {
  const payload = await getPayload({ config })

  const order = await payload.find({
    collection: 'stock-orders',
    where: {
      invoiceNumber: {
        equals: 'ETT-STC-251222-10',
      },
    },
    depth: 0,
  })

  if (order.docs.length > 0) {
    const doc = order.docs[0]
    console.log(JSON.stringify(doc, null, 2))
  } else {
    console.log('Order not found')
  }
  process.exit(0)
}

getOrderDetails()
