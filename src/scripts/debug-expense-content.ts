import config from '@payload-config'
import { getPayload } from 'payload'

const debugExpense = async () => {
  const payload = await getPayload({ config })
  try {
    const expenses = await payload.find({
      collection: 'expenses',
      where: {
        'details.amount': {
          equals: 3520
        },
        'details.source': {
          equals: 'OC PRODUCTS'
        },
        'details.reason': {
          equals: '7UP'
        }
      }
    })

    if (expenses.docs.length > 0) {
      console.log('Found Expenses:', expenses.docs.length)
      expenses.docs.forEach(doc => {
        console.log('ID:', doc.id)
        console.log('Raw Date:', doc.date)
        console.log('Details:', JSON.stringify(doc.details, null, 2))
      })
    } else {
      console.log('No matching expense found')
    }
  } catch (e) {
    console.error(e)
  }
  process.exit(0)
}

debugExpense()
