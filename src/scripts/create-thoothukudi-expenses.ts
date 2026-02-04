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
      branch: '68fcfbf138714903fbd03e54', // THOOTHUKUDI MACROON
      details: [
        {
          source: 'OC PRODUCTS',
          reason: 'Asj always',
          amount: 5350,
        },
        {
          source: 'RAW MATERIAL',
          reason: 'Baji powder',
          amount: 516,
        },
        {
          source: 'OC PRODUCTS',
          reason: 'Amman palkova',
          amount: 3610,
        },
        {
          source: 'RAW MATERIAL',
          reason: 'Ro water',
          amount: 1700,
        },
        {
          source: 'RAW MATERIAL',
          reason: 'Plumbing',
          amount: 50,
        },
        {
          source: 'SALARY',
          reason: 'Salary valliammal',
          amount: 400,
        },
        {
          source: 'SALARY',
          reason: 'Salary petchiammal',
          amount: 400,
        },
        {
          source: 'OC PRODUCTS',
          reason: 'Golli soda',
          amount: 1560,
        },
        {
          source: 'COMPLEMENTARY',
          reason: 'kl23n 6073',
          amount: 100,
        },
        {
          source: 'COMPLEMENTARY',
          reason: 'Kl9n 7733',
          amount: 100,
        },
        {
          source: 'COMPLEMENTARY',
          reason: 'TN 60 E 5490',
          amount: 250,
        },
        {
          source: 'ADVANCE',
          reason: 'tea master Kumar',
          amount: 200,
        },
        {
          source: 'OC PRODUCTS',
          reason: 'Dairy day ice cream',
          amount: 5041,
        },
      ],
      total: 19277,
    } as any,
  })

  console.log('Expense entry created successfully:')
  console.log(JSON.stringify(expense, null, 2))

  process.exit(0)
}

createExpenses()
