import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)
dayjs.tz.setDefault('Asia/Kolkata')

async function revertInvoices() {
  const uri = process.env.DATABASE_URI || ''
  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log('Connected to MongoDB')
    const db = client.db()
    const collection = db.collection('stock-orders')

    // Find ONLY the modified orders
    const orders = await collection
      .find({
        invoiceNumber: { $regex: /^[A-Z]{3}-\d{2}$/ },
      })
      .toArray()

    console.log(`Found ${orders.length} modified orders to revert.`)

    // Group to optimize processing?
    // Actually, we need to handle them branch by branch, day by day, to get the sequence right.
    // BUT, we must also consider the *existing* old format orders in the database for that day?
    // If the migration crashed halfway, some orders for '251209' might be new format, some old?
    // Safer approach: Group ALL orders for a Branch+Day, sort them, and re-label ALL of them to be safe?
    // Or just re-label the modified ones sequentially, hoping they were the only ones?
    // If migration processed 'SAW' fully, then all SAW orders are new format.
    // If it crashed on ALA, maybe some ALA are new, some old.

    // Let's create a "Scope" of (Branch + Day).
    // For every modified order, identified its Branch and Day.
    // Then fetch ALL orders for that Branch+Day (clean or modified).
    // Sort by createdAt.
    // Re-assign invoices.

    const touchedScopes = new Set<string>()

    orders.forEach((o) => {
      let branchId = ''
      if (typeof o.branch === 'string') branchId = o.branch
      else if (o.branch?._id) branchId = o.branch._id.toString()
      else branchId = o.branch?.toString()

      const dateStr = dayjs(o.createdAt).tz('Asia/Kolkata').format('YYMMDD')
      touchedScopes.add(`${branchId}|${dateStr}`)
    })

    console.log(`Identified ${touchedScopes.size} affected Branch-Day scopes.`)

    // Load branches for abbr
    const branches = await db.collection('branches').find({}).toArray()
    const branchMap = new Map<string, string>()
    branches.forEach((b) => {
      branchMap.set(b._id.toString(), (b.name || 'UNK').substring(0, 3).toUpperCase())
    })

    for (const scope of touchedScopes) {
      const [branchId, dateStr] = scope.split('|')
      const abbr = branchMap.get(branchId) || 'UNK'

      // Search for everything in this scope
      // We can't easily search by 'day' on DB without range query.
      // But we can fetch by branch and do in-memory filter since dataset isn't huge (5000 docs total max usually).
      // Or just search by the modified ones? No, we need sequence integrity.

      // Let's calculate day range
      const start = dayjs.tz(dateStr, 'YYMMDD', 'Asia/Kolkata').startOf('day').toDate()
      const end = dayjs.tz(dateStr, 'YYMMDD', 'Asia/Kolkata').endOf('day').toDate()

      const scopeOrders = await collection
        .find({
          $or: [
            { branch: branchId },
            { branch: { $type: 'objectId', $eq: new ObjectId(branchId) } }, // In case stored as ObjectId
          ],
          createdAt: { $gte: start, $lte: end },
        })
        .sort({ createdAt: 1 })
        .toArray()

      console.log(
        `Querying scope ${abbr} ${dateStr} (${start.toISOString()} - ${end.toISOString()}): Found ${scopeOrders.length} orders`,
      )

      // Re-assign invoices
      let seq = 1
      for (const order of scopeOrders) {
        const seqStr = seq.toString().padStart(2, '0')
        const originalFormat = `${abbr}-STC-${dateStr}-${seqStr}`

        if (order.invoiceNumber !== originalFormat) {
          console.log(`Reverting ${order.invoiceNumber} -> ${originalFormat}`)
          await collection.updateOne(
            { _id: order._id },
            { $set: { invoiceNumber: originalFormat } },
          )
        }
        seq++
      }
    }

    console.log('Revert complete.')
  } catch (err) {
    console.error(err)
  } finally {
    await client.close()
  }
}

revertInvoices()
