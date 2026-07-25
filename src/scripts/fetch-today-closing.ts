import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()

const uri = process.env.DATABASE_URI
if (!uri) throw new Error('DATABASE_URI is not defined')
const client = new MongoClient(uri)

async function run() {
  await client.connect()
  const db = client.db('blackforest-payload')

  const branchId = '68fcf95338714903fbd03e27'

  const branch = await db.collection('branches').findOne({ _id: new ObjectId(branchId) })
  console.log(`\n🏪 Branch: ${branch?.name || 'UNKNOWN'} (${branchId})`)
  console.log(`📅 Today: July 25, 2026\n`)

  const startOfDay = new Date('2026-07-25T00:00:00.000Z')
  const endOfDay = new Date('2026-07-25T23:59:59.999Z')

  // All bills today
  const allBills = await db.collection('billings').find({
    branch: new ObjectId(branchId),
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ createdAt: 1 }).toArray()

  // Status breakdown
  const statusMap: Record<string, { count: number, total: number }> = {}
  allBills.forEach((b: any) => {
    const status = b.status || 'unknown'
    if (!statusMap[status]) statusMap[status] = { count: 0, total: 0 }
    statusMap[status].count++
    statusMap[status].total += b.totalAmount || 0
  })

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📋 TODAY'S BILLING (July 25)`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  if (allBills.length === 0) {
    console.log(`\n  ❌ No bills found for today.`)
  } else {
    console.log(`\n  ── Status Breakdown ──`)
    let grandTotal = 0, grandCount = 0
    Object.entries(statusMap).sort((a, b) => b[1].total - a[1].total).forEach(([status, data]) => {
      console.log(`     ${status.padEnd(15)}: ${data.count.toString().padStart(4)} bills  |  ₹${data.total.toLocaleString('en-IN')}`)
      grandTotal += data.total
      grandCount += data.count
    })
    console.log(`     ${'─'.repeat(50)}`)
    console.log(`     ${'ALL'.padEnd(15)}: ${grandCount.toString().padStart(4)} bills  |  ₹${grandTotal.toLocaleString('en-IN')}`)

    // Completed + Settled
    const completedBills = allBills.filter((b: any) => b.status === 'completed' || b.status === 'settled')
    const completedTotal = completedBills.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0)

    console.log(`\n  ── Completed/Settled ──`)
    console.log(`     Bills  : ${completedBills.length}`)
    console.log(`     Amount : ₹${completedTotal.toLocaleString('en-IN')}`)

    // Payment mode breakdown
    const paymentMap: Record<string, { count: number, total: number }> = {}
    completedBills.forEach((b: any) => {
      const mode = b.paymentMode || b.paymentMethod || 'unknown'
      if (!paymentMap[mode]) paymentMap[mode] = { count: 0, total: 0 }
      paymentMap[mode].count++
      paymentMap[mode].total += b.totalAmount || 0
    })

    console.log(`\n  ── Payment Mode Breakdown ──`)
    Object.entries(paymentMap).sort((a, b) => b[1].total - a[1].total).forEach(([mode, data]) => {
      console.log(`     ${mode.padEnd(15)}: ${data.count.toString().padStart(4)} bills  |  ₹${data.total.toLocaleString('en-IN')}`)
    })

    // First and last bill times
    if (completedBills.length > 0) {
      const firstBill = completedBills[0] as any
      const lastBill = completedBills[completedBills.length - 1] as any
      console.log(`\n  ── Timeline ──`)
      console.log(`     First bill : ${new Date(firstBill.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} (${firstBill.invoiceNumber || 'N/A'})`)
      console.log(`     Last bill  : ${new Date(lastBill.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} (${lastBill.invoiceNumber || 'N/A'})`)
    }
  }

  // Check closing entries for today - get branch prefix first
  const branchPrefix = branch?.name ? branch.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) : 'BRN'
  const closingPattern = `${branchPrefix}-CLO-250726`
  
  // Also try generic search
  const closingEntries = await db.collection('closing-entries').find({
    $or: [{ branch: branchId }, { branch: new ObjectId(branchId) }],
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ createdAt: 1 }).toArray()

  if (closingEntries.length > 0) {
    const closingSystemSales = closingEntries.reduce((s: number, e: any) => s + (e.systemSales || 0), 0)
    const closingBills = closingEntries.reduce((s: number, e: any) => s + (e.totalBills || 0), 0)

    console.log(`\n  ── Closing Entries Today ──`)
    closingEntries.forEach((e: any) => {
      const t = new Date(e.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
      console.log(`     ${e.closingNumber} (${t}): ${e.totalBills} bills, ₹${(e.systemSales || 0).toLocaleString('en-IN')}`)
    })
    console.log(`     Total in closings: ${closingBills} bills, ₹${closingSystemSales.toLocaleString('en-IN')}`)
  } else {
    console.log(`\n  ── No closing entries yet today ──`)
  }

  await client.close()
}

run().catch(console.error)
