import { PayloadHandler } from 'payload'

export const cashfreeCreateOrderHandler: PayloadHandler = async (req): Promise<Response> => {
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

  const { totalAmount, customerName, customerPhone, customerEmail, billId } = body

  if (!totalAmount) {
    return Response.json({ message: 'Missing totalAmount' }, { status: 400 })
  }

  // Get credentials from process.env
  const clientId = process.env.CASHFREE_CLIENT_ID
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET
  const isProduction = process.env.CASHFREE_ENV === 'production'

  if (!clientId || !clientSecret) {
    return Response.json({ message: 'Cashfree credentials not configured on the server' }, { status: 500 })
  }

  // Determine endpoint
  const url = isProduction
    ? 'https://api.cashfree.com/pg/orders'
    : 'https://sandbox.cashfree.com/pg/orders'

  // Cashfree order_id must be alphanumeric with only - and _
  const sanitizedBillId = (billId || '').replace(/[^a-zA-Z0-9-_]/g, '')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const orderId = sanitizedBillId 
    ? `BF_${sanitizedBillId}_${randomSuffix}`
    : `BF_DIRECT_${Date.now()}_${randomSuffix}`

  // Prepare payload for Cashfree
  const payload = {
    order_amount: Number(totalAmount),
    order_currency: 'INR',
    customer_details: {
      customer_id: (customerPhone || `cust_${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, ''),
      customer_phone: customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : '9999999999',
      customer_name: customerName || 'Customer',
      customer_email: customerEmail || 'customer@example.com',
    },
    order_meta: {
      return_url: 'https://blackforest.vseyal.com/payment-result?order_id={order_id}',
    },
    order_note: billId ? `Bill ${billId}` : 'Direct order',
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json() as any

    if (!response.ok) {
      console.error('Cashfree order creation failed:', data)
      return Response.json({ message: data.message || 'Failed to create order on Cashfree' }, { status: response.status })
    }

    return Response.json({
      success: true,
      paymentSessionId: data.payment_session_id,
      orderId: data.order_id,
      environment: isProduction ? 'production' : 'sandbox',
    })
  } catch (error: any) {
    console.error('Error creating Cashfree order:', error)
    return Response.json({ message: error.message || 'Internal server error' }, { status: 500 })
  }
}
