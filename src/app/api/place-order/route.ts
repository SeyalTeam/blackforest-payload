import { NextRequest } from "next/server";
import { resolveApiTokenForBranch } from "@/lib/api-token";
import { getPayload } from "payload";
import configPromise from "@payload-config";

const NEXT_PUBLIC_SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000';
const API_BASE = `${NEXT_PUBLIC_SERVER_URL}/api`;
const SHARED_TABLE_SECTION = "Shared Tables";
const ACTIVE_BILL_STATUSES = "pending,ordered,confirmed,prepared,delivered";

type IncomingOrderItem = {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  category?: string;
  categoryId?: string;
  department?: string;
  note?: string;
};

type BillingLookupResponse = {
  docs?: Array<Record<string, unknown>>;
};

type ProductMetadata = {
  categoryName: string;
  categoryId: string;
  department: string;
};

export const runtime = "nodejs";

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toFiniteInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractRefId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  const map = readRecord(value);
  if (!map) return "";

  return (
    toTrimmedText(map.id) ||
    toTrimmedText(map._id) ||
    toTrimmedText(map.value) ||
    toTrimmedText(map.product) ||
    toTrimmedText(map.$oid)
  );
}

function normalizePaymentMethod(value: unknown) {
  const normalized = toTrimmedText(value).toLowerCase();
  if (normalized === "cash" || normalized === "upi" || normalized === "card") {
    return normalized;
  }
  return "cash";
}

function parseTableNumberToken(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = Number.parseInt(trimmed, 10);
  if (Number.isFinite(direct)) {
    return direct;
  }

  const withoutPrefix = trimmed.replace(/^table[\s\-_:]*/i, "");
  const parsed = Number.parseInt(withoutPrefix, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const map =
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : null;
      if (!map) return null;
      return {
        name: toTrimmedText(map.name),
        tableCount: toFiniteInteger(map.tableCount),
      };
    })
    .filter(
      (section): section is { name: string; tableCount: number } => section !== null,
    );
}

function resolveLiveSectionsForTableNumber({
  tableNumber,
  tablesDocs,
  preferredSection,
}: {
  tableNumber: number;
  tablesDocs: Array<Record<string, unknown>>;
  preferredSection?: string;
}) {
  const sectionNames = new Set<string>();

  for (const root of tablesDocs ?? []) {
    const sections = parseSections(root.sections);
    for (const section of sections) {
      if (tableNumber > 0 && tableNumber <= section.tableCount && section.name) {
        sectionNames.add(section.name);
      }
    }
  }

  const orderedSections = Array.from(sectionNames);
  const normalizedPreferredSection = preferredSection?.trim().toLowerCase() ?? "";
  if (!normalizedPreferredSection) {
    return orderedSections;
  }

  return orderedSections.sort((left, right) => {
    const leftIsPreferred = left.toLowerCase() === normalizedPreferredSection;
    const rightIsPreferred = right.toLowerCase() === normalizedPreferredSection;
    if (leftIsPreferred === rightIsPreferred) {
      return 0;
    }
    return leftIsPreferred ? -1 : 1;
  });
}

function findAllocatedWaiter({
  tablesDocs,
  sectionName,
  tableNumber,
}: {
  tablesDocs: Array<Record<string, unknown>>;
  sectionName: string;
  tableNumber: string;
}): string | null {
  const normalizedSection = sectionName.trim().toLowerCase();
  const normalizedTable = tableNumber.trim();

  for (const doc of tablesDocs) {
    const sections = Array.isArray(doc.sections) ? doc.sections : [];
    for (const section of sections) {
      const secMap = section && typeof section === "object" ? (section as Record<string, unknown>) : null;
      if (!secMap) continue;

      const currentSecName = typeof secMap.name === "string" ? secMap.name.trim().toLowerCase() : "";
      if (currentSecName === normalizedSection) {
        const waiterAllocations = Array.isArray(secMap.waiterAllocations) ? secMap.waiterAllocations : [];
        for (const alloc of waiterAllocations) {
          const allocMap = alloc && typeof alloc === "object" ? (alloc as Record<string, unknown>) : null;
          if (!allocMap) continue;

          const tNum = typeof allocMap.tableNumber === "string"
            ? allocMap.tableNumber.trim()
            : typeof allocMap.tableNumber === "number"
              ? String(allocMap.tableNumber)
              : "";

          if (tNum === normalizedTable) {
            const waiterId = extractRefId(allocMap.waiter);
            if (waiterId) return waiterId;
          }
        }
      }
    }
  }
  return null;
}

