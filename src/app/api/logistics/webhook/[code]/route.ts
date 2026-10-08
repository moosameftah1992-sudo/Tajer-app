import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { shippingProviders, shipments, orders, logisticsEvents } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, string | null> = {
  created: null,
  accepted: "processing",
  picked_up: "out_for_delivery",
  in_transit: "out_for_delivery",
  out_for_delivery: "out_for_delivery",
  delivered: "fulfilled",
  completed: "fulfilled",
  cancelled: null,
  returned: null,
  failed: null,
};

function safeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const [provider] = await db.select().from(shippingProviders).where(and(eq(shippingProviders.code, code), eq(shippingProviders.active, true))).limit(1);
  if (!provider) return NextResponse.json({ ok: false, error: "unknown_provider" }, { status: 404 });

  const raw = await req.text();
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const headerSecret = req.headers.get("x-tajer-secret") ?? req.headers.get("x-api-key") ?? "";
  const signature = req.headers.get("x-tajer-signature") ?? req.headers.get("x-signature") ?? "";
  const expectedSig = createHmac("sha256", provider.inboundSecret).update(raw).digest("hex");
  const authorized = safeEq(bearer, provider.inboundSecret) || safeEq(headerSecret, provider.inboundSecret) || (signature !== "" && safeEq(signature.toLowerCase(), expectedSig));
  if (!authorized) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = body[k];
      if (typeof v === "string" && v) return v;
      if (typeof v === "number") return String(v);
    }
    return "";
  };
  const tracking = pick("tracking_number", "trackingNumber", "tracking", "awb", "waybill", "shipment_id", "shipmentId");
  const reference = pick("reference", "order_number", "orderNumber");
  const status = pick("status", "event", "state").toLowerCase().replace(/[\s-]+/g, "_");

  let shipment = tracking ? (await db.select().from(shipments).where(eq(shipments.trackingNumber, tracking)).orderBy(desc(shipments.id)).limit(1))[0] : undefined;
  let order = shipment ? (await db.select().from(orders).where(and(eq(orders.id, shipment.orderId), eq(orders.tenantId, shipment.tenantId))).limit(1))[0] : undefined;
  if (!order && reference) {
    order = (await db.select().from(orders).where(and(eq(orders.orderNumber, reference), eq(orders.shippingProviderId, provider.id))).limit(1))[0];
    if (order && !shipment) shipment = (await db.select().from(shipments).where(and(eq(shipments.orderId, order.id), eq(shipments.tenantId, order.tenantId))).orderBy(desc(shipments.id)).limit(1))[0];
  }

  await db.insert(logisticsEvents).values({ providerId: provider.id, tenantId: order?.tenantId ?? null, orderId: order?.id ?? null, tracking: tracking || shipment?.trackingNumber || "", event: status || "update", payload: body });
  if (!order) return NextResponse.json({ ok: true, matched: false });

  const nextOrderStatus = STATUS_MAP[status] ?? null;
  await db.transaction(async (tx) => {
    if (shipment) await tx.update(shipments).set({ status: status || shipment.status, responsePayload: body, updatedAt: new Date() }).where(eq(shipments.id, shipment.id));
    const patch: Partial<typeof orders.$inferInsert> = { shippingStatus: status || order.shippingStatus, updatedAt: new Date() };
    if (nextOrderStatus && order.status !== "cancelled" && order.status !== "fulfilled") patch.status = nextOrderStatus;
    if (status === "delivered" && order.paymentMethod === "cash") patch.paymentStatus = "paid";
    await tx.update(orders).set(patch).where(and(eq(orders.id, order.id), eq(orders.tenantId, order.tenantId)));
  });
  return NextResponse.json({ ok: true, matched: true, order: order.orderNumber, status: nextOrderStatus ?? order.status });
}
