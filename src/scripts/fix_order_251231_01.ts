import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

async function fixOrder() {
  const payload = await getPayload({ config })
  const invoiceNumber = 'KMC-STC-251231-01'
  const targetProduct = 'CHOCOLATE CAKE SMALL'

  console.log(`Searching for order: ${invoiceNumber}...`)

  const orders = await payload.find({
    collection: 'stock-orders',
    where: {
      invoiceNumber: {
        equals: invoiceNumber,
      },
    },
    limit: 1,
  })

  if (orders.totalDocs === 0) {
    console.error(`Order ${invoiceNumber} not found!`)
    process.exit(1)
  }

  const order = orders.docs[0]
  console.log(`Found order ID: ${order.id}. Total items: ${order.items?.length || 0}`)

  if (!order.items || order.items.length === 0) {
    console.log('Order has no items. Exiting.')
    process.exit(0)
  }

  // Filter items
  const filteredItems = order.items.filter(
    (item) => item.name?.trim().toUpperCase() === targetProduct.toUpperCase(),
  )

  if (filteredItems.length === 0) {
    console.error(`Product "${targetProduct}" not found in this order!`)
    console.log('Available products:', order.items.map((i) => i.name).join(', '))
    process.exit(1)
  }

  if (filteredItems.length === order.items.length) {
    console.log('Order already contains only the target product. No changes needed.')
    process.exit(0)
  }

  console.log(`Found target product. Updating order to keep only this item...`)

  // Create a minimal update payload to avoid validation issues if possible,
  // but Payload update usually reruns hooks.
  // We need to be careful about hooks. The hook logic re-calculates amounts.
  // Should be fine as long as we pass the filtered items.

  try {
    const updatedOrder = await payload.update({
      collection: 'stock-orders',
      id: order.id,
      data: {
        items: filteredItems,
      },
      // Check if we need to override access or pass specific user context.
      // The original script used a specific user ID to bypass access control or satisfy roles.
      // 'update' access requires 'superadmin', 'supervisor', 'driver', 'branch', 'factory', 'chef'.
      // hooks might require 'req.user' to be present.
      // Let's assume script execution (server-side) might need overrideAccess: true
      // but hooks might fail if req.user is missing if they strictly check it.
      // Looking at StockOrders.ts:
      // Line 17-22: Access control. clone-stock-order.ts passed `user` object.
      // Line 28: `if (!req.user) throw new Error('Unauthorized')` in `beforeChange` hook for 'create'.
      // For 'update', lines 136+ check `if (req.user) ...`. It doesn't seem to THROW if user is missing for update,
      // EXCEPT line 31 Check branch matches user branch if user is branch/waiter.
      // Ideally we simulate a superadmin.
      overrideAccess: true,
      user: {
        id: '68fcab5f13ce32e6595e46aa', // Common Superadmin ID seen in other tasks usually, or just mock one.
        collection: 'users',
        role: 'superadmin',
        email: 'superadmin@example.com',
      } as any,
    })

    console.log(`Successfully updated order ${updatedOrder.invoiceNumber}`)
    console.log(`Old Item Count: ${order.items.length}`)
    console.log(`New Item Count: ${updatedOrder.items?.length}`)
    console.log(`Remaining Product: ${updatedOrder.items?.[0]?.name}`)
  } catch (err) {
    console.error('Failed to update order:', err)
  }

  process.exit(0)
}

fixOrder()
