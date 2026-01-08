import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

export const POST = async (req: NextRequest) => {
  const payload = await getPayload({ config: configPromise })
  const data = await req.json()

  const { bill, product, rating, feedback, customerName, customerPhone, branch } = data

  if (!bill || !product || !rating) {
    return NextResponse.json(
      { errors: [{ message: 'Bill, Product, and Rating are required' }] },
      { status: 400 },
    )
  }

  try {
    const review = await payload.create({
      collection: 'reviews',
      data: {
        bill,
        product,
        rating,
        feedback: feedback || '',
        customerName,
        customerPhone,
        branch,
      },
    })

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json({ errors: [{ message: 'Failed to create review' }] }, { status: 500 })
  }
}
