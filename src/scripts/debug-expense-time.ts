import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

async function debug() {
  const payload = await getPayload({ config })

  const { docs: latestExpenses } = await payload.find({
    collection: 'expenses',
    sort: '-createdAt',
    limit: 5,
  })

  console.log('--- Latest 5 Expenses ---')
  latestExpenses.forEach((exp) => {
    console.log(`ID: ${exp.id}`)
    console.log(`Invoice: ${exp.invoiceNumber}`)
    console.log(`Raw Date Field: ${exp.date}`)
    console.log(`Created At: ${exp.createdAt}`)
    console.log(
      `Formatted Date (Asia/Kolkata): ${dayjs(exp.date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')}`,
    )
    console.log(
      `Formatted Created (Asia/Kolkata): ${dayjs(exp.createdAt).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')}`,
    )
    console.log('-------------------------')
  })

  process.exit(0)
}

debug()
