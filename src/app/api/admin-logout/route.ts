import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ADMIN_TOKEN_KEY } from "@/components/frontend/branch-session";
import { corsHeaders } from "@/utilities/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true }, { headers: corsHeaders(request, "POST,OPTIONS") });
  response.cookies.set({
    name: COOKIE_ADMIN_TOKEN_KEY,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request, "POST,OPTIONS") });
}
