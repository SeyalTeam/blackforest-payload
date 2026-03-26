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
  
  // Normalize date to start of day UTC
  const d = new Date(dateStr)
  const normalizedDateString = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  ).toISOString()

  try {
    // 1. Get all closing entries for that day to find the last createdAt
    const closingEntries = await payload.find({
      collection: 'closing-entries',
      where: {
        and: [
          { branch: { equals: branchId } },
          { date: { equals: normalizedDateString } }
        ]
      },
      sort: 'createdAt'
    })

    if (closingEntries.docs.length === 0) {
      console.log('No closing entries found.')
      process.exit(0)
    }

    const lastClosing = closingEntries.docs[closingEntries.docs.length - 1]
    const lastClosingTime = new Date(lastClosing.createdAt).toISOString()
    
    console.log(`Last closing entry created at: ${lastClosingTime} (${lastClosing.closingNumber})`)

    // Define end of day in IST
    const endOfDayIST = dayjs.tz(dateStr, 'Asia/Kolkata').endOf('day').toISOString()
    console.log(`End of day (IST): ${endOfDayIST}`)

    // 2. Find bills created AFTER the last closing entry but before the end of the day
    const missingBills = await payload.find({
      collection: 'billings',
      where: {
        and: [
          { branch: { equals: branchId } },
          { createdAt: { greater_than: lastClosingTime } },
          { createdAt: { less_than_equal: endOfDayIST } },
          { status: { equals: 'completed' } }
        ]
      },
      depth: 0
    })

    console.log(`\nFound ${missingBills.docs.length} completed bills after the last closing entry:`)
    let sum = 0
    missingBills.docs.forEach((bill: any) => {
      console.log(`- Bill: ${bill.invoiceNumber}, Created At: ${bill.createdAt}, Amount: ${bill.totalAmount}`)
      sum += (bill.totalAmount || 0)
    })
    console.log(`Total amount for missing bills: ${sum.toFixed(2)}`)

  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
