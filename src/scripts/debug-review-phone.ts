import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const debugReviewPhone = async () => {
  const payload = await getPayload({ config: configPromise })

  const idFromUser = '69610876c98096f84ccca8eb'
  const invoiceNumber = 'VSE-20260109-006'

  console.log(`--- Checking ID ${idFromUser} as Review ID ---`)
  try {
    const review = await payload.findByID({
      collection: 'reviews',
      id: idFromUser,
      depth: 2,
    })
    if (review) {
      console.log('Found Review by ID!')
      console.log('Review customerPhone:', review.customerPhone)
      const bill = review.bill
      if (typeof bill === 'object' && bill !== null) {
        console.log('Bill populated:', bill.id)
        // @ts-ignore
        console.log('Bill invoiceNumber:', bill.invoiceNumber)
        // @ts-ignore
        console.log('Bill customerDetails:', bill.customerDetails)
      }
    }
  } catch (e) {
    console.log('Not a review ID or not found: ' + (e as any).message)
  }

  console.log(`\n--- Checking Bill with Invoice ${invoiceNumber} ---`)
  const bills = await payload.find({
    collection: 'billings',
    where: {
      invoiceNumber: { equals: invoiceNumber },
    },
  })

  if (bills.docs.length > 0) {
    const bill = bills.docs[0]
    console.log(`Found Bill: ${bill.id}`)
    console.log('Bill customerDetails:', bill.customerDetails)

    console.log(`\n--- Searching Review for Bill ID ${bill.id} ---`)
    const reviews = await payload.find({
      collection: 'reviews',
      where: {
        bill: { equals: bill.id },
      },
      depth: 2,
    })
    if (reviews.docs.length > 0) {
      const rev = reviews.docs[0]
      console.log('Found Review via Bill ID!')
      console.log('Review customerPhone:', rev.customerPhone)
      console.log('Review customerName:', rev.customerName)
    } else {
      console.log('No review found for this bill ID.')
    }
  } else {
    console.log('Bill not found with that invoice number.')
  }

  process.exit(0)
}

debugReviewPhone()
