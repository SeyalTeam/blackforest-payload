import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  // 1. Find Branch
  const branches = await payload.find({
    collection: 'branches',
    where: { name: { contains: 'CHIDAMBARAM' } },
  })
  const branchId = branches.docs[0].id

  // 2. Query Entries for Dec 26
  const start = '2025-12-26T00:00:00.000Z'
  const end = '2025-12-26T23:59:59.999Z'

  const entries = await payload.find({
    collection: 'closing-entries',
    where: {
      and: [
        { branch: { equals: branchId } },
        { date: { greater_than_equal: start } },
        { date: { less_than: end } },
      ],
    },
  })

  console.log(`Found ${entries.totalDocs} entries for Dec 26.`)
  entries.docs.forEach((doc: any) => {
    console.log('--------------------------------------------------')
    console.log(`ID: ${doc.id}`)
    console.log(`Number: ${doc.closingNumber}`)
    console.log(`System Sales: ${doc.systemSales}`)
    console.log(`Total Bills: ${doc.totalBills}`)
    console.log(`CreatedAt: ${doc.createdAt}`)
  })
}

run().then(() => process.exit(0))
