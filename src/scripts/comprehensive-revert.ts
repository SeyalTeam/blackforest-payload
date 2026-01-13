import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import path from 'path'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const run = async () => {
  if (!process.env.DATABASE_URI) {
    console.error('DATABASE_URI not found')
    process.exit(1)
  }

  const client = new MongoClient(process.env.DATABASE_URI)

  try {
    await client.connect()
    const db = client.db()

    // Find ALL invoices that match the short format: AAA-SEQ (where SEQ is 1 or more digits)
    // Regex: ^[A-Z]{3}-\d+$
    // AND excluding the standard format which is AAA-STC-YYMMDD-SEQ
    console.log('Scanning for short-format invoices...')

    const shortFormatOrders = await db
      .collection('stock-orders')
      .find({
        invoiceNumber: { $regex: /^[A-Z]{3}-\d+$/ },
      })
      .toArray()

    console.log(`Found ${shortFormatOrders.length} invoices to fix.`)

    if (shortFormatOrders.length === 0) {
      console.log('No orders found to revert.')
      return
    }

    // Group by Branch and Day (from createdAt)
    const scopes = new Map<string, { branchId: any; dateStr: string; abbr: string }>()

    // Get Branch details
    const branchCache = new Map<string, string>()
    const getBranchAbbr = async (id: any) => {
      const idStr = id.toString()
      if (branchCache.has(idStr)) return branchCache.get(idStr)
      const b = await db.collection('branches').findOne({ _id: new ObjectId(idStr) })
      const abbr = (b?.name || 'UNK').substring(0, 3).toUpperCase()
      branchCache.set(idStr, abbr)
      return abbr
    }

    for (const order of shortFormatOrders) {
      let branchId = order.branch
      if (typeof branchId === 'object' && branchId._id) branchId = branchId._id

      const abbr = await getBranchAbbr(branchId)
      const dateStr = dayjs(order.createdAt).tz('Asia/Kolkata').format('YYMMDD')

      const key = `${abbr}|${dateStr}`
      if (!scopes.has(key)) {
        scopes.set(key, { branchId, dateStr, abbr })
      }
    }

    console.log(`Identify ${scopes.size} unique Branch|Day scopes affected.`)

    for (const [key, scope] of scopes) {
      console.log(`Processing ${key}...`)
      const { branchId, dateStr, abbr } = scope

      // Fetch ALL orders for this branch & day to re-sequence them properly
      const startOfDay = dayjs.tz(dateStr, 'YYMMDD', 'Asia/Kolkata').startOf('day').toDate()
      const endOfDay = dayjs.tz(dateStr, 'YYMMDD', 'Asia/Kolkata').endOf('day').toDate()

      const allDayOrders = await db
        .collection('stock-orders')
        .find({
          $or: [{ branch: branchId }, { branch: new ObjectId(branchId.toString()) }],
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        })
        .sort({ createdAt: 1 })
        .toArray() // Sort by creation time is CRITICAL for correct sequence

      console.log(` - Found ${allDayOrders.length} total orders for this day. Re-sequencing...`)

      // Re-assign sequence
      let seq = 1
      for (const order of allDayOrders) {
        const seqStr = seq.toString().padStart(2, '0')
        const correctInvoice = `${abbr}-STC-${dateStr}-${seqStr}`

        if (order.invoiceNumber !== correctInvoice) {
          console.log(`   - Renaming ${order.invoiceNumber} -> ${correctInvoice}`)
          await db
            .collection('stock-orders')
            .updateOne({ _id: order._id }, { $set: { invoiceNumber: correctInvoice } })
        } else {
          // console.log(`   - ${order.invoiceNumber} is correct.`)
        }
        seq++
      }
    }

    console.log('Comprehensive revert complete.')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.close()
  }
}

run()
