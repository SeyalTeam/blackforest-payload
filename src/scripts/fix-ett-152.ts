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

    // Find ETT-152
    const targetInvoice = 'ETT-152'
    const oldFormatOrder = await db
      .collection('stock-orders')
      .findOne({ invoiceNumber: targetInvoice })

    if (!oldFormatOrder) {
      console.log(`Order ${targetInvoice} not found.`)
      return
    }

    // Get Branch Name for prefix
    const branch = await db
      .collection('branches')
      .findOne({ _id: new ObjectId(oldFormatOrder.branch) })
    if (!branch) {
      console.error('Branch not found')
      return
    }
    const abbr = (branch.name || '').substring(0, 3).toUpperCase()

    // Calculate new invoice number based on date
    // ETT-STC-YYMMDD-SEQ
    const date = dayjs(oldFormatOrder.createdAt).tz('Asia/Kolkata')
    const dateStr = date.format('YYMMDD')
    const prefix = `${abbr}-STC-${dateStr}-`

    // Find other orders for this branch on this day to determine SEQ
    // Actually, if we are fixing just ONE, we need to be careful not to collide.
    // Let's see what others exist for this day.
    const startOfDay = date.startOf('day').toDate()
    const endOfDay = date.endOf('day').toDate()

    const existingDayOrders = await db
      .collection('stock-orders')
      .find({
        branch: oldFormatOrder.branch,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        invoiceNumber: { $ne: targetInvoice }, // exclude self
      })
      .toArray()

    console.log(`Found ${existingDayOrders.length} other orders for ${abbr} on ${dateStr}`)
    existingDayOrders.forEach((o) => console.log(` - ${o.invoiceNumber}`))

    // Determine next sequence
    // If existing are formatted correctly, we parse them.
    let maxSeq = 0
    existingDayOrders.forEach((o) => {
      const parts = o.invoiceNumber.split('-')
      if (parts.length === 4) {
        const seq = parseInt(parts[3], 10)
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
      }
    })

    const newSeq = (maxSeq + 1).toString().padStart(2, '0')
    const newInvoiceNumber = `${prefix}${newSeq}`

    console.log(`Planning to rename ${targetInvoice} to ${newInvoiceNumber}`)

    // Update
    await db
      .collection('stock-orders')
      .updateOne({ _id: oldFormatOrder._id }, { $set: { invoiceNumber: newInvoiceNumber } })
    console.log('Update complete.')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.close()
  }
}

run()
