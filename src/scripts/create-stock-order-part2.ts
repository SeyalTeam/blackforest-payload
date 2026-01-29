// src/scripts/create-stock-order-part2.ts
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { getPayload } from 'payload'
import configPromise from '../payload.config'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const branchId = '69724ad6f91273ae0b1e121f'
// Names matched with the database list
const orderItems = [
  { name: 'VEG PUFFS', qty: 30 },
  { name: 'EGG PUFFS', qty: 30 },
  { name: 'CHICKEN PUFFS', qty: 30 },
  { name: 'Big coconut bun', qty: 5 }, // List showed "BIG COCONUT BUN"
  { name: 'BREAD', qty: 10 }, // List showed "BREAD" might be missing if not exact
  { name: 'SANDWICH BREAD', qty: 5 }, // List showed "SANDWICH BREAD"
]

// To be safe, I'll use a loose matching or a specific list
const rawOrder = [
  { search: 'veg puff', qty: 30 },
  { search: 'egg puff', qty: 30 },
  { search: 'chicken puff', qty: 30 },
  { search: 'big coconut', qty: 5 },
  { search: 'wheat bread', qty: 5 }, // Was missed in first run too
  { search: 'sandwich', qty: 5 },
]

async function run() {
  const payload = await getPayload({ config: configPromise })

  console.log('Fetching products...')
  const productDocs = await payload.find({
    collection: 'products',
    pagination: false,
    depth: 0,
  })

  const productMap = new Map()
  productDocs.docs.forEach((p: any) => {
    productMap.set(p.name.toLowerCase().trim(), { id: p.id, name: p.name })
  })

  const items = []
  for (const item of rawOrder) {
    // Try exact match first, then partial
    let found = productMap.get(item.search.toLowerCase().trim())

    if (!found) {
      // Try simple plural/singular or partial
      for (const [name, data] of productMap.entries()) {
        if (name.includes(item.search.toLocaleLowerCase())) {
          found = data
          break
        }
      }
    }

    if (!found) {
      console.error(`Product not found for: ${item.search}`)
      continue
    }

    console.log(`Matched "${item.search}" to "${found.name}"`)
    items.push({
      product: found.id,
      name: found.name,
      inStock: 0,
      requiredQty: item.qty,
      status: 'ordered',
    })
  }

  if (items.length === 0) {
    console.error('No valid products found to order in part 2.')
    process.exit(1)
  }

  // Delivery date: tomorrow at 9 AM IST
  const deliveryDate = dayjs()
    .tz('Asia/Kolkata')
    .add(1, 'day')
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0)
    .toISOString()

  console.log(`Creating second stock order for branch ${branchId}...`)
  try {
    const order = await payload.create({
      collection: 'stock-orders',
      data: {
        branch: branchId,
        deliveryDate,
        items,
        status: 'ordered',
        createdBy: '67484df89240361247d56693',
      },
      user: {
        id: '67484df89240361247d56693',
        role: 'superadmin',
        collection: 'users',
      } as any,
    })

    console.log('Second stock order created successfully!')
    console.log('Invoice Number:', order.invoiceNumber)
    console.log('Order ID:', order.id)
  } catch (error) {
    console.error('Error creating second stock order:', error)
  }

  process.exit(0)
}

run()
