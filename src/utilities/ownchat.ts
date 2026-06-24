import axiosLib from 'axios'

// Use a fresh isolated instance to avoid any global axios interceptors set up by Payload CMS
const axios = axiosLib.create()

/**
 * Normalizes phone numbers to standard WhatsApp format with country code (e.g. 91XXXXXXXXXX).
 * Strips all non-digit characters and prepends '91' for India if it is a 10-digit number.
 */
export const formatPhoneNumberForWhatsApp = (phoneNumber: string): string => {
  const digits = phoneNumber.replace(/\D/g, '')
  if (digits.length === 10) {
    return `91${digits}`
  }
  return digits
}

interface SendWhatsAppBillParams {
  billId: string
  invoiceNumber: string
  customerName: string
  phoneNumber: string
  totalAmount: number
}

/**
 * Sends a billing notification to a customer's WhatsApp number via Ownchat.
 * Supports both Webhook Connection mode (apps/events URL) and Direct Template API mode.
 */
export const sendWhatsAppBill = async (params: SendWhatsAppBillParams): Promise<boolean> => {
  const apiKey = process.env.OWNCHAT_API_KEY
  const apiSecret = process.env.OWNCHAT_API_SECRET
  const apiUrl = process.env.OWNCHAT_API_URL || 'https://api.ownchat.app/apis/v1/chat/send-message'
  const serverUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'

  if (!apiKey || !apiSecret) {
    console.error('[Ownchat] Missing API credentials in environment variables.')
    return false
  }

  const normalizedPhone = formatPhoneNumberForWhatsApp(params.phoneNumber)
  if (!normalizedPhone || normalizedPhone.length < 10) {
    console.error('[Ownchat] Invalid phone number for WhatsApp message:', params.phoneNumber)
    return false
  }

  const billUrl = `${serverUrl}/billings/${params.billId}`
  const customerName = params.customerName || 'Customer'
  const amountStr = params.totalAmount.toFixed(2)

  // Detect Webhook Connection mode (URL contains /apps/)
  const isWebhookMode = apiUrl.includes('/apps/')

  // Build payload based on mode
  const payload = isWebhookMode
    ? {
        // Flat webhook payload for Ownchat Connection events
        customerName,
        invoiceNumber: params.invoiceNumber,
        totalAmount: amountStr,
        phoneNumber: normalizedPhone,
        billUrl,
      }
    : {
        // Meta-compliant WhatsApp Cloud API Template Payload (Direct API mode)
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        recipient_name: customerName,
        to: normalizedPhone,
        type: 'template',
        template: {
          name: process.env.OWNCHAT_TEMPLATE_NAME || 'blackforest_billing_v1',
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customerName },
                { type: 'text', text: params.invoiceNumber },
                { type: 'text', text: amountStr },
                { type: 'text', text: billUrl },
              ],
            },
          ],
        },
      }

  try {
    console.log(`[Ownchat] Sending bill notification for ${params.invoiceNumber} to ${normalizedPhone} (mode: ${isWebhookMode ? 'webhook' : 'direct-api'})...`)

    const response = await axios.post(apiUrl, payload, {
      headers: {
        'OWNCHAT-API-KEY': apiKey,
        'OWNCHAT-API-SECRET': apiSecret,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    // Accept success from both Webhook mode (status: 'success') and Direct API mode (messages array)
    const isSuccess =
      response.status === 200 &&
      (response.data?.status === 'success' ||
        response.data === 'OK' ||
        response.data?.messages?.length > 0)

    if (isSuccess) {
      const entryId = response.data?.data?.entryId || response.data?.messages?.[0]?.id || ''
      console.log(`[Ownchat] Successfully sent bill notification for ${params.invoiceNumber}. Entry: ${entryId}`)
      return true
    } else {
      console.error('[Ownchat] Unexpected response structure:', response.data)
      return false
    }
  } catch (error) {
    const err = error as any
    console.error('[Ownchat] Failed to send WhatsApp bill notification:', err?.response?.data || err?.message || err)
    return false
  }
}
