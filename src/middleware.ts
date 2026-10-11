import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders, handleOptions } from "./utilities/cors";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
