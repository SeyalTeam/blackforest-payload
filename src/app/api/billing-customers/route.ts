import { NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export const runtime = "nodejs";

function toTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = toTrimmedText(searchParams.get("branchId"));

    // Exclude branchId check for required filters
    const queryKeys = [...searchParams.keys()].filter((k) => k !== "branchId");
    if (!queryKeys.length) {
      return Response.json({ message: "Query filters are required" }, { status: 400 });
    }

    const limitParam = searchParams.get("limit");
    const depthParam = searchParams.get("depth");
    const pageParam = searchParams.get("page");

    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    const depth = depthParam ? parseInt(depthParam, 10) : 1;
    const page = pageParam ? parseInt(pageParam, 10) : 1;

    const where: any = {};
    const orConditions: any[] = [];

    for (const [key, value] of searchParams.entries()) {
      // 1. Check for where[or][index][field][operator]
      const orMatch = key.match(/^where\[or\]\[(\d+)\]\[([^\]]+)\]\[([^\]]+)\]$/);
      if (orMatch) {
        const index = parseInt(orMatch[1], 10);
        const fieldName = orMatch[2];
        const operator = orMatch[3];
        if (!orConditions[index]) {
          orConditions[index] = {};
        }
        orConditions[index][fieldName] = { [operator]: value };
        continue;
      }

      // 2. Check for where[field][operator]
      const simpleMatch = key.match(/^where\[([^\]]+)\]\[([^\]]+)\]$/);
      if (simpleMatch) {
        const fieldName = simpleMatch[1];
        const operator = simpleMatch[2];
        where[fieldName] = { [operator]: value };
      }
    }

    const cleanOrConditions = orConditions.filter(Boolean);
    if (cleanOrConditions.length > 0) {
      where.or = cleanOrConditions;
    }

    const payload = await getPayload({ config: configPromise });
    const results = await payload.find({
      collection: "billing-customers",
      where,
      limit,
      depth,
      page,
      overrideAccess: true,
    });

    return Response.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch customer details";
    return Response.json({ message }, { status: 500 });
  }
}
