import payload from "payload"
require("dotenv").config()
import dayjs from 'dayjs'

payload.init({ secret: process.env.PAYLOAD_SECRET, mongoURL: process.env.MONGODB_URI, local: true }).then(async () => {
    const ExpenseModel = payload.db.collections['expenses']
    
    // Let's get expenses for yesterday in IST for branchBilling vs raw group
    const expenses = await ExpenseModel.aggregate([
      { $unwind: '$details' },
      { 
        $group: {
          _id: {
            year: { $year: { $add: ['$date', 19800000] } },
            month: { $month: { $add: ['$date', 19800000] } },
            day: { $dayOfMonth: { $add: ['$date', 19800000] } }
          },
          totalIST: { $sum: '$details.amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
      { $limit: 10 }
    ])
    
    console.log("IST Aggregation:")
    console.log(JSON.stringify(expenses, null, 2))
    
    // Now UTC aggregation as done in expense.ts
    const expensesUTC = await ExpenseModel.aggregate([
      { $unwind: '$details' },
      { 
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' }
          },
          totalUTC: { $sum: '$details.amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
      { $limit: 10 }
    ])
    
    console.log("\nUTC Aggregation (like expense report):")
    console.log(JSON.stringify(expensesUTC, null, 2))

    process.exit(0)
})
