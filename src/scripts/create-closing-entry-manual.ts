import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  console.log('Creating closing entry...')

  try {
    const entry = await payload.create({
      collection: 'closing-entries',
      data: {
        branch: '690e326cea6f468d6fe462e6',
        date: '2026-01-16T17:45:00.000Z', // 2026-01-16 11:15 PM IST
        systemSales: 66352,
        manualSales: 0,
        onlineSales: 0,
        expenses: 0,
        creditCard: 6175,
        upi: 23723,
        cash: 36500, // Will be recalculated by hook from denominations, but we provide it just in case or for validating results if hook doesn't run on create? Hook DOES run.
        // We MUST provide denominations to get the correct cash value if the hook recalculates it.
        denominations: {
          count2000: 0,
          count500: 73, // 73 * 500 = 36500
          count200: 0,
          count100: 0,
          count50: 0,
          count10: 0,
          count5: 0,
        },
        closingNumber: '1', // Dummy value to satisfy type check
        returnTotal: 0,
      },
    })

    console.log('Successfully created closing entry:', entry.id)
    console.log('Closing Number:', entry.closingNumber)
  } catch (error) {
    console.error('Failed to create closing entry:', error)
  }

  process.exit(0)
}

run()
