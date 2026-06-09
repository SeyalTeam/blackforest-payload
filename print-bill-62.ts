import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  
  const bill = await payload.findByID({
    collection: 'billings',
    id: '6a26a1e6316fa535db175689'
  })

  console.log('=== BILL 62 DETAILS ===')
  console.log(JSON.stringify(bill, null, 2))
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
