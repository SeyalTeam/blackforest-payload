import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
export function middleware(request: NextRequest) {
  const APP_SECRET = 'BF_REPORT_SECRET_2024'

  // Define which paths to protect
  const protectedPaths = [
    '/api/billings',
    '/api/stock-orders',
    '/api/return-orders',
    '/api/expenses',
    // '/api/branches' // Uncomment if you want to protect branches too
  ]
  const { pathname } = request.nextUrl
  // Check if the current path starts with any of the protected paths
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path))
  if (isProtected) {
    // Allow CORS preflight requests
    if (request.method === 'OPTIONS') {
      return NextResponse.next()
    }
    // Check for the secret header
    const requestSecret = request.headers.get('x-app-secret')
    if (requestSecret !== APP_SECRET) {
      return NextResponse.json(
        { errors: [{ message: 'Forbidden: Missing or Invalid App Secret Key' }] },
        { status: 403 },
      )
    }
  }
  return NextResponse.next()
}
// Optimizing middleware to run only on API routes
export const config = {
  matcher: '/api/:path*',
}
