import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  const branches = await payload.find({
    collection: 'branches',
    limit: 100
  })

  console.log('=== BRANCHES LIST ===')
  branches.docs.forEach((b: any) => {
    console.log(`ID: ${b.id} | Name: ${b.name}`)
  })
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
