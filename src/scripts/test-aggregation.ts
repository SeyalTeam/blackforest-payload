import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })
  const ClosingModel = payload.db.collections['closing-entries']

  const startDate = '2025-12-26T00:00:00.000Z'
  const endDate = '2025-12-26T23:59:59.999Z'

  console.log(`Aggregating with range: ${startDate} to ${endDate}`)

  const stats = await ClosingModel.aggregate([
    {
      $match: {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $count: 'total',
    },
  ])

  console.log('Result:', JSON.stringify(stats, null, 2))

  process.exit(0)
}

run()
