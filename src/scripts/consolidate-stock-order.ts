// src/scripts/consolidate-stock-order.ts
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
const existingOrderIds = ['697b9ada27b21102f07c517a', '697b9b02765e6a380e93b192']

const rawOrder = [
  { search: 'Veg puff', qty: 30 },
  { search: 'Egg puff', qty: 30 },
  { search: 'Chicken puff', qty: 30 },
  { search: 'Veg roll', qty: 30 },
  { search: 'Chicken roll', qty: 30 },
  { search: 'Bun', qty: 10 },
  { search: 'Coconut bun', qty: 20 },
  { search: 'Butter bun', qty: 20 },
  { search: 'jam bun', qty: 20 },
  { search: 'Big coconut', qty: 5 },
  { search: 'Bread', qty: 10 },
  { search: 'Wheat bread', qty: 5 },
  { search: 'Sandwich', qty: 5 },
]

async function run() {
  const payload = await getPayload({ config: configPromise })

  console.log('Deleting existing orders...')
  for (const id of existingOrderIds) {
    try {
      await payload.delete({
        collection: 'stock-orders',
        id,
        user: { id: '67484df89240361247d56693', role: 'superadmin', collection: 'users' } as any,
      })
      console.log(`Deleted order ${id}`)
    } catch (e) {
      console.error(`Failed to delete order ${id}:`, e)
    }
  }

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
    let found = productMap.get(item.search.toLowerCase().trim())

    if (!found) {
      for (const [name, data] of productMap.entries()) {
        if (name.includes(item.search.toLowerCase())) {
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

  const deliveryDate = dayjs()
    .tz('Asia/Kolkata')
    .add(1, 'day')
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0)
    .toISOString()

  console.log(`Creating consolidated stock order for branch ${branchId}...`)
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

    console.log('Consolidated stock order created successfully!')
    console.log('Invoice Number:', order.invoiceNumber)
    console.log('Order ID:', order.id)
  } catch (error) {
    console.error('Error creating consolidated stock order:', error)
  }

  process.exit(0)
}

run()
