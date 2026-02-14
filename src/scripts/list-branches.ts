import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  try {
    const branches = await payload.find({
      collection: 'branches',
      limit: 100,
      depth: 0,
    })

    console.log(`Found ${branches.docs.length} branches.`)
    branches.docs.forEach((b) => {
      console.log(`Name: ${b.name}, ID: ${b.id}`)
    })
  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
