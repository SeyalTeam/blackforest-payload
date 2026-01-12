'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function approveReview(reviewId: string, itemId: string) {
  const payload = await getPayload({ config: configPromise })

  console.log('--- approveReview ACTION ---')
  console.log('Review ID:', reviewId)
  console.log('Item ID:', itemId)

  try {
    const review = await payload.findByID({
      collection: 'reviews',
      id: reviewId,
      depth: 0,
    })

    if (!review || !review.items) {
      console.error('Review or items not found')
      return { success: false, error: 'Review not found' }
    }

    // console.log('Fetched Review Items:', JSON.stringify(review.items, null, 2))

    let found = false
    const items = review.items.map((item: any) => {
      // payload IDs can be numbers or strings? usually strings.
      // Loose comparison just in case? Or ensure types match.
      if (item.id === itemId) {
        found = true
        console.log('Found item to approve:', item.id)
        return {
          ...item,
          status: 'approved',
        }
      }
      return item
    })

    if (!found) {
      console.error('Item ID not found in review items:', itemId)
      console.log(
        'Available Item IDs:',
        review.items.map((i: any) => i.id),
      )
      return {
        success: false,
        error: `Item ID ${itemId} not found. Available: ${review.items.map((i: any) => i.id).join(', ')}`,
      }
    }

    await payload.update({
      collection: 'reviews',
      id: reviewId,
      data: {
        items,
      },
    })

    console.log('Review updated successfully')
    return { success: true }
  } catch (error: any) {
    console.error('Error approving review:', error)
    return { success: false, error: error.message || 'Failed to approve review' }
  }
}
