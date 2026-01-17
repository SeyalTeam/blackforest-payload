import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  const id = '696b26eed1c964073293c467'
  // Target: 2026-01-16 11:15 PM IST
  // IST is UTC+5:30.
  // 23:15 - 5:30 = 17:45 UTC
  const targetTime = '2026-01-16T17:45:00.000Z'

  console.log(`Updating closing entry ${id} time to ${targetTime}...`)

  try {
    // We update the document.
    // Note: Payload might automatically set updatedAt.
    // We try to simply pass createdAt. If Payload ignores it in standard update, we might need a direct DB update or check if Payload allows overriding createdAt on update.
    // Usually local API allows it.
    const result = await payload.update({
      collection: 'closing-entries',
      id,
      data: {
        createdAt: targetTime,
      },
    })

    console.log('Update result createdAt:', result.createdAt)

    if (result.createdAt === targetTime) {
      console.log('Successfully updated timestamp.')
    } else {
      console.log(
        'WARNING: Timestamp might not have been updated directly via Payload API. Payload might be enforcing its own timestamps.',
      )
    }
  } catch (error) {
    console.error('Failed to update closing entry:', error)
  }

  process.exit(0)
}

run()
