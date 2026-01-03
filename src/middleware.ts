import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Only intercept /api routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Allow CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return NextResponse.next()
    }

    // Check for the x-api-key header
    const apiKey = request.headers.get('x-api-key')
    const validApiKeys = [
      process.env.BRANCH_APP_API_KEY,
      process.env.TRACKER_APP_API_KEY,
      process.env.BILLING_APP_API_KEY,
    ].filter(Boolean) // Remove undefined if variable is missing

    // 1. Allow if API Key is Valid
    if (apiKey && validApiKeys.includes(apiKey)) {
      return NextResponse.next()
    }

    // 2. Allow if Payload Session Cookie exists (Admin Dashboard authenticated users)
    const payloadToken = request.cookies.get('payload-token')
    if (payloadToken) {
      return NextResponse.next()
    }

    // 3. Allow if Referer is from the Admin Panel (e.g., Login Page)
    const referer = request.headers.get('referer')
    if (referer && referer.includes('/admin')) {
      return NextResponse.next()
    }

    // Reject if invalid
    return NextResponse.json(
      { errors: [{ message: 'Unauthorized: Invalid or missing API Key.' }] },
      { status: 401 },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
