import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  const branchId = '68fcfbf138714903fbd03e54'
  
  const startTime = '2026-06-07T18:30:00.000Z'
  const maxEndTime = '2026-06-08T12:20:17.171Z'

  const bills = await payload.find({
    collection: 'billings',
    where: {
      and: [
        { branch: { equals: branchId } },
        { createdAt: { greater_than: startTime } },
        { createdAt: { less_than_equal: maxEndTime } }
      ]
    },
    limit: 1000,
    sort: 'createdAt'
  })

  console.log(`Loaded ${bills.docs.length} bills. Let's find cumulative sums after each bill:`)

  let runningSum = 0
  let matched = false
  bills.docs.forEach((b: any, index) => {
    const status = b.status?.toLowerCase()
    if (status === 'completed' || status === 'settled') {
      runningSum += b.totalAmount || 0
    }
    console.log(`Bill #${index+1} | Time: ${b.createdAt} | Amt: ${b.totalAmount} | Cumulative Completed: ${runningSum}`)
    if (runningSum === 20925) {
      console.log(`\n🎉 MATCH FOUND AT BILL #${index+1}!`)
      console.log(`Time of match: ${b.createdAt}`)
      matched = true
    }
  })

  if (!matched) {
    console.log('\n❌ No cumulative sum matched exactly 20,925.')
  }

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
