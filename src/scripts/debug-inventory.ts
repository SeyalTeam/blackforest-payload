import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

const debugInventory = async () => {
  const payload = await getPayload({ config })

  console.log('--- Starting Debug ---')

  // 1. Check Raw StockOrders
  const orders = await payload.find({
    collection: 'stock-orders',
    limit: 1,
  })
  if (orders.docs.length > 0) {
    console.log('Sample Order Items:', JSON.stringify(orders.docs[0].items?.slice(0, 1), null, 2))
  }

  // 2. Run Aggregation
  const StockOrderModel = payload.db.collections['stock-orders']
  const stockInStats = await StockOrderModel.aggregate([
    {
      $unwind: '$items',
    },
    {
      $match: {
        'items.receivedQty': { $gt: 0 },
      },
    },
    {
      $group: {
        _id: {
          branch: '$branch',
          product: '$items.product',
        },
        totalReceived: { $sum: '$items.receivedQty' },
      },
    },
  ])

  console.log('Aggregation Result Count:', stockInStats.length)
  if (stockInStats.length > 0) {
    console.log('Sample Aggregation result:', stockInStats[0])
    const sample = stockInStats[0]
    console.log('Product ID Type:', typeof sample._id.product)
    console.log('Product ID value:', sample._id.product)
    console.log('Is it an object?', typeof sample._id.product === 'object')
    console.log('Does it have .id?', sample._id.product?.id)
    console.log('Stringified:', String(sample._id.product))
  } else {
    console.log('No stockIn stats found!')
  }

  process.exit(0)
}

debugInventory()
