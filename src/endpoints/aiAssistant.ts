import { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import axios from 'axios'

dayjs.extend(utc)
dayjs.extend(timezone)

export const aiAssistantHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  // 1. Check Authentication
  if (!req.user) {
    return Response.json({ message: 'Unauthorized. Please login.' }, { status: 401 })
  }

  // 2. Parse Query Message
  let message = ''
  try {
    const body = typeof req.json === 'function' ? await req.json() : {}
    message = (body?.message || '').trim()
  } catch (error) {
    // Fallback to query param if JSON parsing fails
    const url = new URL(req.url || '', 'http://localhost')
    message = (url.searchParams.get('message') || '').trim()
  }

  if (!message) {
    return Response.json({ message: 'Message is required.' }, { status: 400 })
  }

  // 3. Check for GEMINI_API_KEY
  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!geminiApiKey) {
    return Response.json({
      message: '⚠️ GEMINI_API_KEY is not configured in the backend environment variables. Please add it to your .env or .env.local file to enable the AI Billing Assistant.',
    }, { status: 200 })
  }

  try {
    let retrievedContext = ''

    // 4. Retrieve Sales/Billing Statistics Context if query contains sales terms
    const hasSalesTerms = /sale|revenue|income|earn|sold|bill|order|stat|popular/i.test(message)
    if (hasSalesTerms) {
      let startDate = dayjs().tz('Asia/Kolkata').startOf('day')
      let endDate = dayjs().tz('Asia/Kolkata').endOf('day')
      let dateLabel = 'today'

      if (/yesterday/i.test(message)) {
        startDate = dayjs().tz('Asia/Kolkata').subtract(1, 'day').startOf('day')
        endDate = dayjs().tz('Asia/Kolkata').subtract(1, 'day').endOf('day')
        dateLabel = 'yesterday'
      }

      const billsResult = await payload.find({
        collection: 'billings',
        where: {
          and: [
            { createdAt: { greater_than_equal: startDate.toISOString() } },
            { createdAt: { less_than_equal: endDate.toISOString() } },
            { status: { not_equals: 'cancelled' } },
          ],
        },
        limit: 1000,
        overrideAccess: true,
      })

      const itemMap: { [key: string]: number } = {}
      let totalAmountSum = 0
      const billCount = billsResult.docs.length

      for (const bill of billsResult.docs as any[]) {
        totalAmountSum += bill.totalAmount || 0
        if (Array.isArray(bill.items)) {
          for (const item of bill.items) {
            const name = item.name || 'Unknown'
            const qty = item.quantity || 1
            itemMap[name] = (itemMap[name] || 0) + qty
          }
        }
      }

      const topSold = Object.entries(itemMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)

      retrievedContext += `
[Sales/Order Context for ${dateLabel}]
- Total Completed/Active Bills: ${billCount}
- Total Revenue/Sales: ${totalAmountSum.toFixed(2)} INR
- Top Sold Items:
${topSold.length > 0 ? topSold.map(([name, qty]) => `  * ${name}: ${qty} units`).join('\n') : '  * No sales recorded yet.'}
`
    }

    // 5. Retrieve Catalog/Products Context matching search keywords
    const cleanKeywords = message
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          ![
            'what',
            'how',
            'show',
            'list',
            'check',
            'have',
            'much',
            'stock',
            'today',
            'yesterday',
            'sales',
            'revenue',
            'you',
            'the',
            'any',
            'some',
          ].includes(w),
      )

    if (cleanKeywords.length > 0) {
      const searchClauses = cleanKeywords.map((kw) => ({
        name: { like: kw },
      }))

      const productsResult = await payload.find({
        collection: 'products',
        where: {
          or: searchClauses,
        },
        limit: 10,
        overrideAccess: true,
      })

      if (productsResult.docs.length > 0) {
        retrievedContext += `
[Menu & Catalog Context (matching keywords: ${cleanKeywords.join(', ')})]
`
        for (const prod of productsResult.docs as any[]) {
          const price = prod.defaultPriceDetails?.price || prod.defaultPriceDetails?.rate || 'N/A'
          const categoryName = typeof prod.category === 'object' ? prod.category?.name : 'General'
          const availability = prod.isAvailable !== false ? 'Available' : 'Out of Stock'
          retrievedContext += `- ${prod.name} (${prod.productId || 'No ID'}): Price is ${price} INR | Category: ${categoryName} | Status: ${availability}\n`
        }
      }
    }

    // 6. Define System Instructions
    const systemPrompt = `You are the AI Billing Assistant for Blackforest Cakes. Your role is to help the shop owner/manager query business reports, product catalog details, and sales statistics.
    
Here is the live context retrieved from our database corresponding to the user query:
${retrievedContext ? retrievedContext : '- No specific context matched in the database for this query.'}

Instructions:
- Use the retrieved database context to answer the query accurately.
- Do not make up sales numbers or prices if they are not in the context.
- Be concise, helpful, and polite.
- Format all prices in INR (e.g. ₹150) and format numbers clearly.
- If the user asks a general question not directly in the context, answer it using general restaurant management best practices but state that it is general advice.
`

    // 7. Make API request to Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`
    const response = await axios.post(
      geminiUrl,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }],
          },
        ],
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const answer = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.'

    return Response.json({ message: answer }, { status: 200 })
  } catch (err: any) {
    req.payload.logger.error({
      err,
      msg: 'Error in AI Billing Assistant endpoint',
    })
    
    // Extract detailed error description (e.g. from Axios API errors)
    const errorDetails = err.response?.data?.error?.message || err.message
    
    return Response.json({
      message: `Error: ${errorDetails}`,
    }, { status: 500 })
  }
}
