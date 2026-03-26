import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const branchId = '69724ad6f91273ae0b1e121f'
  const dateStr = '2026-03-24'
  
  // Normalize date to start of day UTC as per the collection logic
  const d = new Date(dateStr)
  const normalizedDateString = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  ).toISOString()

  try {
    const closingEntries = await payload.find({
      collection: 'closing-entries',
      where: {
        and: [
          { branch: { equals: branchId } },
          { date: { equals: normalizedDateString } }
        ]
      }
    })

    if (closingEntries.docs.length === 0) {
      console.log(`No closing entry found for branch ${branchId} on ${dateStr}.`)
      process.exit(0)
    }

    const entry = closingEntries.docs[0]
    console.log(`Found ${closingEntries.docs.length} closing entries for this date.`)
    closingEntries.docs.forEach((entry: any) => {
      console.log(`\nClosing Entry: ${entry.closingNumber}`)
      console.log(`System Sales (systemSales): ${entry.systemSales}`)
      console.log(`Total Bills (count): ${entry.totalBills}`)
      console.log(`Manual Sales: ${entry.manualSales}`)
      console.log(`Total Sales (totalSales): ${entry.totalSales}`)
    })

    const aggregateSystemSales = closingEntries.docs.reduce((sum, e: any) => sum + (e.systemSales || 0), 0)
    const aggregateTotalBills = closingEntries.docs.reduce((sum, e: any) => sum + (e.totalBills || 0), 0)
    console.log(`\nAggregated Total for the Day:`)
    console.log(`Total System Sales: ${aggregateSystemSales.toFixed(2)}`)
    console.log(`Total Bills Count: ${aggregateTotalBills}`)

  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
