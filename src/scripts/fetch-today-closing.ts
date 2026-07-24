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

  const startOfDay = new Date('2026-07-23T00:00:00.000Z')
  const endOfDay = new Date('2026-07-23T23:59:59.999Z')

  // Get closing entries
  const closingEntries = await db.collection('closing-entries').find({
    closingNumber: { $regex: /^ETP-CLO-230726/ }
  }).sort({ createdAt: 1 }).toArray()

  // Get all completed/settled bills
  const allBills = await db.collection('billings').find({
    branch: new ObjectId(branchId),
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['completed', 'settled'] }
  }).sort({ createdAt: 1 }).toArray()

  // ── WINDOW 1: Start of day → Closing #1 (3:26:53 PM) ──
  // Closing says 43 bills / ₹12,423, actual window has 44 bills / ₹12,467
  // → 1 extra bill worth ₹44

  const closing1Time = new Date(closingEntries[0].createdAt)
  const window1Bills = allBills.filter((b: any) => {
    const t = new Date(b.createdAt)
    return t > startOfDay && t <= closing1Time
  })

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`🔍 WINDOW 1: Start of day → ${closing1Time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`)
  console.log(`   Closing recorded: 43 bills, ₹12,423`)
  console.log(`   Actual in window: ${window1Bills.length} bills, ₹${window1Bills.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0).toLocaleString('en-IN')}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  // The closing hook uses: createdAt > lastClosingTime AND createdAt < endOfDay
  // At hook runtime, it would only see bills that existed at that moment
  // The 1 missing bill is likely the one created closest to the closing time
  // Let's find it by removing bills until we get to ₹12,423 (43 bills)

  // Sort by createdAt descending to find the ones closest to closing time
  const w1Sorted = [...window1Bills].sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Find subset that sums to ₹12,423 with 43 bills — the extra bill(s) are the difference
  const closingAmount1 = closingEntries[0].systemSales || 0
  const closingCount1 = closingEntries[0].totalBills || 0
  const actualAmount1 = window1Bills.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0)

  const diffAmount1 = actualAmount1 - closingAmount1
  const diffCount1 = window1Bills.length - closingCount1

  console.log(`\n   Looking for ${diffCount1} bill(s) totalling ₹${diffAmount1}...\n`)

  // Find bills whose amounts sum to the difference
  // Since it's 1 bill = ₹44, find the bill with amount ₹44
  const candidates1 = window1Bills.filter((b: any) => (b.totalAmount || 0) === diffAmount1)
  
  if (candidates1.length > 0) {
    candidates1.forEach((b: any) => {
      printBill(b, 'MISSED IN CLOSING #1')
    })
  } else {
    // Try bills created in the last few seconds before closing
    console.log(`   No single bill with exact amount ₹${diffAmount1}. Checking bills near closing time...`)
    const nearClosingBills = w1Sorted.slice(0, diffCount1 + 2)
    nearClosingBills.forEach((b: any) => {
      printBill(b, 'NEAR CLOSING #1 TIME')
    })
  }

  // ── WINDOW 2: Closing #1 → Closing #2 (6:27:08 PM) ──
  // Closing says 57 bills / ₹19,851, actual window has 59 bills / ₹20,265
  // → 2 extra bills worth ₹414

  const closing2Time = new Date(closingEntries[1].createdAt)
  const window2Bills = allBills.filter((b: any) => {
    const t = new Date(b.createdAt)
    return t > closing1Time && t <= closing2Time
  })

  const closingAmount2 = closingEntries[1].systemSales || 0
  const closingCount2 = closingEntries[1].totalBills || 0
  const actualAmount2 = window2Bills.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0)
  const diffAmount2 = actualAmount2 - closingAmount2
  const diffCount2 = window2Bills.length - closingCount2

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`🔍 WINDOW 2: ${closing1Time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} → ${closing2Time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`)
  console.log(`   Closing recorded: ${closingCount2} bills, ₹${closingAmount2.toLocaleString('en-IN')}`)
  console.log(`   Actual in window: ${window2Bills.length} bills, ₹${actualAmount2.toLocaleString('en-IN')}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`\n   Looking for ${diffCount2} bill(s) totalling ₹${diffAmount2}...\n`)

  // The closing hook uses createdAt > lastClosingTime (which is the PREVIOUS closing's createdAt)
  // But the hook finds lastClosingTime by querying closing-entries for the same branch+date, sorted by -createdAt, limit 1
  // The "previous" closing for #2 should be #1's createdAt
  // The extra 2 bills could be:
  //   a) Bills created in the same second as closing #1 (race condition)
  //   b) Bills that the hook's query missed due to timing

  // Let's find bills created very close to closing #1's time (could be before/after by milliseconds)
  const w2Sorted = [...window2Bills].sort((a: any, b: any) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // Show bills closest to the window boundaries
  console.log(`   Bills at start of window (closest to closing #1 time):`)
  w2Sorted.slice(0, 5).forEach((b: any) => {
    const t = new Date(b.createdAt)
    const diffMs = t.getTime() - closing1Time.getTime()
    console.log(`     ${b.invoiceNumber || 'N/A'} | ${t.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} | ₹${(b.totalAmount || 0)} | +${diffMs}ms after closing`)
  })

  // Try to find 2 bills that sum to ₹414
  console.log(`\n   Searching for 2-bill combination summing to ₹${diffAmount2}...`)
  let found = false
  for (let i = 0; i < window2Bills.length && !found; i++) {
    for (let j = i + 1; j < window2Bills.length && !found; j++) {
      const sum = (window2Bills[i] as any).totalAmount + (window2Bills[j] as any).totalAmount
      if (sum === diffAmount2) {
        console.log(`\n   ✅ Found matching pair:\n`)
        printBill(window2Bills[i], 'MISSED IN CLOSING #2 (bill A)')
        printBill(window2Bills[j], 'MISSED IN CLOSING #2 (bill B)')
        found = true
      }
    }
  }

  if (!found) {
    // Show all bills in window sorted by time, highlight ones near boundaries
    console.log(`\n   Could not find exact 2-bill match. Showing all ${diffCount2 + 2} bills near window start:`)
    w2Sorted.slice(0, diffCount2 + 3).forEach((b: any) => {
      printBill(b, 'NEAR START OF WINDOW 2')
    })
  }

  // ── SUMMARY ──
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📊 SUMMARY OF ALL 5 MISSED BILLS (₹981)`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Window #1 gap: ${diffCount1} bill(s), ₹${diffAmount1}`)
  console.log(`  Window #2 gap: ${diffCount2} bill(s), ₹${diffAmount2}`)
  console.log(`  After last closing: 2 bills, ₹523`)
  console.log(`  TOTAL: ${diffCount1 + diffCount2 + 2} bills, ₹${diffAmount1 + diffAmount2 + 523}`)

  await client.close()
}

function printBill(b: any, label: string) {
  const t = new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  console.log(`   🔸 [${label}]`)
  console.log(`      Invoice   : ${b.invoiceNumber || b.billNumber || 'N/A'}`)
  console.log(`      ID        : ${b._id}`)
  console.log(`      Created   : ${t}`)
  console.log(`      Amount    : ₹${(b.totalAmount || 0).toLocaleString('en-IN')}`)
  console.log(`      Status    : ${b.status}`)
  console.log(`      Payment   : ${b.paymentMode || b.paymentMethod || 'N/A'}`)
  if (b.items && Array.isArray(b.items)) {
    b.items.forEach((item: any) => {
      const name = item.productName || item.name || (item.product && typeof item.product === 'object' ? item.product.name : item.product) || 'Unknown'
      const qty = item.quantity || item.qty || 1
      const price = item.price || item.rate || item.amount || 0
      console.log(`      Item      : ${name} x${qty} @ ₹${price}`)
    })
  }
  console.log(``)
}

run().catch(console.error)
