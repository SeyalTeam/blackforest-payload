import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()

const uri = process.env.DATABASE_URI
if (!uri) throw new Error('DATABASE_URI is not defined')
const client = new MongoClient(uri)

async function run() {
  await client.connect()
  const db = client.db('blackforest-payload')

  const branchId = '69724ad6f91273ae0b1e121f'

  const branch = await db.collection('branches').findOne({ _id: new ObjectId(branchId) })
  console.log(`\n🏪 Branch: ${branch?.name || 'UNKNOWN'} (${branchId})`)
  console.log(`📅 Today: July 22, 2026\n`)

  // Today's closing entries — pattern: ETP-CLO-220726
  const todayEntries = await db.collection('closing-entries').find({
    $or: [{ branch: branchId }, { branch: new ObjectId(branchId) }],
    closingNumber: { $regex: /^ETP-CLO-220726/ }
  }).sort({ createdAt: 1 }).toArray()

  if (todayEntries.length === 0) {
    console.log(`❌ No closing entries found for today (July 22, 2026).`)

    // Check if there are any from yesterday (July 21)
    const yesterdayEntries = await db.collection('closing-entries').find({
      $or: [{ branch: branchId }, { branch: new ObjectId(branchId) }],
      closingNumber: { $regex: /^ETP-CLO-210726/ }
    }).sort({ createdAt: 1 }).toArray()

    if (yesterdayEntries.length > 0) {
      console.log(`\n📋 Yesterday (July 21) had ${yesterdayEntries.length} closing entries:`)
      yesterdayEntries.forEach((e: any) => {
        const t = new Date(e.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
        console.log(`  ${e.closingNumber} at ${t} — Sales: ₹${(e.totalSales || 0).toLocaleString('en-IN')}, Bills: ${e.totalBills || 0}, Net: ₹${(e.net || 0).toLocaleString('en-IN')}`)
      })
    }

    // Also check today's bills so far
    const startToday = new Date('2026-07-22T00:00:00.000Z')
    const endToday = new Date('2026-07-22T23:59:59.999Z')
    const todayBills = await db.collection('billings').find({
      branch: new ObjectId(branchId),
      createdAt: { $gte: startToday, $lte: endToday },
      status: { $in: ['completed', 'settled'] }
    }).toArray()
    const todayBillTotal = todayBills.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0)
    console.log(`\n📊 Today's billing so far (no closing yet):`)
    console.log(`  Completed/Settled Bills: ${todayBills.length}`)
    console.log(`  Total Amount: ₹${todayBillTotal.toLocaleString('en-IN')}`)
  } else {
    console.log(`✅ Found ${todayEntries.length} closing entries for today:\n`)

    todayEntries.forEach((entry: any, i: number) => {
      const timeStr = new Date(entry.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📝 Closing Entry #${i + 1}: ${entry.closingNumber} (${timeStr})`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`  ID             : ${entry._id}`)
      console.log(``)
      console.log(`  ── 💵 Sales ──`)
      console.log(`  System Sales   : ₹${(entry.systemSales || 0).toLocaleString('en-IN')}`)
      console.log(`  Manual Sales   : ₹${(entry.manualSales || 0).toLocaleString('en-IN')}`)
      console.log(`  Online Sales   : ₹${(entry.onlineSales || 0).toLocaleString('en-IN')}`)
      console.log(`  Total Sales    : ₹${(entry.totalSales || 0).toLocaleString('en-IN')}`)
      console.log(`  Total Bills    : ${entry.totalBills || 0}`)
      console.log(``)
      console.log(`  ── 📉 Deductions ──`)
      console.log(`  Expenses       : ₹${(entry.expenses || 0).toLocaleString('en-IN')}`)
      console.log(`  Return Total   : ₹${(entry.returnTotal || 0).toLocaleString('en-IN')}`)
      console.log(`  Stock Orders   : ₹${(entry.stockOrders || 0).toLocaleString('en-IN')}`)
      console.log(``)
      console.log(`  ── 💳 Payments ──`)
      console.log(`  Credit Card    : ₹${(entry.creditCard || 0).toLocaleString('en-IN')}`)
      console.log(`  UPI            : ₹${(entry.upi || 0).toLocaleString('en-IN')}`)
      console.log(`  Cash           : ₹${(entry.cash || 0).toLocaleString('en-IN')}`)
      console.log(`  Total Payments : ₹${(entry.totalPayments || 0).toLocaleString('en-IN')}`)
      console.log(``)
      console.log(`  ── 🪙 Denominations ──`)
      if (entry.denominations) {
        const d = entry.denominations
        const denomList = [
          { label: '₹2000', count: d.count2000 || 0, value: 2000 },
          { label: '₹500 ', count: d.count500 || 0, value: 500 },
          { label: '₹200 ', count: d.count200 || 0, value: 200 },
          { label: '₹100 ', count: d.count100 || 0, value: 100 },
          { label: '₹50  ', count: d.count50 || 0, value: 50 },
          { label: '₹10  ', count: d.count10 || 0, value: 10 },
          { label: '₹5   ', count: d.count5 || 0, value: 5 },
        ]
        denomList.forEach(dn => {
          if (dn.count > 0) {
            console.log(`  ${dn.label} x ${dn.count.toString().padStart(3)} = ₹${(dn.count * dn.value).toLocaleString('en-IN')}`)
          }
        })
        const denomTotal = denomList.reduce((s, dn) => s + dn.count * dn.value, 0)
        console.log(`  Denom Total    : ₹${denomTotal.toLocaleString('en-IN')}`)
      } else {
        console.log(`  (no denominations entered)`)
      }
      console.log(``)
      console.log(`  ── 📊 Net ──`)
      console.log(`  NET            : ₹${(entry.net || 0).toLocaleString('en-IN')}`)
      console.log(``)
    })

    // Aggregate if multiple
    if (todayEntries.length > 1) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📊 DAY AGGREGATE (All ${todayEntries.length} Closings)`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      const agg = (field: string) => todayEntries.reduce((s, e: any) => s + (e[field] || 0), 0)
      console.log(`  System Sales   : ₹${agg('systemSales').toLocaleString('en-IN')}`)
      console.log(`  Manual Sales   : ₹${agg('manualSales').toLocaleString('en-IN')}`)
      console.log(`  Online Sales   : ₹${agg('onlineSales').toLocaleString('en-IN')}`)
      console.log(`  Total Sales    : ₹${agg('totalSales').toLocaleString('en-IN')}`)
      console.log(`  Total Bills    : ${agg('totalBills')}`)
      console.log(`  Expenses       : ₹${agg('expenses').toLocaleString('en-IN')}`)
      console.log(`  Returns        : ₹${agg('returnTotal').toLocaleString('en-IN')}`)
      console.log(`  Stock Orders   : ₹${agg('stockOrders').toLocaleString('en-IN')}`)
      console.log(`  Credit Card    : ₹${agg('creditCard').toLocaleString('en-IN')}`)
      console.log(`  UPI            : ₹${agg('upi').toLocaleString('en-IN')}`)
      console.log(`  Cash           : ₹${agg('cash').toLocaleString('en-IN')}`)
      console.log(`  Total Payments : ₹${agg('totalPayments').toLocaleString('en-IN')}`)
      console.log(`  NET            : ₹${agg('net').toLocaleString('en-IN')}`)
    }

    const last = todayEntries[todayEntries.length - 1] as any
    const lastTime = new Date(last.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
    console.log(`\n🔔 LAST CLOSING: ${last.closingNumber} at ${lastTime} IST`)
  }

  await client.close()
}

run().catch(console.error)
