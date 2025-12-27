import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  // 1. Find the Branch
  const branches = await payload.find({
    collection: 'branches',
    where: {
      name: { contains: 'CHIDAMBARAM' },
    },
  })

  if (branches.totalDocs === 0) {
    console.log('Branch not found.')
    process.exit(0)
  }

  const branch = branches.docs[0]
  console.log(`Found Branch: ${branch.name} (ID: ${branch.id})`)

  // 2. Define Date Range (Yesterday: 2025-12-26)
  // const date = new Date('2025-12-26T00:00:00Z') // Start of day UTC
  const startOfDay = new Date(Date.UTC(2025, 11, 26, 0, 0, 0, 0)).toISOString()
  const endOfDay = new Date(Date.UTC(2025, 11, 26, 23, 59, 59, 999)).toISOString()

  console.log(`Querying for date: 2025-12-26 (${startOfDay} to ${endOfDay})`)

  // 3. Query Billings
  let totalAmount = 0
  let totalBills = 0

  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const billings = await payload.find({
      collection: 'billings',
      where: {
        and: [
          { branch: { equals: branch.id } },
          { createdAt: { greater_than_equal: startOfDay } },
          { createdAt: { less_than: endOfDay } },
        ],
      },
      limit: 1000,
      page,
    })

    totalBills += billings.totalDocs // actually totalDocs is constant for query, but we loop pages to sum amount if needed
    // More efficiently:
    if (page === 1) {
      totalBills = billings.totalDocs
    }

    // Sum amount
    for (const bill of billings.docs) {
      totalAmount += bill.totalAmount || 0 // Assuming 'totalAmount' field exists in Billings
    }

    hasNextPage = billings.hasNextPage
    page++
  }

  console.log('------------------------------------------------')
  console.log(`Create At: 2025-12-26`)
  console.log(`Branch: ${branch.name}`)
  console.log(`Total Bills: ${totalBills}`)
  console.log(`Total Amount: ${totalAmount.toFixed(2)}`)
  console.log('------------------------------------------------')

  process.exit(0)
}

run()
