import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  const ExpenseModel = payload.db.collections['expenses']
  
  const rawExpenseTrendStats = await ExpenseModel.aggregate([
    {
      $group: {
        _id: {
          year: { $year: { $add: ['$date', 19800000] } },
          month: { $month: { $add: ['$date', 19800000] } },
          day: { $dayOfMonth: { $add: ['$date', 19800000] } }
        },
        totalExpense: { $sum: '$total' },
      },
    }
  ])
  console.log(JSON.stringify(rawExpenseTrendStats, null, 2))
  process.exit(0)
}
run()
