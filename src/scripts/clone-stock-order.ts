import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

async function cloneOrder() {
  const payload = await getPayload({ config })

  // 1. Fetch original
  const original = await payload.find({
    collection: 'stock-orders',
    where: {
      invoiceNumber: {
        equals: 'ETT-STC-251222-10',
      },
    },
    depth: 0,
  })

  if (original.docs.length === 0) {
    console.log('Original order not found')
    process.exit(1)
  }

  const doc = original.docs[0]
  console.log(`Cloning from ${doc.invoiceNumber}...`)

  // 2. Prepare items (reset all except required info)
  const newItems = (doc.items || []).map(
    (item: { product: any; name: string; inStock?: number; requiredQty?: number }) => ({
      product: typeof item.product === 'object' ? item.product.id : item.product,
      name: item.name,
      inStock: item.inStock || 0,
      requiredQty: item.requiredQty || 0,
      // Other qty fields will be 0 by default or handled by hooks
    }),
  )

  // 3. Create new order
  // Tomorrow is Dec 24, 2025
  const tomorrowDelivery = new Date('2025-12-24T09:00:00.000Z')

  try {
    // We need to act as a user with 'branch' role to bypass access control
    // User 69031a3ba019f41f1db7aeca was the original creator
    const newOrder = await payload.create({
      collection: 'stock-orders',
      data: {
        invoiceNumber: 'TEMP-' + Date.now(), // Will be overwritten by hook
        createdBy: '69031a3ba019f41f1db7aeca',
        branch: doc.branch,
        company: doc.company,
        deliveryDate: tomorrowDelivery.toISOString(),
        items: newItems as {
          product: string
          name: string
          inStock: number
          requiredQty: number
        }[],
        status: 'ordered',
      },
      user: {
        id: '69031a3ba019f41f1db7aeca',
        collection: 'users',
        role: 'branch',
        branch: doc.branch,
      } as { id: string; collection: 'users'; role: string; branch: any },
      overrideAccess: true,
    })

    console.log(`Successfully created cloned order: ${newOrder.invoiceNumber}`)
    console.log(`New Order ID: ${newOrder.id}`)
  } catch (err) {
    console.error('Error creating clone:', err)
  }

  process.exit(0)
}

cloneOrder()
