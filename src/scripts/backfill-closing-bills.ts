import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  console.log('Fetching all closing entries...')
  const entries = await payload.find({
    collection: 'closing-entries',
    limit: 1000,
  })

  console.log(`Found ${entries.totalDocs} entries. Processing...`)

  for (const entry of entries.docs) {
    if (typeof entry.branch !== 'object' || !entry.date) continue

    const entryDate = new Date(entry.date)
    const startOfDay = new Date(
      Date.UTC(
        entryDate.getUTCFullYear(),
        entryDate.getUTCMonth(),
        entryDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    ).toISOString()
    const endOfDay = new Date(
      Date.UTC(
        entryDate.getUTCFullYear(),
        entryDate.getUTCMonth(),
        entryDate.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    ).toISOString()

    // Find Previous Closing Time
    let lastClosingTime = startOfDay
    try {
      const lastClosing = await payload.find({
        collection: 'closing-entries',
        where: {
          and: [
            { branch: { equals: entry.branch.id } },
            { date: { greater_than_equal: startOfDay } },
            { date: { less_than: endOfDay } },
            { createdAt: { less_than: entry.createdAt } }, // Strictly before current entry
          ],
        },
        sort: '-createdAt',
        limit: 1,
      })

      if (lastClosing.docs.length > 0) {
        lastClosingTime = new Date(lastClosing.docs[0].createdAt).toISOString()
      }
    } catch {
      // safe fallback
    }

    const { totalDocs: billCount } = await payload.count({
      collection: 'billings',
      where: {
        and: [
          { branch: { equals: entry.branch.id } },
          { createdAt: { greater_than: lastClosingTime } }, // Incremental!
          { createdAt: { less_than: endOfDay } },
        ],
      },
    })

    if (entry.totalBills !== billCount) {
      console.log(
        `Updating Entry ${entry.closingNumber}: Bills ${entry.totalBills || 0} -> ${billCount}`,
      )
      await payload.update({
        collection: 'closing-entries',
        id: entry.id,
        data: {
          totalBills: billCount,
        },
      })
    }
  }

  console.log('Backfill complete.')
  process.exit(0)
}

run()
