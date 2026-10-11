import { NextRequest } from "next/server";
import { getProductsPageData } from "@/lib/home-data";

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
    const categoryId = request.nextUrl.searchParams.get("categoryId")?.trim() || "";
    const categoryName = request.nextUrl.searchParams.get("categoryName")?.trim() || undefined;

    if (!categoryId) {
      return Response.json(
        { message: "Category id is required" },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
            ...corsHeaders(),
          },
        },
      );
    }

    const payload = await getProductsPageData(categoryId, branchId, categoryName);
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=20, stale-while-revalidate=120",
        ...corsHeaders(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load products page data";
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
