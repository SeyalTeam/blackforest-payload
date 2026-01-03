import { getPayload } from 'payload'
import config from '../payload.config'

async function run() {
  const payload = await getPayload({ config })
  const branchId = '68fcfa0238714903fbd03e3c'
  const resetTime = '2026-01-02T09:51:00.000Z' // 15:21 IST

  console.log('Fetching billings for Chidambaram Nagar after', resetTime)

  const billings = await payload.find({
    collection: 'billings',
    where: {
      and: [
        { branch: { equals: branchId } },
        { createdAt: { greater_than_equal: resetTime } },
        { status: { not_equals: 'cancelled' } },
      ],
    },
    limit: 1000,
    pagination: false,
  })

  console.log(`Found ${billings.docs.length} billings`)

  const reduction: Record<string, { name: string; qty: number }> = {}
  billings.docs.forEach((bill) => {
    bill.items.forEach((item) => {
      const id = typeof item.product === 'string' ? item.product : item.product.id
      if (!reduction[id]) reduction[id] = { name: item.name, qty: 0 }
      reduction[id].qty += item.quantity
    })
  })

  // Sort by quantity descending
  const sortedReduction = Object.values(reduction).sort((a, b) => b.qty - a.qty)

  console.log('REDUCTION_REPORT_START')
  sortedReduction.forEach((item) => {
    console.log(`${item.name}: ${item.qty}`)
  })
  console.log('REDUCTION_REPORT_END')

  console.log('Updating branch inventoryResetDate...')
  await payload.update({
    collection: 'branches',
    id: branchId,
    data: {
      inventoryResetDate: resetTime,
    },
  })
  console.log('Update complete')

  process.exit(0)
}

run()
