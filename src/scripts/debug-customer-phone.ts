import config from '../payload.config'
import { getPayload } from 'payload'

const debugCustomerByPhone = async () => {
  const payload = await getPayload({ config })

  const customers = await payload.find({
    collection: 'customers',
    where: {
      phoneNumber: {
        equals: '9597014938',
      },
    },
    depth: 0,
  })

  if (customers.totalDocs > 0) {
    const customer = customers.docs[0]
    console.log('Customer Found:', customer.id)
    console.log('Name:', customer.name)
    console.log('Bills:', customer.bills)
  } else {
    console.log('No customer found for 9597014938')
  }

  process.exit(0)
}

debugCustomerByPhone()
