import config from '../payload.config'
import { getPayload } from 'payload'

const debugBill2 = async () => {
  const payload = await getPayload({ config })

  try {
    const bill = await payload.findByID({
      collection: 'billings',
      id: '6961038f04d90cb829219f92',
    })

    console.log('Bill ID:', bill.id)
    console.log('Customer Details:', JSON.stringify(bill.customerDetails, null, 2))
  } catch (error) {
    console.error('Error fetching bill:', error)
  }

  process.exit(0)
}

debugBill2()
