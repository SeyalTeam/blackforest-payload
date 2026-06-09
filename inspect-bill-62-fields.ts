import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  
  const b = await payload.findByID({
    collection: 'billings',
    id: '6a26a1e6316fa535db175689'
  })

  console.log('=== BILL 62 FIELDS ===')
  console.log(`id: ${b.id}`)
  console.log(`status: ${b.status} (${typeof b.status})`)
  console.log(`grandTotal: ${b.grandTotal} (${typeof b.grandTotal})`)
  console.log(`total: ${b.total} (${typeof b.total})`)
  console.log(`netAmount: ${b.netAmount} (${typeof b.netAmount})`)
  console.log(`totalAmount: ${b.totalAmount} (${typeof b.totalAmount})`)
  console.log(`amount: ${b.amount} (${typeof b.amount})`)
  
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
