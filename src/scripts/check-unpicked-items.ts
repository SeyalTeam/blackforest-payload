import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  try {
    const invoiceNumber = 'ETT-STC-260209-01'
    const orders = await payload.find({
      collection: 'stock-orders',
      where: { invoiceNumber: { equals: invoiceNumber } },
      depth: 1, // Depth 1 to get product names
    })

    if (orders.docs.length === 0) {
      console.log('Order not found.')
    } else {
      const order = orders.docs[0]
      console.log(`Order: ${order.invoiceNumber}`)
      console.log(`Branch: ${order.branch?.name} (${order.branch?.id})`)

      const unpicked = order.items.filter((i: any) => !i.pickedQty || i.pickedQty === 0)
      const picked = order.items.filter((i: any) => i.pickedQty > 0)
      const received = order.items.filter((i: any) => i.receivedQty > 0)

      console.log(`Total Items: ${order.items.length}`)
      console.log(`Picked: ${picked.length}`)
      console.log(`Received: ${received.length}`)
      console.log(`Unpicked: ${unpicked.length}`)

      if (unpicked.length > 0) {
        console.log('\nUnpicked Items (Receive Disabled for these):')
        unpicked.forEach((i: any) => {
          console.log(
            `- ${i.product?.name || i.product} (Required: ${i.requiredQty}, Confirmed: ${i.confirmedQty || 0})`,
          )
        })
      }
    }
  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
