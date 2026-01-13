import 'dotenv/config'
import { MongoClient } from 'mongodb'

async function migrateInvoiceNumbers() {
  const uri = process.env.DATABASE_URI || ''
  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    const db = client.db()
    const ordersCollection = db.collection('stock-orders')
    const branchesCollection = db.collection('branches')

    // 1. Fetch all branches to build ID -> Abbr map
    const branches = await branchesCollection.find({}).toArray()
    const branchMap = new Map<string, string>()

    branches.forEach((branch) => {
      const abbr = (branch.name || 'UNK').substring(0, 3).toUpperCase()
      branchMap.set(branch._id.toString(), abbr)
    })

    console.log(`Loaded ${branchMap.size} branches.`)

    // 2. Fetch all orders
    const orders = await ordersCollection.find({}).sort({ createdAt: 1 }).toArray()
    console.log(`Found ${orders.length} orders. Processing...`)

    // 3. Group by Branch
    const ordersByBranch: Record<string, typeof orders> = {}

    orders.forEach((order) => {
      // Handle both string ID and ObjectId
      let branchId = ''
      if (typeof order.branch === 'string') {
        branchId = order.branch
      } else if (order.branch && typeof order.branch === 'object' && '_id' in order.branch) {
        branchId = order.branch._id.toString()
      } else if (order.branch) {
        // If it's just an ObjectId but not stringified in 'branch' field directly?
        // payload usually stores ID as string or ObjectId depending on adapter.
        // Let's assume basic check:
        branchId = order.branch.toString()
      }

      if (!branchId) {
        console.warn(`Order ${order._id} has no branch. Skipping.`, order)
        return
      }

      if (!ordersByBranch[branchId]) {
        ordersByBranch[branchId] = []
      }
      ordersByBranch[branchId].push(order)
    })

    // 4. Update Orders
    for (const [branchId, branchOrders] of Object.entries(ordersByBranch)) {
      const abbr = branchMap.get(branchId) || 'UNK'
      console.log(`Processing ${abbr} (${branchId})... ${branchOrders.length} orders`)

      // Sort again to be safe (though we fetched sorted, grouping preserves order mostly)
      branchOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      let seq = 1
      for (const order of branchOrders) {
        const seqStr = seq.toString().padStart(2, '0')
        const newInvoice = `${abbr}-${seqStr}`

        if (order.invoiceNumber !== newInvoice) {
          console.log(`  Renaming ${order.invoiceNumber} -> ${newInvoice}`)
          await ordersCollection.updateOne(
            { _id: order._id },
            { $set: { invoiceNumber: newInvoice } },
          )
        }
        seq++
      }
    }

    console.log('Migration complete.')
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.close()
  }
}

migrateInvoiceNumbers()
