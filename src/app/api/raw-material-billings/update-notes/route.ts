import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const body = await request.json()
    const { billId, notes } = body || {}

    if (!billId) {
      return Response.json({ message: 'Missing billId' }, { status: 400 })
    }

    const updated = await payload.update({
      collection: 'raw-material-billings',
      id: billId,
      data: {
        notes: typeof notes === 'string' ? notes : '',
      },
      overrideAccess: true,
    })

    return Response.json({ success: true, id: updated.id, notes: (updated as any).notes })
  } catch (error: any) {
    console.error('Error updating raw material billing notes:', error)
    return Response.json({ message: error.message || 'Error updating notes' }, { status: 500 })
  }
}
