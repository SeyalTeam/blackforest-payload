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
  const branchNameMatch = 'ETP-Ettayapuram Road'
  
  try {
    // 1. Find the branch
    const branches = await payload.find({
      collection: 'branches',
      where: {
        name: { equals: branchNameMatch }
      }
    })

    if (branches.docs.length === 0) {
      console.log(`Branch "${branchNameMatch}" not found.`)
      
      // Let's try a partial search if not found
      const allBranches = await payload.find({
        collection: 'branches',
        limit: 100
      })
      console.log('Available branches:', allBranches.docs.map(b => b.name).join(', '))
      process.exit(0)
    }

    const branch = branches.docs[0]
    console.log(`Found branch: ${branch.name} (${branch.id})`)

    // 2. Query bills for yesterday (2026-03-24)
    // The current date is 2026-03-25. Yesterday is 2026-03-24.
    const yesterdayStr = '2026-03-24'
    const startOfDay = dayjs.tz(yesterdayStr, 'Asia/Kolkata').startOf('day').toDate()
    const endOfDay = dayjs.tz(yesterdayStr, 'Asia/Kolkata').endOf('day').toDate()

    console.log(`Querying bills from ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`)

    const bills = await payload.find({
      collection: 'billings',
      where: {
        and: [
          { branch: { equals: branch.id } },
          { createdAt: { greater_than_equal: startOfDay.toISOString() } },
          { createdAt: { less_than_equal: endOfDay.toISOString() } },
          { status: { equals: 'completed' } }
        ]
      },
      limit: 1000,
      depth: 0
    })

    const totalAmount = bills.docs.reduce((sum, bill: any) => sum + (bill.totalAmount || 0), 0)
    
    console.log(`\nResults for ${branch.name} on ${yesterdayStr}:`)
    console.log(`Bill Count: ${bills.docs.length}`)
    console.log(`Total Amount: ${totalAmount.toFixed(2)}`)

  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
