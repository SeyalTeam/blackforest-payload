import { PayloadHandler } from 'payload'

export const updateBillVerificationStatusHandler: PayloadHandler = async (req): Promise<Response> => {
  const { payload } = req

  // Authenticate user and verify role
  if (!req.user || !['superadmin', 'admin', 'account'].includes(req.user.role)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { billId, status } = await (req as any).json()

    if (!billId || !status) {
      return Response.json({ message: 'Missing required fields' }, { status: 400 })
    }

    if (!['pending', 'verified', 'not_verified', 'not_match', 'cancelled'].includes(status)) {
      return Response.json({ message: 'Invalid verification status value' }, { status: 400 })
    }

    // Update the bill verification status in the database
    const updatedBill = await payload.update({
      collection: 'billings',
      id: billId,
      data: {
        verificationStatus: status,
      },
      overrideAccess: true, // Bypass access control checks since role restriction was handled above
    })

    return Response.json({ message: 'Verification status updated', status: updatedBill.verificationStatus })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ message: 'Error updating verification status' }, { status: 500 })
  }
}
