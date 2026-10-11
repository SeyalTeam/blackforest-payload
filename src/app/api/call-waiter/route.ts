import { NextRequest } from "next/server";
import { resolveApiTokenForBranch } from "@/lib/api-token";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { callWaiterHandler } from "@/endpoints/callWaiter";
import { corsHeaders } from "@/utilities/cors";

function toTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = (await request.json()) as unknown;
    const body = toPayload(rawBody);

    const branchId = toTrimmedText(body?.branchId);
    if (!branchId) {
      return Response.json(
        { ok: false, message: "Branch id is required" },
        { status: 400, headers: corsHeaders(request, "POST,OPTIONS") },
      );
    }

    const token = resolveApiTokenForBranch(branchId);
    if (!token) {
      return Response.json(
        {
          ok: false,
          message:
            "Waiter call is not enabled yet. Add BLACKFOREST_BRANCH_API_TOKENS or BLACKFOREST_API_TOKEN in so the website can alert billing.",
        },
        { status: 503, headers: corsHeaders(request, "POST,OPTIONS") },
      );
    }

    const payload = await getPayload({ config: configPromise });

    // Mock PayloadRequest properties expected by callWaiterHandler
    const payloadReq = request as any;
    payloadReq.payload = payload;
    payloadReq.json = async () => body;

    const response = await callWaiterHandler(payloadReq);
    // Add CORS headers to the response from the handler
    const corsHead = corsHeaders(request, "POST,OPTIONS");
    for (const [key, value] of Object.entries(corsHead)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to call waiter";
    return Response.json({ ok: false, message }, { status: 500, headers: corsHeaders(request, "POST,OPTIONS") });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request, "POST,OPTIONS") });
}
