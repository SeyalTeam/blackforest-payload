import { NextRequest } from "next/server";
import type { BillSummaryData, BillSummaryItem } from "@/lib/order-types";
import { resolveApiTokenForBranch } from "@/lib/api-token";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { getPublicServerURL } from "@/utilities/serverUrl";

const NEXT_PUBLIC_SERVER_URL = getPublicServerURL();
const API_BASE = `${NEXT_PUBLIC_SERVER_URL}/api`;
const ACTIVE_BILL_STATUSES = "pending,ordered,confirmed,prepared,delivered";

function getIndiaDayStartIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return new Date(`${year}-${month}-${day}T00:00:00+05:30`).toISOString();
}

function toTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["true", "1", "yes"].includes(value.trim().toLowerCase());
  }
  return false;
}

function readText(...values: unknown[]) {
  for (const value of values) {
    const text = toTrimmedText(value);
    if (text) {
      return text;
    }
  }
  return "";
}

function toPreparationMinutes(value: unknown) {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) {
      return Number.parseInt(normalized, 10);
    }
  }

  return null;
}

function resolvePreparationMinutes(
  item: Record<string, unknown>,
  product: Record<string, unknown> | null,
) {
  const itemPreparingTime = toPreparationMinutes(item.preparingTime);
  if (itemPreparingTime !== null) {
    return {
      minutes: itemPreparingTime,
      source: "billing-item" as const,
    };
  }

  const itemPreparationTime = toPreparationMinutes(item.preparationTime);
  if (itemPreparationTime !== null) {
    return {
      minutes: itemPreparationTime,
      source: "billing-item" as const,
    };
  }

  const productPreparingTime = toPreparationMinutes(product?.preparingTime);
  if (productPreparingTime !== null) {
    return {
      minutes: productPreparingTime,
      source: "product-default" as const,
    };
  }

  const productPreparationTime = toPreparationMinutes(product?.preparationTime);
  if (productPreparationTime !== null) {
    return {
      minutes: productPreparationTime,
      source: "product-default" as const,
    };
  }

  return {
    minutes: null,
    source: "none" as const,
  };
}

function normalizeStatus(value: unknown) {
  const normalized = toTrimmedText(value).toLowerCase();
  return normalized || "ordered";
}

function normalizePaymentMethod(value: unknown) {
  const normalized = toTrimmedText(value).toLowerCase();
  if (normalized === "cash" || normalized === "upi" || normalized === "card") {
    return normalized;
  }
  return "cash";
}

function parseItems(
  value: unknown,
  billCreatedAt: string,
  productPrepMap?: Map<string, number>,
): BillSummaryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const item =
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : null;
      if (!item) return null;

      const product =
        item.product && typeof item.product === "object" && !Array.isArray(item.product)
          ? (item.product as Record<string, unknown>)
          : null;
      const productId = toTrimmedText(item.product) || toTrimmedText(product?.id) || toTrimmedText(product?._id);
      const status = normalizeStatus(item.status);
      const orderedAt = readText(
        item.orderedAt,
        item.orderedTime,
        item.createdAt,
        billCreatedAt,
      );
      const preparedAt = readText(
        item.preparedAt,
        item.preparedTime,
        item.updatedAt,
      );
      const preparationTimeInfo = resolvePreparationMinutes(item, product);
      const fallbackProductPrep = productId && productPrepMap ? productPrepMap.get(productId) ?? null : null;
      const resolvedMinutes = preparationTimeInfo.minutes ?? fallbackProductPrep;
      const preparationTimeSource = preparationTimeInfo.minutes !== null
        ? preparationTimeInfo.source
        : fallbackProductPrep !== null
          ? "product-default"
          : "none";

      const preparationTimeUpdatedAt =
        preparationTimeSource === "billing-item"
          ? readText(
              item.preparingTimeUpdatedAt,
              item.preparationTimeUpdatedAt,
              item.updatedAt,
            )
          : "";

      const gst = toTrimmedText(item.gst) || toTrimmedText((product?.defaultPriceDetails as any)?.gst) || "";

      return {
        id: toTrimmedText(item.id) || productId || crypto.randomUUID(),
        name: toTrimmedText(item.name) || toTrimmedText(product?.name) || "Unknown item",
        quantity: Math.max(1, toFiniteNumber(item.quantity) || 1),
        subtotal: toFiniteNumber(item.subtotal),
        status,
        isVeg: toBoolean(product?.isVeg),
        gst,
        preparationTime: resolvedMinutes,
        preparationTimeSource,
        preparationTimeUpdatedAt,
        orderedAt,
        preparedAt,
      } as BillSummaryItem;
    })
    .filter((item): item is BillSummaryItem => item !== null);
}

