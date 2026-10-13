import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders, handleOptions } from "./utilities/cors";

// Known valid client app secrets
const VALID_APP_KEYS = new Set([
  process.env.BLACKFOREST_APP_SECRET || "bf_sec_2026_k9x2m8q4v7",
  process.env.APP_SECRET_WAITER_POS || "bf_pos_9f8d7e6c5b4a3210",
  process.env.APP_SECRET_BRANCH_APP || "bf_branch_3a2b1c4d5e6f7a8b",
  process.env.APP_SECRET_ADMIN_APP || "BF_REPORT_SECRET_2024",
  process.env.APP_SECRET_TRACKER_APP || "bf_tracker_4b5c6d7e8f9a0b1c",
  process.env.APP_SECRET_FRONTEND_WEB || "bf_web_5e6f7a8b9c0d1e2f",
  "BF_REPORT_SECRET_2024",
  "bf_sec_2026_k9x2m8q4v7",
  "bf_pos_9f8d7e6c5b4a3210",
  "bf_branch_3a2b1c4d5e6f7a8b",
  "bf_tracker_4b5c6d7e8f9a0b1c",
  "bf_web_5e6f7a8b9c0d1e2f",
].filter(Boolean));

// Public routes that customer table ordering and APK downloads need without staff keys
const PUBLIC_EXEMPT_PREFIXES = [
  "/api/home-data",
  "/api/categories-data",
  "/api/products-data",
  "/api/bill-summary",
  "/api/place-order",
  "/api/complete-bill",
  "/api/call-waiter",
  "/api/customer-details-config",
  "/api/billing/customer-lookup",
  "/api/billing-customers",
  "/api/favorite-categories-order",
  "/api/favorite-products-order",
  "/api/reviews",
  "/api/branch-from-location",
  "/api/check-app-version",
  "/api/app-download",
  "/api/table-redirect",
  "/api/speedtest",
  "/api/graphql-playground",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    // 1. Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    // 2. Allow Payload Admin panel internal requests (has admin cookie or referer)
    const hasAdminToken = request.cookies.has("payload-token");
    const referer = request.headers.get("referer") || "";
    if (hasAdminToken || referer.includes("/admin")) {
      return NextResponse.next();
    }

    // 3. Allow public customer table ordering and app download endpoints
    const isExempt = PUBLIC_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (isExempt) {
      return NextResponse.next();
    }

    // 4. Verify App Secret Key Header or Authenticated Bearer Token
    const secret =
      request.headers.get("x-app-secret") ||
      request.headers.get("x-app-key") ||
      request.headers.get("x-blackforest-key");

    const hasAppKey = Boolean(secret && VALID_APP_KEYS.has(secret));
    const hasBearer = Boolean(request.headers.get("authorization")?.startsWith("Bearer "));

    // Login endpoint ALWAYS strictly requires the App Key
    if (pathname === "/api/users/login" || pathname === "/api/v1/users/login") {
      if (!hasAppKey) {
        return NextResponse.json(
          {
            error: "Forbidden: Unauthorized application.",
            message: "Login is restricted to authorized Blackforest applications.",
          },
          {
            status: 403,
            headers: corsHeaders(request),
          }
        );
      }
    } else if (!hasAppKey && !hasBearer) {
      return NextResponse.json(
        {
          error: "Forbidden: Unauthorized application.",
          message: "This endpoint is restricted to authorized Blackforest applications.",
        },
        {
          status: 403,
          headers: corsHeaders(request),
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

