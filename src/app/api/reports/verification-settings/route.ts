import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const DEFAULT_SETTINGS = {
  rawMaterial: {
    effectiveFrom: null,
    flowType: 'sequential',
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  closingEntry: {
    effectiveFrom: null,
    flowType: 'sequential',
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  stockOrder: {
    effectiveFrom: null,
    flowType: 'sequential',
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  returnOrder: {
    effectiveFrom: null,
    flowType: 'sequential',
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  otherProducts: {
    effectiveFrom: null,
    flowType: 'sequential',
    requireAccountant: true,
    requireWatcher: true,
    requireManager: true,
  },
  expense: {
    effectiveFrom: null,
    flowType: 'sequential',
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
          effectiveFrom: settings?.rawMaterial?.effectiveFrom ?? null,
          flowType: settings?.rawMaterial?.flowType ?? 'sequential',
          requireAccountant: settings?.rawMaterial?.requireAccountant ?? true,
          requireWatcher: settings?.rawMaterial?.requireWatcher ?? true,
          requireManager: settings?.rawMaterial?.requireManager ?? true,
        },
        closingEntry: {
          effectiveFrom: settings?.closingEntry?.effectiveFrom ?? null,
          flowType: settings?.closingEntry?.flowType ?? 'sequential',
          requireAccountant: settings?.closingEntry?.requireAccountant ?? true,
          requireWatcher: settings?.closingEntry?.requireWatcher ?? true,
          requireManager: settings?.closingEntry?.requireManager ?? true,
        },
        stockOrder: {
          effectiveFrom: settings?.stockOrder?.effectiveFrom ?? null,
          flowType: settings?.stockOrder?.flowType ?? 'sequential',
          requireAccountant: settings?.stockOrder?.requireAccountant ?? true,
          requireWatcher: settings?.stockOrder?.requireWatcher ?? true,
          requireManager: settings?.stockOrder?.requireManager ?? true,
        },
        returnOrder: {
          effectiveFrom: settings?.returnOrder?.effectiveFrom ?? null,
          flowType: settings?.returnOrder?.flowType ?? 'sequential',
          requireAccountant: settings?.returnOrder?.requireAccountant ?? true,
          requireWatcher: settings?.returnOrder?.requireWatcher ?? true,
          requireManager: settings?.returnOrder?.requireManager ?? true,
        },
        otherProducts: {
          effectiveFrom: settings?.otherProducts?.effectiveFrom ?? null,
          flowType: settings?.otherProducts?.flowType ?? 'sequential',
          requireAccountant: settings?.otherProducts?.requireAccountant ?? true,
          requireWatcher: settings?.otherProducts?.requireWatcher ?? true,
          requireManager: settings?.otherProducts?.requireManager ?? true,
        },
        expense: {
          effectiveFrom: settings?.expense?.effectiveFrom ?? null,
          flowType: settings?.expense?.flowType ?? 'sequential',
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
