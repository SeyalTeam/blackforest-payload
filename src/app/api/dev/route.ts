import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../payload.config'
import dayjs from 'dayjs'

export async function GET() {
  const payload = await getPayload({ config })
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
  
  const allExpenses = await ExpenseModel.find({}).limit(5).select('date total createdAt branch');
  
  return NextResponse.json({
    rawExpenseTrendStats,
    allExpenses
  })
}
