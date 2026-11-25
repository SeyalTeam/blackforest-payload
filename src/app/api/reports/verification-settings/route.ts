import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const DEFAULT_SETTINGS = {
  rawMaterial: {
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  closingEntry: {
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  stockOrder: {
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  returnOrder: {
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  otherProducts: {
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  expense: {
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
}

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    const settings = await (payload as any).findGlobal({
      slug: 'report-verification-settings',
    })

    return Response.json({
      success: true,
      settings: {
        rawMaterial: {
          requireAccountant: settings?.rawMaterial?.requireAccountant ?? true,
          requireWatcher: settings?.rawMaterial?.requireWatcher ?? true,
          requireManager: settings?.rawMaterial?.requireManager ?? true,
        },
        closingEntry: {
          requireAccountant: settings?.closingEntry?.requireAccountant ?? true,
          requireWatcher: settings?.closingEntry?.requireWatcher ?? true,
          requireManager: settings?.closingEntry?.requireManager ?? true,
        },
        stockOrder: {
          requireAccountant: settings?.stockOrder?.requireAccountant ?? true,
          requireWatcher: settings?.stockOrder?.requireWatcher ?? true,
          requireManager: settings?.stockOrder?.requireManager ?? true,
        },
        returnOrder: {
          requireAccountant: settings?.returnOrder?.requireAccountant ?? true,
          requireWatcher: settings?.returnOrder?.requireWatcher ?? true,
          requireManager: settings?.returnOrder?.requireManager ?? true,
        },
        otherProducts: {
          requireAccountant: settings?.otherProducts?.requireAccountant ?? true,
          requireWatcher: settings?.otherProducts?.requireWatcher ?? true,
          requireManager: settings?.otherProducts?.requireManager ?? true,
        },
        expense: {
          requireAccountant: settings?.expense?.requireAccountant ?? true,
          requireWatcher: settings?.expense?.requireWatcher ?? true,
          requireManager: settings?.expense?.requireManager ?? true,
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching verification settings:', error)
    return Response.json({ success: true, settings: DEFAULT_SETTINGS })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authResult = await payload.auth({ headers: req.headers })
    const user = authResult?.user as any

    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return Response.json(
        { message: 'Unauthorized. Only Office Super Admin or Office Admin can change verification settings.' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const { rawMaterial, closingEntry, stockOrder, returnOrder, otherProducts, expense } = body || {}

    const updated = await (payload as any).updateGlobal({
      slug: 'report-verification-settings',
      data: {
        ...(rawMaterial ? { rawMaterial } : {}),
        ...(closingEntry ? { closingEntry } : {}),
        ...(stockOrder ? { stockOrder } : {}),
        ...(returnOrder ? { returnOrder } : {}),
        ...(otherProducts ? { otherProducts } : {}),
        ...(expense ? { expense } : {}),
      },
    })

    return Response.json({
      success: true,
      message: 'Verification settings updated successfully',
      settings: updated,
    })
  } catch (error: any) {
    console.error('Error updating verification settings:', error)
    return Response.json({ message: error.message || 'Error updating settings' }, { status: 500 })
  }
}
