import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

async function debug() {
  const payload = await getPayload({ config })

  const order = await payload.find({
    collection: 'stock-orders',
    where: {
      invoiceNumber: {
        equals: 'ETT-STC-251221-03',
      },
    },
  })

  if (order.docs.length === 0) {
    console.log('Order not found')
    return
  }

  const doc = order.docs[0]
  console.log('Stock Order:', doc.invoiceNumber)
  console.log('Items Count:', doc.items?.length)

  doc.items?.forEach(
    (
      item: {
        name: string
        product: string | object
        requiredQty?: number | null
        sendingQty?: number | null
        confirmedQty?: number | null
      },
      index: number,
    ) => {
      console.log(
        `[${index}] ${item.name} (${item.product}): Req: ${item.requiredQty}, Send: ${item.sendingQty}, Conf: ${item.confirmedQty}`,
      )
    },
  )

  process.exit(0)
}

debug()
