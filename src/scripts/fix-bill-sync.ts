import config from '../payload.config'
import { getPayload } from 'payload'

const fixBill = async () => {
  const payload = await getPayload({ config })

  const billId = '6961037004d90cb829219f16'

  try {
    console.log(`Updating bill ${billId} to trigger sync...`)

    // Fetch first to get current data
    const bill = await payload.findByID({
      collection: 'billings',
      id: billId,
    })

    // Update with same notes (or just touch it)
    await payload.update({
      collection: 'billings',
      id: billId,
      data: {
        notes: bill.notes || '', // No change
      },
    })

    console.log('Update complete. Hook should have run.')

    // Verify
    const customer = await payload.find({
      collection: 'customers',
      where: {
        phoneNumber: { equals: '9597014938' },
      },
    })

    if (customer.totalDocs > 0) {
      console.log('Customer bills:', customer.docs[0].bills)
      const linked = customer.docs[0].bills?.some((b) => {
        const id = typeof b === 'object' ? b.id : b
        return id === billId
      })
      console.log('Is bill linked?', linked)
    }
  } catch (error) {
    console.error('Error fixing bill:', error)
  }

  process.exit(0)
}

fixBill()
