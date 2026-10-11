import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/utilities/cors'

export const POST = async (req: NextRequest) => {
  const payload = await getPayload({ config: configPromise })
  const data = await req.json()

  const { bill, product, rating, feedback, customerName, customerPhone, branch } = data

  if (!bill || !product || !rating) {
    return NextResponse.json(
      { errors: [{ message: 'Bill, Product, and Rating are required' }] },
      { status: 400, headers: corsHeaders(req, 'POST,OPTIONS') },
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

      return NextResponse.json(updatedReview, { status: 200, headers: corsHeaders(req, 'POST,OPTIONS') })
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

      return NextResponse.json(review, { status: 201, headers: corsHeaders(req, 'POST,OPTIONS') })
    }
  } catch (error) {
    console.error('Error creating/updating review:', error)
    return NextResponse.json(
      { errors: [{ message: 'Failed to create/update review' }] },
      { status: 500, headers: corsHeaders(req, 'POST,OPTIONS') },
    )
  }
}

export const GET = async (req: NextRequest) => {
  const payload = await getPayload({ config: configPromise })
  const { searchParams } = new URL(req.url)
  const bill = searchParams.get('bill')
  const product = searchParams.get('product')
  const branchEquals = searchParams.get('where[branch][equals]')
  const branchIn = searchParams.get('where[branch][in]')

  const where: any = {}
  if (bill) {
    where.bill = { equals: bill }
  }
  if (product) {
    where['items.product'] = { equals: product }
  }
  if (branchEquals && branchEquals !== 'NONE') {
    where.branch = { equals: branchEquals }
  } else if (branchEquals === 'NONE') {
    where.branch = { equals: '000000000000000000000000' }
  } else if (branchIn) {
    where.branch = { in: branchIn.split(',') }
  }

  try {
    const reviews = await payload.find({
      collection: 'reviews',
      where,
      depth: 1, // Adjust depth as needed to get related data
      limit: 100, // Reasonable default limit
    })

    return NextResponse.json(reviews, { status: 200, headers: corsHeaders(req, 'GET,OPTIONS') })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { errors: [{ message: 'Failed to fetch reviews' }] },
      { status: 500, headers: corsHeaders(req, 'GET,OPTIONS') }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request, 'GET,POST,OPTIONS') })
}
