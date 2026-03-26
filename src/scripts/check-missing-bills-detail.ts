import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })
  const invoiceNumbers = [
    'ETP-20260324-199',
    'ETP-20260324-200',
    'ETP-20260324-201',
    'ETP-20260324-202',
    'ETP-20260324-203'
  ]

  try {
    const bills = await payload.find({
        collection: 'billings',
        where: {
            invoiceNumber: { in: invoiceNumbers }
        },
        depth: 0
    })

    console.log(`\nRequested bills details:`)
    bills.docs.forEach((bill: any) => {
        console.log(`- ${bill.invoiceNumber}: ${bill.status}, Created at: ${bill.createdAt}, Amount: ${bill.totalAmount}`)
    })

  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
