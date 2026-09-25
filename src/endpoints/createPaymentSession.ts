import { PayloadHandler } from 'payload'

export const createPaymentSessionHandler: PayloadHandler = async (req): Promise<Response> => {
  const { payload } = req

  try {
    const paymentSettings = await payload.findGlobal({
      slug: 'payment-settings',
    })

    if (!paymentSettings || paymentSettings.activePaymentMethod !== 'hdfc_smartgateway') {
      return Response.json({ message: 'HDFC SmartGateway is not active' }, { status: 400 })
    }

    const { hdfcSettings } = paymentSettings
    if (!hdfcSettings || !hdfcSettings.merchantId || !hdfcSettings.apiKeyBase64) {
      return Response.json({ message: 'HDFC SmartGateway is not fully configured' }, { status: 500 })
    }

    const { amount, billId, customerId, customerName, customerPhone } = await (req as any).json()

    if (!amount || !billId) {
      return Response.json({ message: 'Missing amount or billId' }, { status: 400 })
    }

    const isProduction = hdfcSettings.environment === 'production'
    const endpoint = isProduction 
      ? 'https://smartgateway.hdfc.bank.in/session' 
      : 'https://smartgateway.hdfcuat.bank.in/session'

    // SmartGateway expects amount as string with up to 2 decimal places
    const formattedAmount = Number(amount).toFixed(2)

    const payloadBody = {
      order_id: billId,
      amount: formattedAmount,
      customer_id: customerId || 'guest',
      customer_phone: customerPhone || '9999999999',
      payment_page_client_id: hdfcSettings.paymentPageClientId || 'hdfcmaster',
      action: 'paymentPage',
      return_url: `${req.headers.get('origin') || process.env.NEXT_PUBLIC_SERVER_URL}/kot`,
      description: `Payment for Bill ${billId}`,
      first_name: customerName || 'Customer',
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${hdfcSettings.apiKeyBase64}`,
        'x-merchantid': hdfcSettings.merchantId,
        'x-customerid': customerId || 'guest',
      },
      body: JSON.stringify(payloadBody),
    })

    const data = await response.json()

    if (!response.ok) {
      payload.logger.error(`HDFC Session Error: ${JSON.stringify(data)}`)
      return Response.json({ message: data.error_message || 'Error creating payment session', details: data }, { status: response.status })
    }

    return Response.json({ 
      paymentUrl: data.payment_links?.web,
      orderId: data.order_id,
      sdkPayload: data.sdk_payload 
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ message: 'Internal server error' }, { status: 500 })
  }
}
