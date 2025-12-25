import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

async function getBranchTime() {
  const payload = await getPayload({ config })

  const branch = await payload.findByID({
    collection: 'branches',
    id: '694a2a735648bf1795c86af6',
  })

  if (branch) {
    console.log(`Branch Name: ${branch.name}`)
    console.log(`Created At: ${branch.createdAt}`)
  } else {
    console.log('Branch not found')
  }
  process.exit(0)
}

getBranchTime()
