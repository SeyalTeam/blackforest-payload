import config from '../payload.config'
import { getPayload } from 'payload'

const debugCustomer = async () => {
  const payload = await getPayload({ config })

  const customers = await payload.find({
    collection: 'customers',
    where: {
      name: {
        equals: 'castro',
      },
    },
    depth: 2,
  })

  if (customers.totalDocs > 0) {
    const customer = customers.docs[0]
    console.log('Customer found:', customer.name)
    console.log('Phone:', customer.phoneNumber)
    console.log('Bills field:', JSON.stringify(customer.bills, null, 2))

    if (customer.bills && customer.bills.length > 0) {
      console.log('First bill details:', customer.bills[0])
    }
  } else {
    console.log('Customer "castro" not found.')
  }

  process.exit(0)
}

debugCustomer()
