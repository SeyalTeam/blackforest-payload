import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  try {
    const branchId = '6790ca4a242f38699478f657'
    console.log(`Searching for Branch: ${branchId}`)

    const branch = await payload.findByID({
      collection: 'branches',
      id: branchId,
      depth: 0,
    })

    console.log('Branch Name:', branch.name)
    console.log('Stock Order Workflow:', JSON.stringify(branch.stockOrderWorkflow, null, 2))
  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

run()
