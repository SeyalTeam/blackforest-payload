import { PayloadHandler } from 'payload'

export const updateBillTransactionIdHandler: PayloadHandler = async (req): Promise<Response> => {
  const { payload } = req

  // Authenticate user and verify role
  if (!req.user || !['superadmin', 'admin', 'account'].includes(req.user.role)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { billId, upiBankTransactionId } = await (req as any).json()

    if (!billId) {
      return Response.json({ message: 'Missing billId' }, { status: 400 })
    }

    // Update the bill transaction ID in the database
    const updatedBill = await payload.update({
      collection: 'billings',
      id: billId,
      data: {
        upiBankTransactionId: upiBankTransactionId || null,
      },
      overrideAccess: true, // Bypass access control checks since role restriction was handled above
    })

    return Response.json({ message: 'Transaction ID updated', upiBankTransactionId: updatedBill.upiBankTransactionId })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ message: 'Error updating transaction ID' }, { status: 500 })
  }
}
