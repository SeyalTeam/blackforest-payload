import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

const start = async () => {
  const payload = await getPayload({ config })

  // 1. Create a stock order with 2 items
  const branches = await payload.find({
    collection: 'branches',
    limit: 1,
  })
  if (branches.docs.length === 0) {
    console.error('No branches found')
    process.exit(1)
  }
  const branch = branches.docs[0]

  const products = await payload.find({
    collection: 'products',
    limit: 2,
  })

  if (products.docs.length < 2) {
    console.error('Not enough products to test')
    process.exit(1)
  }

  const users = await payload.find({
    collection: 'users',
    where: {
      role: {
        equals: 'superadmin',
      },
    },
    limit: 1,
  })
  if (users.docs.length === 0) {
    console.error('No superadmin found')
    process.exit(1)
  }
  const adminUser = users.docs[0]

  try {
    console.log('Creating stock order...')
    const order = await payload.create({
      collection: 'stock-orders',
      data: {
        branch: branch.id,
        deliveryDate: new Date().toISOString(),
        items: [
          {
            product: products.docs[0].id,
            requiredQty: 10,
            status: 'ordered',
            name: products.docs[0].name || 'Product 1',
            inStock: 0,
          },
          {
            product: products.docs[1].id,
            requiredQty: 5,
            status: 'ordered',
            name: products.docs[1].name || 'Product 2',
            inStock: 0,
          },
        ],
      },
      user: adminUser,
    })

    console.log(`Order created: ${order.invoiceNumber}, Status: ${order.status}`)

    // 2. Update item 1 to completed
    console.log('Updating item 1 to completed...')
    const updated1 = await payload.update({
      collection: 'stock-orders',
      id: order.id,
      data: {
        items: [
          {
            ...order.items[0],
            status: 'completed',
          },
          {
            ...order.items[1],
            // keep ordered
          },
        ],
      },
      user: adminUser,
    })
    console.log(`Order Status after 1 item completed: ${updated1.status}`)

    if (updated1.status === 'completed') {
      console.error('FAIL: Order should not be completed yet')
    }

    // 3. Update item 2 to completed
    console.log('Updating item 2 to completed...')
    // Note: updated1.items contains 2 items.
    const item1 = updated1.items[0]
    const item2 = updated1.items[1]

    const item1Status = typeof item1 === 'object' && 'status' in item1 ? item1.status : ''

    const updated2 = await payload.update({
      collection: 'stock-orders',
      id: order.id,
      data: {
        items: [
          updated1.items[0],
          {
            ...updated1.items[1], // item 2
            status: 'completed',
          },
        ],
      },
      user: adminUser,
    })
    console.log(`Order Status after all items completed: ${updated2.status}`)

    if (updated2.status === 'completed') {
      console.log('SUCCESS: Order is completed')
    } else {
      console.error('FAIL: Order status is not completed. Status is: ' + updated2.status)
    }
  } catch (e) {
    console.error(e)
  }

  process.exit(0)
}

start()
