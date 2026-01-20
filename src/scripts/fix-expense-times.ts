import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

async function fixData() {
  const payload = await getPayload({ config })

  const todayStart = dayjs().tz('Asia/Kolkata').startOf('day').toDate()
  const todayEnd = dayjs().tz('Asia/Kolkata').endOf('day').toDate()

  const { docs: todaysExpenses } = await payload.find({
    collection: 'expenses',
    where: {
      createdAt: {
        greater_than_equal: todayStart.toISOString(),
      },
    },
    limit: 1000,
  })

  console.log(`Found ${todaysExpenses.length} expenses to fix for today.`)

  for (const exp of todaysExpenses) {
    if (
      dayjs(exp.date).format('HH:mm') === '05:30' ||
      dayjs(exp.date).format('HH:mm') === '00:00'
    ) {
      console.log(`Fixing Expense ${exp.invoiceNumber}...`)
      await payload.update({
        collection: 'expenses',
        id: exp.id,
        data: {
          date: exp.createdAt, // Sync date with creation time
        },
      })
    }
  }

  console.log('Fix complete.')
  process.exit(0)
}

fixData()
