import { getPayload } from 'payload'
import config from './src/payload.config'
import { ObjectId } from 'mongodb'

async function run() {
  const payload = await getPayload({ config })
  const branchId = '68fcfbf138714903fbd03e54'
  
  // Closing Entry 1
  const t0 = '2026-06-08T00:00:00.000Z'
  const t1 = '2026-06-08T12:20:17.171Z' // THO-CLO-080626-01 createdAt

  // Fetch all bills in Interval 1
  const bills = await payload.find({
    collection: 'billings',
    where: {
      and: [
        { branch: { equals: branchId } },
        { createdAt: { greater_than_equal: t0 } },
        { createdAt: { less_than_equal: t1 } }
      ]
    },
    limit: 1000,
    sort: 'createdAt'
  })

  console.log(`=== ANALYZING ${bills.docs.length} BILLS IN INTERVAL 1 ===`)
  
  let totalSum = 0
  let syncedAfterClosing = 0
  let syncedAfterClosingSum = 0
  const afterClosingBills: any[] = []

  bills.docs.forEach((b: any) => {
    totalSum += b.totalAmount || 0
    
    // Extract timestamp from ObjectId if it's a valid hex string of 24 chars
    let dbInsertionTime: Date | null = null
    try {
      const oid = new ObjectId(b.id)
      dbInsertionTime = oid.getTimestamp()
    } catch (e) {
      // not a valid ObjectId
    }

    const createdAt = new Date(b.createdAt)
    const updatedAt = new Date(b.updatedAt)
    const closingTime = new Date(t1)

    // Check if the bill was inserted or last updated after the closing entry time
    const isInsertedAfter = dbInsertionTime ? dbInsertionTime > closingTime : false
    const isUpdatedAfter = updatedAt > closingTime

    if (isInsertedAfter || isUpdatedAfter) {
      syncedAfterClosing++
      syncedAfterClosingSum += b.totalAmount || 0
      afterClosingBills.push({
        id: b.id,
        billNumber: b.billNumber,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        dbInsertionTime: dbInsertionTime ? dbInsertionTime.toISOString() : 'N/A',
        totalAmount: b.totalAmount,
        paymentMethod: b.paymentMethod,
        status: b.status
      })
    }
  })

  console.log('Actual Sum of Bills in Interval:', totalSum)
  console.log('Number of bills inserted/updated after closing entry 1:', syncedAfterClosing)
  console.log('Sum of bills inserted/updated after closing entry 1:', syncedAfterClosingSum)
  
  if (afterClosingBills.length > 0) {
    console.log('\n--- SAMPLES OF LATE SYNCED BILLS ---')
    afterClosingBills.slice(0, 10).forEach(b => {
      console.log(`Bill: ${b.billNumber || b.id} | Amt: ${b.totalAmount} | PM: ${b.paymentMethod} | CreatedAt: ${b.createdAt} | DB Insertion: ${b.dbInsertionTime} | UpdatedAt: ${b.updatedAt}`)
    })
  }

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
