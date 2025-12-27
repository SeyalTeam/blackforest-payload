import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  const entries = await payload.find({
    collection: 'closing-entries',
    limit: 10,
    sort: '-createdAt',
  })

  console.log('Found Closing Entries:', entries.totalDocs)
  if (entries.docs.length > 0) {
    console.log('Sample Entry:', JSON.stringify(entries.docs[0], null, 2))
  } else {
    console.log('No closing entries found.')
  }

  process.exit(0)
}

run()