function normalizeSectionKey(value: string) {
  return value.trim().toLowerCase();
}

async function findOccupiedSectionsForTable({
  tableNumber,
  branchId,
  token,
}: {
  tableNumber: string;
  branchId: string;
  token: string;
}) {
  const occupiedSections = new Set<string>();
  try {
    const payload = await getPayload({ config: configPromise });
    const activeBills = await payload.find({
      collection: "billings",
      where: {
        status: { in: ACTIVE_BILL_STATUSES.split(",") },
        createdAt: { greater_than_equal: getIndiaDayStartIso() },
        branch: { equals: branchId },
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    });

    for (const doc of activeBills.docs ?? []) {
      const tableDetails = readRecord((doc as any).tableDetails);
      if (toTrimmedText(tableDetails?.tableNumber) === tableNumber) {
        const sectionName = toTrimmedText(tableDetails?.section);
        if (sectionName) {
          occupiedSections.add(normalizeSectionKey(sectionName));
        }
      }
    }
    return occupiedSections;
  } catch {
    if (!token) return occupiedSections;
    const lookupParams = new URLSearchParams({
      "where[status][in]": ACTIVE_BILL_STATUSES,
      "where[createdAt][greater_than_equal]": getIndiaDayStartIso(),
      "where[branch][equals]": branchId,
      limit: "500",
      depth: "0",
    });

    const response = await fetch(`${API_BASE}/billings?${lookupParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return occupiedSections;

    const resPayload = (await response.json()) as BillingLookupResponse;
    for (const doc of resPayload.docs ?? []) {
      const tableDetails = readRecord(doc.tableDetails);
      if (toTrimmedText(tableDetails?.tableNumber) === tableNumber) {
        const sectionName = toTrimmedText(tableDetails?.section);
        if (sectionName) {
          occupiedSections.add(normalizeSectionKey(sectionName));
        }
      }
    }
    return occupiedSections;
  }
}

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

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseProductMetadata(rawProduct: Record<string, unknown>): ProductMetadata {
  const categoryMap = readRecord(rawProduct.category);
  const categoryName =
    toTrimmedText(rawProduct.categoryName) ||
    toTrimmedText(categoryMap?.name) ||
    toTrimmedText(rawProduct.category);
  const categoryId =
    toTrimmedText(rawProduct.categoryId) ||
    toTrimmedText(categoryMap?.id) ||
    toTrimmedText(categoryMap?._id);

  const departmentMap = readRecord(rawProduct.department);
  const department =
    toTrimmedText(rawProduct.department) ||
    toTrimmedText(departmentMap?.name) ||
    categoryName;

  return {
    categoryName,
    categoryId,
    department,
  };
}

async function fetchProductMetadataMap({
  items,
  token,
}: {
  items: IncomingOrderItem[];
  token: string;
}): Promise<Map<string, ProductMetadata>> {
  const ids = Array.from(
    new Set(
      items
        .map((item) => toTrimmedText(item.id))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (ids.length === 0) {
    return new Map<string, ProductMetadata>();
  }

  const params = new URLSearchParams({
    "where[id][in]": ids.join(","),
    limit: String(ids.length),
    depth: "1",
  });

  const response = await fetch(`${API_BASE}/products?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return new Map<string, ProductMetadata>();
  }

  const payload = (await response.json()) as {
    docs?: Array<Record<string, unknown>>;
  };
  const metadataById = new Map<string, ProductMetadata>();

  for (const product of payload.docs ?? []) {
    const productId = extractRefId(product.id ?? product._id ?? product.value);
    if (!productId) continue;
    metadataById.set(productId, parseProductMetadata(product));
  }

  return metadataById;
}

function mergeIncomingItemMetadata(
  item: IncomingOrderItem,
  metadata?: ProductMetadata,
): IncomingOrderItem {
  const category = toTrimmedText(item.category) || metadata?.categoryName || "";
  const categoryId =
    toTrimmedText(item.categoryId) || metadata?.categoryId || "";
  const department =
    toTrimmedText(item.department) || metadata?.department || category;

  return {
    ...item,
    category,
    categoryId,
    department,
  };
}

function billDocId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  const map = readRecord(value);
  if (!map) return "";

  return (
    toTrimmedText(map.id) ||
    toTrimmedText(map._id) ||
    toTrimmedText(map.$oid)
  );
}

async function readResponseMessage(response: Response) {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as {
      message?: string;
      errors?: Array<{ message?: string }>;
    };
    return parsed.message || parsed.errors?.[0]?.message || raw || "Request failed";
  } catch {
    return raw || "Request failed";
  }
}

