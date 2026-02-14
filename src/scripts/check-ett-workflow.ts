import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  try {
    const branches = await payload.find({
      collection: 'branches',
      where: {
        name: {
          contains: 'Ettayapuram',
        },
      },
      depth: 0,
    })

    if (branches.docs.length === 0) {
      console.log('Branch not found.')
    } else {
      branches.docs.forEach((branch) => {
        console.log('Branch Name:', branch.name)
        console.log('Branch ID:', branch.id)
        console.log('Stock Order Workflow:', JSON.stringify(branch.stockOrderWorkflow, null, 2))
      })
    }
  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
