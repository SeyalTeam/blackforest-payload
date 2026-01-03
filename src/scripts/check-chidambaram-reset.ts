import { getPayload } from 'payload'
import config from '../payload.config'

async function run() {
  const payload = await getPayload({ config })

  const branchId = '68fcfa0238714903fbd03e3c'
  const orderId = '695795105694776e01f00fe9'

  const branch = await payload.findByID({ collection: 'branches', id: branchId })
  console.log(`Branch Reset Date: ${branch.inventoryResetDate}`)

  const order = await payload.findByID({ collection: 'stock-orders', id: orderId })
  console.log('Order Details:')
  console.log(`- Created At: ${order.createdAt}`)
  console.log(`- Notes: ${order.notes}`)

  const itemsWithStock = order.items?.filter((item) => (item.inStock || 0) > 0)
  console.log(`- Items with inStock > 0: ${itemsWithStock?.length || 0}`)
  if (itemsWithStock && itemsWithStock.length > 0) {
    console.log('Sample Items with inStock:')
    itemsWithStock.slice(0, 5).forEach((item) => {
      console.log(`  - ${item.name}: ${item.inStock}`)
    })
  }

  process.exit(0)
}

run()
