import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

const createExpense = async () => {
  const payload = await getPayload({ config })

  // Date: today (Jan 19, 2026) at 9 PM
  const targetDate = new Date(2026, 0, 19, 21, 0, 0)

  const expense = await payload.create({
    collection: 'expenses',
    data: {
      invoiceNumber: 'TEMP', // Will be overwritten by beforeChange hook
      date: targetDate.toISOString(),
      branch: '68fcf95338714903fbd03e27', // VVD branch
      details: [
        {
          source: 'RAW MATERIAL',
          reason: 'SVD nuts',
          amount: 2000,
        },
      ],
      total: 2000, // Explicitly setting it, though beforeChange should handle it
    } as any,
  })

  console.log('Expense created successfully:')
  console.log(JSON.stringify(expense, null, 2))

  process.exit(0)
}

createExpense()
