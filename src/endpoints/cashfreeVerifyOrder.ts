import { PayloadHandler } from 'payload'

export const cashfreeVerifyOrderHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json?.()
  } catch (_e) {}

  if (!body) {
    return Response.json({ message: 'Missing request body' }, { status: 400 })
  }

  const { cfOrderId, recalledBillId, billingData } = body

  if (!cfOrderId) {
    return Response.json({ message: 'Missing cfOrderId' }, { status: 400 })
  }

  // Get credentials from process.env
  const clientId = process.env.CASHFREE_CLIENT_ID
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET
  const isProduction = process.env.CASHFREE_ENV === 'production'

  if (!clientId || !clientSecret) {
    return Response.json({ message: 'Cashfree credentials not configured on the server' }, { status: 500 })
  }

  // Call Cashfree GET /orders/{orderId}
  const url = isProduction
    ? `https://api.cashfree.com/pg/orders/${cfOrderId}`
    : `https://sandbox.cashfree.com/pg/orders/${cfOrderId}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': '2023-08-01',
      },
    })

    const data = await response.json() as any

    if (!response.ok) {
      console.error('Cashfree order status check failed:', data)
      return Response.json({ message: data.message || 'Failed to check order status' }, { status: response.status })
    }

    if (data.order_status !== 'PAID') {
      return Response.json({
        success: false,
        status: data.order_status,
        message: `Order status is not PAID: ${data.order_status}`,
      })
    }

    // Payment is verified! Complete the bill in the database
    if (!billingData) {
      return Response.json({
        success: true,
        status: 'PAID',
        message: 'Payment verified, but billingData not provided to complete the bill',
      })
    }

    // Ensure status is completed and payment method is cashfree
    billingData.status = 'completed'
    billingData.paymentMethod = 'cashfree'

    let savedBill: any

    if (recalledBillId) {
      // Update existing bill
      savedBill = await req.payload.update({
        collection: 'billings',
        id: recalledBillId,
        data: billingData,
        user: req.user,
      })
    } else {
      // Create new bill
      savedBill = await req.payload.create({
        collection: 'billings',
        data: billingData,
        user: req.user,
      })
    }

    return Response.json({
      success: true,
      status: 'PAID',
      bill: savedBill,
    })
  } catch (error: any) {
    console.error('Error verifying Cashfree order:', error)
    return Response.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
