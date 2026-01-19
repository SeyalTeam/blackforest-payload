import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

const createExpenses = async () => {
  const payload = await getPayload({ config })

  // Date: today (Jan 19, 2026) at 9 PM
  const targetDate = new Date(2026, 0, 19, 21, 0, 0)

  const expense = await payload.create({
    collection: 'expenses',
    data: {
      invoiceNumber: 'TEMP',
      date: targetDate.toISOString(),
      branch: '68fcfa9238714903fbd03e48', // SAWYERPURAM
      details: [
        {
          source: 'STAFF WELFARE',
          reason: 'Tiffen',
          amount: 50,
        },
        {
          source: 'OC PRODUCTS',
          reason: 'Sms agency',
          amount: 924,
        },
        {
          source: 'OC PRODUCTS',
          reason: 'sm traders',
          amount: 2000,
        },
        {
          source: 'STAFF WELFARE',
          reason: 'Dinner',
          amount: 50,
        },
      ],
      total: 3024,
    },
  })

  console.log('Expense entry created successfully:')
  console.log(JSON.stringify(expense, null, 2))

  process.exit(0)
}

createExpenses()
