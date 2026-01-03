import { getPayload } from 'payload'
import config from '../payload.config'

async function verifyInventoryValue() {
  const payload = await getPayload({ config })

  // VSeyal Branch
  const branchId = '6906dc71896efbd4bc64d028'
  // BINGO ORIGINAL SALT
  const productId = '6929cb8bda14ded995904114'

  console.log(`Verifying value calculation for Product ${productId} in Branch ${branchId}...`)

  const product = await payload.findByID({
    collection: 'products',
    id: productId,
    depth: 1,
  })

  // Get Inventory (mocked or fetched - for this test we recall previous stock was 5)
  // Let's assume stock is 5 for verification of calculation
  const inventory = 5

  let rate = product.defaultPriceDetails?.rate || 0
  console.log('Base Rate:', rate)

  if (product.branchOverrides && Array.isArray(product.branchOverrides)) {
    const override = product.branchOverrides.find((bo: any) => {
      const boBranchId = typeof bo.branch === 'string' ? bo.branch : bo.branch?.id
      return boBranchId === branchId
    })
    if (override) {
      console.log('Branch Override Found:', override)
      if (override.rate !== undefined) rate = override.rate
    }
  }

  console.log('Final Rate:', rate)
  console.log('Inventory:', inventory)
  console.log('Calculated Value:', inventory * rate)

  process.exit(0)
}

verifyInventoryValue()
