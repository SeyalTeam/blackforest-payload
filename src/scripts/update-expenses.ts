import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

const invoiceNumbers = [
  'ETT-EXP-160126-01',
  'ETT-EXP-160126-02',
  'ETT-EXP-160126-03',
  'ETT-EXP-160126-04',
  'ETT-EXP-160126-05',
]

const updateExpenses = async () => {
  console.log('Starting expense update...')
  const payload = await getPayload({ config })

  for (const invoiceNumber of invoiceNumbers) {
    try {
      const results = await payload.find({
        collection: 'expenses',
        where: {
          invoiceNumber: {
            equals: invoiceNumber,
          },
        },
      })

      if (results.totalDocs > 0) {
        const expense = results.docs[0]

        // Create date object for Jan 16, 2026 at 1:50 PM Local Time
        // Local time context is implied by execution environment
        const targetDate = new Date(2026, 0, 16, 13, 50, 0)

        await payload.update({
          collection: 'expenses',
          id: expense.id,
          data: {
            date: targetDate.toISOString(),
          },
        })
        console.log(
          `Updated ${invoiceNumber} time to ${targetDate.toString()} (${targetDate.toISOString()})`,
        )
      } else {
        console.log(`Expense ${invoiceNumber} not found`)
      }
    } catch (e) {
      console.error(`Error updating ${invoiceNumber}:`, e)
    }
  }

  process.exit(0)
}

updateExpenses()
