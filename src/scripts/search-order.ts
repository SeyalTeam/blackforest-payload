import { getPayload } from 'payload'
import config from '../payload.config'

async function search() {
  try {
    const payload = await getPayload({ config })
    const branchRes = await payload.find({
      collection: 'branches',
      where: { name: { equals: 'CHIDAMBARAM NAGAR' } },
    })
    console.log('BRANCH_DATA:' + JSON.stringify(branchRes.docs))

    const orderRes = await payload.find({
      collection: 'stock-orders',
      where: { invoiceNumber: { equals: 'CHI-STC-260102-01' } },
    })
    console.log('ORDER_DATA:' + JSON.stringify(orderRes.docs))
  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

search()
