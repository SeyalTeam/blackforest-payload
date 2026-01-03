import { getPayload } from 'payload'
import config from '../payload.config'

async function verifyBillingValidation() {
  const payload = await getPayload({ config })

  const branchId = '6906dc71896efbd4bc64d028' // VSeyal
  const productId = '6929cb8bda14ded995904114' // BINGO ORIGINAL SALT
  const companyId = '68fe6784b80e59c6ded81200' // VSeyal Company

  console.log('Attempting to create a bill for a product with insufficient stock...')

  try {
    const billing = await payload.create({
      collection: 'billings',
      data: {
        branch: branchId,
        company: companyId,
        items: [
          {
            product: productId,
            name: 'BINGO ORIGINAL SALT',
            quantity: 1,
            unitPrice: 10,
            subtotal: 10,
          },
        ],
        invoiceNumber: 'TEMP', // Will be overridden by hook
        totalAmount: 10, // Will be overridden by hook
        status: 'pending',
        paymentMethod: 'cash',
        createdBy: '69195db9b1875799b940b004', // VSeyal User
      } as any,
      overrideAccess: true,
    })
    console.log('Error: Billing should have failed but succeeded!', billing.invoiceNumber)
  } catch (error: any) {
    console.log('Verification Success: Billing failed as expected.')
    console.log('Error Message:', error.message)
    if (error.message.includes('Insufficient stock')) {
      console.log('✅ Validation message is correct.')
    } else {
      console.log('❌ Validation message is unexpected.')
    }
  }

  process.exit(0)
}

verifyBillingValidation()
