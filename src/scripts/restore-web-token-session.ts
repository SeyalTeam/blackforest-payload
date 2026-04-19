import { getPayload } from 'payload'
import configPromise from '../payload.config'

const restoreSession = async () => {
  const payload = await getPayload({ config: configPromise })
  const userId = '69724afef91273ae0b1e1232'
  const sessionId = '30fef245-beb7-4c3b-a0a9-8cca2ed7cb1d'

  console.log(`Searching for user ${userId}...`)
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
  })

  if (!user) {
    console.error('User not found!')
    process.exit(1)
  }

  const sessions = (user as any).sessions || []
  const sessionExists = sessions.some((s: any) => s.id === sessionId)

  if (sessionExists) {
    console.log('Session already exists. No action needed.')
    process.exit(0)
  }

  console.log(`Restoring session ${sessionId} for user ${user.email}...`)
  
  // Add the session back to the beginning of the array
  const updatedSessions = [{ id: sessionId }, ...sessions].slice(0, 50) // Keep it within limits

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      sessions: updatedSessions,
    } as any,
    overrideAccess: true,
  })

  console.log('Session restored successfully! The token in .env should work again.')
  process.exit(0)
}

restoreSession().catch((err) => {
  console.error('Restoration Failed:', err)
  process.exit(1)
})
