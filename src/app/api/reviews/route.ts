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
    // 1. Check if a review document already exists for this bill
    const existingReviews = await payload.find({
      collection: 'reviews',
      where: {
        bill: {
          equals: bill,
        },
      },
      depth: 0,
    })

    const existingReview = existingReviews.docs[0]

    if (existingReview) {
      // 2. If exists, update the specific item in the array or push new one
      const items = (existingReview.items as any[]) || []
      const existingItemIndex = items.findIndex(
        (item: any) =>
          (typeof item.product === 'object' ? item.product.id : item.product) === product,
      )

      if (existingItemIndex > -1) {
        // Update existing item
        items[existingItemIndex] = {
          ...items[existingItemIndex],
          rating,
          feedback: feedback || '',
        }
      } else {
        // Add new item
        items.push({
          product,
          rating,
          feedback: feedback || '',
        })
      }

      const updatedReview = await payload.update({
        collection: 'reviews',
        id: existingReview.id,
        data: {
          items,
          customerName: customerName || existingReview.customerName,
          customerPhone: customerPhone || existingReview.customerPhone,
          branch: branch || existingReview.branch,
        },
      })

      return NextResponse.json(updatedReview, { status: 200 })
    } else {
      // 3. If not exists, create new document with items array
      const review = await payload.create({
        collection: 'reviews',
        data: {
          bill,
          items: [
            {
              product,
              rating,
              feedback: feedback || '',
            },
          ],
          customerName,
          customerPhone,
          branch,
        },
      })

      return NextResponse.json(review, { status: 201 })
    }
  } catch (error) {
    console.error('Error creating/updating review:', error)
    return NextResponse.json(
      { errors: [{ message: 'Failed to create/update review' }] },
      { status: 500 },
    )
  }
}
