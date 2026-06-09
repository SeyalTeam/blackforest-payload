import { getPayload } from 'payload'
import config from './src/payload.config'
import { ObjectId } from 'mongodb'

async function run() {
  const payload = await getPayload({ config })
  const branchId = '68fcfbf138714903fbd03e54'
  
  const t0 = '2026-06-08T00:00:00.000Z'
  const t1 = '2026-06-08T12:20:17.171Z'

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
    sort: '-createdAt' // newest first
  })

  console.log('=== LATEST 15 BILLS IN INTERVAL 1 ===')
  bills.docs.slice(0, 15).forEach((b: any, i) => {
    let dbTime = 'N/A'
    try {
      dbTime = new ObjectId(b.id).getTimestamp().toISOString()
    } catch {}
    console.log(`[${i+1}] ID: ${b.id} | CreatedAt: ${b.createdAt} | DB Insertion: ${dbTime} | UpdatedAt: ${b.updatedAt} | Amt: ${b.totalAmount}`)
  })

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
