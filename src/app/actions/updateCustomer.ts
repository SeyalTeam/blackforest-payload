'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { revalidatePath } from 'next/cache'

export async function updateCustomer(billId: string, name: string, phone: string) {
  try {
    const payload = await getPayload({ config: configPromise })

    await payload.update({
      collection: 'billings',
      id: billId,
      data: {
        customerDetails: {
          name,
          phoneNumber: phone,
        },
      },
    })

    revalidatePath(`/billings/${billId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating customer details:', error)
    return { success: false, error: 'Failed to update details' }
  }
}
