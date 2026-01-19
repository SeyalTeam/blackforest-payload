import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  try {
    // Define Today Range (2026-01-19)
    const start = new Date('2026-01-18T18:30:00.000Z') // UTC start of 19th IST approx
    // Actually better to use simple string match or wide range to find ANY for today

    // Let's just look for any with receivedDate > 2026-01-01
    const checkDate = new Date('2026-01-19T00:00:00.000Z')

    console.log('Searching for items with receivedDate >= ', checkDate)

    const result = await payload.db.collections['stock-orders'].findOne({
      'items.receivedDate': { $gte: checkDate },
      'items.receivedQty': { $gt: 0 },
    })

    if (!result) {
      console.log('No Stock Order found for Today')
    } else {
      console.log('Found Order For Today:', result._id)
      // Check items
      if (result.items && Array.isArray(result.items)) {
        const receivedItem = result.items.find(
          (i: any) => i.receivedQty > 0 && i.receivedDate >= checkDate,
        )
        if (receivedItem) {
          console.log('Item Product:', receivedItem.product)
          console.log('Item Received Qty:', receivedItem.receivedQty)
          console.log('Item Received Date Value:', receivedItem.receivedDate)
        }
      }
    }
  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
