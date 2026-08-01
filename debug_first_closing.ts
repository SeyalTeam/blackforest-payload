import 'dotenv/config'
import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  
  const branchId = '690e326cea6f468d6fe462e6'
  const dateStr = '2025-11-20'
  
  const startOfDay = new Date('2025-11-20T00:00:00.000Z')
  const endOfDay = new Date('2025-11-20T23:59:59.999Z')

  console.log('Fetching closing entries for branch:', branchId, 'on date:', dateStr)
  const closings = await payload.find({
    collection: 'closing-entries',
    where: {
      and: [
        { branch: { equals: branchId } },
        { date: { equals: '2025-11-20T00:00:00.000Z' } }
      ]
    },
    sort: 'createdAt',
  })

  console.log(`Found ${closings.docs.length} closing entries.`)
  closings.docs.forEach((c: any, i) => {
    console.log(`\nEntry #${i + 1}:`)
    console.log(`- ID: ${c.id}`)
    console.log(`- Closing Number: ${c.closingNumber}`)
    console.log(`- Created At: ${c.createdAt}`)
    console.log(`- systemSales in Doc: ${c.systemSales}`)
    console.log(`- totalBills in Doc: ${c.totalBills}`)
  })

  console.log('\nFetching all completed/settled bills for this date and branch...')
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

  console.log(`Found ${bills.docs.length} bills in total.`)
  const totalAmount = bills.docs.reduce((sum, b: any) => sum + (b.totalAmount || 0), 0)
  console.log(`Sum of all bills on 2025-11-20: ₹${totalAmount}`)

  // Let's see the time window breakdown
  const closingList = closings.docs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  
  closingList.forEach((entry: any, i) => {
    const entryTime = new Date(entry.createdAt).getTime()
    let prevTime = startOfDay.getTime()
    if (i > 0) {
      prevTime = new Date(closingList[i - 1].createdAt).getTime()
    }
    
    const entryBills = bills.docs.filter((bill: any) => {
      const billTime = new Date(bill.createdAt).getTime()
      return billTime > prevTime && billTime <= entryTime
    })
    
    const entryBillsSum = entryBills.reduce((sum, b: any) => sum + (b.totalAmount || 0), 0)
    console.log(`\nWindow for ${entry.closingNumber} (from ${new Date(prevTime).toISOString()} to ${new Date(entryTime).toISOString()}):`)
    console.log(`- Number of bills in this window: ${entryBills.length}`)
    console.log(`- Calculated system bills sum: ₹${entryBillsSum}`)
  })

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
