import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  // Find one entry
  const entries = await payload.find({
    collection: 'closing-entries',
    limit: 1,
  })

  if (entries.docs.length > 0) {
    const doc = entries.docs[0]
    console.log('Date Field:', doc.date)
    console.log('Type of Date Field:', typeof doc.date)
  }

  // Debug Query with Date object vs String
  const start = new Date('2025-01-01') // Future date, should be 0

  // Try finding with String
  const strQuery = await payload.find({
    collection: 'closing-entries',
    where: { date: { greater_than: '2023-01-01' } }, // broad range
    limit: 5,
  })
  console.log('String Query found:', strQuery.totalDocs)

  process.exit(0)
}

run()