function buildBillingItem(item: IncomingOrderItem) {
  const productId = toTrimmedText(item.id);
  const name = toTrimmedText(item.name);
  const quantity = Math.max(1, toFiniteNumber(item.quantity) || 1);
  const unitPrice = Math.max(0, toFiniteNumber(item.price));
  const categoryName = toTrimmedText(item.category);
  const categoryId = toTrimmedText(item.categoryId);
  const department = toTrimmedText(item.department) || categoryName;
  const note = toTrimmedText(item.note);

  if (!productId || !name) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {
    product: productId,
    name,
    quantity,
    unitPrice,
    subtotal: unitPrice * quantity,
    orderedAt: nowIso,
    orderedTime: nowIso,
  };

  if (department) {
    payload.department = department;
  }

  if (categoryName) {
    payload.categoryName = categoryName;
  }

  if (categoryId) {
    payload.categoryId = categoryId;
  }

  if (note) {
    payload.specialNote = note;
    payload.notes = note;
    payload.note = note;
    payload.instructions = note;
  }

  return payload;
}

function normalizeCustomerDetails(value: unknown) {
  const map =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (!map) {
    return null;
  }

  const name = toTrimmedText(map.name);
  const phoneNumber = toTrimmedText(map.phoneNumber);

  if (!name && !phoneNumber) {
    return null;
  }

  return {
    name,
    phoneNumber,
  };
}

function mergeCustomerDetails(
  existingValue: unknown,
  incomingDetails: { name?: string; phoneNumber?: string } | null,
) {
  const existingMap =
    existingValue && typeof existingValue === "object" && !Array.isArray(existingValue)
      ? (existingValue as Record<string, unknown>)
      : null;

  const existingName = toTrimmedText(existingMap?.name);
  const existingPhone = toTrimmedText(existingMap?.phoneNumber);

  const finalName = incomingDetails?.name?.trim() || existingName;
  const finalPhone = incomingDetails?.phoneNumber?.trim() || existingPhone;

  if (!finalName && !finalPhone) {
    return existingMap;
  }

  return {
    ...existingMap,
    name: finalName,
    phoneNumber: finalPhone,
  };
}

function mergeNotes(existingNotes: unknown, newNotes: string) {
  const currentNotes = toTrimmedText(existingNotes);
  const addition = toTrimmedText(newNotes);

  if (!currentNotes) return addition;
  if (!addition) return currentNotes;

  if (currentNotes.includes(addition)) {
    return currentNotes;
  }

  return `${currentNotes}, ${addition}`;
}

