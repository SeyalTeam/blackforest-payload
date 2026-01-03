import { getPayload } from 'payload'
import config from '../payload.config'

async function run() {
  const payload = await getPayload({ config })

  console.log('Searching for branch CHIDAMBARAM NAGAR...')
  const branchRes = await payload.find({
    collection: 'branches',
    where: {
      name: { equals: 'CHIDAMBARAM NAGAR' },
    },
  })

  if (branchRes.docs.length > 0) {
    const branch = branchRes.docs[0]
    console.log(`Found Branch: ${branch.name} (${branch.id})`)
  } else {
    console.log('Branch not found')
  }

  console.log('Searching for order CHI-STC-260102-01...')
  const orderRes = await payload.find({
    collection: 'stock-orders',
    where: {
      invoiceNumber: { equals: 'CHI-STC-260102-01' },
    },
  })

  if (orderRes.docs.length > 0) {
    const order = orderRes.docs[0]
    console.log(`Found Order: ${order.invoiceNumber} (${order.id})`)
    console.log(`Notes: ${order.notes}`)
    console.log(`Status: ${order.status}`)
    // console.log('Items:', JSON.stringify(order.items, null, 2))
  } else {
    console.log('Order not found')
  }

  process.exit(0)
}

run()
