import 'dotenv/config'
import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  
  const branchId = '68fcf95338714903fbd03e27' // VVD
  const dateStr = '2026-07-24'
  
  // Date boundaries for query
  const startOfDay = new Date('2026-07-24T00:00:00.000Z')
  const endOfDay = new Date('2026-07-24T23:59:59.999Z')

  console.log('Fetching closing entries...')
  const closings = await payload.find({
    collection: 'closing-entries',
    where: {
      and: [
        { branch: { equals: branchId } },
        { date: { equals: '2026-07-24T00:00:00.000Z' } }
      ]
    },
    sort: 'createdAt'
  })

  console.log(`Found ${closings.docs.length} closing entries:`)
  closings.docs.forEach((c: any) => {
    console.log(`- Closing Number: ${c.closingNumber}, Created At: ${c.createdAt}`)
  })

  console.log('\nFetching bills in UTC day...')
  const bills = await payload.find({
    collection: 'billings',
    where: {
      and: [
        { branch: { equals: branchId } },
        { createdAt: { greater_than_equal: startOfDay.toISOString() } },
        { createdAt: { less_than_equal: endOfDay.toISOString() } },
        { status: { in: ['completed', 'settled'] } }
      ]
    },
    sort: 'createdAt',
    limit: 1000
  })

  console.log(`Found ${bills.docs.length} completed/settled bills:`)
  
  // Let's perform the mapping logic
  const closingList = closings.docs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  
  bills.docs.forEach((bill: any) => {
    const billTime = new Date(bill.createdAt).getTime()
    let matchedEntry: any = null
    
    for (let i = 0; i < closingList.length; i++) {
      const currentEntry = closingList[i]
      const currentEntryTime = new Date(currentEntry.createdAt).getTime()
      
      let lastClosingTime = 0
      if (i > 0) {
        lastClosingTime = new Date(closingList[i - 1].createdAt).getTime()
      } else {
        lastClosingTime = startOfDay.getTime()
      }
      
      if (billTime > lastClosingTime && billTime <= currentEntryTime) {
        matchedEntry = currentEntry
        break
      }
    }
    
    if (matchedEntry) {
      console.log(`Bill: ${bill.invoiceNumber} | Created: ${bill.createdAt} -> Closed in ${matchedEntry.closingNumber}`)
    } else {
      console.log(`Bill: ${bill.invoiceNumber} | Created: ${bill.createdAt} -> MISSED!`)
    }
  })

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
