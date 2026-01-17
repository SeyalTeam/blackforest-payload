import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  const id = '696932d49b07256d0bd96a70' // TH1-CLO-160126-01

  // Target Date: Jan 15, 2026
  // Target Time: 11:58 PM IST = 18:28 UTC
  const targetCreatedAt = '2026-01-15T18:28:00.000Z'
  const targetDate = '2026-01-15T00:00:00.000Z' // Normalized start of day
  const targetClosingNumber = 'TH1-CLO-150126-03'

  console.log(`Moving closing entry ${id}...`)
  console.log(`New CreatedAt: ${targetCreatedAt}`)
  console.log(`New Date: ${targetDate}`)
  console.log(`New ClosingNumber: ${targetClosingNumber}`)

  try {
    const result = await payload.update({
      collection: 'closing-entries',
      id,
      data: {
        createdAt: targetCreatedAt,
        date: targetDate,
        closingNumber: targetClosingNumber,
      },
    })

    console.log('Update result:', {
      id: result.id,
      closingNumber: result.closingNumber,
      date: result.date,
      createdAt: result.createdAt,
    })

    if (result.closingNumber === targetClosingNumber && result.createdAt === targetCreatedAt) {
      console.log('Successfully updated closing entry.')
    } else {
      console.log('WARNING: Fields might not have been fully updated. Please check output.')
    }
  } catch (error) {
    console.error('Failed to update closing entry:', error)
  }

  process.exit(0)
}

run()
