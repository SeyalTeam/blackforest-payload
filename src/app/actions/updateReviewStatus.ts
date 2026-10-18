'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function updateReviewStatus(
  reviewId: string,
  itemId: string,
  reviewStatus: 'positive' | 'negative' | 'pending',
) {
  const payload = await getPayload({ config: configPromise })

  try {
    const review = await payload.findByID({
      collection: 'reviews',
      id: reviewId,
      depth: 0,
    })

    if (!review || !review.items) {
      return { success: false, error: 'Review not found' }
    }

    let found = false
    const items = review.items.map((item: any) => {
      if (item.id === itemId) {
        found = true
        return {
          ...item,
          reviewStatus,
        }
      }
      return item
    })

    if (!found) {
      return {
        success: false,
        error: `Item ID ${itemId} not found in review items`,
      }
    }

    await payload.update({
      collection: 'reviews',
      id: reviewId,
      data: {
        items,
      },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Failed to update review status:', error)
    return { success: false, error: error.message || 'Failed to update review status' }
  }
}
