import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authResult = await payload.auth({ headers: request.headers })
    const user = authResult?.user as any

    if (!user) {
      return Response.json({ message: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { entryId, billId, id, step, status, notes, skipReason } = body || {}
    const closingId = entryId || billId || id

    if (!closingId) {
      return Response.json({ message: 'Missing closing entry ID (entryId)' }, { status: 400 })
    }

    if (!step || !['accountant', 'watcher', 'manager'].includes(step)) {
      return Response.json({ message: 'Invalid verification step. Must be accountant, watcher, or manager.' }, { status: 400 })
    }

    if (!status || !['verified', 'rejected', 'skipped', 'pending'].includes(status)) {
      return Response.json({ message: 'Invalid verification status' }, { status: 400 })
    }

    const userRole = user.role || ''
    const isSuperOrAdmin = ['superadmin', 'admin'].includes(userRole)

    // Role check for each step
    if (!isSuperOrAdmin) {
      if (step === 'accountant' && userRole !== 'account') {
        return Response.json(
          { message: 'Only Accountant, Office Admin, or Super Admin can verify the Accountant step.' },
          { status: 403 },
        )
      }
      if (step === 'watcher' && userRole !== 'watcher') {
        return Response.json(
          { message: 'Only Watcher, Office Admin, or Super Admin can verify the Watcher step.' },
          { status: 403 },
        )
      }
      if (step === 'manager' && userRole !== 'manager') {
        return Response.json(
          { message: 'Only Manager, Office Admin, or Super Admin can verify the Manager step.' },
          { status: 403 },
        )
      }
      if (status === 'skipped') {
        return Response.json(
          { message: 'Only Office Admin or Super Admin can skip a verification step.' },
          { status: 403 },
        )
      }
    }

    // Fetch existing closing entry
    const existingEntry = await payload.findByID({
      collection: 'closing-entries',
      id: closingId,
      overrideAccess: true,
    })

    if (!existingEntry) {
      return Response.json({ message: 'Closing entry not found' }, { status: 404 })
    }

    const currentVerification = (existingEntry as any).verification || {
      overallStatus: 'pending',
      accountant: { status: 'pending', notes: '' },
      watcher: { status: 'pending', notes: '' },
      manager: { status: 'pending', notes: '' },
    }

    // Sequential verification enforcement (unless superadmin/admin)
    if (!isSuperOrAdmin) {
      if (step === 'watcher') {
        const accStatus = currentVerification.accountant?.status || 'pending'
        if (accStatus !== 'verified' && accStatus !== 'skipped') {
          return Response.json(
            { message: 'Step 1 (Accountant) must be verified or skipped before Watcher verification can proceed.' },
            { status: 400 },
          )
        }
      }
      if (step === 'manager') {
        const watStatus = currentVerification.watcher?.status || 'pending'
        if (watStatus !== 'verified' && watStatus !== 'skipped') {
          return Response.json(
            { message: 'Step 2 (Watcher) must be verified or skipped before Manager verification can proceed.' },
            { status: 400 },
          )
        }
      }
    }

    // Fetch verification rules from global settings
    let settings: any = null
    try {
      settings = await (payload as any).findGlobal({
        slug: 'report-verification-settings',
      })
    } catch {
      // ignore
    }

    const reqAcc = settings?.closingEntry?.requireAccountant ?? true
    const reqWat = settings?.closingEntry?.requireWatcher ?? true
    const reqMgr = settings?.closingEntry?.requireManager ?? true

    let finalNotes = typeof notes === 'string' ? notes.trim() : (currentVerification[step]?.notes || '')
    if (status === 'skipped' && skipReason) {
      finalNotes = finalNotes ? `${finalNotes} (Skipped: ${skipReason})` : `Skipped: ${skipReason}`
    }

    const updatedStepData = {
      status,
      notes: finalNotes,
      verifiedBy: user.id,
      verifiedByName: user.name || user.username || user.email || 'Admin',
      verifiedByRole: user.role || 'admin',
      verifiedAt: new Date().toISOString(),
    }

    const newVerification = {
      ...currentVerification,
      [step]: updatedStepData,
    }

    const accSt = newVerification.accountant?.status || 'pending'
    const watSt = newVerification.watcher?.status || 'pending'
    const mgrSt = newVerification.manager?.status || 'pending'

    // Compute overall status considering active requirements
    let overallStatus: 'pending' | 'partially_verified' | 'verified' | 'rejected' = 'pending'

    const isAccOk = !reqAcc || accSt === 'verified' || accSt === 'skipped'
    const isWatOk = !reqWat || watSt === 'verified' || watSt === 'skipped'
    const isMgrOk = !reqMgr || mgrSt === 'verified' || mgrSt === 'skipped'

    if (accSt === 'rejected' || watSt === 'rejected' || mgrSt === 'rejected') {
      overallStatus = 'rejected'
    } else if (isAccOk && isWatOk && isMgrOk) {
      overallStatus = 'verified'
    } else if (
      (reqAcc && (accSt === 'verified' || accSt === 'skipped')) ||
      (reqWat && (watSt === 'verified' || watSt === 'skipped')) ||
      (reqMgr && (mgrSt === 'verified' || mgrSt === 'skipped'))
    ) {
      overallStatus = 'partially_verified'
    } else {
      overallStatus = 'pending'
    }

    newVerification.overallStatus = overallStatus

    const combinedNotes = [
      newVerification.accountant?.notes ? `[Accountant: ${newVerification.accountant.notes}]` : null,
      newVerification.watcher?.notes ? `[Watcher: ${newVerification.watcher.notes}]` : null,
      newVerification.manager?.notes ? `[Manager: ${newVerification.manager.notes}]` : null,
    ]
      .filter(Boolean)
      .join(' ')

    const updated = await (payload as any).update({
      collection: 'closing-entries',
      id: closingId,
      data: {
        verification: newVerification,
        notes: combinedNotes || '',
      },
      overrideAccess: true,
    })

    return Response.json({
      success: true,
      id: (updated as any)?.id || closingId,
      verification: (updated as any)?.verification || newVerification,
      notes: (updated as any)?.notes || combinedNotes,
    })
  } catch (error: any) {
    console.error('Error updating closing entry verification:', error)
    return Response.json({ message: error.message || 'Error updating verification' }, { status: 500 })
  }
}
