import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })
  const branch = '690e326cea6f468d6fe462e6'

  // Start of Jan 16 2026 UTC
  // The schema stores date as start of day 00:00:00 UTC.
  // We can just query by date string or range.
  // But let's just find all for that branch and sort by created desc to see the list.

  console.log('Fetching closing entries for branch...')

  // Filter for Jan 15 - Jan 17 to capture the midnight rollover
  const entries = await payload.find({
    collection: 'closing-entries',
    where: {
      and: [
        { branch: { equals: branch } },
        { createdAt: { greater_than: '2026-01-15T12:00:00.000Z' } },
        { createdAt: { less_than: '2026-01-17T12:00:00.000Z' } },
      ],
    },
    sort: 'createdAt',
    limit: 100,
  })

  console.log(`Found ${entries.totalDocs} entries between Jan 15 and Jan 17.`)

  for (const doc of entries.docs) {
    const createdAt = new Date(doc.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

    console.log('------------------------------------------------')
    console.log(`ID: ${doc.id}`)
    console.log(`Closing Number: ${doc.closingNumber}`)
    console.log(`Created At (IST): ${createdAt}`)
    console.log(`System Sales: ${doc.systemSales}`)
    console.log(`Total Bills: ${doc.totalBills}`)
    console.log('------------------------------------------------')
  }

  process.exit(0)
}

run()
