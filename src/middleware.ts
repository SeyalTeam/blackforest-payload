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
    const validApiKey = process.env.BRANCH_APP_API_KEY

    // Validate
    if (apiKey && apiKey === validApiKey) {
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
