import { getPayload } from 'payload'
import config from '../payload.config'
import { getProductStock } from '../utilities/inventory'

async function run() {
  const payload = await getPayload({ config })

  const branchId = '6906dc71896efbd4bc64d028' // VSeyal
  const productId = '68fcf614b56439f25a2dccf4' // CHOCOLATE CAKE SMALL

  console.log(`Checking stock for Product ${productId} in Branch ${branchId}...`)

  try {
    const stock = await getProductStock(payload, productId, branchId)
    console.log(`Current Stock: ${stock}`)
  } catch (err) {
    console.error('Error calculating stock:', err)
  }

  process.exit(0)
}

run()
