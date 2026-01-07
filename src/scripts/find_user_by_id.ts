import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

const findUser = async () => {
  const payload = await getPayload({ config })

  const userId = '693f916c536497dce5d7eb26'

  try {
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
    })

    if (user) {
      console.log('User found:', user)
      console.log('Name:', user.name || user.email || 'No name field')
    } else {
      console.log('User not found with ID:', userId)
    }
  } catch (err) {
    console.error('Error:', err)
  }

  process.exit(0)
}

findUser()
