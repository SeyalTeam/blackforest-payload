import { getPayload } from 'payload'
import configPromise from '../payload.config'
import jwt from 'jsonwebtoken'

const generateToken = async () => {
  const payload = await getPayload({ config: configPromise })
  const email = 'ettroad@bf.com'

  console.log(`Getting user ${email}...`)
  const userResult = await payload.find({
    collection: 'users',
    where: {
      email: { equals: email }
    },
    limit: 1,
  })

  const user = userResult.docs[0]
  if (!user) {
    console.error('User not found!')
    process.exit(1)
  }

  // Create a new Session ID
  const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

  console.log(`Adding new 30-day session ${sessionId} to database...`)
  
  const currentSessions = (user as any).sessions || []
  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      sessions: [{ id: sessionId }, ...currentSessions].slice(0, 50)
    } as any,
    overrideAccess: true,
  })

  // Generate the JWT
  // Payload 3 secrets are in process.env.PAYLOAD_SECRET
  const secret = process.env.PAYLOAD_SECRET || ''
  const token = jwt.sign(
    {
      id: user.id,
      collection: 'users',
      email: user.email,
      sid: sessionId,
    },
    secret,
    {
      expiresIn: '30d' // 1 month
    }
  )

  console.log('\n--- NEW WEB APP TOKEN (VALID FOR 30 DAYS) ---')
  console.log(token)
  console.log('--- END ---')
  
  process.exit(0)
}

generateToken().catch((err) => {
  console.error('Token Generation Failed:', err)
  process.exit(1)
})
