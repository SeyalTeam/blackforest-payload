import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { getProductStock, addGranularMatch } from '../utilities/inventory'
import { ObjectId } from 'mongodb'

const run = async () => {
  const payload = await getPayload({ config })

  const entryId = '696bc0ff607c737f8110de87'
  const branchId = '68fcfa0238714903fbd03e3c'

  console.log(`Checking Instock Entry ${entryId}...`)

  const entry = await payload.findByID({
    collection: 'instock-entries',
    id: entryId,
  })

  console.log(`Current Status: ${entry.status}`)

  if (entry.status !== 'approved') {
    console.log('Approving entry...')
    await payload.update({
      collection: 'instock-entries',
      id: entryId,
      data: {
        status: 'approved',
      },
    })
    console.log('Entry approved.')
  }

  // Pick a product to verify
  const firstItem = entry.items && entry.items.length > 0 ? entry.items[0] : null
  const productId = firstItem
    ? typeof firstItem.product === 'object'
      ? firstItem.product.id
      : firstItem.product
    : null
  const qty = firstItem ? firstItem.instock : 0

  if (!productId) {
    console.log('No item found to verify.')
    process.exit(1)
  }

  console.log(`Verifying stock for product ID: ${productId} (Expected +${qty})`)

  // Check if we need to update timestamp to be after reset
  // Reset date was seen as 17:28 UTC. Entry is 17:03 UTC.
  // We'll verify stock. If 0, we update timestamp to NOW.

  const stockBefore = await getProductStock(payload, productId, branchId)
  if (stockBefore < qty) {
    console.log(`Stock (${stockBefore}) is less than expected (${qty}). Likely due to reset date.`)
    console.log('Updating entry timestamp to NOW...')
    await payload.update({
      collection: 'instock-entries',
      id: entryId,
      data: {
        createdAt: new Date().toISOString(),
      },
    })
    console.log('Timestamp updated.')
  }

  const stock = await getProductStock(payload, productId, branchId)
  console.log(`Current Calculated Stock: ${stock}`)

  if (stock >= qty) {
    console.log('SUCCESS: Stock reflects the instock entry.')
  } else {
    console.log('WARNING: Stock still low.')
  }

  process.exit(0)
}

run()
