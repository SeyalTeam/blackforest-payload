import config from '../payload.config'
import { getPayload } from 'payload'

const debugDuplicates = async () => {
  const payload = await getPayload({ config })

  const ids = ['69778e6aa6fbb8df90dc78b0', '69778eec780c47f786e12a7b']

  for (const id of ids) {
    try {
      const bill = await payload.findByID({
        collection: 'billings',
        id,
      })
      console.log(`Bill ID: ${id}`)
      console.log(`Invoice Number: ${bill.invoiceNumber}`)
      console.log(`KOT Number: ${bill.kotNumber}`)
      console.log(`Status: ${bill.status}`)
      console.log(`Created At: ${bill.createdAt}`)
      console.log('---')
    } catch (error) {
      console.log(`Error fetching bill ${id}:`, error.message)
    }
  }

  process.exit(0)
}

debugDuplicates()
