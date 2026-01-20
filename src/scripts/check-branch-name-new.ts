import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

const checkBranch = async () => {
  const payload = await getPayload({ config })
  const branch = await payload.findByID({
    collection: 'branches',
    id: '68fcfbf138714903fbd03e54',
  })

  console.log(`Branch Name: ${branch.name}`)
  process.exit(0)
}

checkBranch()
