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
  
  try {
    const startOfDayIST = dayjs.tz(dateStr, 'Asia/Kolkata').startOf('day').toISOString()
    const endOfDayIST = dayjs.tz(dateStr, 'Asia/Kolkata').endOf('day').toISOString()

    const allBills = await payload.find({
      collection: 'billings',
      where: {
        and: [
          { branch: { equals: branchId } },
          { createdAt: { greater_than_equal: startOfDayIST } },
          { createdAt: { less_than_equal: endOfDayIST } }
        ]
      },
      limit: 1000,
      depth: 0
    })

    console.log(`Total bills for the whole day (any status): ${allBills.docs.length}`)
    
    const countByStatus: Record<string, number> = {}
    let completedSum = 0
    let completedCount = 0

    allBills.docs.forEach((bill: any) => {
        countByStatus[bill.status] = (countByStatus[bill.status] || 0) + 1
        if (bill.status === 'completed') {
            completedSum += (bill.totalAmount || 0)
            completedCount++
        }
    })

    console.log(`\nStatus breakdown:`)
    Object.keys(countByStatus).forEach(status => {
        console.log(`- ${status}: ${countByStatus[status]}`)
    })

    console.log(`\nCompleted total from first query: ${completedCount} bills, Amount: ${completedSum.toFixed(2)}`)

  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
