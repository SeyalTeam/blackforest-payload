import { NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export const runtime = "nodejs";

async function resolveBranchId(payload: any, branchRef?: string, branchName?: string): Promise<string | undefined> {
  try {
    if (branchRef && /^[0-9a-fA-F]{24}$/.test(branchRef)) {
      const exists = await payload.findByID({
        collection: "branches",
        id: branchRef,
        overrideAccess: true,
      });
      if (exists) return branchRef;
    }

    const searchName = (branchName || branchRef || "").trim();
    if (!searchName) return undefined;

    // Search branches by name
    const branchQuery = await payload.find({
      collection: "branches",
      where: {
        name: {
          contains: searchName.split(" ")[0], // Match first word or key prefix
        },
      },
      limit: 10,
      overrideAccess: true,
    });

    if (branchQuery.docs.length > 0) {
      // Find closest match
      const lowerSearch = searchName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const exact = branchQuery.docs.find((b: any) => {
        const cleanName = (b.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return cleanName.includes(lowerSearch) || lowerSearch.includes(cleanName);
      });
      return exact ? String(exact.id) : String(branchQuery.docs[0].id);
    }
  } catch (err) {
    console.warn("[CakeSync] Could not resolve branch:", branchRef, branchName, err);
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });
    const body = await request.json();
    const action = body.action || "create";

    if (action === "update-status") {
      const { legacyOrderId, kotNumber, orderStatus } = body;
      const where: any = {};
      if (legacyOrderId) where.legacyOrderId = { equals: String(legacyOrderId) };
      else if (kotNumber) where.kotNumber = { equals: String(kotNumber) };
      else return Response.json({ message: "Missing identifier" }, { status: 400 });

      const found = await payload.find({
        collection: "cakes",
        where,
        limit: 1,
        overrideAccess: true,
      });

      if (!found.docs.length) {
        return Response.json({ message: "Cake order not found in Payload" }, { status: 404 });
      }

      const updated = await payload.update({
        collection: "cakes",
        id: found.docs[0].id,
        data: { orderStatus },
        overrideAccess: true,
      });

      return Response.json({ success: true, id: updated.id, orderStatus: updated.orderStatus });
    }

    if (action === "update-balance") {
      const { legacyOrderId, kotNumber, paymentAmount, pendingAmount, status } = body;
      const where: any = {};
      if (legacyOrderId) where.legacyOrderId = { equals: String(legacyOrderId) };
      else if (kotNumber) where.kotNumber = { equals: String(kotNumber) };
      else return Response.json({ message: "Missing identifier" }, { status: 400 });

      const found = await payload.find({
        collection: "cakes",
        where,
        limit: 1,
        overrideAccess: true,
      });

      if (!found.docs.length) {
        return Response.json({ message: "Cake order not found in Payload" }, { status: 404 });
      }

      const updateData: any = {};
      if (typeof paymentAmount !== "undefined") updateData.paymentAmount = Number(paymentAmount);
      if (typeof pendingAmount !== "undefined") updateData.pendingAmount = Number(pendingAmount);
      if (typeof status !== "undefined") updateData.status = status;

      const updated = await payload.update({
        collection: "cakes",
        id: found.docs[0].id,
        data: updateData,
        overrideAccess: true,
      });

      return Response.json({ success: true, id: updated.id, status: updated.status, pendingAmount: updated.pendingAmount });
    }

    if (action === "update-document") {
      const { legacyOrderId, kotNumber, orderDoc } = body;
      const where: any = {};
      if (legacyOrderId) where.legacyOrderId = { equals: String(legacyOrderId) };
      else if (kotNumber) where.kotNumber = { equals: String(kotNumber) };
      else return Response.json({ message: "Missing identifier" }, { status: 400 });

      const found = await payload.find({
        collection: "cakes",
        where,
        limit: 1,
        overrideAccess: true,
      });

      if (!found.docs.length) {
        return Response.json({ message: "Cake order not found in Payload" }, { status: 404 });
      }

      const updated = await payload.update({
        collection: "cakes",
        id: found.docs[0].id,
        data: { orderDoc: String(orderDoc || "") },
        overrideAccess: true,
      });

      return Response.json({ success: true, id: updated.id, orderDoc: updated.orderDoc });
    }

    // Default: create or upsert
    const kotNumber = String(body.kotNumber || Date.now());
    const existing = await payload.find({
      collection: "cakes",
      where: {
        or: [
          { kotNumber: { equals: kotNumber } },
          ...(body.legacyOrderId ? [{ legacyOrderId: { equals: String(body.legacyOrderId) } }] : []),
        ],
      },
      limit: 1,
      overrideAccess: true,
    });

    const resolvedBranch = await resolveBranchId(payload, body.branch, body.branchName);

    const cakePrice = Number(body.cakePrice) || 0;
    const paymentAmount = Number(body.paymentAmount) || 0;
    const pendingAmount = typeof body.pendingAmount !== "undefined"
      ? Number(body.pendingAmount)
      : Math.max(0, cakePrice - paymentAmount);
    const paymentStatus = body.status || (pendingAmount <= 0 ? "paid" : "pending");

    const cakeData: any = {
      kotNumber,
      legacyOrderId: body.legacyOrderId ? String(body.legacyOrderId) : undefined,
      branch: resolvedBranch || undefined,
      customerName: body.customerName || "",
      customerPhone: body.customerPhone || "",
      customerEmail: body.customerEmail || "",
      deliveryAddress: body.deliveryAddress || "",
      cakePrice,
      paymentAmount,
      pendingAmount,
      paymentMethod: body.paymentMethod || "cash",
      paymentType: body.paymentType || (pendingAmount <= 0 ? "full" : "advance"),
      status: paymentStatus,
      orderStatus: body.orderStatus || "pending",
      deliveryDate: body.deliveryDate ? new Date(body.deliveryDate).toISOString() : new Date().toISOString(),
      flavour: body.flavour || "",
      weight: body.weight || "",
      creamType: body.creamType || "",
      cakeModel: body.cakeModel || "",
      alteration: body.alteration || "",
      wordings: body.wordings || "",
      specialCare: body.specialCare || "",
      deliveryType: body.deliveryType || "shop",
      orderDoc: body.orderDoc || "",
      cashierId: body.cashierId ? String(body.cashierId) : undefined,
      cashierName: body.cashierName || undefined,
    };

    let resultDoc: any;
    if (existing.docs.length > 0) {
      resultDoc = await payload.update({
        collection: "cakes",
        id: existing.docs[0].id,
        data: cakeData,
        overrideAccess: true,
      });
      console.log(`[CakeSync] Updated existing cake order ${kotNumber} (id: ${resultDoc.id})`);
    } else {
      resultDoc = await payload.create({
        collection: "cakes",
        data: cakeData,
        overrideAccess: true,
      });
      console.log(`[CakeSync] Created new cake order ${kotNumber} (id: ${resultDoc.id})`);
    }

    return Response.json({
      success: true,
      id: resultDoc.id,
      kotNumber: resultDoc.kotNumber,
      action: existing.docs.length > 0 ? "updated" : "created",
    });
  } catch (error: any) {
    console.error("[CakeSync] Error processing cake sync:", error);
    return Response.json({ message: error.message || "Error processing cake sync" }, { status: 500 });
  }
}
