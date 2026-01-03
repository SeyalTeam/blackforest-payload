import { getPayload } from 'payload'
import config from '../payload.config'
import dotenv from 'dotenv'

dotenv.config()

async function resetVseyalBranch() {
  const payload = await getPayload({ config })

  // 1. Find the Vseyal branch
  const branchResult = await payload.find({
    collection: 'branches',
    where: {
      name: {
        equals: 'VSeyal',
      },
    },
  })

  if (branchResult.docs.length === 0) {
    console.error('Vseyal branch not found')
    process.exit(1)
  }

  const branch = branchResult.docs[0]
  console.log(`Found branch: ${branch.name} (${branch.id})`)

  // 2. Set the reset date to now
  const now = new Date().toISOString()
  await payload.update({
    collection: 'branches',
    id: branch.id,
    data: {
      inventoryResetDate: now,
    },
  })

  console.log(`Updated inventoryResetDate to ${now}`)

  // 3. Create an INITIAL STOCK entry with 0 for all products
  const productsResult = await payload.find({
    collection: 'products',
    limit: 1000,
    pagination: false,
  })

  const items = productsResult.docs.map((p) => ({
    product: p.id,
    name: p.name,
    inStock: 0,
    requiredQty: 0, // Required by schema
    status: 'ordered' as const,
  }))

  const initialStockOrder = await payload.create({
    collection: 'stock-orders',
    data: {
      branch: branch.id,
      notes: 'INITIAL STOCK',
      status: 'confirmed',
      items: items,
      invoiceNumber: `INIT-${branch.name.substring(0, 3).toUpperCase()}-${Date.now()}`, // Consistent with STC prefix
      deliveryDate: now,
      createdBy: '6921733e6f7f76623ca0dec1',
      company: typeof branch.company === 'string' ? branch.company : (branch.company as any).id,
    },
    user: await payload.findByID({ collection: 'users', id: '6921733e6f7f76623ca0dec1' }),
    overrideAccess: true,
  })

  console.log(`Created INITIAL STOCK order: ${initialStockOrder.invoiceNumber}`)
  process.exit(0)
}

resetVseyalBranch()
