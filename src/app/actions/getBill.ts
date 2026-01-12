'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { BillData } from '@/components/BillReceipt'

export async function getBill(id: string): Promise<BillData | null> {
  const payload = await getPayload({ config: configPromise })

  try {
    const bill = await payload.findByID({
      collection: 'billings',
      id,
      depth: 2,
    })

    if (!bill) return null

    // Fetch existing review for this bill
    let existingReview
    try {
      const reviewsQuery = await payload.find({
        collection: 'reviews',
        where: {
          bill: {
            equals: id,
          },
        },
        depth: 0,
      })
      existingReview = reviewsQuery.docs[0] || null
    } catch (error) {
      console.error('Error fetching existing review:', error)
    }

    // Construct data object for BillReceipt
    const billData: BillData = {
      id: bill.id,
      invoiceNumber: bill.invoiceNumber,
      totalAmount: bill.totalAmount,
      items: bill.items as any,
      createdAt: bill.createdAt,
      customerDetails: bill.customerDetails,
      paymentMethod: bill.paymentMethod,
      branch: bill.branch as any,
      createdBy: bill.createdBy as any,
      company: bill.company as any,
      existingReviews: existingReview as any,
    }

    return billData
  } catch (error) {
    console.error('Error fetching bill:', error)
    return null
  }
}
