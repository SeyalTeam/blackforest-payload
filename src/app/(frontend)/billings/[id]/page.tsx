import React from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import BillReceipt, { BillData } from '@/components/BillReceipt'
import './styles.css'

type Args = {
  params: Promise<{
    id: string
  }>
}

export default async function BillPage({ params }: Args) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })

  let bill
  try {
    bill = await payload.findByID({
      collection: 'billings',
      id,
      depth: 3,
    })
  } catch (error) {
    console.error('Error fetching billing:', error)
    return notFound()
  }

  if (!bill) {
    return notFound()
  }

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

  // Construct data object for BillReceipt using the fetched document
  const billData: BillData = {
    id: bill.id,
    invoiceNumber: bill.invoiceNumber,
    totalAmount: bill.totalAmount,
    items: bill.items as any, // Type assertion for compatibility
    createdAt: bill.createdAt,
    customerDetails: bill.customerDetails,
    paymentMethod: bill.paymentMethod,
    branch: bill.branch as any,
    createdBy: bill.createdBy as any,
    company: bill.company as any,
    existingReviews: existingReview as any,
  }

  return (
    <div className="public-bill-container">
      <div style={{ width: '100%' }}>
        {billData.customerDetails?.name && (
          <h2 style={{ color: 'white', marginBottom: '20px', textAlign: 'left' }}>
            Hello {billData.customerDetails.name},
          </h2>
        )}
        <BillReceipt data={billData} />
      </div>
    </div>
  )
}