export async function GET(request: NextRequest) {
  try {
    let billId = request.nextUrl.searchParams.get("billId")?.trim() || "";
    const branchId = request.nextUrl.searchParams.get("branchId")?.trim() || "";
    const tableNumber = request.nextUrl.searchParams.get("tableNumber")?.trim() || "";
    const section = request.nextUrl.searchParams.get("section")?.trim() || "";
    const customerPhone = request.nextUrl.searchParams.get("customerPhone")?.trim() || "";

    const payload = await getPayload({ config: configPromise });

    if (!billId && branchId && (tableNumber || customerPhone)) {
      try {
        const activeRes = await payload.find({
          collection: "billings",
          where: {
            branch: { equals: branchId },
            status: { in: ACTIVE_BILL_STATUSES.split(",") },
            createdAt: { greater_than_equal: getIndiaDayStartIso() },
          },
          sort: "-updatedAt",
          limit: 50,
          depth: 1,
          overrideAccess: true,
        });

        const docs = activeRes.docs ?? [];
        const cleanTable = tableNumber.toLowerCase();
        const cleanSection = section.toLowerCase();
        const cleanPhone = customerPhone.replace(/\D/g, "");

        const matchedDoc = docs.find((doc: any) => {
          const tableDetails = doc.tableDetails && typeof doc.tableDetails === "object" ? doc.tableDetails : null;
          const docTable = toTrimmedText(tableDetails?.tableNumber).toLowerCase();
          const docSection = toTrimmedText(tableDetails?.section || doc.section).toLowerCase();
          const customerDetails = (doc.customerDetails ?? doc.customer) && typeof (doc.customerDetails ?? doc.customer) === "object" ? (doc.customerDetails ?? doc.customer) : null;
          const docPhone = toTrimmedText(customerDetails?.phoneNumber).replace(/\D/g, "");

          if (cleanTable) {
            const baseDocTable = docTable.split("-")[0];
            const baseCleanTable = cleanTable.split("-")[0];
            const isTableEqual = docTable === cleanTable || baseDocTable === baseCleanTable;
            if (isTableEqual) {
              if (cleanSection && docSection && cleanSection !== docSection) {
                return false;
              }
              return true;
            }
          }

          if (cleanPhone && docPhone && (docPhone.endsWith(cleanPhone) || cleanPhone.endsWith(docPhone))) {
            if (cleanSection && docSection && cleanSection !== docSection) {
              return false;
            }
            return true;
          }

          return false;
        });

        if (matchedDoc) {
          billId = toTrimmedText(matchedDoc.id);
        }
      } catch (err) {
        console.warn("[bill-summary] Active bill lookup error", err);
      }
    }

    if (!billId) {
      return Response.json({ message: "Bill not found" }, { status: 404 });
    }

    let payloadDoc: Record<string, unknown> | null = null;
    try {
      const doc = await payload.findByID({
        collection: "billings",
        id: billId,
        depth: 1,
        overrideAccess: true,
      });
      if (doc) {
        payloadDoc = doc as unknown as Record<string, unknown>;
      }
    } catch (err) {
      console.warn("[bill-summary] Find by ID error", err);
    }

    if (!payloadDoc) {
      const token = resolveApiTokenForBranch(branchId);
      const response = await fetch(`${API_BASE}/billings/${billId}?depth=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!response.ok) {
        return Response.json({ message: "Unable to load bill" }, { status: response.status });
      }
      payloadDoc = (await response.json()) as Record<string, unknown>;
    }

    const branch =
      payloadDoc.branch && typeof payloadDoc.branch === "object" && !Array.isArray(payloadDoc.branch)
        ? (payloadDoc.branch as Record<string, unknown>)
        : null;
    const resolvedBranchId = branchId || toTrimmedText(branch?.id) || toTrimmedText(branch?._id) || "";
    const tableDetails =
      payloadDoc.tableDetails &&
      typeof payloadDoc.tableDetails === "object" &&
      !Array.isArray(payloadDoc.tableDetails)
        ? (payloadDoc.tableDetails as Record<string, unknown>)
        : null;

    const rawItems = Array.isArray(payloadDoc.items) ? payloadDoc.items : [];
    const missingProductIds = Array.from(
      new Set(
        rawItems
          .map((entry) => {
            const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
            if (!item) return null;
            const hasItemPrep =
              toPreparationMinutes(item.preparingTime) !== null ||
              toPreparationMinutes(item.preparationTime) !== null;
            if (hasItemPrep) return null;
            const prod = item.product;
            if (typeof prod === "string" && prod.trim()) return prod.trim();
            if (prod && typeof prod === "object") {
              const pObj = prod as Record<string, unknown>;
              if (
                toPreparationMinutes(pObj.preparationTime) !== null ||
                toPreparationMinutes(pObj.preparingTime) !== null
              ) {
                return null;
              }
              return toTrimmedText(pObj.id) || toTrimmedText(pObj._id);
            }
            return null;
          })
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const productPrepMap = new Map<string, number>();
    if (missingProductIds.length > 0 && resolvedBranchId) {
      try {
        const prodRes = await payload.find({
          collection: "products",
          where: {
            id: { in: missingProductIds },
          },
          limit: missingProductIds.length,
          depth: 0,
          overrideAccess: true,
        });
        for (const doc of prodRes.docs ?? []) {
          const pObj = doc as unknown as Record<string, unknown>;
          const pid = toTrimmedText(pObj.id) || toTrimmedText(pObj._id);
          const prepTime =
            toPreparationMinutes(pObj.preparationTime) ??
            toPreparationMinutes(pObj.preparingTime);
          if (pid && prepTime !== null) {
            productPrepMap.set(pid, prepTime);
          }
        }
      } catch (err) {
        console.warn("[bill-summary] Product prep map lookup error", err);
      }
    }

    const summary: BillSummaryData = {
      billId: toTrimmedText(payloadDoc.id) || billId,
      invoiceNumber: toTrimmedText(payloadDoc.invoiceNumber),
      createdAt: toTrimmedText(payloadDoc.createdAt),
      branchName: toTrimmedText(branch?.name) || "VSeyal",
      tableNumber: toTrimmedText(tableDetails?.tableNumber),
      section: toTrimmedText(tableDetails?.section),
      status: normalizeStatus(payloadDoc.status),
      totalAmount: toFiniteNumber(payloadDoc.totalAmount),
      paymentMethod: normalizePaymentMethod(payloadDoc.paymentMethod),
      items: parseItems(payloadDoc.items, toTrimmedText(payloadDoc.createdAt), productPrepMap),
    };

    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load bill";
    return Response.json({ message }, { status: 500 });
  }
}
