import React from 'react'
import { notFound } from 'next/navigation'
import { getPayloadHMR } from '@payloadcms/next/utilities'
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
  const payload = await getPayloadHMR({ config: configPromise })

  let bill
  try {
    bill = await payload.findByID({
      collection: 'billings',
      id,
      depth: 2,
    })
  } catch (error) {
    console.error('Error fetching billing:', error)
    return notFound()
  }

  if (!bill) {
    return notFound()
  }

  // Construct data object for BillReceipt using the fetched document
  const billData: BillData = {
    invoiceNumber: bill.invoiceNumber,
    totalAmount: bill.totalAmount,
    items: bill.items as any, // Type assertion for compatibility
    createdAt: bill.createdAt,
    customerDetails: bill.customerDetails,
    paymentMethod: bill.paymentMethod,
    branch: bill.branch as any,
    createdBy: bill.createdBy as any,
  }

  return (
    <div className="public-bill-container">
      <div className="bill-wrapper">
        <BillReceipt data={billData} />
      </div>
    </div>
  )
}
