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
  "/api/widgets/app-key-settings",
  "/api/branches",
];

let cachedGatekeeper: {
  disabledBranchIds: Set<string>;
  disabledBranchPins: Set<string>;
  disabledBranchCodes: Set<string>;
  expiresAt: number;
} | null = null;

async function getExemptBranches(request: NextRequest): Promise<{
  disabledBranchIds: Set<string>;
  disabledBranchPins: Set<string>;
  disabledBranchCodes: Set<string>;
}> {
  const now = Date.now();
  if (cachedGatekeeper && cachedGatekeeper.expiresAt > now) {
    return cachedGatekeeper;
  }

  try {
    const url = new URL("/api/widgets/app-key-settings", request.url);
    const res = await fetch(url.toString(), {
      headers: { "x-internal-query": "true" },
    });
    if (res.ok) {
      const data = await res.json();
      cachedGatekeeper = {
        disabledBranchIds: new Set(
          (data.disabledBranchIds || []).map((id: string) => String(id).trim())
        ),
        disabledBranchPins: new Set(
          (data.disabledBranchPins || []).map((pin: string) => String(pin).trim())
        ),
        disabledBranchCodes: new Set(
          (data.disabledBranchCodes || []).map((code: string) =>
            String(code).trim().toLowerCase()
          )
        ),
        expiresAt: now + 5000,
      };
      return cachedGatekeeper;
    }
  } catch (_) {}

  return (
    cachedGatekeeper || {
      disabledBranchIds: new Set(),
      disabledBranchPins: new Set(),
      disabledBranchCodes: new Set(),
    }
  );
}

async function isRequestFromAppKeyExemptBranch(
  request: NextRequest,
  pathname: string
): Promise<boolean> {
  const { disabledBranchIds, disabledBranchPins, disabledBranchCodes } =
    await getExemptBranches(request);

  if (
    disabledBranchIds.size === 0 &&
    disabledBranchPins.size === 0 &&
    disabledBranchCodes.size === 0
  ) {
    return false;
  }

  // 1. Check direct branch headers
  const branchIdHeader =
    request.headers.get("x-branch-id") || request.headers.get("x-branch");
  if (branchIdHeader && disabledBranchIds.has(branchIdHeader.trim())) {
    return true;
  }

  const branchPinHeader =
    request.headers.get("x-branch-pin") || request.headers.get("x-branch-code");
  if (branchPinHeader) {
    const pin = branchPinHeader.trim();
    if (disabledBranchPins.has(pin) || disabledBranchCodes.has(pin.toLowerCase())) {
      return true;
    }
  }

  // 2. Check query params
  const branchParam =
    request.nextUrl.searchParams.get("where[branch][equals]") ||
    request.nextUrl.searchParams.get("branch") ||
    request.nextUrl.searchParams.get("branchId");
  if (branchParam && disabledBranchIds.has(branchParam.trim())) {
    return true;
  }

  // 3. For login requests, inspect JSON body
  if (pathname === "/api/users/login" || pathname === "/api/v1/users/login") {
    try {
      const body = await request.clone().json();
      if (body) {
        if (body.branchPin && disabledBranchPins.has(String(body.branchPin).trim())) {
          return true;
        }
        if (body.email) {
          const emailStr = String(body.email).trim().toLowerCase();
          const username = emailStr.includes("@") ? emailStr.split("@")[0] : emailStr;
          if (disabledBranchCodes.has(username) || disabledBranchCodes.has(emailStr)) {
            return true;
          }
        }
      }
    } catch (_) {}
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    // 1. Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    // 2. Allow Payload Admin panel internal / trusted admin requests
    const hasAdminToken = request.cookies.has("payload-token");
    const referer = request.headers.get("referer") || "";
    const origin = request.headers.get("origin") || "";

    const isTrustedAdminOrigin =
      origin.includes("theblackforestcakes.com") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1");

    const isTrustedAdminReferer =
      referer.includes("theblackforestcakes.com") ||
      referer.includes("/admin") ||
      referer.includes("localhost") ||
      referer.includes("127.0.0.1");

    const isPayloadInternalEndpoint =
      pathname.startsWith("/api/payload-preferences") ||
      pathname === "/api/users/me" ||
      pathname.startsWith("/api/users/me/") ||
      pathname.startsWith("/api/graphql") ||
      pathname.startsWith("/api/access");

    if (
      hasAdminToken ||
      isPayloadInternalEndpoint ||
      isTrustedAdminOrigin ||
      isTrustedAdminReferer
    ) {
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

    if (hasAppKey) {
      return NextResponse.next();
    }

    // Check if this branch has App Key enforcement disabled (Legacy Mode allowed)
    const isBranchExempt = await isRequestFromAppKeyExemptBranch(request, pathname);
    if (isBranchExempt) {
      return NextResponse.next();
    }

    // Login endpoint ALWAYS strictly requires the App Key unless branch is exempt
    if (pathname === "/api/users/login" || pathname === "/api/v1/users/login") {
      return NextResponse.json(
        {
          error: "Forbidden: Unauthorized application.",
          message:
            "Login is restricted to authorized Blackforest applications. Please provide a valid App Key or enable legacy mode for your branch in Widget Settings.",
        },
        {
          status: 403,
          headers: corsHeaders(request),
        }
      );
    } else if (!hasBearer) {
      return NextResponse.json(
        {
          error: "Forbidden: Unauthorized application.",
          message:
            "This endpoint is restricted to authorized Blackforest applications. Please provide a valid App Key or enable legacy mode for your branch in Widget Settings.",
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

