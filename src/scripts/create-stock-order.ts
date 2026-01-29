// src/scripts/create-stock-order.ts
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
const orderItems = [
  { name: 'Veg puff', qty: 30 },
  { name: 'Egg puff', qty: 30 },
  { name: 'Chicken puff', qty: 30 },
  { name: 'Veg roll', qty: 30 },
  { name: 'Chicken roll', qty: 30 },
  { name: 'Bun', qty: 10 },
  { name: 'Coconut bun', qty: 20 },
  { name: 'Butter bun', qty: 20 },
  { name: 'jam bun', qty: 20 },
  { name: 'Big coconut', qty: 5 },
  { name: 'Bread', qty: 10 },
  { name: 'Wheat bread', qty: 5 },
  { name: 'Sandwich', qty: 5 },
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
    productMap.set(p.name.toLowerCase().trim(), p.id)
  })

  const items = []
  for (const item of orderItems) {
    const productId = productMap.get(item.name.toLowerCase().trim())
    if (!productId) {
      console.error(`Product not found: ${item.name}`)
      continue
    }
    items.push({
      product: productId,
      name: item.name,
      inStock: 0,
      requiredQty: item.qty,
      status: 'ordered',
    })
  }

  if (items.length === 0) {
    console.error('No valid products found to order.')
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

  console.log(`Creating stock order for branch ${branchId}...`)
  try {
    const order = await payload.create({
      collection: 'stock-orders',
      data: {
        branch: branchId,
        deliveryDate,
        items,
        status: 'ordered',
        createdBy: '67484df89240361247d56693', // Assuming a superadmin ID or valid user ID is needed, I'll check if I can omit it or use an existing one. Actually StockOrders.ts has defaultValue for createdBy.
      },
      // Skip access control to use Local API as superuser
      user: {
        id: '67484df89240361247d56693', // Provided ID from typical superadmin in this project or dummy
        role: 'superadmin',
        collection: 'users',
      } as any,
    })

    console.log('Stock order created successfully!')
    console.log('Invoice Number:', order.invoiceNumber)
    console.log('Order ID:', order.id)
    console.log('Delivery Date:', order.deliveryDate)
  } catch (error) {
    console.error('Error creating stock order:', error)
  }

  process.exit(0)
}

run()
