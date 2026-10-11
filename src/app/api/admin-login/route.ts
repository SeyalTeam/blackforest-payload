import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ADMIN_TOKEN_KEY } from "@/components/frontend/branch-session";
import {
  API_BASE,
  fetchCurrentUser,
  readResponseMessage,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

function corsHeaders() {
  const origin = process.env.FRONTEND_URL || "http://localhost:3001";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

function toTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      email?: string;
      password?: string;
    };
    const usernameOrEmail = toTrimmedText(body.username || body.email).toLowerCase();
    const password = toTrimmedText(body.password);

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { message: "Enter username/email and password." },
        { status: 400, headers: corsHeaders() },
      );
    }

    const loginResponse = await fetch(`${API_BASE}/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: usernameOrEmail,
        password,
      }),
      cache: "no-store",
    });

    if (!loginResponse.ok) {
      return NextResponse.json(
        { message: await readResponseMessage(loginResponse) },
        { status: loginResponse.status, headers: corsHeaders() },
      );
    }

    const loginPayload = (await loginResponse.json()) as {
      token?: string;
      data?: {
        token?: string;
      };
    };
    const sessionToken = toTrimmedText(loginPayload.token || loginPayload.data?.token);
    if (!sessionToken) {
      return NextResponse.json(
        { message: "Login succeeded but token was missing." },
        { status: 500, headers: corsHeaders() },
      );
    }

    const me = await fetchCurrentUser(sessionToken);
    if (!me.ok || !me.isSuperAdmin) {
      return NextResponse.json(
        { message: "Only superadmin is allowed for admin mode." },
        { status: 403, headers: corsHeaders() },
      );
    }

    const response = NextResponse.json(
      { ok: true, token: sessionToken },
      { headers: corsHeaders() },
    );
    response.cookies.set({
      name: COOKIE_ADMIN_TOKEN_KEY,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to login";
    return NextResponse.json({ message }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
