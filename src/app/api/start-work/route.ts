import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { startWorkHandler } from '@/endpoints/startWork'
import { corsHeaders, handleOptions } from '@/utilities/cors'

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request, 'POST,OPTIONS')
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authResult = await payload.auth({ headers: req.headers })
    const user = authResult?.user || null

    const payloadReq: any = req
    payloadReq.payload = payload
    payloadReq.user = user

    const response = await startWorkHandler(payloadReq)
    const headers = new Headers(response.headers)
    const cors = corsHeaders(req, 'POST,OPTIONS')
    for (const [key, value] of Object.entries(cors)) {
      headers.set(key, value)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (err: any) {
    return Response.json(
      { success: false, message: err.message || 'Internal server error' },
      { status: 500, headers: corsHeaders(req, 'POST,OPTIONS') },
    )
  }
}