async function resolveTableTarget({
  tableNumberInput,
  branchId,
  tablesDocs,
  token,
  preferredSection,
}: {
  tableNumberInput: string;
  branchId: string;
  tablesDocs: Array<Record<string, unknown>>;
  token: string;
  preferredSection?: string;
}) {
  const tableNumber = tableNumberInput.trim();
  const parsedTable = parseTableNumberToken(tableNumberInput);
  if (parsedTable === null || !tableNumber) {
    return {
      tableNumber,
      section: SHARED_TABLE_SECTION,
      useShared: true,
    };
  }

  const liveSections = resolveLiveSectionsForTableNumber({
    tableNumber: parsedTable,
    tablesDocs,
    preferredSection,
  });
  if (liveSections.length === 0) {
    return {
      tableNumber,
      section: SHARED_TABLE_SECTION,
      useShared: true,
    };
  }

  const occupiedSections = await findOccupiedSectionsForTable({
    tableNumber,
    branchId,
    token,
  });

  if (preferredSection) {
    const normalizedPref = normalizeSectionKey(preferredSection);
    const matchedLive = liveSections.find(s => normalizeSectionKey(s) === normalizedPref);
    if (matchedLive) {
      if (occupiedSections.has(normalizedPref)) {
        return {
          tableNumber,
          section: SHARED_TABLE_SECTION,
          useShared: true,
        };
      }
      return {
        tableNumber,
        section: matchedLive,
        useShared: false,
      };
    }
  }

  for (const liveSection of liveSections) {
    if (!occupiedSections.has(normalizeSectionKey(liveSection))) {
      return {
        tableNumber,
        section: liveSection,
        useShared: false,
      };
    }
  }

  return {
    tableNumber,
    section: SHARED_TABLE_SECTION,
    useShared: true,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      billId?: string;
      branchId?: string;
      tableNumber?: string;
      preferredSection?: string;
      tableLocked?: boolean;
      customerDetails?: {
        name?: string;
        phoneNumber?: string;
      };
      items?: IncomingOrderItem[];
    };

    const billIdInput = toTrimmedText(body.billId);
    const branchId = toTrimmedText(body.branchId);
    const tableNumberInput = toTrimmedText(body.tableNumber);
    const preferredSection = toTrimmedText(body.preferredSection);
    const incomingCustomerDetails = normalizeCustomerDetails(body.customerDetails);
    const incomingItems = Array.isArray(body.items) ? body.items : [];

    if (!branchId) {
      return Response.json({ message: "Branch id is required" }, { status: 400 });
    }

    if (!tableNumberInput) {
      return Response.json({ message: "Table number is required" }, { status: 400 });
    }

    const payload = await getPayload({ config: configPromise });
    const token = resolveApiTokenForBranch(branchId) || "";

    const productMetadataById = new Map<string, ProductMetadata>();
    const requiresMetadataLookup = incomingItems.some((item) => {
      const category = toTrimmedText(item.category);
      const categoryId = toTrimmedText(item.categoryId);
      const department = toTrimmedText(item.department);
      return !category || !categoryId || !department;
    });

    if (requiresMetadataLookup) {
      const productIds = Array.from(
        new Set(incomingItems.map((item) => toTrimmedText(item.id)).filter((id): id is string => Boolean(id))),
      );
      if (productIds.length > 0) {
        try {
          const productsRes = await payload.find({
            collection: "products",
            where: {
              id: { in: productIds },
            },
            limit: productIds.length,
            depth: 1,
            overrideAccess: true,
          });
          for (const prod of productsRes.docs ?? []) {
            const p = prod as unknown as Record<string, unknown>;
            const pid = extractRefId(p.id ?? p._id);
            if (pid) {
              productMetadataById.set(pid, parseProductMetadata(p));
            }
          }
        } catch {
          if (token) {
            const map = await fetchProductMetadataMap({ items: incomingItems, token });
            for (const [k, v] of map.entries()) {
              productMetadataById.set(k, v);
            }
          }
        }
      }
    }

    const billingItems = incomingItems
      .map((item) =>
        mergeIncomingItemMetadata(
          item,
          productMetadataById.get(toTrimmedText(item.id)),
        ),
      )
      .map((item) => buildBillingItem(item))
      .filter((item): item is Record<string, unknown> => item !== null);

    if (billingItems.length === 0) {
      return Response.json({ message: "At least one valid item is required" }, { status: 400 });
    }

    let existingBill: Record<string, unknown> | null = null;

    if (billIdInput) {
      try {
        const doc = await payload.findByID({
          collection: "billings",
          id: billIdInput,
          depth: 0,
          overrideAccess: true,
        });
        if (doc) {
          existingBill = doc as unknown as Record<string, unknown>;
        }
      } catch (err) {
        console.warn("[place-order] Could not find bill by ID", billIdInput, err);
      }
    }

    if (!existingBill && incomingCustomerDetails?.phoneNumber) {
      try {
        const lookup = await payload.find({
          collection: "billings",
          where: {
            status: { in: ACTIVE_BILL_STATUSES.split(",") },
            "customerDetails.phoneNumber": { equals: incomingCustomerDetails.phoneNumber.trim() },
            branch: { equals: branchId.trim() },
            createdAt: { greater_than_equal: getIndiaDayStartIso() },
          },
          limit: 1,
          sort: "-updatedAt",
          depth: 0,
          overrideAccess: true,
        });
        if (lookup.docs && lookup.docs.length > 0) {
          existingBill = lookup.docs[0] as unknown as Record<string, unknown>;
        }
      } catch (err) {
        console.warn("[place-order] Could not lookup bill by phone", err);
      }
    }

    let tablesDocs: Array<Record<string, unknown>> = [];
    try {
      const tablesRes = await payload.find({
        collection: "tables",
        where: {
          branch: { equals: branchId.trim() },
        },
        limit: 100,
        depth: 1,
        overrideAccess: true,
      });
      tablesDocs = (tablesRes.docs ?? []) as unknown as Array<Record<string, unknown>>;
    } catch (err) {
      console.warn("[place-order] Could not fetch tables via payload", err);
    }

    let resolvedTarget:
      | {
          tableNumber: string;
          section: string;
          useShared: boolean;
        }
      | undefined;

    if (existingBill) {
      const tableDetails = readRecord(existingBill.tableDetails);
      resolvedTarget = {
        tableNumber: toTrimmedText(tableDetails?.tableNumber) || tableNumberInput,
        section: toTrimmedText(tableDetails?.section) || preferredSection || SHARED_TABLE_SECTION,
        useShared: false,
      };
    } else {
      resolvedTarget = await resolveTableTarget({
        tableNumberInput,
        branchId,
        tablesDocs,
        token,
        preferredSection,
      });
    }

    let waiterId: string | null = null;
    if (!existingBill && tablesDocs.length > 0 && resolvedTarget) {
      waiterId = findAllocatedWaiter({
        tablesDocs,
        sectionName: resolvedTarget.section,
        tableNumber: resolvedTarget.tableNumber,
      });
    }

    let tableNumber = resolvedTarget.tableNumber;
    const sectionName = resolvedTarget.section;

    if (sectionName === SHARED_TABLE_SECTION && !tableNumber.includes("-")) {
      const ms = Date.now().toString();
      tableNumber = `${tableNumber}-${ms.slice(-3)}`;
    }

    const newTotalAmount = billingItems.reduce(
      (sum, item) => sum + toFiniteNumber(item.subtotal),
      0,
    );
    const newNotes = billingItems
      .map((item) => {
        const note = toTrimmedText(item.specialNote);
        const name = toTrimmedText(item.name);
        return note && name ? `${name}: ${note}` : "";
      })
      .filter(Boolean)
      .join(", ");

    const existingId = toTrimmedText(existingBill?.id);
    const existingItems = Array.isArray(existingBill?.items)
      ? (existingBill.items as Record<string, unknown>[])
      : [];

    const payloadData: Record<string, unknown> = {
      branch: branchId,
      items: existingItems.concat(billingItems),
      totalAmount: toFiniteNumber(existingBill?.totalAmount) + newTotalAmount,
      customerDetails: mergeCustomerDetails(
        existingBill?.customerDetails,
        incomingCustomerDetails,
      ),
      paymentMethod: normalizePaymentMethod(existingBill?.paymentMethod),
      applyCustomerOffer: existingBill?.applyCustomerOffer === true,
      status: toTrimmedText(existingBill?.status) || "pending",
      tableDetails: {
        section: sectionName,
        tableNumber,
      },
      isQrOrder: true,
    };

    if (!existingId && waiterId) {
      payloadData.createdBy = waiterId;
    }

    const mergedNotes = mergeNotes(existingBill?.notes, newNotes);
    if (mergedNotes) {
      payloadData.notes = mergedNotes;
    }

    const companyId = toTrimmedText(existingBill?.company);
    if (companyId) {
      payloadData.company = companyId;
    }

    let writeDoc: Record<string, unknown>;
    try {
      if (existingId) {
        const updated = await payload.update({
          collection: "billings",
          id: existingId,
          data: payloadData as any,
          overrideAccess: true,
        });
        writeDoc = updated as unknown as Record<string, unknown>;
      } else {
        const created = await payload.create({
          collection: "billings",
          data: payloadData as any,
          overrideAccess: true,
        });
        writeDoc = created as unknown as Record<string, unknown>;
      }
    } catch (err) {
      console.error("[place-order] Payload create/update error", err);
      if (token) {
        const writeUrl = existingId
          ? `${API_BASE}/billings/${existingId}?depth=0`
          : `${API_BASE}/billings?depth=0`;
        const writeResponse = await fetch(writeUrl, {
          method: existingId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payloadData),
          cache: "no-store",
        });

        if (!writeResponse.ok) {
          const message = await readResponseMessage(writeResponse);
          return Response.json({ message }, { status: writeResponse.status });
        }

        const writePayload = (await writeResponse.json()) as Record<string, unknown>;
        writeDoc = readRecord(writePayload.doc) ?? writePayload;
      } else {
        throw err;
      }
    }

    return Response.json({
      ok: true,
      billId:
        billDocId(writeDoc.id) ||
        billDocId(writeDoc._id) ||
        billDocId(writeDoc.doc) ||
        existingId,
      invoiceNumber: toTrimmedText(writeDoc.invoiceNumber),
      merged: Boolean(existingId),
      tableNumber,
      section: sectionName,
      useShared: resolvedTarget.useShared,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to place order";
    return Response.json({ message }, { status: 500 });
  }
}
