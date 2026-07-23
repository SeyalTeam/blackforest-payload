import { NextRequest } from "next/server";
import type { BillSummaryData, BillSummaryItem } from "@/lib/order-types";
import { resolveApiTokenForBranch } from "@/lib/api-token";

const NEXT_PUBLIC_SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000';
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

function parseItems(value: unknown, billCreatedAt: string): BillSummaryItem[] {
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
      const preparationTimeUpdatedAt =
        preparationTimeInfo.source === "billing-item"
          ? readText(
              item.preparingTimeUpdatedAt,
              item.preparationTimeUpdatedAt,
              item.updatedAt,
            )
          : "";

      const gst = toTrimmedText(item.gst) || toTrimmedText((product?.defaultPriceDetails as any)?.gst) || "";

      return {
        id: toTrimmedText(item.id) || toTrimmedText(product?.id) || crypto.randomUUID(),
        name: toTrimmedText(item.name) || toTrimmedText(product?.name) || "Unknown item",
        quantity: Math.max(1, toFiniteNumber(item.quantity) || 1),
        subtotal: toFiniteNumber(item.subtotal),
        status,
        isVeg: toBoolean(product?.isVeg),
        gst,
        preparationTime: preparationTimeInfo.minutes,
        preparationTimeSource: preparationTimeInfo.source,
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
    const customerPhone = request.nextUrl.searchParams.get("customerPhone")?.trim() || "";
    const branchToken = branchId ? resolveApiTokenForBranch(branchId) : "";

    if (!billId && branchId && (tableNumber || customerPhone)) {
      if (branchToken) {
        const lookupParams = new URLSearchParams({
          "where[branch][equals]": branchId,
          "where[status][in]": ACTIVE_BILL_STATUSES,
          "where[createdAt][greater_than_equal]": getIndiaDayStartIso(),
          sort: "-updatedAt",
          limit: "50",
          depth: "1",
        });

        const activeResponse = await fetch(`${API_BASE}/billings?${lookupParams.toString()}`, {
          headers: { Authorization: `Bearer ${branchToken}` },
          cache: "no-store",
        });

        if (activeResponse.ok) {
          const payload = (await activeResponse.json()) as { docs?: Array<Record<string, unknown>> };
          const docs = payload.docs ?? [];
          const cleanTable = tableNumber.toLowerCase();
          const cleanPhone = customerPhone.replace(/\D/g, "");

          const matchedDoc = docs.find((doc) => {
            const tableDetails = doc.tableDetails && typeof doc.tableDetails === "object" ? (doc.tableDetails as Record<string, unknown>) : null;
            const docTable = toTrimmedText(tableDetails?.tableNumber).toLowerCase();
            const customerDetails = (doc.customerDetails ?? doc.customer) && typeof (doc.customerDetails ?? doc.customer) === "object" ? ((doc.customerDetails ?? doc.customer) as Record<string, unknown>) : null;
            const docPhone = toTrimmedText(customerDetails?.phoneNumber).replace(/\D/g, "");

            if (cleanTable) {
              const baseDocTable = docTable.split("-")[0];
              const baseCleanTable = cleanTable.split("-")[0];
              if (docTable === cleanTable || baseDocTable === baseCleanTable) {
                return true;
              }
            }

            if (cleanPhone && docPhone && (docPhone.endsWith(cleanPhone) || cleanPhone.endsWith(docPhone))) {
              return true;
            }

            return false;
          });

          if (matchedDoc) {
            billId = toTrimmedText(matchedDoc.id);
          }
        }
      }
    }

    if (!billId) {
      return Response.json({ message: "Bill not found" }, { status: 404 });
    }

    const headers: HeadersInit = {};
    if (branchToken) {
      headers.Authorization = `Bearer ${branchToken}`;
    }

    const response = await fetch(`${API_BASE}/billings/${billId}?depth=1`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      return Response.json({ message: "Unable to load bill" }, { status: response.status });
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const branch =
      payload.branch && typeof payload.branch === "object" && !Array.isArray(payload.branch)
        ? (payload.branch as Record<string, unknown>)
        : null;
    const tableDetails =
      payload.tableDetails &&
      typeof payload.tableDetails === "object" &&
      !Array.isArray(payload.tableDetails)
        ? (payload.tableDetails as Record<string, unknown>)
        : null;

    const summary: BillSummaryData = {
      billId: toTrimmedText(payload.id) || billId,
      invoiceNumber: toTrimmedText(payload.invoiceNumber),
      createdAt: toTrimmedText(payload.createdAt),
      branchName: toTrimmedText(branch?.name) || "VSeyal",
      tableNumber: toTrimmedText(tableDetails?.tableNumber),
      section: toTrimmedText(tableDetails?.section),
      status: normalizeStatus(payload.status),
      totalAmount: toFiniteNumber(payload.totalAmount),
      paymentMethod: normalizePaymentMethod(payload.paymentMethod),
      items: parseItems(payload.items, toTrimmedText(payload.createdAt)),
    };

    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load bill";
    return Response.json({ message }, { status: 500 });
  }
}
