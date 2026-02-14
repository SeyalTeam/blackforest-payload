import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  try {
    const invoiceNumber = 'ETT-STC-260209-01'
    console.log(`Searching for Stock Order: ${invoiceNumber}`)

    const orders = await payload.find({
      collection: 'stock-orders',
      where: {
        invoiceNumber: {
          equals: invoiceNumber,
        },
      },
      depth: 0,
    })

    if (orders.docs.length === 0) {
      console.log('Order not found.')
    } else {
      const order = orders.docs[0]
      console.log('Order ID:', order.id)
      console.log('Document Status:', order.status)
      console.log('Branch:', order.branch)

      if (order.items && Array.isArray(order.items)) {
        console.log('Items Count:', order.items.length)
        order.items.forEach((item, index) => {
          console.log(`Item ${index + 1}:`)
          console.log(`  Product: ${item.product}`)
          console.log(`  Required: ${item.requiredQty}`)
          console.log(`  Sending: ${item.sendingQty}`)
          console.log(`  Confirmed: ${item.confirmedQty}`)
          console.log(`  Picked: ${item.pickedQty}`)
          console.log(`  Received: ${item.receivedQty}`)
          console.log(`  Status: ${item.status}`)
        })
      }
    }
  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
