import { NextRequest } from "next/server";
import { findBranchByCoordinates } from "@/lib/home-data";

function corsHeaders() {
  const origin = process.env.FRONTEND_URL || "http://localhost:3001";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

export async function GET(request: NextRequest) {
  try {
    const latitude = Number.parseFloat(request.nextUrl.searchParams.get("lat") ?? "");
    const longitude = Number.parseFloat(request.nextUrl.searchParams.get("lng") ?? "");
    const branchId = request.nextUrl.searchParams.get("branchId")?.trim() || undefined;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return Response.json(
        { message: "Latitude and longitude are required" },
        { status: 400, headers: corsHeaders() },
      );
    }

    const payload = await findBranchByCoordinates(latitude, longitude, branchId);
    return Response.json(payload, { headers: corsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve branch";
    console.error("branch-from-location failed", {
      message,
      lat: request.nextUrl.searchParams.get("lat"),
      lng: request.nextUrl.searchParams.get("lng"),
      branchId: request.nextUrl.searchParams.get("branchId"),
    });
    return Response.json({ message }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
