import { NextRequest } from "next/server";
import { getCategoriesPageData } from "@/lib/home-data";

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
    const branchId = request.nextUrl.searchParams.get("branchId")?.trim() || undefined;
    const payload = await getCategoriesPageData(branchId);
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        ...corsHeaders(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load categories page data";
    return Response.json(
      { message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          ...corsHeaders(),
        },
      },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
