import payload from 'payload'
import config from '../payload.config'
import dayjs from 'dayjs'

async function run() {
  await payload.init({ secret: process.env.PAYLOAD_SECRET || 'test', mongoURL: process.env.MONGODB_URI || 'mongodb://127.0.0.1/blackforest', local: true })
  
  const ExpenseModel = payload.db.collections['expenses']
  const trendStartDate = dayjs().subtract(7, 'day').startOf('day')
  
  const rawExpenseTrendStats = await ExpenseModel.aggregate([
    { $match: { date: { $gte: trendStartDate.toDate() } } },
    {
      $group: {
        _id: {
          year: { $year: { $add: ['$date', 19800000] } },
          month: { $month: { $add: ['$date', 19800000] } },
          day: { $dayOfMonth: { $add: ['$date', 19800000] } }
        },
        totalExpense: { $sum: '$total' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ])
  
  console.log("Raw Expenses:", JSON.stringify(rawExpenseTrendStats, null, 2))
  process.exit(0)
}
run()
