import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

const findBranch = async () => {
  const payload = await getPayload({ config })
  const branches = await payload.find({
    collection: 'branches',
    where: {
      name: {
        contains: 'vvd',
      },
    },
  })

  if (branches.totalDocs > 0) {
    branches.docs.forEach((b: any) => {
      console.log(`Branch: ${b.name}, ID: ${b.id}`)
    })
  } else {
    console.log('No branch found matching "vvd"')
  }
  process.exit(0)
}

findBranch()
