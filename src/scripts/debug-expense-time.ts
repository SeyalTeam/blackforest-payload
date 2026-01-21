import config from '@payload-config'
import { getPayload } from 'payload'

const debugExpense = async () => {
  const payload = await getPayload({ config })
  const expense = await payload.find({
    collection: 'expenses',
    where: {
      id: {
        equals: '696fc61ea6d8c3cce44049c1'
      }
    }
  })

  if (expense.docs.length > 0) {
    console.log('Expense Date (Raw):', expense.docs[0].date)
    console.log('Expense Details:', JSON.stringify(expense.docs[0].details, null, 2))
  } else {
    console.log('Expense not found')
  }
  process.exit(0)
}

debugExpense()
