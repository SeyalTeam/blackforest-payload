import 'dotenv/config'
import configPromise from '../payload.config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  try {
    const email = 'tester@bf.com'
    const password = 'testerpassword123'
    
    // Check if user already exists
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
    })

    if (existing.docs.length > 0) {
      console.log(`User ${email} already exists.`)
    } else {
      await payload.create({
        collection: 'users',
        data: {
          email,
          password,
          name: 'Manual Tester',
          role: 'superadmin',
        },
      })
      console.log(`Superadmin user created: ${email} / ${password}`)
    }
  } catch (err) {
    console.error('Error creating test user:', err)
  }
  process.exit(0)
}

run()
