import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const debugBilling = async () => {
  const { getPayload } = await import('payload')
  const configPromise = (await import('@payload-config')).default

  const payload = await getPayload({ config: configPromise })

  const billingId = '690c3a8d30de3c3a474c83d0'

  try {
    const billing = await payload.findByID({
      collection: 'billings',
      id: billingId,
      depth: 1,
    })

    console.log('Billing ID:', billing.id)
    console.log('CreatedBy Field:', JSON.stringify(billing.createdBy, null, 2))

    if (typeof billing.createdBy === 'object' && billing.createdBy !== null) {
      console.log('CreatedBy Name:', (billing.createdBy as any).name)
      console.log('CreatedBy Email:', (billing.createdBy as any).email)
    } else {
      console.log('CreatedBy is not an object (probably ID string or null)')
    }
  } catch (error) {
    console.error('Error fetching billing:', error)
  }

  process.exit(0)
}

debugBilling()
