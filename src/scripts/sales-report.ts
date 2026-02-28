import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const uri = process.env.DATABASE_URI
if (!uri) {
  console.error('DATABASE_URI not found in .env')
  process.exit(1)
}

const client = new MongoClient(uri)

async function run() {
  try {
    await client.connect()
    const db = client.db('blackforest-payload')

    // 1. Find the branch
    const branchId = '69724ad6f91273ae0b1e121f'

    // 2. Find the products
    const productsColl = db.collection('products')
    const targetProducts = await productsColl
      .find({
        name: { $in: ['EGG PUFFS', 'DUBAI CHOCO KUNAFA'] },
      })
      .toArray()

    console.log(`Found ${targetProducts.length} products`)

    if (targetProducts.length === 0) {
      const possible = await productsColl
        .find({
          name: { $regex: /puff|kunafa/i },
        })
        .toArray()
      console.log(
        'Possible matches:',
        possible.map((p) => ({ id: p._id, name: p.name })),
      )
      return
    }

    // const productIds = targetProducts.map((p) => p._id.toString())
    const productMap: Record<string, 'EGG PUFFS' | 'DUBAI CHOCO KUNAFA'> = {}
    targetProducts.forEach((p) => {
      productMap[p._id.toString()] = p.name as 'EGG PUFFS' | 'DUBAI CHOCO KUNAFA'
    })

    // 3. Find billings today for this branch
    // Today IST (Feb 27) starts at 2026-02-26T18:30:00Z
    const startOfTodayIST = new Date('2026-02-26T18:30:00Z')
    const endOfTodayIST = new Date() // Up to now

    const billingsColl = db.collection('billings')
    const query = {
      branch: new ObjectId(branchId),
      createdAt: { $gte: startOfTodayIST, $lte: endOfTodayIST },
      status: { $ne: 'cancelled' },
    }

    console.log(
      'Querying billings for branch:',
      branchId,
      'between',
      startOfTodayIST,
      'and',
      endOfTodayIST,
    )

    const bills = await billingsColl.find(query).toArray()
    console.log(`Found ${bills.length} bills today for this branch`)

    const result: Record<'EGG PUFFS' | 'DUBAI CHOCO KUNAFA', { count: number; bills: string[] }> = {
      'EGG PUFFS': { count: 0, bills: [] },
      'DUBAI CHOCO KUNAFA': { count: 0, bills: [] },
    }

    for (const bill of bills) {
      if (!bill.items) continue
      for (const item of bill.items) {
        const pId = item.product ? item.product.toString() : null
        if (pId && productMap[pId]) {
          const productName = productMap[pId]
          const qty = Number(item.quantity) || 0
          result[productName].count += qty
          const invoice = bill.invoiceNumber || bill._id.toString()
          if (!result[productName].bills.includes(invoice)) {
            result[productName].bills.push(invoice)
          }
        }
      }
    }

    console.log('--- FINAL REPORT ---')
    console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    console.error(err)
  } finally {
    await client.close()
  }
}

run().catch(console.error)
