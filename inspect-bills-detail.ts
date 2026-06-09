import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  const branchId = '68fcfbf138714903fbd03e54'
  
  const t0 = '2026-06-08T00:00:00.000Z'
  const t1 = '2026-06-08T12:20:17.171Z'

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

  console.log(`=== DETAILED BILLS IN INTERVAL 1 (Total: ${bills.docs.length}) ===`)
  
  // Let's print out all bills to see the sequence and values
  bills.docs.forEach((b: any, index) => {
    console.log(`[${index+1}] ID: ${b.id} | No: ${b.billNumber || 'N/A'} | Time: ${b.createdAt} | Amt: ${b.totalAmount} | PM: ${b.paymentMethod} | Status: ${b.status}`)
  })

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
