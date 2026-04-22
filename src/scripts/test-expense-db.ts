import payload from 'payload'
import config from '../payload.config.js'

const run = async () => {
    await payload.init({ secret: 'test', mongoURL: 'mongodb://127.0.0.1/blackforest', local: true })
    const ExpenseModel = payload.db.collections['expenses']
    const res = await ExpenseModel.aggregate([
        { $limit: 2 },
        { $project: { date: 1, createdAt: 1, total: 1 } }
    ])
    console.log("Docs:", res)
    process.exit(0)
}
run()
