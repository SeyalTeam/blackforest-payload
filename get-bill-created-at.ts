import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  
  const b = await payload.findByID({
    collection: 'billings',
    id: '6a3f9cc3154c2f924321facc'
  })

  console.log('=== BILL CREATED AT ===')
  console.log(`createdAt: ${b.createdAt}`)
  console.log(`updatedAt: ${b.updatedAt}`)
  console.log(`isQrOrder: ${b.isQrOrder}`)
  console.log(`createdBy: ${b.createdBy}`)
  
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
