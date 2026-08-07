import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const branchId = '6906dc71896efbd4bc64d028'

  try {
    const bills = await payload.find({
      collection: 'billings',
      where: {
        and: [
          { branch: { equals: branchId } },
          { createdAt: { greater_than_equal: '2026-08-06T18:00:00.000Z' } },
          { createdAt: { less_than_equal: '2026-08-06T19:00:00.000Z' } }
        ]
      },
      limit: 10,
      depth: 0,
    })

    console.log(`Bills found in that specific hour (regardless of status): ${bills.docs.length}`)
    bills.docs.forEach((b: any) => {
      console.log(`Bill ID: ${b.id}`)
      console.log(`Status: ${b.status}`)
      console.log(`Total Amount: ₹${b.totalAmount}`)
      console.log(`Created At: ${b.createdAt} (UTC)`)
      
      const localDate = new Date(b.createdAt)
      console.log(`Created At Local: ${localDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`)
    })

  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
